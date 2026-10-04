'use strict';
/* How evenly does the PICTURE advance, in the live frame loop, on a slow CPU?
   A scratch copy of the page records every completed build: when it was shown,
   and what moment of the world (tick + fraction) it drew. Motion is smooth when
   pictures come at even intervals AND each advances the world by an even amount.
     node smooth.js <throttle> <hash> [seconds] [file]                         */
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const rate = Number(process.argv[2] || 1), hash = process.argv[3] || '#seed=7', secs = Number(process.argv[4] || 20);
const file = process.argv[5] || path.join(ROOT, 'index.html');
let src = fs.readFileSync(file, 'utf8');
function once(from, to) {
  if (src.split(from).length !== 2) { console.error('probe anchor: ' + from); process.exit(1); }
  src = src.replace(from, () => to);
}
once('  BFRAC = TFRAC;\n', '  BFRAC = TFRAC; window.__bd = ptick + TFRAC;\n');
once('      lastBuildMs = buildWork;\n', '      lastBuildMs = buildWork; (window.__pics||(window.__pics=[])).push([window.__fnow, window.__bd, buildWork, instN]);\n');
once('  const fStart = performance.now();\n', '  const fStart = performance.now(); window.__fnow = now; (window.__fr||(window.__fr=[])).push(now);\n');
const PORT = 8125;
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(src); }).listen(PORT);
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync=false'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.error('PAGE ERROR: ' + e));
  const cdp = await page.context().newCDPSession(page);
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto(`http://127.0.0.1:${PORT}/index.html` + hash, { waitUntil: 'load' });
  await page.waitForTimeout(6000);            /* a reload for sizing, if any, has happened by now */
  await page.waitForFunction(() => window.__world && window.__world.plants, null, { timeout: 180000 });
  const warm = Number(process.env.WARM || 10);
  await page.waitForTimeout(warm * 1000);
  await page.evaluate(() => { window.__pics = []; window.__fr = []; });
  await page.waitForTimeout(secs * 1000);
  const r = await page.evaluate(() => {
    const p = window.__world.plants();
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return { pics: window.__pics, fr: window.__fr, live: p.live, bodies: p.bodies, tick: p.tick, hash: location.hash,
             sized: window.__world.sized ? window.__world.sized() : null,
             gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?' };
  });
  await browser.close(); server.close();
  const P = r.pics, F = r.fr;
  const fi = []; for (let k = 1; k < F.length; k++) fi.push(F[k] - F[k - 1]); fi.sort((a, b) => a - b);
  const pi = [], dd = []; for (let k = 1; k < P.length; k++) { pi.push(P[k][0] - P[k - 1][0]); dd.push(P[k][1] - P[k - 1][1]); }
  const pis = pi.slice().sort((a, b) => a - b), dds = dd.slice().sort((a, b) => a - b);
  /* drawn time against shown time: the slope is the world's rate, the scatter is the jerk */
  let n = P.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of P) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), icpt = (sy - slope * sx) / (n || 1);
  let ss = 0, worst = 0; for (const p of P) { const e = (p[1] - (icpt + slope * p[0])) / (slope || 1); ss += e * e; worst = Math.max(worst, Math.abs(e)); }
  const span = P.length ? (P[P.length - 1][0] - P[0][0]) / 1000 : 0;
  const builds = P.map(p => p[2]).sort((a, b) => a - b);
  console.log(`throttle x${rate}   ${r.hash}   gpu: ${r.gpu}`);
  console.log(`  world: ${r.live} nodes, ${r.bodies} plants, tick ${r.tick}, ${P.length ? P[P.length - 1][3] : 0} instances, sized ${JSON.stringify(r.sized)}`);
  console.log(`  frames:   ${(F.length / secs).toFixed(1)}/s   interval median ${q(fi, .5).toFixed(1)}  p95 ${q(fi, .95).toFixed(1)}  max ${q(fi, .999).toFixed(1)} ms`);
  console.log(`  pictures: ${(P.length / (span || 1)).toFixed(1)}/s   interval median ${q(pis, .5).toFixed(1)}  p95 ${q(pis, .95).toFixed(1)}  max ${q(pis, .999).toFixed(1)} ms   build median ${q(builds, .5).toFixed(1)} max ${q(builds, .999).toFixed(1)} ms`);
  console.log(`  world rate ${(slope * 1000).toFixed(1)} ticks/s   advance per picture: median ${q(dds, .5).toFixed(2)}  p95 ${q(dds, .95).toFixed(2)}  max ${q(dds, .999).toFixed(2)} ticks`);
  console.log(`  timing error of the motion: rms ${Math.sqrt(ss / (n || 1)).toFixed(1)} ms, worst ${worst.toFixed(1)} ms`);
  /* the speed each picture shows the world moving at, against the mean: 1 is even */
  const mean = P.length > 1 ? (P[P.length-1][1]-P[0][1])/(P[P.length-1][0]-P[0][0]) : 0;
  const sp = []; for (let k = 0; k < pi.length; k++) if (pi[k] > 0) sp.push(dd[k]/pi[k]/(mean||1));
  sp.sort((a, b) => a - b);
  const off = sp.filter(v => v < 0.5 || v > 1.5).length;
  console.log(`  speed shown per picture, x mean: p5 ${q(sp,.05).toFixed(2)}  median ${q(sp,.5).toFixed(2)}  p95 ${q(sp,.95).toFixed(2)}   outside 0.5-1.5: ${(100*off/(sp.length||1)).toFixed(0)}%   gaps over 100ms: ${pi.filter(v=>v>100).length}`);
})();
