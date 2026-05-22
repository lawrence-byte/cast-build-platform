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
function buildPdfStreamContract({ sheet, actor, expiresInSeconds = 300 }) {
  const permission = requireCastCad(actor.role, 'stream_pdf');
  if (!permission.ok) return permission;
  if (!sheet || !sheet.path || sheet.extension !== 'pdf') return { ok: false, status: 404, error: 'PDF sheet not found in the approved drawing index.' };
  const providerConfigured = Boolean(process.env.CAST_CAD_PDF_STREAM_BASE || process.env.DROPBOX_ACCESS_TOKEN || process.env.CAST_SERVER_DOCUMENT_API_URL);
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
function listMarkups(state, filters = {}) {
  let rows = state.markups.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.search) { const q = String(filters.search).toLowerCase(); rows = rows.filter((row) => `${row.subject} ${row.body} ${row.trade} ${row.costCode}`.toLowerCase().includes(q)); }
  return rows;
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
function markupsCsv(markups) {
  const cols = ['id','projectId','sheetId','pageNumber','tool','subject','status','priority','trade','costCode','quantity','unit','createdByUserId','createdAt'];
  return [cols.join(','), ...markups.map((m) => cols.map((c) => csvEscape(c === 'quantity' ? (m.measurement?.value || '') : c === 'unit' ? (m.measurement?.unit || '') : m[c])).join(','))].join('\n');
}

module.exports = {
  CAST_CAD_ROLES, CAST_CAD_PERMISSIONS, canCastCad, requireCastCad, getActor, getState, resetState, json, readBody, audit,
  buildPdfStreamContract, sheetFromIndex, createMarkup, updateMarkup, listMarkups, createTakeoffWorkbookExport, createAnnotatedPdfExport,
  createRfiFromMarkup, indexOcrPage, searchOcr, createReviewRoom, buildComparisonJob, markupsCsv,
};
