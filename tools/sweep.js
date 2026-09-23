#!/usr/bin/env node
/* Run the same world under several settings and say which survived.
 *
 * Usage:
 *   node tools/sweep.js life=800,1500,3000          one dial, three values
 *   node tools/sweep.js life=1500 minfrag=10,20,40  a dial against a dial
 *   node tools/sweep.js --seeds 4 --ticks 20000 step=0.02,0.026
 *
 * Four rules this harness exists to obey, every one of them learned the hard
 * way on the project this descends from:
 *
 *   1. STOP THE FRAME LOOP. The frame loop advances the same world this
 *      advances, by an amount that depends on how many frames the machine
 *      managed — so two arms that saw different numbers of frames are not the
 *      same world, and the continents have moved. requestAnimationFrame is
 *      metered: exactly the first call is let through, because the boot lives
 *      inside one, and every call after it is dropped.
 *
 *   2. ASSERT THAT THE PROBE AGREES WITH ITSELF BEFORE IT COMPARES ANYTHING.
 *      Two runs of one setting at one seed must be byte-identical. If they are
 *      not, nothing below this line means anything, and the harness says so
 *      and stops rather than reporting a difference it cannot attribute.
 *
 *   3. REFUSE TO AVERAGE A DEAD WORLD INTO A MEAN. An extinct arm is not a bad
 *      score, it is a different kind of event, and folding it into an average
 *      hides the one outcome that matters most. Deaths are counted and named.
 *
 *   4. SINGLE SEEDS VARY MORE THAN THE EFFECTS WORTH CHASING. Four by default.
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files',
];

/* ---- what the arms are ---- */
const argv = process.argv.slice(2);
let SEEDS = 4, TICKS = 20000, VERBOSE = false;
const dials = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--seeds')      { SEEDS = +argv[++i]; continue; }
  if (a === '--ticks')      { TICKS = +argv[++i]; continue; }
  if (a === '-v')           { VERBOSE = true; continue; }
  const m = /^([A-Za-z_]+)=(.+)$/.exec(a);
  if (!m) { console.error('cannot read argument: ' + a); process.exit(2); }
  dials[m[1]] = m[2].split(',').map(s => s.trim());
}
if (!Object.keys(dials).length) {
  console.error('nothing to sweep. try: node tools/sweep.js life=800,1500,3000');
  process.exit(2);
}

/* the cross product of every dial, in order */
let arms = [{}];
for (const k of Object.keys(dials)) {
  const next = [];
  for (const a of arms) for (const v of dials[k]) next.push(Object.assign({}, a, { [k]: v }));
  arms = next;
}
const label = a => Object.keys(a).length
  ? Object.keys(a).map(k => k + '=' + a[k]).join(' ') : 'default';

/* ---- one run ---- */
async function run(browser, arm, seed) {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  await page.addInitScript(() => {
    let allowed = 1;
    const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => (allowed-- > 0 ? real(cb) : 0);
  });
  const hash = '#seed=' + seed + '&auto=0' + Object.keys(arm).map(k => '&' + k + '=' + arm[k]).join('');
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(PAGE + hash, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__world && window.__world.plants, null, { timeout: 90000 });
  await page.evaluate(t => window.__world.runWorld(t), TICKS);
  const s = await page.evaluate(() => {
    const p = window.__world.plants();
    return {
      live: p.live, wood: p.wood, bodies: p.bodies,
      mean: p.meanBody, largest: p.largestBody,
      even: p.diversity.programGap, top: p.diversity.topGround, d: p.diversity,
      mixed: p.body && p.body.mixedCapBodies,
      fanSD: p.body && p.body.fanSD, stepSD: p.body && p.body.stepSD,
      nonFinite: p.nonFinite,
      hash: window.__world.instHash().hash,
    };
  });
  await page.close();
  if (errs.length) s.error = errs[0];
  return s;
}

/* ---- the acceptance test ----
   The same marks verify.js holds the default world to; see the table there.
   The two columns the report prints, under their old headings, are now how
   unlike the plants' programs are (`even`) and the largest plant's share of
   the held ground (`top`). */
const alive  = s => s.live > 0 && s.bodies > 0;
const passes = s => alive(s) && s.d.plants >= 10 && s.d.topGround <= 0.25 && s.d.shapes >= 6 &&
                    s.d.topShape <= 0.50 && s.d.programGap >= 0.40 && s.d.bred >= 50 && s.d.topParent <= 0.65;

(async () => {
  const browser = await chromium.launch({ args: GL_ARGS });

  /* Rule 2, before anything is compared. */
  process.stdout.write('determinism check ... ');
  const a = await run(browser, arms[0], 1);
  const b = await run(browser, arms[0], 1);
  if (a.hash !== b.hash || a.live !== b.live) {
    console.log('FAILED');
    console.log('  two runs of one setting at one seed disagreed:');
    console.log('  live ' + a.live + ' vs ' + b.live + ',  hash ' + a.hash + ' vs ' + b.hash);
    console.log('  Nothing below this line would mean anything. Fix the harness first.');
    await browser.close();
    process.exit(1);
  }
  console.log('ok  (live ' + a.live + ', hash ' + a.hash + ')');
  console.log(arms.length + ' arm' + (arms.length > 1 ? 's' : '') +
              ' x ' + SEEDS + ' seeds x ' + TICKS + ' ticks\n');

  const rows = [];
  for (const arm of arms) {
    const runs = [];
    for (let s = 1; s <= SEEDS; s++) {
      const r = await run(browser, arm, s);
      runs.push(r);
      if (VERBOSE) console.log('  ' + label(arm) + ' seed ' + s + '  ' + JSON.stringify(r));
      process.stdout.write('.');
    }
    /* Rule 3: the dead are counted, never averaged in. */
    const live = runs.filter(alive);
    const dead = runs.length - live.length;
    const mean = k => live.length ? live.reduce((a2, r) => a2 + (r[k] || 0), 0) / live.length : NaN;
    rows.push({
      arm: label(arm), dead, n: live.length,
      even: mean('even'), top: mean('top'), liveN: mean('live'),
      bodies: mean('bodies'), meanB: mean('mean'), largest: mean('largest'),
      mixed: mean('mixed'), fanSD: mean('fanSD'), stepSD: mean('stepSD'),
      pass: live.filter(passes).length,
      nonFinite: runs.reduce((a2, r) => a2 + (r.nonFinite || 0), 0),
    });
  }
  console.log('\n');

  const f = (v, d) => (Number.isFinite(v) ? v.toFixed(d === undefined ? 2 : d) : '  --');
  const pad = (s, n) => String(s).padEnd(n);
  const rpad = (s, n) => String(s).padStart(n);
  console.log(pad('arm', 26) + rpad('even', 6) + rpad('top', 6) + rpad('pass', 6) +
              rpad('dead', 6) + rpad('live', 8) + rpad('plants', 8) + rpad('meanB', 7) +
              rpad('largest', 8) + rpad('mixed', 7) + rpad('fanSD', 7) + rpad('stepSD', 8));
  console.log('-'.repeat(100));
  for (const r of rows)
    console.log(pad(r.arm, 26) + rpad(f(r.even), 6) + rpad(f(r.top), 6) +
                rpad(r.pass + '/' + r.n, 6) + rpad(r.dead || '', 6) +
                rpad(f(r.liveN, 0), 8) + rpad(f(r.bodies, 0), 8) + rpad(f(r.meanB, 0), 7) +
                rpad(f(r.largest, 0), 8) + rpad(f(r.mixed), 7) +
                rpad(f(r.fanSD), 7) + rpad(f(r.stepSD, 4), 8));

  const bad = rows.filter(r => r.nonFinite);
  if (bad.length) {
    console.log('\nNON-FINITE PROGRAM RESULTS — this counter is expected to stay at zero:');
    for (const r of bad) console.log('  ' + r.arm + ': ' + r.nonFinite);
  }
  const died = rows.filter(r => r.dead);
  if (died.length) {
    console.log('\nEXTINCTIONS (not averaged into anything above):');
    for (const r of died) console.log('  ' + r.arm + ': ' + r.dead + ' of ' + (r.dead + r.n) + ' seeds');
  }
  console.log('\npass = seeds meeting every mark in verify.js; even = program gap, top = share of ground held by the largest plant');
  await browser.close();
})();
