'use strict';
const { getActor, getState, json, readBody, createToolSet, createToolItem, saveMarkupAsTool, listToolLibrary, exportToolLibrary } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState();
  const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const filters = {
        projectId: url.searchParams.get('projectId'),
        scope: url.searchParams.get('scope'),
        search: url.searchParams.get('search'),
        favorite: url.searchParams.get('favorite') === 'true',
      };
      if (url.searchParams.get('format') === 'json') return json(res, 200, { ok: true, library: exportToolLibrary(state, filters) });
      const rows = listToolLibrary(state, filters);
      return json(res, 200, { ok: true, toolSetCount: rows.toolSets.length, toolItemCount: rows.toolItems.length, ...rows });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const action = body.action || body.type || 'tool-item';
    const result = action === 'tool-set'
      ? createToolSet(state, body, actor)
      : action === 'save-markup-as-tool'
        ? saveMarkupAsTool(state, body.markupId || body.markup_id || body.id, body, actor)
        : createToolItem(state, body, actor);
    return json(res, result.ok ? 201 : (result.status || 422), result);
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
};
