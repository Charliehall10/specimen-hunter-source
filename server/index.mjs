// Specimen Hunter game server: JSON API over plain node:http (no dependencies) plus the built client.
//   GET  /api/health                    -> { ok, game, demo }
//   POST /api/session  { currency, balance, maxStake, ageBand }  (pence)
//   POST /api/spin     { sessionId, stake, requestId, force }
//   GET  /api/history?sessionId=...
// Run: node server/index.mjs   (PORT=8787, DEMO=1 enables the free demo bonus)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRgs, GameError, GAME_INFO } from './rgs.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.ico': 'image/x-icon' };

export function createHttpServer({ rgs, staticDir = null }) {
  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  };
  const readJson = req => new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 10_000) { reject(new GameError('TOO_LARGE', 'Request too large', 413)); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new GameError('BAD_JSON', 'Invalid JSON')); } });
    req.on('error', reject);
  });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // Allow the Vite dev server (another localhost port) to call the API during development
    const origin = req.headers.origin;
    const cors = origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' } : {};
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, POST' }); return res.end(); }
      if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, game: GAME_INFO, demo: rgs.demo }, cors);
      if (url.pathname === '/api/session' && req.method === 'POST') return send(res, 201, rgs.createSession(await readJson(req)), cors);
      if (url.pathname === '/api/spin' && req.method === 'POST') return send(res, 200, rgs.spin(await readJson(req)), cors);
      if (url.pathname === '/api/history' && req.method === 'GET') return send(res, 200, rgs.history(url.searchParams.get('sessionId')), cors);
      if (url.pathname.startsWith('/api/')) throw new GameError('NOT_FOUND', 'Unknown endpoint', 404);

      // Static client files
      if (!staticDir || req.method !== 'GET') throw new GameError('NOT_FOUND', 'Not found', 404);
      const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.normalize(path.join(staticDir, rel));
      if (!file.startsWith(staticDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new GameError('NOT_FOUND', 'Not found', 404);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      if (e instanceof GameError) return send(res, e.status, { error: e.code, message: e.message }, cors);
      console.error(e);
      send(res, 500, { error: 'INTERNAL', message: 'Internal error' }, cors);
    }
  });
}

// Started directly: node server/index.mjs
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const demo = process.env.DEMO === '1';
  const rgs = createRgs({ demo });
  const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
  const port = Number(process.env.PORT ?? 8787);
  createHttpServer({ rgs, staticDir: fs.existsSync(staticDir) ? staticDir : null })
    .listen(port, '127.0.0.1', () => console.log(`Specimen Hunter server on http://localhost:${port}  (demo bonus ${demo ? 'ON' : 'OFF'})`));
}
