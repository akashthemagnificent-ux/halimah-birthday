/**
 * Simple static file server for halimah-birthday site.
 * Usage: PORT=8234 bun run scripts/serve.mjs
 * Serves the parent directory (site root) on the specified port.
 */

const SITE_ROOT = import.meta.dir + '/..';
const PORT = parseInt(process.env.PORT || '8234', 10);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;
    if (pathname === '/') pathname = '/index.html';

    // Security: prevent directory traversal
    const safePath = pathname.replace(/\.\./g, '');
    const filePath = SITE_ROOT + safePath;

    const file = Bun.file(filePath);
    if (await file.exists()) {
      const ext = '.' + safePath.split('.').pop().toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      return new Response(file, {
        headers: { 'Content-Type': mime },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
