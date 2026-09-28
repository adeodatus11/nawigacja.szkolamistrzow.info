import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Local production-artifact preview only. Deployment remains static GitHub Pages.
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 8788);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const cache = new Map();

createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(root)) { response.writeHead(403); response.end(); return; }
    const info = await stat(file);
    let entry = cache.get(file);
    if (!entry || entry.modified !== info.mtimeMs) {
      const body = await readFile(file);
      entry = { body, gzip: gzipSync(body), modified: info.mtimeMs };
      cache.set(file, entry);
    }
    const compressed = request.headers['accept-encoding']?.includes('gzip');
    const body = compressed ? entry.gzip : entry.body;
    response.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'Vary': 'Accept-Encoding',
      ...(compressed ? { 'Content-Encoding': 'gzip' } : {}),
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Podgląd produkcyjny: http://127.0.0.1:${port}/`));
