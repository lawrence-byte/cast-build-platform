'use strict';
const { getActor, getState, json, readBody, createMarkup, updateMarkup, listMarkups, markupsCsv, createMarkupComment, listMarkupComments, listMarkupAudit, getViewerPreferences, saveViewerPreferences, createToolLibraryItem, updateToolLibraryItem, listToolLibraryItems, applyToolLibraryItemToMarkup } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState();
  const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const action = url.searchParams.get('action');
      if (action === 'comments') {
        const markupId = url.searchParams.get('markupId') || url.searchParams.get('id');
        const comments = listMarkupComments(state, markupId);
        return json(res, 200, { ok: true, count: comments.length, comments });
      }
      if (action === 'audit') {
        const markupId = url.searchParams.get('markupId') || url.searchParams.get('id');
        const auditLog = listMarkupAudit(state, markupId);
        return json(res, 200, { ok: true, count: auditLog.length, auditLog });
      }
      if (action === 'preferences') {
        const result = getViewerPreferences(state, actor, url.searchParams.get('projectId') || 'default');
        return json(res, result.ok ? 200 : (result.status || 403), result);
      }
      if (action === 'tool-library') {
        const items = listToolLibraryItems(state, { projectId: url.searchParams.get('projectId'), trade: url.searchParams.get('trade'), category: url.searchParams.get('category'), status: url.searchParams.get('status'), search: url.searchParams.get('search') });
        return json(res, 200, { ok: true, itemCount: items.length, items, placements: state.toolLibraryPlacements || [] });
      }
      const rows = listMarkups(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), status: url.searchParams.get('status'), search: url.searchParams.get('search') });
      if (url.searchParams.get('format') === 'csv') {
        res.statusCode = 200; res.setHeader('content-type', 'text/csv; charset=utf-8'); res.end(markupsCsv(rows)); return;
      }
      return json(res, 200, { ok: true, count: rows.length, markups: rows });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.action === 'preferences') {
        const result = saveViewerPreferences(state, actor, body);
        return json(res, result.ok ? 200 : (result.status || 422), result);
      }
      if (body.action === 'tool-library') {
        const result = body.operation === 'place-tool' ? applyToolLibraryItemToMarkup(state, body, actor) : body.operation === 'update-item' ? updateToolLibraryItem(state, body.id || body.itemId || body.item_id, body.patch || body, actor) : createToolLibraryItem(state, body, actor);
        return json(res, result.ok ? (body.operation === 'place-tool' ? 201 : 200) : (result.status || 422), result);
      }
      if (body.action === 'comment' || body.comment || body.parentId || body.parent_id) {
        const result = createMarkupComment(state, body.markupId || body.id, body.comment || body, actor);
        return json(res, result.ok ? 201 : (result.status || 422), result);
      }
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
