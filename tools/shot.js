#!/usr/bin/env node
/**
 * Photograph the world, so a change can be looked at rather than argued about.
 *
 *   node tools/shot.js                                   → shots/latest.png
 *   node tools/shot.js out.png
 *   node tools/shot.js out.png --size 1600x900
 *   node tools/shot.js out.png --hash '#seed=7&step=0.05&minfrag=100'
 *   node tools/shot.js out.png --nohud          hide the interface
 *   node tools/shot.js out.png --wait 40        seconds before the shutter
 *
 * This exists because taking a screenshot of this page has three traps in it
 * and every one of them produces the SAME symptom — a perfectly black arena
 * with a perfectly correct HUD in front of it — which reads as a rendering bug
 * and is not one. All three are handled here so that nobody has to find them
 * again:
 *
 *   1. THE GL FLAGS. `--use-gl=swiftshader` loses the WebGL context outright
 *      when the instance buffer is allocated. The page then boots, simulates,
 *      reports healthy statistics and draws nothing at all. ANGLE over
 *      SwiftShader is the path that works.
 *
 *   2. THE WAIT. The instance buffer is rebuilt in SLICES across frames, and
 *      under software rendering a machine manages a frame every second or so.
 *      A screenshot taken four seconds in is a photograph of an unfinished
 *      build, which is to say of nothing. Twenty-five seconds is the default
 *      and it is not generous.
 *
 *   3. DO NOT METER requestAnimationFrame. Every probe that MEASURES this world
 *      must stub rAF, because the frame loop advances the same world the probe
 *      does. A probe that wants a PICTURE must not, because the frame loop is
 *      what draws — and handing rAF back afterwards does not help: the boot
 *      schedules the loop with its own rAF call, and that call is the one being
 *      dropped. There is nothing left to restore.
 *
 * The world's own numbers are printed with the picture, so that what is on
 * screen and what the simulation thinks are never two separate claims.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8124;

const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
];

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};
const has = name => argv.indexOf('--' + name) >= 0;

const out = (argv[0] && !argv[0].startsWith('--'))
  ? path.resolve(argv[0]) : path.join(ROOT, 'shots', 'latest.png');
const [W, H] = String(flag('size', '1600x900')).split('x').map(Number);
const hash = flag('hash', '') || '';
const wait = Number(flag('wait', 25)) * 1000;

(async () => {
  let chromium;
  try { chromium = require('playwright').chromium; }
  catch (e) {
    console.error('playwright is not installed. Run:  npm i && npx playwright install chromium');
    process.exit(1);
  }

  /* Served rather than opened from disk, because that is how it ships. */
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404); res.end('no'); return;
    }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  }).listen(PORT);

  const browser = await chromium.launch({ args: GL_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.error('PAGE ERROR: ' + e));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE: ' + m.text()); });

  await page.goto(`http://127.0.0.1:${PORT}/index.html` + hash, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__world && window.__world.plants, null, { timeout: 180000 });

  if (has('nohud')) await page.evaluate(() => {
    document.getElementById('hud').style.display = 'none';
    document.getElementById('arenaedge').style.display = 'none';
  });

  /* Trap 2. No rAF stub anywhere above — see trap 3. */
  await page.waitForTimeout(wait);

  const s = await page.evaluate(() => {
    const p = window.__world.plants();
    const a = window.__world.arena();
    return { live: p.live, wood: p.wood, bodies: p.bodies, mean: p.meanBody,
             largest: p.largestBody, d: p.diversity, tick: p.tick,
             arena: a.w + 'x' + a.h + ' (' + a.aspect + ')',
             lost: document.getElementById('gl').getContext('webgl2').isContextLost() };
  });

  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  await browser.close();
  server.close();

  if (s.lost) console.error('WARNING: the WebGL context was lost — the picture is not the world.');
  console.log(out);
  console.log(`  tick ${s.tick}   ${s.live} living nodes, ${s.wood} standing dead`);
  console.log(`  ${s.bodies} plants, mean ${s.mean}, largest ${s.largest}`);
  console.log(`  largest plant ${s.d.topGround} of the ground   ${s.d.shapes} leaf shapes, commonest ${s.d.topShape}`);
  console.log(`  programs differ ${s.d.programGap}   ${s.d.bred} bred, busiest lineage ${s.d.topParent}`);
  console.log(`  arena ${s.arena}`);
})();
