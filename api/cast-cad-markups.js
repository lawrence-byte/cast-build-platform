'use strict';
const { getActor, getState, json, readBody, createMarkup, updateMarkup, deleteMarkup, listMarkups, markupsCsv, createMarkupComment, listMarkupComments, listMarkupAudit, getViewerPreferences, saveViewerPreferences, saveViewportMapping, listViewportMappings, upsertDrawingDocumentMetadata, importDrawingDocumentMetadataFromIndex, listDrawingDocumentMetadata, createToolLibraryItem, updateToolLibraryItem, listToolLibraryItems, applyToolLibraryItemToMarkup, buildPermissionMatrix, upsertProjectMemberRole, listProjectMembers, getEffectivePermissions, readCastCadAuditLog } = require('./_lib/cast-cad-production');

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
      if (action === 'viewport-mapping' || action === 'coordinate-mapping') {
        const mappings = listViewportMappings(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), pageNumber: url.searchParams.get('pageNumber') });
        return json(res, 200, { ok: true, mappingCount: mappings.length, mappings, contract: { normalizedOrigin: 'top-left-percent', coordinateSystem: 'pdf-points-bottom-left', durableAdapterRequired: 'CAST_CAD_DOCUMENT_METADATA_ADAPTER', rendererWorkerStillRequired: 'PDF.js/commercial renderer integration' } });
      }
      if (action === 'document-metadata' || action === 'drawing-documents') {
        const documents = listDrawingDocumentMetadata(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), sheetId: url.searchParams.get('sheetId'), status: url.searchParams.get('status'), search: url.searchParams.get('search') });
        return json(res, 200, { ok: true, documentCount: documents.length, documents, contract: { durableAdapterRequired: 'CAST_CAD_DOCUMENT_METADATA_ADAPTER', privateMetadata: true, streamEndpoint: '/api/cast-cad-pdf-stream' } });
      }
      if (action === 'tool-library') {
        const items = listToolLibraryItems(state, { projectId: url.searchParams.get('projectId'), trade: url.searchParams.get('trade'), category: url.searchParams.get('category'), status: url.searchParams.get('status'), search: url.searchParams.get('search') });
        return json(res, 200, { ok: true, itemCount: items.length, items, placements: state.toolLibraryPlacements || [] });
      }
      if (action === 'admin' || action === 'permission-matrix') {
        return json(res, 200, { ok: true, roles: buildPermissionMatrix(), authRequiredWhenEnabled: 'CAST_CAD_REQUIRE_AUTH=true' });
      }
      if (action === 'members') {
        const result = listProjectMembers(state, { projectId: url.searchParams.get('projectId'), role: url.searchParams.get('role'), status: url.searchParams.get('status') }, actor);
        return json(res, result.ok ? 200 : (result.status || 403), result);
      }
      if (action === 'effective-permissions') {
        const result = getEffectivePermissions(state, { projectId: url.searchParams.get('projectId'), userId: url.searchParams.get('userId'), email: url.searchParams.get('email') }, actor);
        return json(res, result.ok ? 200 : (result.status || 403), result);
      }
      if (action === 'audit-log') {
        const result = readCastCadAuditLog(state, { entityType: url.searchParams.get('entityType'), entityId: url.searchParams.get('entityId'), actorUserId: url.searchParams.get('actorUserId') }, actor);
        return json(res, result.ok ? 200 : (result.status || 403), result);
      }
      const includeDeleted = url.searchParams.get('includeDeleted') === 'true' || url.searchParams.get('include_deleted') === 'true';
      const rows = listMarkups(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), status: url.searchParams.get('status'), search: url.searchParams.get('search'), includeDeleted });
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
      if (body.action === 'viewport-mapping' || body.action === 'coordinate-mapping') {
        const result = saveViewportMapping(state, body, actor);
        return json(res, result.ok ? 200 : (result.status || 422), result);
      }
      if (body.action === 'document-metadata' || body.action === 'drawing-documents') {
        const result = body.operation === 'import-index' || body.importIndex ? importDrawingDocumentMetadataFromIndex(state, body, actor) : upsertDrawingDocumentMetadata(state, body, actor);
        return json(res, result.ok ? (result.status || 200) : (result.status || 422), result);
      }
      if (body.action === 'tool-library') {
        const result = body.operation === 'place-tool' ? applyToolLibraryItemToMarkup(state, body, actor) : body.operation === 'update-item' ? updateToolLibraryItem(state, body.id || body.itemId || body.item_id, body.patch || body, actor) : createToolLibraryItem(state, body, actor);
        return json(res, result.ok ? (body.operation === 'place-tool' ? 201 : 200) : (result.status || 422), result);
      }
      if (body.action === 'admin' || body.action === 'upsert-member-role') {
        const result = upsertProjectMemberRole(state, body, actor);
        return json(res, result.ok ? 200 : (result.status || 422), result);
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
    if (req.method === 'DELETE') {
      const url = new URL(req.url, 'http://localhost');
      const body = await readBody(req).catch(() => ({}));
      const result = deleteMarkup(state, body.id || body.markupId || url.searchParams.get('id') || url.searchParams.get('markupId'), { ...body, hardDelete: body.hardDelete || url.searchParams.get('hardDelete') === 'true', humanReviewApproved: body.humanReviewApproved || url.searchParams.get('humanReviewApproved') === 'true', reason: body.reason || url.searchParams.get('reason') || '' }, actor);
      return json(res, result.ok ? 200 : (result.status || 422), result);
    }
    return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST, PATCH, DELETE' });
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
