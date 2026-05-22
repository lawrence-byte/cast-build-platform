'use strict';
const { getActor, getState, json, readBody, indexOcrPage, searchOcr, requireCastCad } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const permission = requireCastCad(actor.role, 'view');
      if (!permission.ok) return json(res, permission.status, permission);
      const url = new URL(req.url, 'http://localhost');
      const results = searchOcr(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), query: url.searchParams.get('q') || url.searchParams.get('query') });
      return json(res, 200, { ok: true, count: results.length, results });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const result = indexOcrPage(state, body, actor);
      return json(res, result.ok ? 201 : (result.status || 422), result);
    }
    return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
