'use strict';
/**
 * Stand-in for query-api during editor e2e: the web server's own requests (draft
 * list, draft autosave, header data) get a 404 JSON answer, so no real database is
 * ever touched. The only data it serves is the rich post fixture (post + author
 * profile) used as the copy source for paste specs. Browser calls the specs care
 * about are mocked with `page.route`.
 */
const http = require('node:http');

const { RICH_POST_ROUTES } = require('./rich-post-fixture.cjs');

const PORT = Number(process.env.EDITOR_E2E_QUERY_API_PORT || 7997);

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    req.resume();
    const path = (req.url ?? '').split('?')[0];
    const fixture = req.method === 'GET' ? RICH_POST_ROUTES[path] : undefined;
    if (fixture) {
      sendJson(res, 200, fixture);
      return;
    }
    sendJson(res, 404, { statusCode: 404, message: 'editor e2e stub' });
  })
  .listen(PORT, '127.0.0.1');
