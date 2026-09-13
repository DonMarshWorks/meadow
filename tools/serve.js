#!/usr/bin/env node
/**
 * Static server for local testing — how the site actually ships.
 *
 *   npm run serve        then open http://localhost:8000/
 *
 * VS Code's Run and Debug button starts this as a background task and opens a
 * browser on it (see .vscode/launch.json). Launching twice is normal and must
 * not fail, so a server already on the port is treated as success rather than
 * as EADDRINUSE.
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

console.log('aetheris: starting');

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

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`aetheris: listening on ${URL} (already running)`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, () => console.log(`aetheris: listening on ${URL}`));
