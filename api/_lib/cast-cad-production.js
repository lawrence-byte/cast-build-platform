'use strict';

const crypto = require('crypto');
const { safeSegment, safeFileName } = require('./document-storage');

const CAST_CAD_ROLES = ['Owner Admin','CAST Admin','Project Manager','Project Engineer','Architect','Consultant','General Contractor','Subcontractor','Read Only Viewer'];
const CAST_CAD_PERMISSIONS = {
  'Owner Admin': ['view','stream_pdf','create_markup','edit_markup','delete_markup','export','create_rfi','review_room','manage_drawing_sets','admin','audit'],
  'CAST Admin': ['view','stream_pdf','create_markup','edit_markup','delete_markup','export','create_rfi','review_room','manage_drawing_sets','admin','audit'],
  'Project Manager': ['view','stream_pdf','create_markup','edit_markup','export','create_rfi','review_room','manage_drawing_sets','audit'],
  'Project Engineer': ['view','stream_pdf','create_markup','edit_markup','export','create_rfi','review_room','manage_drawing_sets'],
  Architect: ['view','stream_pdf','create_markup','edit_markup','export','review_room','manage_drawing_sets'],
  Consultant: ['view','stream_pdf','create_markup','export','review_room'],
  'General Contractor': ['view','stream_pdf','create_markup','export','create_rfi','review_room'],
  Subcontractor: ['view','stream_pdf','create_markup'],
  'Read Only Viewer': ['view','stream_pdf'],
};

const DEFAULT_STATE = () => ({
  markups: [], comments: [], auditLog: [], exportJobs: [], rfiLinks: [], reviewRooms: [], ocrPages: [], comparisonJobs: [], aiFindings: [], userPreferences: [], drawingSetVersions: [], drawingSheetRevisions: [], toolLibraryItems: [], toolLibraryPlacements: [], batchOperations: [], fieldPackages: [], fieldSyncEvents: [],
});
let memoryState = DEFAULT_STATE();

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}
function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function csvEscape(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function normalizeRole(role) { return CAST_CAD_ROLES.includes(role) ? role : 'Read Only Viewer'; }
function canCastCad(role, action) { return (CAST_CAD_PERMISSIONS[normalizeRole(role)] || []).includes(action); }
function requireCastCad(role, action) {
  if (!canCastCad(role, action)) return { ok: false, status: 403, error: `Role ${normalizeRole(role)} cannot ${action.replace(/_/g, ' ')}.` };
  return { ok: true };
}
function getActor(req = {}) {
  return {
    id: req.headers?.['x-cast-user-id'] || 'cast-system-user',
    name: req.headers?.['x-cast-user-name'] || 'CAST User',
    role: normalizeRole(req.headers?.['x-cast-role'] || 'Owner Admin'),
    email: req.headers?.['x-cast-user-email'] || 'user@cast-dev.example',
  };
}
function audit(state, actor, action, entityType, entityId, previousValue, newValue, notes = '') {
  const entry = { id: id('cad_audit'), action, entityType, entityId, actorUserId: actor.id, actorRole: actor.role, previousValue: previousValue || null, newValue: newValue || null, notes, createdAt: now() };
  state.auditLog.push(entry);
  return entry;
}
function getState() { return memoryState; }
function resetState(seed) { memoryState = seed ? clone(seed) : DEFAULT_STATE(); return memoryState; }
function json(res, status, body, headers = {}) {
  res.statusCode = status;
  Object.entries({ 'content-type': 'application/json; charset=utf-8', ...headers }).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body, null, 2));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 8_000_000) reject(new Error('Request body too large.')); });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (error) { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}
function sheetFromIndex(index, sheetId) {
  const files = index?.files || [];
  return files.find((file) => safeSegment(file.path) === safeSegment(sheetId) || safeSegment(file.name) === safeSegment(sheetId) || file.id === sheetId) || null;
}
function joinUrl(base, segment) {
  const cleanBase = String(base || '').replace(/\/+$/, '');
  const cleanSegment = String(segment || '').split('/').map(encodeURIComponent).join('/');
  return `${cleanBase}/${cleanSegment}`;
}
function buildServerPdfUrls(sheet) {
  const sourcePath = String(sheet?.path || '');
  const streamBase = process.env.CAST_CAD_PDF_STREAM_BASE || '';
  const editBase = process.env.CAST_CAD_PDF_EDIT_BASE || process.env.CAST_CAD_DRAWING_SET_EDIT_BASE || '';
  const documentApi = process.env.CAST_SERVER_DOCUMENT_API_URL || '';
  return {
    streamUrl: streamBase ? joinUrl(streamBase, sourcePath) : documentApi ? `${documentApi.replace(/\/+$/, '')}/pdf?path=${encodeURIComponent(sourcePath)}` : '',
    editUrl: editBase ? joinUrl(editBase, sourcePath) : '',
  };
}
function buildPdfStreamContract({ sheet, actor, expiresInSeconds = 300 }) {
  const permission = requireCastCad(actor.role, 'stream_pdf');
  if (!permission.ok) return permission;
  if (!sheet || !sheet.path || sheet.extension !== 'pdf') return { ok: false, status: 404, error: 'PDF sheet not found in the approved drawing index.' };
  const providerConfigured = Boolean(process.env.CAST_CAD_PDF_STREAM_BASE || process.env.DROPBOX_ACCESS_TOKEN || process.env.CAST_SERVER_DOCUMENT_API_URL);
  const urls = buildServerPdfUrls(sheet);
  const streamId = crypto.createHash('sha256').update(`${sheet.path}|${actor.id}|${Date.now()}`).digest('hex').slice(0, 24);
  const contract = {
    streamId,
    sheetName: sheet.name,
    sourcePath: sheet.path,
    contentType: 'application/pdf',
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    cacheControl: 'private, max-age=0, no-store',
    disposition: `inline; filename="${safeFileName(sheet.name)}"`,
    publicExposure: false,
    requiresAuth: true,
    provider: process.env.CAST_CAD_PDF_STREAM_BASE ? 'cast-server' : process.env.DROPBOX_ACCESS_TOKEN ? 'dropbox' : process.env.CAST_SERVER_DOCUMENT_API_URL ? 'cast-server-api' : 'unconfigured',
    streamUrl: urls.streamUrl,
    editUrl: urls.editUrl,
    editableOnServer: Boolean(urls.editUrl),
    editingModel: 'CAST CAD stores vector markups separately and opens the approved server drawing link for source-PDF edits.',
  };
  if (!providerConfigured) return { ok: false, status: 503, error: 'Authenticated PDF provider is not configured; refusing to expose private drawing files.', contract };
  return { ok: true, contract };
}
function validateMarkup(input = {}) {
  const errors = [];
  if (!input.projectId && !input.project_id) errors.push('projectId is required.');
  if (!input.sheetId && !input.drawing_id) errors.push('sheetId is required.');
  if (!input.tool) errors.push('tool is required.');
  if (!input.subject) errors.push('subject is required.');
  return errors;
}
function createMarkup(state, input, actor) {
  const permission = requireCastCad(actor.role, 'create_markup');
  if (!permission.ok) return permission;
  const errors = validateMarkup(input);
  if (errors.length) return { ok: false, status: 422, errors };
  const markup = {
    id: input.id || id('cad_markup'),
    projectId: input.projectId || input.project_id,
    sheetId: input.sheetId || input.drawing_id,
    pageNumber: Number(input.pageNumber || input.page_number || 1),
    tool: input.tool,
    markupType: input.markupType || input.markup_type || 'comment-pin',
    subject: input.subject,
    body: input.body || '',
    status: input.status || 'Open',
    priority: input.priority || 'Normal',
    trade: input.trade || '',
    costCode: input.costCode || input.cost_code || '',
    assigneeUserId: input.assigneeUserId || input.assignee_user_id || '',
    geometry: input.geometry || { type: 'point', points: [{ x: Number(input.x ?? 50), y: Number(input.y ?? 50) }] },
    measurement: input.measurement || null,
    layer: input.layer || 'Default',
    groupId: input.groupId || input.group_id || '',
    style: input.style || { stroke: '#f97316', fill: 'rgba(249,115,22,.16)', opacity: 1, lineWidth: 2, fontSize: 12 },
    sourceSnapshot: input.sourceSnapshot || input.source_snapshot || {},
    createdByUserId: actor.id,
    updatedByUserId: actor.id,
    createdAt: now(),
    updatedAt: now(),
  };
  state.markups.push(markup);
  audit(state, actor, 'Created CAST CAD markup', 'CAST_CAD_MARKUP', markup.id, null, markup);
  return { ok: true, markup };
}
function updateMarkup(state, markupId, patch, actor) {
  const permission = requireCastCad(actor.role, 'edit_markup');
  if (!permission.ok) return permission;
  const markup = state.markups.find((row) => row.id === markupId);
  if (!markup) return { ok: false, status: 404, error: 'Markup not found.' };
  const previous = clone(markup);
  if (patch.cost_code !== undefined) patch.costCode = patch.cost_code;
  if (patch.assignee_user_id !== undefined) patch.assigneeUserId = patch.assignee_user_id;
  ['subject','body','status','priority','trade','costCode','assigneeUserId','geometry','measurement','layer','style','groupId'].forEach((key) => {
    if (patch[key] !== undefined) markup[key] = patch[key];
  });
  markup.updatedByUserId = actor.id;
  markup.updatedAt = now();
  audit(state, actor, 'Updated CAST CAD markup', 'CAST_CAD_MARKUP', markup.id, previous, markup);
  return { ok: true, markup };
}
function mentionsFromText(text) {
  return [...new Set(String(text || '').match(/@[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|@[a-z][a-z0-9._-]*/gi) || [])]
    .map((mention) => mention.slice(1).replace(/[.,;:!?)]$/, ''));
}
function createMarkupComment(state, markupId, input = {}, actor) {
  const permission = requireCastCad(actor.role, 'create_markup');
  if (!permission.ok) return permission;
  const markup = state.markups.find((row) => row.id === markupId);
  if (!markup) return { ok: false, status: 404, error: 'Markup not found.' };
  if (!String(input.body || '').trim()) return { ok: false, status: 422, errors: ['Comment body is required.'] };
  const parentId = input.parentId || input.parent_id || '';
  if (parentId && !state.comments.some((row) => row.id === parentId && row.markupId === markupId)) return { ok: false, status: 422, errors: ['Parent comment must belong to the same markup thread.'] };
  const comment = {
    id: input.id || id('cad_comment'),
    markupId,
    parentId,
    body: String(input.body).trim(),
    mentions: input.mentions || mentionsFromText(input.body),
    attachments: input.attachments || [],
    createdByUserId: actor.id,
    createdByName: actor.name,
    createdAt: now(),
    updatedAt: now(),
  };
  state.comments.push(comment);
  markup.updatedByUserId = actor.id;
  markup.updatedAt = now();
  audit(state, actor, 'Added CAST CAD markup thread comment', 'CAST_CAD_MARKUP_COMMENT', comment.id, null, comment, comment.mentions.length ? `Mentions: ${comment.mentions.join(', ')}` : '');
  return { ok: true, comment };
}
function listMarkupComments(state, markupId) {
  return state.comments.filter((row) => !markupId || row.markupId === markupId);
}
function listMarkupAudit(state, markupId) {
  if (!markupId) return state.auditLog.slice();
  const commentIds = new Set(state.comments.filter((row) => row.markupId === markupId).map((row) => row.id));
  return state.auditLog.filter((row) => row.entityId === markupId || commentIds.has(row.entityId));
}
function listMarkups(state, filters = {}) {
  let rows = state.markups.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.search) { const q = String(filters.search).toLowerCase(); rows = rows.filter((row) => `${row.subject} ${row.body} ${row.trade} ${row.costCode}`.toLowerCase().includes(q)); }
  return rows;
}
function defaultViewerPreferences() {
  return {
    renderer: 'browser-pdf',
    layout: 'single-page',
    zoomMode: 'fit-width',
    showThumbnails: true,
    showBookmarks: false,
    showPageLabels: true,
    splitView: false,
    sideBySide: false,
    keyboardShortcuts: true,
    searchPanelOpen: false,
  };
}
function normalizeViewerPreferences(input = {}) {
  const allowedLayouts = new Set(['single-page','continuous','split-view','side-by-side']);
  const allowedZoomModes = new Set(['fit-width','fit-page','actual-size']);
  const base = defaultViewerPreferences();
  const layout = allowedLayouts.has(input.layout) ? input.layout : base.layout;
  return {
    renderer: 'browser-pdf',
    layout,
    zoomMode: allowedZoomModes.has(input.zoomMode || input.zoom_mode) ? (input.zoomMode || input.zoom_mode) : base.zoomMode,
    showThumbnails: input.showThumbnails !== undefined ? Boolean(input.showThumbnails) : input.show_thumbnails !== undefined ? Boolean(input.show_thumbnails) : base.showThumbnails,
    showBookmarks: input.showBookmarks !== undefined ? Boolean(input.showBookmarks) : input.show_bookmarks !== undefined ? Boolean(input.show_bookmarks) : base.showBookmarks,
    showPageLabels: input.showPageLabels !== undefined ? Boolean(input.showPageLabels) : input.show_page_labels !== undefined ? Boolean(input.show_page_labels) : base.showPageLabels,
    splitView: input.splitView !== undefined ? Boolean(input.splitView) : input.split_view !== undefined ? Boolean(input.split_view) : layout === 'split-view',
    sideBySide: input.sideBySide !== undefined ? Boolean(input.sideBySide) : input.side_by_side !== undefined ? Boolean(input.side_by_side) : layout === 'side-by-side',
    keyboardShortcuts: input.keyboardShortcuts !== undefined ? Boolean(input.keyboardShortcuts) : input.keyboard_shortcuts !== undefined ? Boolean(input.keyboard_shortcuts) : base.keyboardShortcuts,
    searchPanelOpen: input.searchPanelOpen !== undefined ? Boolean(input.searchPanelOpen) : input.search_panel_open !== undefined ? Boolean(input.search_panel_open) : base.searchPanelOpen,
  };
}
function getViewerPreferences(state, actor, projectId = 'default') {
  const permission = requireCastCad(actor.role, 'view');
  if (!permission.ok) return permission;
  const existing = state.userPreferences.find((row) => row.userId === actor.id && row.projectId === projectId && row.scope === 'cast-cad-viewer');
  return { ok: true, preferences: existing ? existing.preferences : defaultViewerPreferences(), source: existing ? 'stored' : 'default' };
}
function saveViewerPreferences(state, actor, input = {}) {
  const permission = requireCastCad(actor.role, 'view');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id || 'default';
  const preferences = normalizeViewerPreferences(input.preferences || input);
  const previous = state.userPreferences.find((row) => row.userId === actor.id && row.projectId === projectId && row.scope === 'cast-cad-viewer') || null;
  const previousSnapshot = previous ? clone(previous) : null;
  const record = previous || { id: id('cad_pref'), userId: actor.id, projectId, scope: 'cast-cad-viewer', createdAt: now() };
  record.preferences = preferences;
  record.updatedAt = now();
  if (!previous) state.userPreferences.push(record);
  audit(state, actor, 'Saved CAST CAD viewer preferences', 'CAST_CAD_VIEWER_PREFERENCES', record.id, previousSnapshot, record);
  return { ok: true, preferences: record };
}
function createTakeoffWorkbookExport(state, { projectId, sheetId, format = 'xlsx' }, actor) {
  const permission = requireCastCad(actor.role, 'export');
  if (!permission.ok) return permission;
  const markups = listMarkups(state, { projectId, sheetId }).filter((row) => row.measurement || /count|measure|area|length/i.test(row.tool));
  const rows = markups.map((m) => ({ sheetId: m.sheetId, subject: m.subject, trade: m.trade, costCode: m.costCode, quantity: m.measurement?.value || 1, unit: m.measurement?.unit || 'EA', status: m.status, sourceMarkupId: m.id }));
  const exportJob = { id: id('cad_export'), projectId, sheetId: sheetId || '', type: 'takeoff-workbook', format, status: 'ready', rowCount: rows.length, rows, outputPointer: `/api/cast-cad/export/${projectId || 'project'}-${Date.now()}.${format}`, createdByUserId: actor.id, createdAt: now() };
  state.exportJobs.push(exportJob);
  audit(state, actor, 'Created takeoff workbook export job', 'CAST_CAD_EXPORT', exportJob.id, null, exportJob);
  return { ok: true, exportJob };
}
function createAnnotatedPdfExport(state, { projectId, sheetId, flatten = true }, actor) {
  const permission = requireCastCad(actor.role, 'export');
  if (!permission.ok) return permission;
  const markups = listMarkups(state, { projectId, sheetId });
  const exportJob = { id: id('cad_export'), projectId, sheetId: sheetId || '', type: 'annotated-pdf', format: 'pdf', status: process.env.CAST_CAD_PDF_EXPORT_WORKER ? 'queued' : 'provider-required', flatten: Boolean(flatten), markupCount: markups.length, providerRequired: !process.env.CAST_CAD_PDF_EXPORT_WORKER, outputPointer: process.env.CAST_CAD_PDF_EXPORT_WORKER ? `/api/cast-cad/export/${projectId || 'project'}-${Date.now()}.pdf` : '', createdByUserId: actor.id, createdAt: now() };
  state.exportJobs.push(exportJob);
  audit(state, actor, 'Created annotated PDF export job', 'CAST_CAD_EXPORT', exportJob.id, null, exportJob, exportJob.providerRequired ? 'PDF export worker not configured yet.' : 'Queued for PDF export worker.');
  return { ok: true, exportJob };
}
function createRfiFromMarkup(state, markupId, actor, overrides = {}) {
  const permission = requireCastCad(actor.role, 'create_rfi');
  if (!permission.ok) return permission;
  const markup = state.markups.find((row) => row.id === markupId);
  if (!markup) return { ok: false, status: 404, error: 'Markup not found.' };
  const rfiLink = { id: id('cad_rfi_link'), markupId, rfiId: overrides.rfiId || id('draft_rfi'), linkStatus: 'draft', snapshotPointer: { sheetId: markup.sheetId, pageNumber: markup.pageNumber, geometry: markup.geometry, subject: markup.subject, body: markup.body, createdAt: now() }, createdByUserId: actor.id, createdAt: now() };
  state.rfiLinks.push(rfiLink);
  audit(state, actor, 'Created draft RFI from markup snapshot', 'CAST_CAD_RFI_LINK', rfiLink.id, null, rfiLink);
  return { ok: true, rfiLink };
}
function indexOcrPage(state, input, actor) {
  const permission = requireCastCad(actor.role, 'admin');
  if (!permission.ok) return permission;
  const page = { id: input.id || id('cad_ocr'), projectId: input.projectId, sheetId: input.sheetId, pageNumber: Number(input.pageNumber || 1), text: input.text || '', symbols: input.symbols || [], source: input.source || 'OCR worker', confidence: Number(input.confidence || 0), createdAt: now() };
  state.ocrPages.push(page);
  audit(state, actor, 'Indexed OCR/search page', 'CAST_CAD_OCR_PAGE', page.id, null, { ...page, text: page.text.slice(0, 120) });
  return { ok: true, page };
}
function searchOcr(state, { projectId, sheetId, query }) {
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  return state.ocrPages.filter((page) => (!projectId || page.projectId === projectId) && (!sheetId || page.sheetId === sheetId) && (`${page.text} ${page.symbols.join(' ')}`.toLowerCase().includes(q))).map((page) => ({ id: page.id, sheetId: page.sheetId, pageNumber: page.pageNumber, confidence: page.confidence, excerpt: excerpt(page.text, q), symbols: page.symbols }));
}
function excerpt(text, q) {
  const lower = String(text || '').toLowerCase();
  const i = Math.max(0, lower.indexOf(q));
  return String(text || '').slice(Math.max(0, i - 60), i + q.length + 90);
}
function createReviewRoom(state, input, actor) {
  const permission = requireCastCad(actor.role, 'review_room');
  if (!permission.ok) return permission;
  const room = { id: input.id || id('cad_room'), projectId: input.projectId, name: input.name || 'CAST CAD Review Room', status: input.status || 'Active', sheetIds: input.sheetIds || [], markupIds: input.markupIds || [], participants: (input.participants || []).map((p) => ({ ...p, invitedAt: now(), status: 'Invited' })), auditRequired: true, createdByUserId: actor.id, createdAt: now(), updatedAt: now() };
  state.reviewRooms.push(room);
  audit(state, actor, 'Created CAST CAD review room', 'CAST_CAD_REVIEW_ROOM', room.id, null, room);
  return { ok: true, room };
}
function normalizeToolLibraryItem(input = {}, actor) {
  const unit = String(input.unit || input.measurementUnit || input.measurement_unit || 'EA').trim().toUpperCase();
  const toolType = String(input.toolType || input.tool_type || input.type || 'count').trim().toLowerCase();
  const defaultMarkupTool = toolType === 'area' ? 'Area Measurement' : toolType === 'length' ? 'Line Measurement' : 'Count';
  return {
    id: input.id || id('cad_tool'),
    projectId: input.projectId || input.project_id || 'global',
    name: String(input.name || '').trim(),
    category: String(input.category || 'General').trim(),
    trade: String(input.trade || 'Coordination').trim(),
    costCode: input.costCode || input.cost_code || '',
    assemblyCode: input.assemblyCode || input.assembly_code || '',
    toolType,
    markupTool: input.markupTool || input.markup_tool || defaultMarkupTool,
    unit,
    unitCost: input.unitCost === undefined && input.unit_cost === undefined ? null : Number(input.unitCost ?? input.unit_cost),
    formula: String(input.formula || 'quantity').trim(),
    defaultLayer: String(input.defaultLayer || input.default_layer || input.category || 'Default').trim(),
    style: input.style || { stroke: '#0f766e', fill: 'rgba(15,118,110,.16)', opacity: 1, lineWidth: 2, fontSize: 12 },
    requiresHumanReview: input.requiresHumanReview !== undefined ? Boolean(input.requiresHumanReview) : input.requires_human_review !== undefined ? Boolean(input.requires_human_review) : true,
    status: input.status || 'active',
    createdByUserId: input.createdByUserId || input.created_by_user_id || actor.id,
    updatedByUserId: actor.id,
    createdAt: input.createdAt || input.created_at || now(),
    updatedAt: now(),
  };
}
function validateToolLibraryItem(item) {
  const errors = [];
  if (!item.name) errors.push('name is required.');
  if (!['count','length','area','symbol','stamp'].includes(item.toolType)) errors.push('toolType must be count, length, area, symbol, or stamp.');
  if (item.unitCost !== null && (!Number.isFinite(item.unitCost) || item.unitCost < 0)) errors.push('unitCost must be a non-negative number when provided.');
  if (!item.requiresHumanReview) errors.push('Tool Library items must require human review before quantities can affect budget or exports.');
  return errors;
}
function createToolLibraryItem(state, input = {}, actor) {
  state.toolLibraryItems ||= [];
  const permission = requireCastCad(actor.role, 'admin');
  if (!permission.ok) return permission;
  const item = normalizeToolLibraryItem(input, actor);
  const errors = validateToolLibraryItem(item);
  if (errors.length) return { ok: false, status: 422, errors };
  state.toolLibraryItems.push(item);
  audit(state, actor, 'Created CAST CAD Tool Library item', 'CAST_CAD_TOOL_LIBRARY_ITEM', item.id, null, item);
  return { ok: true, item };
}
function updateToolLibraryItem(state, itemId, patch = {}, actor) {
  state.toolLibraryItems ||= [];
  const permission = requireCastCad(actor.role, 'admin');
  if (!permission.ok) return permission;
  const item = state.toolLibraryItems.find((row) => row.id === itemId);
  if (!item) return { ok: false, status: 404, error: 'Tool Library item not found.' };
  const previous = clone(item);
  const next = normalizeToolLibraryItem({ ...item, ...patch, id: item.id, createdAt: item.createdAt, createdByUserId: item.createdByUserId }, actor);
  const errors = validateToolLibraryItem(next);
  if (errors.length) return { ok: false, status: 422, errors };
  Object.assign(item, next, { id: previous.id, createdAt: previous.createdAt, createdByUserId: previous.createdByUserId, updatedByUserId: actor.id, updatedAt: now() });
  audit(state, actor, 'Updated CAST CAD Tool Library item', 'CAST_CAD_TOOL_LIBRARY_ITEM', item.id, previous, item);
  return { ok: true, item };
}
function listToolLibraryItems(state, filters = {}) {
  state.toolLibraryItems ||= [];
  let rows = state.toolLibraryItems.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId || row.projectId === 'global');
  if (filters.trade) rows = rows.filter((row) => row.trade === filters.trade);
  if (filters.category) rows = rows.filter((row) => row.category === filters.category);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.search) { const q = String(filters.search).toLowerCase(); rows = rows.filter((row) => `${row.name} ${row.category} ${row.trade} ${row.costCode} ${row.assemblyCode}`.toLowerCase().includes(q)); }
  return rows;
}
function applyToolLibraryItemToMarkup(state, input = {}, actor) {
  state.toolLibraryItems ||= [];
  state.toolLibraryPlacements ||= [];
  const permission = requireCastCad(actor.role, 'create_markup');
  if (!permission.ok) return permission;
  const itemId = input.itemId || input.item_id || input.toolLibraryItemId || input.tool_library_item_id;
  const item = state.toolLibraryItems.find((row) => row.id === itemId && row.status !== 'archived');
  if (!item) return { ok: false, status: 404, error: 'Active Tool Library item not found.' };
  const quantity = Number(input.quantity || input.measurement?.value || 1);
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, status: 422, errors: ['quantity must be a positive number.'] };
  const created = createMarkup(state, {
    projectId: input.projectId || item.projectId,
    sheetId: input.sheetId || input.drawing_id,
    pageNumber: input.pageNumber || input.page_number || 1,
    tool: item.markupTool,
    markupType: input.markupType || (item.toolType === 'area' || item.toolType === 'length' ? 'measurement' : 'pin'),
    subject: input.subject || item.name,
    body: input.body || `Placed from CAST Tool Library item ${item.name}. Human review required before budget use.`,
    status: input.status || 'Needs Review',
    priority: input.priority || 'Normal',
    trade: item.trade,
    costCode: item.costCode,
    geometry: input.geometry || { type: item.toolType === 'area' ? 'polygon' : item.toolType === 'length' ? 'line' : 'point', points: input.points || [{ x: Number(input.x ?? 50), y: Number(input.y ?? 50) }] },
    measurement: { value: quantity, unit: item.unit, source: 'tool-library', humanReviewRequired: true, formula: item.formula, unitCost: item.unitCost, assemblyCode: item.assemblyCode },
    layer: input.layer || item.defaultLayer,
    style: input.style || item.style,
    sourceSnapshot: { toolLibraryItemId: item.id, itemName: item.name, category: item.category, assemblyCode: item.assemblyCode, requiresHumanReview: true },
  }, actor);
  if (!created.ok) return created;
  const placement = { id: id('cad_tool_place'), itemId: item.id, markupId: created.markup.id, projectId: created.markup.projectId, sheetId: created.markup.sheetId, quantity, unit: item.unit, budgetAuthoritative: false, humanReviewRequired: true, createdByUserId: actor.id, createdAt: now() };
  state.toolLibraryPlacements.push(placement);
  audit(state, actor, 'Placed CAST CAD Tool Library item as review-gated markup', 'CAST_CAD_TOOL_LIBRARY_PLACEMENT', placement.id, null, placement);
  return { ok: true, item, markup: created.markup, placement };
}
function buildComparisonJob(state, input, actor) {
  const permission = requireCastCad(actor.role, 'export');
  if (!permission.ok) return permission;
  const job = { id: id('cad_compare'), projectId: input.projectId, baseSheetId: input.baseSheetId, revisedSheetId: input.revisedSheetId, status: process.env.CAST_CAD_COMPARISON_WORKER ? 'queued' : 'provider-required', providerRequired: !process.env.CAST_CAD_COMPARISON_WORKER, deltaReportPointer: '', createdByUserId: actor.id, createdAt: now() };
  state.comparisonJobs.push(job);
  audit(state, actor, 'Created drawing comparison job', 'CAST_CAD_COMPARISON_JOB', job.id, null, job);
  return { ok: true, job };
}
function normalizeBatchOperationInput(input = {}) {
  const operation = String(input.operation || input.batchOperation || input.batch_operation || 'update-markup-status').trim();
  const markupIds = [...new Set((input.markupIds || input.markup_ids || []).map(String).filter(Boolean))];
  const filters = input.filters || {};
  return {
    projectId: input.projectId || input.project_id || filters.projectId || '',
    sheetId: input.sheetId || input.sheet_id || filters.sheetId || '',
    operation,
    markupIds,
    filters,
    patch: input.patch || {},
    stamp: input.stamp || {},
    humanReviewApproved: Boolean(input.humanReviewApproved || input.human_review_approved),
  };
}
function targetMarkupsForBatch(state, normalized) {
  if (normalized.markupIds.length) {
    const ids = new Set(normalized.markupIds);
    return state.markups.filter((row) => ids.has(row.id));
  }
  return listMarkups(state, { projectId: normalized.projectId, sheetId: normalized.sheetId, status: normalized.filters.status, search: normalized.filters.search });
}
function createBatchOperation(state, input = {}, actor) {
  state.batchOperations ||= [];
  const permission = requireCastCad(actor.role, 'edit_markup');
  if (!permission.ok) return permission;
  const normalized = normalizeBatchOperationInput(input);
  const allowed = new Set(['update-markup-status','assign-markups','set-layer','place-stamp','flag-for-review']);
  if (!allowed.has(normalized.operation)) return { ok: false, status: 422, errors: ['operation must be update-markup-status, assign-markups, set-layer, place-stamp, or flag-for-review.'] };
  const targets = targetMarkupsForBatch(state, normalized);
  if (!targets.length) return { ok: false, status: 404, error: 'No CAST CAD markups matched the batch operation scope.' };
  const sensitive = normalized.operation === 'place-stamp' || normalized.patch.status === 'Verified' || normalized.patch.status === 'Resolved';
  if (sensitive && !normalized.humanReviewApproved) return { ok: false, status: 409, code: 'human-review-required', error: 'Batch stamp/resolution/verification requires human review approval before mutating markups.', targetCount: targets.length };
  const batch = { id: id('cad_batch'), projectId: normalized.projectId || targets[0]?.projectId || '', sheetId: normalized.sheetId || targets[0]?.sheetId || '', operation: normalized.operation, status: 'applied', targetCount: targets.length, updatedMarkupIds: [], humanReviewApproved: normalized.humanReviewApproved, providerRequired: false, createdByUserId: actor.id, createdAt: now() };
  targets.forEach((markup) => {
    const previous = clone(markup);
    if (normalized.operation === 'update-markup-status') markup.status = normalized.patch.status || input.status || 'Needs Review';
    if (normalized.operation === 'assign-markups') markup.assigneeUserId = normalized.patch.assigneeUserId || normalized.patch.assignee_user_id || input.assigneeUserId || input.assignee_user_id || markup.assigneeUserId;
    if (normalized.operation === 'set-layer') markup.layer = normalized.patch.layer || input.layer || markup.layer || 'Default';
    if (normalized.operation === 'flag-for-review') { markup.status = 'Needs Review'; markup.priority = normalized.patch.priority || input.priority || markup.priority || 'High'; }
    if (normalized.operation === 'place-stamp') {
      markup.status = normalized.patch.status || markup.status;
      markup.sourceSnapshot = { ...(markup.sourceSnapshot || {}), batchStamp: { label: normalized.stamp.label || input.label || 'CAST reviewed', note: normalized.stamp.note || input.note || '', appliedByUserId: actor.id, appliedAt: now(), humanReviewApproved: true } };
    }
    markup.updatedByUserId = actor.id;
    markup.updatedAt = now();
    batch.updatedMarkupIds.push(markup.id);
    audit(state, actor, `Batch ${normalized.operation} applied to CAST CAD markup`, 'CAST_CAD_MARKUP', markup.id, previous, markup, `Batch operation ${batch.id}`);
  });
  state.batchOperations.push(batch);
  audit(state, actor, 'Created CAST CAD batch operation', 'CAST_CAD_BATCH_OPERATION', batch.id, null, batch);
  return { ok: true, batch, markups: targets };
}
function listBatchOperations(state, filters = {}) {
  state.batchOperations ||= [];
  let rows = state.batchOperations.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.operation) rows = rows.filter((row) => row.operation === filters.operation);
  return rows;
}
function createFieldPackage(state, input = {}, actor) {
  state.fieldPackages ||= [];
  const permission = requireCastCad(actor.role, 'view');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id;
  const sheetIds = [...new Set((input.sheetIds || input.sheet_ids || []).map(String).filter(Boolean))];
  if (!projectId) return { ok: false, status: 422, errors: ['projectId is required.'] };
  if (!sheetIds.length) return { ok: false, status: 422, errors: ['At least one sheetId is required for a field package.'] };
  const expiresInHours = Math.max(1, Math.min(168, Number(input.expiresInHours || input.expires_in_hours || 24)));
  const packageMarkups = state.markups
    .filter((row) => row.projectId === projectId && sheetIds.includes(row.sheetId))
    .map((row) => ({ id: row.id, sheetId: row.sheetId, pageNumber: row.pageNumber, tool: row.tool, subject: row.subject, body: row.body, status: row.status, priority: row.priority, trade: row.trade, costCode: row.costCode, assigneeUserId: row.assigneeUserId, geometry: row.geometry, measurement: row.measurement, layer: row.layer, groupId: row.groupId, style: row.style, updatedAt: row.updatedAt }));
  const fieldPackage = {
    id: input.id || id('cad_field_pkg'),
    projectId,
    sheetIds,
    deviceId: String(input.deviceId || input.device_id || 'unassigned-device'),
    mode: 'offline-field-review',
    status: 'ready',
    markupCount: packageMarkups.length,
    cacheControl: 'private, max-age=0, no-store',
    publicExposure: false,
    requiresAuth: true,
    syncContract: { endpoint: '/api/cast-cad-exports', type: 'field-sync', conflictPolicy: 'server-audited-human-review' },
    package: { projectId, sheetIds, markups: packageMarkups, generatedAt: now() },
    expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.fieldPackages.push(fieldPackage);
  audit(state, actor, 'Created CAST CAD offline field package', 'CAST_CAD_FIELD_PACKAGE', fieldPackage.id, null, { ...fieldPackage, package: { ...fieldPackage.package, markups: packageMarkups.map((row) => row.id) } });
  return { ok: true, fieldPackage };
}
function syncFieldPackageDeltas(state, input = {}, actor) {
  state.fieldSyncEvents ||= [];
  const permission = requireCastCad(actor.role, 'edit_markup');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id;
  const packageId = input.packageId || input.package_id || '';
  const deltas = Array.isArray(input.deltas) ? input.deltas : [];
  if (!projectId) return { ok: false, status: 422, errors: ['projectId is required.'] };
  if (!deltas.length) return { ok: false, status: 422, errors: ['At least one field delta is required.'] };
  const sensitiveDelta = deltas.find((delta) => delta.operation === 'update-markup' && ['Verified','Resolved'].includes(delta.patch?.status));
  if (sensitiveDelta && !(input.humanReviewApproved || input.human_review_approved)) return { ok: false, status: 409, code: 'human-review-required', error: 'Offline field sync cannot verify or resolve markups without human review approval.', targetMarkupId: sensitiveDelta.markupId || sensitiveDelta.markup_id };
  const applied = [];
  const rejected = [];
  deltas.forEach((delta) => {
    const operation = delta.operation || 'comment';
    if (operation === 'create-markup') {
      const created = createMarkup(state, { ...delta.markup, projectId: delta.markup?.projectId || projectId }, actor);
      if (created.ok) applied.push({ operation, markupId: created.markup.id }); else rejected.push({ operation, error: created.error || created.errors });
      return;
    }
    if (operation === 'update-markup') {
      const updated = updateMarkup(state, delta.markupId || delta.markup_id, delta.patch || {}, actor);
      if (updated.ok) applied.push({ operation, markupId: updated.markup.id }); else rejected.push({ operation, markupId: delta.markupId || delta.markup_id, error: updated.error || updated.errors });
      return;
    }
    if (operation === 'comment') {
      const comment = createMarkupComment(state, delta.markupId || delta.markup_id, delta.comment || delta, actor);
      if (comment.ok) applied.push({ operation, markupId: comment.comment.markupId, commentId: comment.comment.id }); else rejected.push({ operation, markupId: delta.markupId || delta.markup_id, error: comment.error || comment.errors });
      return;
    }
    rejected.push({ operation, error: 'Unsupported field sync operation.' });
  });
  const event = { id: id('cad_field_sync'), projectId, packageId, deviceId: String(input.deviceId || input.device_id || 'unassigned-device'), status: rejected.length ? 'partial' : 'applied', appliedCount: applied.length, rejectedCount: rejected.length, humanReviewApproved: Boolean(input.humanReviewApproved || input.human_review_approved), applied, rejected, createdByUserId: actor.id, createdAt: now() };
  state.fieldSyncEvents.push(event);
  audit(state, actor, 'Synced CAST CAD offline field deltas', 'CAST_CAD_FIELD_SYNC', event.id, null, event);
  return { ok: rejected.length === 0, status: rejected.length ? 207 : 200, event };
}
function listFieldPackages(state, filters = {}) {
  state.fieldPackages ||= [];
  state.fieldSyncEvents ||= [];
  let packages = state.fieldPackages.slice();
  if (filters.projectId) packages = packages.filter((row) => row.projectId === filters.projectId);
  if (filters.deviceId) packages = packages.filter((row) => row.deviceId === filters.deviceId);
  let syncEvents = state.fieldSyncEvents.slice();
  if (filters.projectId) syncEvents = syncEvents.filter((row) => row.projectId === filters.projectId);
  if (filters.packageId) syncEvents = syncEvents.filter((row) => row.packageId === filters.packageId);
  return { packages, syncEvents };
}
function normalizeSheetRevision(input = {}, setVersion, actor, status = 'current') {
  const drawingNumber = input.drawingNumber || input.drawing_number || String(input.name || input.path || input.sheetId || '').replace(/\.pdf$/i, '');
  const sourcePath = input.sourcePath || input.source_path || input.path || '';
  return {
    id: input.id || id('cad_sheet_rev'),
    projectId: setVersion.projectId,
    setId: setVersion.setId,
    setVersionId: setVersion.id,
    sheetId: input.sheetId || input.sheet_id || safeSegment(sourcePath || drawingNumber),
    drawingNumber,
    drawingTitle: input.drawingTitle || input.drawing_title || input.title || '',
    revisionLabel: input.revisionLabel || input.revision_label || setVersion.revisionLabel,
    revisionDate: input.revisionDate || input.revision_date || setVersion.revisionDate,
    sourcePath,
    fileName: safeFileName(input.fileName || input.file_name || input.name || `${drawingNumber}.pdf`),
    contentHash: input.contentHash || input.content_hash || '',
    status,
    supersedesRevisionId: input.supersedesRevisionId || input.supersedes_revision_id || '',
    supersededByRevisionId: '',
    humanReviewApproved: Boolean(input.humanReviewApproved || input.human_review_approved),
    createdByUserId: actor.id,
    createdAt: now(),
  };
}
function createDrawingSetVersion(state, input = {}, actor) {
  state.drawingSetVersions ||= [];
  state.drawingSheetRevisions ||= [];
  const permission = requireCastCad(actor.role, 'manage_drawing_sets');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id;
  const setId = input.setId || input.set_id || safeSegment(input.name || 'drawing-set');
  const sheets = Array.isArray(input.sheets) ? input.sheets : [];
  if (!projectId) return { ok: false, status: 422, errors: ['projectId is required.'] };
  if (!sheets.length) return { ok: false, status: 422, errors: ['At least one sheet is required.'] };
  const version = {
    id: input.id || id('cad_set_version'),
    projectId,
    setId,
    name: input.name || 'CAST CAD Drawing Set',
    revisionLabel: input.revisionLabel || input.revision_label || `Set ${state.drawingSetVersions.filter((row) => row.projectId === projectId && row.setId === setId).length + 1}`,
    revisionDate: input.revisionDate || input.revision_date || now().slice(0, 10),
    sourceIndex: input.sourceIndex || input.source_index || '',
    status: 'current',
    sheetCount: sheets.length,
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.drawingSetVersions.filter((row) => row.projectId === projectId && row.setId === setId && row.status === 'current').forEach((row) => { row.status = 'superseded'; row.supersededByVersionId = version.id; });
  const revisions = sheets.map((sheet) => normalizeSheetRevision(sheet, version, actor));
  revisions.forEach((revision) => {
    state.drawingSheetRevisions
      .filter((row) => row.projectId === projectId && row.setId === setId && row.status === 'current' && (row.sheetId === revision.sheetId || row.drawingNumber === revision.drawingNumber))
      .forEach((row) => { row.status = 'superseded'; row.supersededByRevisionId = revision.id; revision.supersedesRevisionId = revision.supersedesRevisionId || row.id; });
  });
  state.drawingSetVersions.push(version);
  state.drawingSheetRevisions.push(...revisions);
  audit(state, actor, 'Created drawing set version and superseded matching sheets', 'CAST_CAD_DRAWING_SET_VERSION', version.id, null, { version, revisions });
  return { ok: true, version, revisions };
}
function slipSheetRevision(state, input = {}, actor) {
  state.drawingSetVersions ||= [];
  state.drawingSheetRevisions ||= [];
  const permission = requireCastCad(actor.role, 'manage_drawing_sets');
  if (!permission.ok) return permission;
  const targetId = input.targetRevisionId || input.target_revision_id || input.supersedesRevisionId || input.supersedes_revision_id;
  const target = state.drawingSheetRevisions.find((row) => row.id === targetId);
  if (!target) return { ok: false, status: 404, error: 'Target drawing revision not found.' };
  if (!input.humanReviewApproved && !input.human_review_approved) return { ok: false, status: 409, error: 'Slip-sheeting requires human review approval before a current sheet can be superseded.', code: 'human-review-required', targetRevision: target };
  const setVersion = state.drawingSetVersions.find((row) => row.id === target.setVersionId) || { projectId: target.projectId, setId: target.setId, id: target.setVersionId, revisionLabel: input.revisionLabel || target.revisionLabel, revisionDate: now().slice(0, 10) };
  const replacement = normalizeSheetRevision({ ...target, ...input.replacementSheet, ...input, sheetId: target.sheetId, drawingNumber: target.drawingNumber, supersedesRevisionId: target.id, humanReviewApproved: true }, setVersion, actor, 'current');
  target.status = 'superseded';
  target.supersededByRevisionId = replacement.id;
  state.drawingSheetRevisions.push(replacement);
  audit(state, actor, 'Slip-sheeted drawing revision after human approval', 'CAST_CAD_DRAWING_REVISION', replacement.id, target, replacement);
  return { ok: true, replacement, superseded: target };
}
function listDrawingSetVersions(state, filters = {}) {
  state.drawingSetVersions ||= [];
  state.drawingSheetRevisions ||= [];
  let versions = state.drawingSetVersions.slice();
  if (filters.projectId) versions = versions.filter((row) => row.projectId === filters.projectId);
  if (filters.setId) versions = versions.filter((row) => row.setId === filters.setId);
  const versionIds = new Set(versions.map((row) => row.id));
  const revisions = state.drawingSheetRevisions.filter((row) => versionIds.has(row.setVersionId) || (!filters.projectId || row.projectId === filters.projectId));
  return { versions, revisions };
}
function markupsCsv(markups) {
  const cols = ['id','projectId','sheetId','pageNumber','tool','subject','status','priority','trade','costCode','quantity','unit','createdByUserId','createdAt'];
  return [cols.join(','), ...markups.map((m) => cols.map((c) => csvEscape(c === 'quantity' ? (m.measurement?.value || '') : c === 'unit' ? (m.measurement?.unit || '') : m[c])).join(','))].join('\n');
}

module.exports = {
  CAST_CAD_ROLES, CAST_CAD_PERMISSIONS, canCastCad, requireCastCad, getActor, getState, resetState, json, readBody, audit,
  buildPdfStreamContract, sheetFromIndex, buildServerPdfUrls, createMarkup, updateMarkup, listMarkups, createTakeoffWorkbookExport, createAnnotatedPdfExport,
  createMarkupComment, listMarkupComments, listMarkupAudit,
  defaultViewerPreferences, normalizeViewerPreferences, getViewerPreferences, saveViewerPreferences,
  createRfiFromMarkup, indexOcrPage, searchOcr, createReviewRoom,
  createToolLibraryItem, updateToolLibraryItem, listToolLibraryItems, applyToolLibraryItemToMarkup,
  buildComparisonJob, createBatchOperation, listBatchOperations, createFieldPackage, syncFieldPackageDeltas, listFieldPackages,
  createDrawingSetVersion, slipSheetRevision, listDrawingSetVersions,
  markupsCsv,
};
