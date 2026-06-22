const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 5173;
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  pathname = pathname.replace(/\0/g, '');

  let filePath = path.join(DIST, pathname);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(path.resolve(DIST))) {
    res.writeHead(403, securityHeaders);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.promises.stat(resolvedPath);
    if (stat.isDirectory()) {
      filePath = path.join(DIST, 'index.html');
    }
  } catch {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const content = await fs.promises.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType, ...securityHeaders });
    res.end(content);
  } catch {
    res.writeHead(404, securityHeaders);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
