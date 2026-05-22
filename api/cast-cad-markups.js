'use strict';
const { getActor, getState, json, readBody, createMarkup, updateMarkup, listMarkups, markupsCsv } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState();
  const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const rows = listMarkups(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), status: url.searchParams.get('status'), search: url.searchParams.get('search') });
      if (url.searchParams.get('format') === 'csv') {
        res.statusCode = 200; res.setHeader('content-type', 'text/csv; charset=utf-8'); res.end(markupsCsv(rows)); return;
      }
      return json(res, 200, { ok: true, count: rows.length, markups: rows });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const result = createMarkup(state, body, actor);
      return json(res, result.ok ? 201 : (result.status || 422), result);
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const result = updateMarkup(state, body.id || body.markupId, body.patch || body, actor);
      return json(res, result.ok ? 200 : (result.status || 422), result);
    }
    return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST, PATCH' });
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
