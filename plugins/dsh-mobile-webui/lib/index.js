import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const name = 'mobile-webui';
const inject = ['webServer'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

function resolveDistDir() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(currentDir, '../dist');
  if (fs.existsSync(distDir)) {
    return distDir;
  }
  // Fallback to currentDir if bundled flat
  return currentDir;
}

function apply(ctx) {
  const distDir = resolveDistDir();

  const route = {
    kind: 'prefix',
    path: '/mobile',
    handler: async (req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', 'http://localhost');
        let pathname = reqUrl.pathname;

        // Strip leading /mobile
        let relPath = pathname.replace(/^\/mobile\/?/, '');

        // Default to index.html if empty
        if (!relPath || relPath === '' || relPath === '/') {
          relPath = 'index.html';
        }

        // Sanitize path to prevent directory traversal
        const safePath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
        let filePath = path.join(distDir, safePath);

        // Check if exact file exists
        let stat = null;
        try {
          if (fs.existsSync(filePath)) {
            stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              filePath = path.join(filePath, 'index.html');
              stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
            }
          }
        } catch {
          stat = null;
        }

        // If file not found and doesn't look like a static asset, fallback to index.html for SPA
        if (!stat && !path.extname(safePath)) {
          filePath = path.join(distDir, 'index.html');
          try {
            stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
          } catch {
            stat = null;
          }
        }

        if (!stat) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Mobile WebUI Asset Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const isHtml = ext === '.html';

        const headers = {
          'Content-Type': contentType,
          'Content-Length': stat.size,
        };

        if (isHtml) {
          headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        } else if (safePath.startsWith('assets/')) {
          headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        } else {
          headers['Cache-Control'] = 'public, max-age=3600';
        }

        res.writeHead(200, headers);
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      } catch (err) {
        ctx.logger.warn(`[mobile-webui] Error serving ${req.url}: ${err?.message || err}`);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Internal Server Error');
        }
      }
    },
  };

  ctx.effect(() => {
    const dispose = ctx.webServer.register(route);
    ctx.logger.info('[mobile-webui] Dedicated mobile WebUI mounted at /mobile');
    return dispose;
  }, 'mobile-webui: /mobile route');
}

export { apply, inject, name, apply as default };
