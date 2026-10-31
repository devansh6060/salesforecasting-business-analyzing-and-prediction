import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import market from './api/market.mjs';
import indices from './api/indices.mjs';
import exchangeRate from './api/exchange-rate.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const handler = { '/api/market': market, '/api/indices': indices, '/api/exchange-rate': exchangeRate }[url.pathname];
    if (handler) {
      const response = await handler(new Request(url, { method: req.method }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    if (relative.split(/[\\/]/).some(part => part.startsWith('.')) || !types[path.extname(relative)]) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(filename);
    res.writeHead(200, { 'Content-Type': `${types[path.extname(filename)]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' ? 404 : 500);
    res.end(error.code === 'ENOENT' ? 'Not found' : 'Request failed');
  }
});
server.listen(Number(process.env.PORT || 8765), '127.0.0.1', () => console.log('ForecastIQ running at http://localhost:8765'));
