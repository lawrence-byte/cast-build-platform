'use strict';

const crypto = require('crypto');
const { safeSegment, safeFileName } = require('./document-storage');

const CAST_CAD_ROLES = ['Owner Admin','CAST Admin','Project Manager','Project Engineer','Architect','Consultant','General Contractor','Subcontractor','Read Only Viewer'];
const CAST_CAD_PERMISSIONS = {
  'Owner Admin': ['view','stream_pdf','create_markup','edit_markup','delete_markup','export','create_rfi','review_room','admin','audit'],
  'CAST Admin': ['view','stream_pdf','create_markup','edit_markup','delete_markup','export','create_rfi','review_room','admin','audit'],
  'Project Manager': ['view','stream_pdf','create_markup','edit_markup','export','create_rfi','review_room','audit'],
  'Project Engineer': ['view','stream_pdf','create_markup','edit_markup','export','create_rfi','review_room'],
  Architect: ['view','stream_pdf','create_markup','edit_markup','export','review_room'],
  Consultant: ['view','stream_pdf','create_markup','export','review_room'],
  'General Contractor': ['view','stream_pdf','create_markup','export','create_rfi','review_room'],
  Subcontractor: ['view','stream_pdf','create_markup'],
  'Read Only Viewer': ['view','stream_pdf'],
};

const DEFAULT_STATE = () => ({
  markups: [], comments: [], auditLog: [], exportJobs: [], rfiLinks: [], reviewRooms: [], ocrPages: [], comparisonJobs: [], aiFindings: [], userPreferences: [],
  drawingSets: [], drawingSetVersions: [], slipSheetJobs: [],
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
function buildComparisonJob(state, input, actor) {
  const permission = requireCastCad(actor.role, 'export');
  if (!permission.ok) return permission;
  const job = { id: id('cad_compare'), projectId: input.projectId, baseSheetId: input.baseSheetId, revisedSheetId: input.revisedSheetId, status: process.env.CAST_CAD_COMPARISON_WORKER ? 'queued' : 'provider-required', providerRequired: !process.env.CAST_CAD_COMPARISON_WORKER, deltaReportPointer: '', createdByUserId: actor.id, createdAt: now() };
  state.comparisonJobs.push(job);
  audit(state, actor, 'Created drawing comparison job', 'CAST_CAD_COMPARISON_JOB', job.id, null, job);
  return { ok: true, job };
}
function normalizeSheetKey(sheet = {}) {
  return String(sheet.sheetId || sheet.sheet_id || sheet.drawingNumber || sheet.drawing_number || sheet.number || sheet.sourcePath || sheet.source_path || '').trim();
}
function normalizeDrawingSetSheet(sheet = {}, index = 0) {
  const sheetId = normalizeSheetKey(sheet) || `sheet-${index + 1}`;
  return {
    sheetId,
    drawingNumber: String(sheet.drawingNumber || sheet.drawing_number || sheet.number || sheetId),
    title: String(sheet.title || sheet.drawingTitle || sheet.drawing_title || ''),
    discipline: String(sheet.discipline || ''),
    revision: String(sheet.revision || sheet.current_revision || sheet.currentRevision || '0'),
    revisionDate: String(sheet.revisionDate || sheet.revision_date || sheet.date || ''),
    sourcePath: String(sheet.sourcePath || sheet.source_path || sheet.path || ''),
    status: sheet.status || 'Current',
  };
}
function createDrawingSetVersion(state, input = {}, actor) {
  const permission = requireCastCad(actor.role, 'admin');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id;
  const setName = input.setName || input.set_name;
  const sheets = Array.isArray(input.sheets) ? input.sheets.map(normalizeDrawingSetSheet).filter((sheet) => sheet.sheetId) : [];
  const errors = [];
  if (!projectId) errors.push('projectId is required.');
  if (!setName) errors.push('setName is required.');
  if (!sheets.length) errors.push('At least one sheet is required.');
  if (new Set(sheets.map((sheet) => sheet.sheetId)).size !== sheets.length) errors.push('Sheet IDs must be unique within a drawing set version.');
  if (errors.length) return { ok: false, status: 422, errors };
  const setKey = input.setKey || input.set_key || `${projectId}:${setName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const previousCurrent = state.drawingSetVersions.find((row) => row.projectId === projectId && row.setKey === setKey && row.status === 'Current') || null;
  const versionNumber = Number(input.versionNumber || input.version_number || ((previousCurrent?.versionNumber || 0) + 1));
  const drawingSet = state.drawingSets.find((row) => row.projectId === projectId && row.setKey === setKey) || { id: id('cad_drawing_set'), projectId, setKey, setName, createdAt: now() };
  drawingSet.setName = setName;
  drawingSet.currentVersionNumber = versionNumber;
  drawingSet.sheetCount = sheets.length;
  drawingSet.updatedAt = now();
  if (!state.drawingSets.some((row) => row.id === drawingSet.id)) state.drawingSets.push(drawingSet);
  if (previousCurrent) previousCurrent.status = 'Superseded';
  const version = { id: input.id || id('cad_dwgset_ver'), projectId, drawingSetId: drawingSet.id, setKey, setName, versionNumber, label: input.label || `Version ${versionNumber}`, status: input.status || 'Current', sheetCount: sheets.length, sheets, previousVersionId: previousCurrent?.id || '', createdByUserId: actor.id, createdAt: now() };
  state.drawingSetVersions.push(version);
  audit(state, actor, 'Created CAST CAD drawing set version', 'CAST_CAD_DRAWING_SET_VERSION', version.id, previousCurrent, version, previousCurrent ? `Superseded ${previousCurrent.id}` : 'Initial drawing set version');
  return { ok: true, drawingSet, version };
}
function compareDrawingSetVersions(baseVersion = {}, revisedVersion = {}) {
  const baseBySheet = new Map((baseVersion.sheets || []).map((sheet) => [sheet.sheetId, sheet]));
  const revisedBySheet = new Map((revisedVersion.sheets || []).map((sheet) => [sheet.sheetId, sheet]));
  const added = [], removed = [], revised = [], unchanged = [];
  for (const [sheetId, sheet] of revisedBySheet) {
    const base = baseBySheet.get(sheetId);
    if (!base) added.push(sheet);
    else if (base.revision !== sheet.revision || base.sourcePath !== sheet.sourcePath || base.title !== sheet.title) revised.push({ sheetId, before: base, after: sheet });
    else unchanged.push(sheet);
  }
  for (const [sheetId, sheet] of baseBySheet) if (!revisedBySheet.has(sheetId)) removed.push(sheet);
  return { added, removed, revised, unchanged, summary: { added: added.length, removed: removed.length, revised: revised.length, unchanged: unchanged.length } };
}
function getDrawingSetVersion(state, idOrKey) {
  return state.drawingSetVersions.find((row) => row.id === idOrKey || `${row.setKey}:v${row.versionNumber}` === idOrKey) || null;
}
function slipSheetDrawingSet(state, input = {}, actor) {
  const base = getDrawingSetVersion(state, input.baseVersionId || input.base_version_id || input.versionId || input.version_id);
  if (!base) return { ok: false, status: 404, error: 'Base drawing set version not found.' };
  const replacements = Array.isArray(input.replacements) ? input.replacements.map(normalizeDrawingSetSheet) : [];
  if (!replacements.length) return { ok: false, status: 422, errors: ['At least one replacement sheet is required.'] };
  const replacementById = new Map(replacements.map((sheet) => [sheet.sheetId, sheet]));
  const carried = base.sheets.filter((sheet) => !replacementById.has(sheet.sheetId));
  const next = createDrawingSetVersion(state, { projectId: base.projectId, setName: base.setName, setKey: base.setKey, sheets: [...carried, ...replacements].sort((a, b) => a.sheetId.localeCompare(b.sheetId, undefined, { numeric: true })), label: input.label || `Slip-sheet ${base.setName}` }, actor);
  if (!next.ok) return next;
  const diff = compareDrawingSetVersions(base, next.version);
  const job = { id: id('cad_slipsheet'), projectId: base.projectId, baseVersionId: base.id, revisedVersionId: next.version.id, status: 'ready', replacementCount: replacements.length, diff, createdByUserId: actor.id, createdAt: now(), pdfBytesTouched: false, notes: 'Provider-independent slip-sheet contract updates sheet version metadata only; private PDF bytes remain behind the authenticated stream provider.' };
  state.slipSheetJobs.push(job);
  audit(state, actor, 'Created CAST CAD slip-sheet revision job', 'CAST_CAD_SLIP_SHEET_JOB', job.id, base, job);
  return { ok: true, job, version: next.version, drawingSet: next.drawingSet };
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
  createRfiFromMarkup, indexOcrPage, searchOcr, createReviewRoom, buildComparisonJob,
  createDrawingSetVersion, compareDrawingSetVersions, slipSheetDrawingSet, getDrawingSetVersion,
  markupsCsv,
};
