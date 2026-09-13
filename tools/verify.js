#!/usr/bin/env node
/**
 * Plants verification harness.
 *
 *   npm i && npx playwright install chromium     (once)
 *   npm run verify
 *   npm run verify -- --static                   (the instant checks only)
 *
 * Renders in software (SwiftShader through ANGLE) so results are deterministic
 * on any machine, which makes it slow — several minutes is normal. It checks
 * the things that have actually broken, here or on the project this descends
 * from, rather than that the page loads.
 *
 * Exit code 0 = all good, 1 = something regressed.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
/* Required lazily, so `--static` needs nothing installed at all. The instant
   checks are the ones somebody runs while editing, and making them depend on a
   browser download is how a check stops being run. */
let chromium = null;

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'index.html');
const PORT = 8123;

/* ANGLE over SwiftShader, and not the raw --use-gl=swiftshader path. The raw
   one loses the WebGL context outright when the instance buffer is allocated,
   which presents as a page that boots, simulates, reports healthy statistics
   and draws absolutely nothing — several hours were spent looking at the page
   for that. When a probe says the picture is empty, check the probe. */
const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
];

let failures = 0;
const pass = m => console.log('  \x1b[32mok\x1b[0m   ' + m);
const fail = m => { failures++; console.log('  \x1b[31mFAIL\x1b[0m ' + m); };
const check = (cond, m) => cond ? pass(m) : fail(m);
const section = t => console.log('\n\x1b[1m' + t + '\x1b[0m');

/* ────────────────────────────────────────────────────────────────────────
   1. Static scan — catches whole bug classes without rendering anything
   ──────────────────────────────────────────────────────────────────────── */
/* Shader source lives in template literals. Pair backticks naively — the
   shaders contain ${...} interpolation but never a backtick. */
function glslRegions(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('`', i)) !== -1) {
    const end = src.indexOf('`', i + 1);
    if (end === -1) break;
    const body = src.slice(i + 1, end);
    if (/#version 300 es|precision highp float/.test(body)) out.push(body);
    i = end + 1;
  }
  return out;
}

/* A block comment that never closes swallows every declaration after it until
   the next one does. `node --check` sees valid JavaScript — the eaten code is
   simply not there — and it surfaces as a ReferenceError hundreds of lines
   away, which is exactly how it surfaced. Cheap to assert, so it is asserted. */
function commentScan(src) {
  const a = src.indexOf('<script>') + 8;
  const s = src.slice(a, src.lastIndexOf('</script>'));
  let i = 0, state = 'code', depth = 0, eaten = 0, opens = 0;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '*') { state = 'block'; opens++; i += 2; continue; }
      if (c === '/' && d === '/') { state = 'line'; i += 2; continue; }
      if (c === "'") { state = 'sq'; i++; continue; }
      if (c === '"') { state = 'dq'; i++; continue; }
      if (c === '`') { state = 'tpl'; i++; continue; }
      if (c === '{') depth++; else if (c === '}') depth--;
    } else if (state === 'block') {
      if (c === '\n') { i++; continue; }
      if (c === '*' && d === '/') { state = 'code'; opens--; i += 2; continue; }
    } else if (state === 'line') {
      if (c === '\n') state = 'code';
    } else {
      if (c === '\\') { i += 2; continue; }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') ||
          (state === 'tpl' && c === '`')) state = 'code';
    }
    i++;
  }
  return { open: opens, endState: state, eaten };
}

/* Two definitions of one function and the LAST one wins, everywhere, because
   declarations hoist. A stale `fitAt` shadowed its replacement for four
   commits on the project this came from, and what hid it was that the dead
   version returned NaN and `NaN|0` is 0, so a downstream Math.max turned total
   failure into a plausible constant. Grep for duplicates first. */
function duplicateFunctions(src) {
  const names = [...src.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]);
  const seen = new Set(), dupes = new Set();
  for (const n of names) { if (seen.has(n)) dupes.add(n); seen.add(n); }
  return [...dupes];
}

function staticScan() {
  section('Static scan');
  const src = fs.readFileSync(PAGE, 'utf8');
  const shaders = glslRegions(src);
  check(shaders.length >= 2, `found ${shaders.length} shader sources to scan`);

  // Reversed smoothstep is undefined in GLSL and fails silently on some
  // drivers — this exact bug hid an entire starfield once. Flagged only inside
  // shader source: the JS helper of the same name handles descending edges
  // correctly and is used that way on purpose.
  const bad = [];
  const re = /smoothstep\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,/g;
  for (const shader of shaders) {
    let m;
    while ((m = re.exec(shader))) {
      if (parseFloat(m[1]) >= parseFloat(m[2])) bad.push(m[0] + ')');
    }
  }
  check(bad.length === 0,
    bad.length ? `reversed smoothstep in GLSL (undefined behaviour): ${bad.join('; ')}`
               : 'no reversed smoothstep in shader code');

  // A backtick anywhere inside shader source closes the template literal the
  // shader lives in, and the rest of the file becomes JavaScript. It reads as
  // ordinary prose, so it is easy to write and impossible to spot.
  const truncated = shaders.filter(s => /#version 300 es/.test(s) && !/void\s+main\s*\(/.test(s));
  check(truncated.length === 0,
    truncated.length ? 'shader source truncated — stray backtick inside a shader comment'
                     : 'no stray backticks inside shader source');

  const cs = commentScan(src);
  check(cs.open === 0 && cs.endState === 'code',
    cs.open === 0 && cs.endState === 'code'
      ? 'no unterminated block comment swallowing code'
      : `unterminated block comment (${cs.open} open, ended in ${cs.endState})`);

  const dupes = duplicateFunctions(src);
  check(dupes.length === 0,
    dupes.length ? `duplicate function declarations — the last one wins: ${dupes.join(', ')}`
                 : 'no duplicate function declarations');

  check(!/window\.__(cam|ptrCount|tapDbg)\s*=/.test(src), 'no stray debug globals');
  check((src.match(/touch-action:\s*none/g) || []).length >= 2,
    'touch-action:none on body and canvas');
  check(/user-scalable=no/.test(src), 'page zoom disabled');
  check(/const ptrs = new Map/.test(src), 'pointer-map input present');
  check(/clearPointers/.test(src), 'lost-pointer recovery present');
  check(/gesturestart/.test(src) && /e\.ctrlKey/.test(src),
    'Safari gesture and ctrl+wheel zoom both prevented');

  // The site must be self-contained. Only things the browser actually
  // *fetches* count — og:/canonical metadata carries absolute URLs by design.
  const fetched = [
    ...[...src.matchAll(/<script\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi)].map(x => x[1]),
    ...[...src.matchAll(/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi)].map(x => x[1]),
    ...[...src.matchAll(/<link\b[^>]*\brel\s*=\s*"(?:stylesheet|preload|prefetch)"[^>]*\bhref\s*=\s*"([^"]+)"/gi)].map(x => x[1]),
    ...[...src.matchAll(/@import\s+(?:url\()?["']([^"']+)/gi)].map(x => x[1]),
  ].filter(u => !u.startsWith('data:'));
  check(fetched.length === 0,
    fetched.length ? `fetched resources: ${fetched.join(', ')}` : 'nothing fetched from markup');
}

/* ────────────────────────────────────────────────────────────────────────
   the shared page setup
   ──────────────────────────────────────────────────────────────────────── */
/* Every probe below stops the frame loop first. The frame loop advances the
   same world the probes advance, by an amount that depends on how many frames
   this machine managed — so without this, two runs of the same file disagree
   and nothing measured means anything. Exactly the first call is let through,
   because the boot lives inside one and schedules the loop as its last act. */
/* `frames` opts OUT of the metering, for the one check that needs the frame
   loop: drawing. Handing rAF back afterwards does NOT work and looked as
   though it did — the boot schedules the loop with its own rAF call, that call
   is the one being dropped, and restoring the function later restores nothing
   because there is no pending callback to restore. The arena was blank for the
   same reason twice more before this was written down. */
async function open(browser, hash, size, frames) {
  const page = await browser.newPage({ viewport: size || { width: 800, height: 450 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('request', r => {
    const u = r.url();
    if (!/^(http:\/\/127\.0\.0\.1:|http:\/\/localhost:|data:|blob:)/.test(u))
      errs.push('OFF-ORIGIN REQUEST: ' + u);
  });
  if (!frames) await page.addInitScript(() => {
    let allowed = 1;
    const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => (allowed-- > 0 ? real(cb) : 0);
  });
  await page.goto(`http://127.0.0.1:${PORT}/index.html` + (hash || ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__world && window.__world.plants, null, { timeout: 180000 });
  page.__errs = errs;
  return page;
}

/* ────────────────────────────────────────────────────────────────────────
   2. It boots, and it boots the same way twice
   ──────────────────────────────────────────────────────────────────────── */
async function determinism(browser) {
  section('Determinism');
  /* The assertion that must hold before any other number is believed: seed
     plus parameters determine a world completely. Nothing here reads the
     clock and no genome draws from Math.random, so two runs of one seed are
     the same run — down to the instance buffer. */
  const results = [];
  for (let i = 0; i < 2; i++) {
    const page = await open(browser, '#seed=4242');
    await page.evaluate(() => window.__world.runWorld(3000));
    results.push(await page.evaluate(() => {
      const p = window.__world.plants();
      return { live: p.live, bodies: p.bodies, hash: window.__world.instHash().hash };
    }));
    await page.close();
  }
  const [a, b] = results;
  check(a.hash === b.hash && a.live === b.live && a.bodies === b.bodies,
    a.hash === b.hash && a.live === b.live
      ? `two runs of one seed are identical (${a.live} nodes, hash ${a.hash})`
      : `two runs of one seed DIVERGED: live ${a.live}/${b.live}, hash ${a.hash}/${b.hash}`);

  /* And the sliced rebuild must produce the same buffer as building it whole —
     the only thing that says slicing changed nothing but when the work
     happened. The world is not advanced between the two, or they are not the
     same world. */
  const page = await open(browser, '#seed=4242');
  await page.evaluate(() => window.__world.runWorld(1500));
  const h = await page.evaluate(() => ({
    whole: window.__world.instHash(0),
    sliced: window.__world.instHash(0.4),
  }));
  check(h.whole.hash === h.sliced.hash && h.whole.inst === h.sliced.inst,
    h.whole.hash === h.sliced.hash
      ? `a sliced rebuild equals a whole one (${h.whole.inst} instances)`
      : `sliced rebuild differs: ${h.whole.inst}/${h.whole.hash} vs ${h.sliced.inst}/${h.sliced.hash}`);
  await page.close();
}

/* ────────────────────────────────────────────────────────────────────────
   3. The arena is 16:9 whatever shape the window is
   ──────────────────────────────────────────────────────────────────────── */
async function letterbox(browser) {
  section('The 16:9 arena');
  const shapes = [
    { width: 1600, height: 900,  name: 'exactly 16:9' },
    { width: 900,  height: 900,  name: 'square' },
    { width: 420,  height: 900,  name: 'tall phone' },
    { width: 1400, height: 500,  name: 'wide and short' },
  ];
  for (const s of shapes) {
    const page = await open(browser, '#prerun=0', { width: s.width, height: s.height });
    const a = await page.evaluate(() => window.__world.arena());
    const err = Math.abs(a.aspect - a.want) / a.want;
    check(err < 0.005, `${s.name} (${s.width}x${s.height}): viewport ${a.w}x${a.h}, ` +
                       `aspect ${a.aspect.toFixed(4)} vs ${a.want.toFixed(4)}`);
    /* and the world is centred in the window, so the bars are equal */
    const dx = Math.abs(a.x * 2 + a.w - a.canvas[0]);
    const dy = Math.abs(a.y * 2 + a.h - a.canvas[1]);
    check(dx <= 2 && dy <= 2, `  centred (bar imbalance ${dx}px, ${dy}px)`);
    await page.close();
  }
}

/* ────────────────────────────────────────────────────────────────────────
   4. The invariants of the world itself
   ──────────────────────────────────────────────────────────────────────── */
async function invariants(browser) {
  section('World invariants');
  const page = await open(browser, '#seed=7');
  await page.evaluate(() => window.__world.runWorld(8000));
  const r = await page.evaluate(() => ({
    wall: window.__world.wallScan(),
    overlap: window.__world.overlapScan(),
    hop: window.__world.hopScan(),
    p: window.__world.plants(),
  }));

  check(r.wall.outside === 0,
    r.wall.outside === 0 ? 'every node is inside the walls'
                         : `${r.wall.outside} nodes outside the arena (worst ${r.wall.worst})`);
  check(r.overlap.tooClosePairs === 0,
    r.overlap.tooClosePairs === 0
      ? `exclusion holds (${r.overlap.sampled} of ${r.overlap.live} nodes sampled)`
      : `${r.overlap.tooClosePairs} overlapping pairs, worst ${r.overlap.worstOverlapPct}%`);
  check(r.hop.overLimit === 0,
    r.hop.overLimit === 0
      ? `every parent link is a legal step (${r.hop.links} links, longest ${r.hop.longest})`
      : `${r.hop.overLimit} links longer than one step — something was joined that never grew together`);
  check(r.p.nonFinite === 0,
    r.p.nonFinite === 0 ? 'no non-finite genome results'
                        : `${r.p.nonFinite} non-finite program results`);
  check(r.p.badGenes === 0 && r.p.badKonst === 0,
    (r.p.badGenes === 0 && r.p.badKonst === 0)
      ? 'no corrupt genomes' : `corrupt genomes: ${r.p.badGenes} genes, ${r.p.badKonst} constants`);
  await page.close();
}

/* ────────────────────────────────────────────────────────────────────────
   5. The acceptance test — this is the point of the piece
   ──────────────────────────────────────────────────────────────────────── */
/* Two ways this genre of simulation dies: monoculture, where one strategy
   wins and diversity goes to zero, and extinction. Both are checked on the
   DEFAULT world across several seeds, because a piece that only works on the
   seed it was tuned against does not work. */
const EVEN_MIN = 0.45;   // niche evenness may not fall below this
const TOP_MAX  = 0.50;   // no one strategy may hold more than this

async function acceptance(browser) {
  section('Acceptance: it must not degenerate');
  const seeds = ['#seed=1', '#seed=7', '#seed=999', '#seed=31337'];
  const rows = [];
  for (const s of seeds) {
    const page = await open(browser, s);
    await page.evaluate(() => window.__world.runWorld(12000));
    const p = await page.evaluate(() => {
      const q = window.__world.plants();
      return { live: q.live, bodies: q.bodies, even: q.evenness, top: q.topStrategy,
               strategies: q.strategies, where: q.where, mean: q.meanBody };
    });
    rows.push({ seed: s, ...p });
    await page.close();

    const label = s.replace('#seed=', 'seed ');
    check(p.live > 0 && p.bodies > 0,
      p.live > 0 ? `${label}: alive — ${p.live} nodes in ${p.bodies} plants (mean ${p.mean})`
                 : `${label}: EXTINCT`);
    check(p.even >= EVEN_MIN,
      `${label}: niche evenness ${p.even.toFixed(2)} (needs >= ${EVEN_MIN})`);
    check(p.top <= TOP_MAX,
      `${label}: biggest strategy ${p.top.toFixed(2)} (needs <= ${TOP_MAX})`);
    /* every one of the five must be a living, not merely a category */
    const thin = Object.entries(p.where).filter(([, v]) => v < 0.01).map(([k]) => k);
    check(thin.length === 0,
      thin.length ? `${label}: niches almost empty: ${thin.join(', ')}`
                  : `${label}: all five niches occupied ` +
                    Object.entries(p.where).map(([k, v]) => k + ' ' + (v * 100).toFixed(0) + '%').join(' '));
  }
  return rows;
}

/* ────────────────────────────────────────────────────────────────────────
   6. It draws something, and the bars really are empty
   ──────────────────────────────────────────────────────────────────────── */
async function drawing(browser) {
  section('Drawing');
  /* The frame loop is what draws, so it has to be handed back — and then given
     long enough for a SLICED rebuild to finish. Under software rendering that
     is several seconds, and a probe that does not wait photographs an empty
     arena and reports a rendering bug that is not there. It did exactly that. */
  const page = await open(browser, '#seed=7', { width: 640, height: 640 }, true);
  /* The interface is put away first. It floats over the whole window, so the
     title in the top corner is inside the top bar — and a check that the bars
     are black reads the word PLANTS at 237/255 and reports a leaking
     letterbox. The picture being checked is the picture, not the furniture. */
  await page.evaluate(() => {
    document.getElementById('hud').style.display = 'none';
    document.getElementById('arenaedge').style.display = 'none';
  });
  /* And then long enough for a SLICED rebuild to finish. Under software
     rendering that is many seconds; a probe that does not wait photographs an
     empty arena and reports a rendering bug that is not there. It did. */
  await page.waitForTimeout(20000);
  const shot = await page.screenshot();
  const a = await page.evaluate(() => window.__world.arena());
  await page.close();

  const img = decodePng(shot);
  const at = (x, y) => { const i = (img.width * y + x) * 4; return [img.data[i], img.data[i+1], img.data[i+2]]; };
  const lum = p => 0.30 * p[0] + 0.59 * p[1] + 0.11 * p[2];

  /* CSS pixels, from the page's own reckoning of where the arena landed. The
     GL viewport is in DEVICE pixels and its y counts up from the bottom, and
     the adaptive resolution shrinks the drawing buffer under software
     rendering — index a screenshot with any of that and the samples land
     somewhere else entirely, which is the second false failure this check
     produced before it produced a true one. */
  const scale = img.width / a.css.cw;
  const x0 = a.css.x * scale, y0 = a.css.y * scale;
  const w = a.css.w * scale, h = a.css.h * scale;

  let lit = 0, n = 0;
  for (let i = 0; i < 4000; i++) {
    const x = Math.floor(x0 + Math.random() * w), y = Math.floor(y0 + Math.random() * h);
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
    n++; if (lum(at(x, y)) > 24) lit++;
  }
  const share = n ? lit / n : 0;
  check(share > 0.10, `the arena has plants in it (${(share * 100).toFixed(0)}% of sampled pixels lit)`);

  /* and the bars really are black — a letterbox that leaks is not a letterbox */
  if (y0 > 4) {
    let worst = 0;
    for (let i = 0; i < 800; i++) {
      const x = Math.floor(Math.random() * img.width), y = Math.floor(Math.random() * (y0 - 2));
      worst = Math.max(worst, lum(at(x, y)));
    }
    check(worst < 12, `the bars are black (brightest sampled ${worst.toFixed(0)}/255)`);
  } else pass('no bars at this window shape (nothing to check)');
}

/* A PNG decoder in thirty lines, because the alternative is a dependency and
   this project has none. Playwright screenshots are always 8-bit non-interlaced
   RGB or RGBA, so only that case is handled and anything else throws rather
   than guessing — a decoder that quietly returns the wrong pixels is worse than
   no decoder, and "the arena is empty" is precisely the claim this exists to
   make. zlib is in the standard library, and the five PNG row filters are the
   only other thing needed. */
function decodePng(buf) {
  const zlib = require('zlib');
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let i = 8, w = 0, h = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i), type = buf.toString('ascii', i + 4, i + 8);
    const body = buf.slice(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4);
      depth = body[8]; colour = body[9]; interlace = body[12];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    i += len + 12;
  }
  if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6))
    throw new Error(`unhandled PNG: depth ${depth} colour ${colour} interlace ${interlace}`);
  const bpp = colour === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * 4);
  const stride = w * bpp;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = Buffer.from(raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      row[x] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 4    ] = row[x * bpp];
      out[(y * w + x) * 4 + 1] = row[x * bpp + 1];
      out[(y * w + x) * 4 + 2] = row[x * bpp + 2];
      out[(y * w + x) * 4 + 3] = bpp === 4 ? row[x * bpp + 3] : 255;
    }
    prev = row;
  }
  return { width: w, height: h, data: out };
}

/* ────────────────────────────────────────────────────────────────────────
   7. Nothing threw, anywhere
   ──────────────────────────────────────────────────────────────────────── */
async function clean(browser) {
  section('A clean load');
  const page = await open(browser, '', null, true);
  await page.waitForTimeout(6000);
  /* open every overlay, because a panel that throws on build is invisible
     until somebody opens it */
  await page.evaluate(() => {
    document.getElementById('gear').click();
    document.getElementById('info').click();
    document.getElementById('aboutlink').click();
  });
  await page.waitForTimeout(2000);
  const cards = await page.evaluate(() => ({
    settings: document.querySelectorAll('#setlist .card').length,
    charts: document.querySelectorAll('#cscroll .card').length,
    about: document.querySelectorAll('#aboutctrls > *').length,
  }));
  check(cards.settings > 6, `settings panel built ${cards.settings} cards`);
  check(cards.charts > 6, `graphs built ${cards.charts} cards`);
  check(cards.about > 2, `about panel built ${cards.about} control illustrations`);
  check(page.__errs.length === 0,
    page.__errs.length ? 'page errors: ' + page.__errs.slice(0, 4).join(' | ')
                       : 'no page errors and nothing left the origin');
  await page.close();
}

/* ──────────────────────────────────────────────────────────────────────── */
(async () => {
  staticScan();
  if (process.argv.includes('--static')) {
    console.log(failures ? `\n\x1b[31m${failures} failed\x1b[0m` : '\n\x1b[32mstatic checks passed\x1b[0m');
    process.exit(failures ? 1 : 0);
  }

  try { chromium = require('playwright').chromium; }
  catch (e) {
    console.log('\n\x1b[31mplaywright is not installed.\x1b[0m ' +
                'Run:  npm i && npx playwright install chromium');
    console.log('(`npm run verify -- --static` needs nothing installed.)');
    process.exit(1);
  }

  /* Served rather than opened from disk, because that is how it ships — and
     because an off-origin request is only detectable when there is an origin. */
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404); res.end('no'); return;
    }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  }).listen(PORT);

  const browser = await chromium.launch({ args: GL_ARGS });
  try {
    await determinism(browser);
    await letterbox(browser);
    await invariants(browser);
    await acceptance(browser);
    await drawing(browser);
    await clean(browser);
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures
    ? `\n\x1b[31m${failures} check${failures > 1 ? 's' : ''} failed\x1b[0m`
    : '\n\x1b[32meverything passed\x1b[0m');
  process.exit(failures ? 1 : 0);
})();
