'use strict';
const { getActor, getState, json, readBody, createRfiFromMarkup } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  try {
    if (req.method === 'GET') return json(res, 200, { ok: true, rfiLinks: state.rfiLinks });
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const result = createRfiFromMarkup(state, body.markupId || body.id, actor, body);
    return json(res, result.ok ? 201 : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
