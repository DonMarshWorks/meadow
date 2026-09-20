#!/usr/bin/env node
/**
 * Static server for local testing — how the site actually ships.
 *
 *   npm run serve        then open http://localhost:8000/
 *
 * VS Code's Run and Debug button starts this as a background task and opens a
 * browser on it (see .vscode/launch.json), with --takeover so a stale copy on
 * the port is replaced. Without the flag, launching twice is normal and must
 * not fail, so a server already on the port is treated as success rather
 * than as EADDRINUSE.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8000;
const URL = `http://localhost:${PORT}/`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

console.log('plants: starting');

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  /* Refuse anything that escapes the project, so a stray ../ in a URL cannot
     read the rest of the disk. */
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('not found');
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    /* Always serve the file on disk. Testing an edit against a cached copy of
       the previous one wastes more time than it saves. */
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
});

/* --takeover: if another copy of THIS server already holds the port, kill it
   and take the port. The VS Code task passes it, so pressing Run and Debug
   always serves the file on disk from a fresh process rather than whatever a
   forgotten terminal is still serving. Only a node process running a
   serve.js is ever killed; anything else on the port is left alone and
   reported, because a port is not evidence of what is behind it. */
const TAKEOVER = process.argv.includes('--takeover');
const { execSync } = require('child_process');
function ownerOfPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      const m = out.split(/\r?\n/).find(l => /LISTENING/.test(l) && new RegExp(':' + port + '\\s').test(l));
      if (!m) return null;
      const pid = Number(m.trim().split(/\s+/).pop());
      const cmd = execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`, { encoding: 'utf8' }).trim();
      return { pid, cmd };
    }
    const pid = Number(execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).split('\n')[0]);
    if (!pid) return null;
    const cmd = execSync(`ps -o command= -p ${pid}`, { encoding: 'utf8' }).trim();
    return { pid, cmd };
  } catch (e) { return null; }
}
let retried = false;
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    if (TAKEOVER && !retried) {
      retried = true;
      const who = ownerOfPort(PORT);
      if (who && /node/i.test(who.cmd) && /serve\.js/.test(who.cmd)) {
        console.log(`plants: killing the server already on ${PORT} (pid ${who.pid})`);
        try { process.kill(who.pid); } catch (e) {}
        setTimeout(() => server.listen(PORT), 400);
        return;
      }
      if (who) console.log(`plants: port ${PORT} is held by something that is not this server (pid ${who.pid}: ${who.cmd}) — left alone`);
    }
    console.log(`plants: listening on ${URL} (already running)`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, () => console.log(`plants: listening on ${URL}`));
