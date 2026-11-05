'use strict';
/**
 * Stand-in for query-api during editor e2e: the web server's own requests (draft
 * list, draft autosave, header data) get a 404 JSON answer, so no real database is
 * ever touched. Browser calls the specs care about are mocked with `page.route`.
 */
const http = require('node:http');

const PORT = Number(process.env.EDITOR_E2E_QUERY_API_PORT || 7997);

http
  .createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    req.resume();
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ statusCode: 404, message: 'editor e2e stub' }));
  })
  .listen(PORT, '127.0.0.1');
