'use strict';
/**
 * Local stand-in for the Supabase gateway (test use only). One origin serves:
 *   /rest/v1/*     → PostgREST (the database API)
 *   /auth/v1/user  → a stub that accepts tokens of the form "stub.<user id>" and returns that user
 *   /storage/v1/*  → signed-link stub: links return a small PDF so pages can embed them
 * Real Supabase Auth and Storage are not part of the local stack. This stub only lets the browser
 * sessions and file links work for the signed-in tests. It is not a security boundary.
 */

const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
// pdf-lib comes from the web app's dependencies, so the stub PDF is a real, viewable document.
const { PDFDocument, StandardFonts } = require(require.resolve('pdf-lib', { paths: [path.join(__dirname, '../../../apps/web')] }));

const [listenPort, postgrestPort] = [Number(process.argv[2]), Number(process.argv[3])];
const pdfReady = (async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 297]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 20, y: 20, width: 380, height: 257, borderWidth: 1 });
  page.drawText('arch-flow local test drawing', { x: 40, y: 240, size: 16, font });
  page.drawText('Stub storage: not a firm drawing', { x: 40, y: 215, size: 10, font });
  return Buffer.from(await doc.save());
})();

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function userFor(authorization) {
  const match = /^Bearer stub\.([0-9a-f-]{36})$/i.exec(authorization ?? '');
  return match ? match[1] : null;
}

function proxyRest(req, res) {
  const upstream = http.request(
    { host: '127.0.0.1', port: postgrestPort, method: req.method, path: req.url.slice('/rest/v1'.length) || '/', headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (error) => json(res, 502, { message: `upstream: ${error.message}` }));
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    const path = req.url.split('?')[0];
    if (path.startsWith('/rest/v1')) return proxyRest(req, res);

    if (path === '/auth/v1/user') {
      const id = userFor(req.headers.authorization);
      if (!id) return json(res, 401, { message: 'invalid JWT' });
      return json(res, 200, { id, aud: 'authenticated', role: 'authenticated', email: `${id}@stub.local`, app_metadata: {}, user_metadata: {} });
    }

    if (path.startsWith('/storage/v1/object/sign/')) {
      if (req.method === 'POST') {
        const object = path.slice('/storage/v1/object/sign/'.length);
        return json(res, 200, { signedURL: `/object/sign/${object}?token=stub-token` });
      }
      pdfReady.then((pdf) => {
        res.writeHead(200, { 'content-type': 'application/pdf' });
        res.end(pdf);
      });
      return;
    }

    if (path === '/auth/v1/token' || path === '/auth/v1/logout') return json(res, 200, { access_token: `stub.${randomUUID()}` });
    json(res, 404, { message: `not served by the local gateway: ${path}` });
  })
  .listen(listenPort, '127.0.0.1');
