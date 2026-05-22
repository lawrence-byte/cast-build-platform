'use strict';
const { getActor, getState, json, readBody, createToolLibraryItem, updateToolLibraryItem, listToolLibraryItems, applyToolLibraryItemToMarkup } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const items = listToolLibraryItems(state, {
        projectId: url.searchParams.get('projectId'),
        trade: url.searchParams.get('trade'),
        category: url.searchParams.get('category'),
        status: url.searchParams.get('status'),
        search: url.searchParams.get('search'),
      });
      return json(res, 200, { ok: true, itemCount: items.length, items, placements: state.toolLibraryPlacements || [] });
    }
    if (!['POST','PATCH'].includes(req.method)) return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST, PATCH' });
    const body = await readBody(req);
    const action = body.action || (req.method === 'PATCH' ? 'update-item' : 'create-item');
    const result = action === 'place-tool'
      ? applyToolLibraryItemToMarkup(state, body, actor)
      : action === 'update-item'
        ? updateToolLibraryItem(state, body.id || body.itemId || body.item_id, body.patch || body, actor)
        : createToolLibraryItem(state, body, actor);
    return json(res, result.ok ? (action === 'place-tool' ? 201 : 200) : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
