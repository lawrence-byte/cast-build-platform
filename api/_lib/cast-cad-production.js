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
  markups: [], comments: [], commentMentionEvents: [], attachments: [], privateUploadLeases: [], auditLog: [], exportJobs: [], rfiLinks: [], workflowLinks: [], reviewRooms: [], reviewRoomInviteEvents: [], ocrPages: [], drawingAutoLinkRuns: [], comparisonJobs: [], modelIngestionJobs: [], modelQuantityLinks: [], aiFindings: [], userPreferences: [], viewportMappings: [], scaleCalibrations: [], pdfRendererSessions: [], drawingSetVersions: [], drawingSheetRevisions: [], drawingDocuments: [], drawingIndexQaReports: [], drawingUploadPackages: [], drawingTransmittals: [], drawingApprovalPackages: [], drawingApprovalDecisions: [], toolLibraryItems: [], toolLibraryPlacements: [], costCatalogItems: [], costCatalogImports: [], batchOperations: [], fieldPackages: [], fieldSyncEvents: [], projectMembers: [], pdfStreamLeases: [], savedMarkupViews: [],
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
  const hasIdentityHeader = Boolean(req.headers?.['x-cast-user-id'] || req.headers?.['x-cast-user-email'] || req.headers?.authorization);
  return {
    id: req.headers?.['x-cast-user-id'] || 'cast-system-user',
    name: req.headers?.['x-cast-user-name'] || 'CAST User',
    role: normalizeRole(req.headers?.['x-cast-role'] || 'Owner Admin'),
    email: req.headers?.['x-cast-user-email'] || 'user@cast-dev.example',
    authenticated: hasIdentityHeader || process.env.CAST_CAD_ALLOW_DEV_ACTOR === 'true',
  };
}
function requireAuthenticatedActor(actor) {
  if (process.env.CAST_CAD_REQUIRE_AUTH === 'true' && !actor.authenticated) {
    return { ok: false, status: 401, code: 'auth-required', error: 'CAST CAD production auth/session identity is required.' };
  }
  return { ok: true };
}
function audit(state, actor, action, entityType, entityId, previousValue, newValue, notes = '') {
  const entry = { id: id('cad_audit'), action, entityType, entityId, actorUserId: actor.id, actorRole: actor.role, previousValue: previousValue || null, newValue: newValue || null, notes, createdAt: now() };
  state.auditLog.push(entry);
  return entry;
}
function getState() { return memoryState; }
function resetState(seed) { memoryState = seed ? clone(seed) : DEFAULT_STATE(); return memoryState; }
function privateResponseHeaders(headers = {}) {
  return {
    'cache-control': 'private, max-age=0, no-store',
    pragma: 'no-cache',
    expires: '0',
    'x-cast-cad-private-contract': 'requires-auth; no-public-cache; no-public-links',
    ...headers,
  };
}
function applyPrivateResponseHeaders(res, headers = {}) {
  Object.entries(privateResponseHeaders(headers)).forEach(([k, v]) => res.setHeader(k, v));
}
function json(res, status, body, headers = {}) {
  res.statusCode = status;
  applyPrivateResponseHeaders(res, {
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(body, null, 2));
}
function privateCsv(res, status, body, headers = {}) {
  res.statusCode = status;
  applyPrivateResponseHeaders(res, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': headers['content-disposition'] || headers['Content-Disposition'] || 'attachment; filename="cast-cad-private-report.csv"',
    ...headers,
  });
  res.end(body);
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
function createPdfStreamLease(state, { sheet, projectId = 'default', expiresInSeconds = 300 } = {}, actor) {
  state.pdfStreamLeases ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const result = buildPdfStreamContract({ sheet, actor, expiresInSeconds });
  if (!result.contract) return result;
  const lease = {
    id: result.contract.streamId,
    projectId,
    sheetName: result.contract.sheetName,
    sourcePath: result.contract.sourcePath,
    actorUserId: actor.id,
    actorRole: actor.role,
    expiresAt: result.contract.expiresAt,
    status: result.ok ? 'ready' : 'provider-required',
    providerRequired: !result.ok,
    publicExposure: false,
    requiresAuth: true,
    cacheControl: result.contract.cacheControl,
    provider: result.contract.provider,
    requiredEnvVars: result.ok ? [] : ['CAST_CAD_PDF_STREAM_BASE or DROPBOX_ACCESS_TOKEN or CAST_SERVER_DOCUMENT_API_URL'],
    createdAt: now(),
  };
  state.pdfStreamLeases.push(lease);
  audit(state, actor, result.ok ? 'Created authenticated CAST CAD PDF stream lease' : 'Blocked CAST CAD PDF stream lease until provider configured', 'CAST_CAD_PDF_STREAM_LEASE', lease.id, null, lease, 'Private drawing stream request is audited; no public URL or cacheable PDF artifact is exposed.');
  return { ...result, lease };
}
function pdfRendererWorkerConfigured() { return Boolean(process.env.CAST_CAD_PDF_RENDERER_WORKER || process.env.CAST_CAD_PDFJS_WORKER_URL || process.env.CAST_CAD_PDF_SDK_PROVIDER); }
function pdfRendererContract() {
  return {
    rendererRequired: 'CAST_CAD_PDF_RENDERER_WORKER or CAST_CAD_PDFJS_WORKER_URL or CAST_CAD_PDF_SDK_PROVIDER',
    privateArtifacts: true,
    publicExposure: false,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    outputs: ['page-render-session','thumbnail-manifest','page-labels','bookmarks','text-search-index','viewport-matrices'],
    workerResponsibilities: ['lazy page rendering','thumbnail rendering','page label extraction','bookmark/outline extraction','text search indexing','native viewport matrix capture'],
  };
}
function createPdfRendererSession(state, input = {}, actor) {
  state.pdfRendererSessions ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'stream_pdf');
  if (!permission.ok) return permission;
  const sourcePointer = String(input.streamLeaseId || input.stream_lease_id || input.sourcePointer || input.source_pointer || '').trim();
  if (!sourcePointer) return { ok: false, status: 422, errors: ['A private streamLeaseId or sourcePointer is required before creating a PDF renderer session.'] };
  if (/^https?:\/\//i.test(sourcePointer)) return { ok: false, status: 409, code: 'public-url-forbidden', error: 'CAST CAD PDF renderer sessions require private stream leases/provider pointers; public PDF URLs are refused.' };
  const providerReady = pdfRendererWorkerConfigured();
  const session = {
    id: input.id || id('cad_pdf_render'),
    type: 'pdf-renderer-session',
    projectId: input.projectId || input.project_id || 'default',
    sheetId: input.sheetId || input.sheet_id || '',
    pageNumber: Number(input.pageNumber || input.page_number || 1),
    sourcePointer,
    status: providerReady ? 'queued' : 'provider-required',
    providerRequired: !providerReady,
    requiredEnvVars: providerReady ? [] : ['CAST_CAD_PDF_RENDERER_WORKER or CAST_CAD_PDFJS_WORKER_URL or CAST_CAD_PDF_SDK_PROVIDER'],
    provider: process.env.CAST_CAD_PDF_RENDERER_WORKER ? 'cast-cad-renderer-worker' : process.env.CAST_CAD_PDFJS_WORKER_URL ? 'pdfjs-worker' : process.env.CAST_CAD_PDF_SDK_PROVIDER || 'unconfigured',
    requestedOutputs: Array.isArray(input.outputs) && input.outputs.length ? input.outputs : pdfRendererContract().outputs,
    thumbnailsReady: false,
    bookmarksReady: false,
    searchIndexReady: false,
    viewportMatricesReady: false,
    outputPointer: '',
    publicExposure: false,
    privateArtifacts: true,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.pdfRendererSessions.push(session);
  audit(state, actor, providerReady ? 'Queued CAST CAD PDF renderer session' : 'Blocked CAST CAD PDF renderer session until worker configured', 'CAST_CAD_PDF_RENDERER_SESSION', session.id, null, session, providerReady ? 'Private renderer worker queued; artifacts remain no-store.' : 'No PDF.js/commercial renderer worker is configured; no thumbnails/search/page artifacts were fabricated.');
  if (!providerReady) return { ok: false, status: 503, code: 'provider-required', error: 'CAST CAD PDF renderer worker is not configured; refusing to fabricate multipage rendering, thumbnails, bookmarks, text search, or viewport matrices.', requiredEnvVars: session.requiredEnvVars, rendererSession: session, contract: pdfRendererContract() };
  return { ok: true, status: 202, rendererSession: session, contract: pdfRendererContract() };
}
function listPdfRendererSessions(state, filters = {}) {
  state.pdfRendererSessions ||= [];
  let rows = state.pdfRendererSessions.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  return rows;
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
function deleteMarkup(state, markupId, input = {}, actor) {
  const permission = requireCastCad(actor.role, 'delete_markup');
  if (!permission.ok) return permission;
  const index = state.markups.findIndex((row) => row.id === markupId);
  if (index === -1) return { ok: false, status: 404, error: 'Markup not found.' };
  const markup = state.markups[index];
  const previous = clone(markup);
  const hardDelete = Boolean(input.hardDelete || input.hard_delete || input.purge);
  if (hardDelete && !(input.humanReviewApproved || input.human_review_approved)) {
    return { ok: false, status: 409, code: 'human-review-required', error: 'Permanent CAST CAD markup deletion requires human review approval; soft-delete/archive remains available.', markup };
  }
  if (hardDelete) {
    state.markups.splice(index, 1);
    audit(state, actor, 'Permanently deleted CAST CAD markup after human approval', 'CAST_CAD_MARKUP', markup.id, previous, null, 'Hard delete/purge was human-review approved and audited.');
    return { ok: true, deleted: true, hardDeleted: true, markupId };
  }
  if (markup.deletedAt) return { ok: true, deleted: true, hardDeleted: false, markup };
  markup.status = 'Deleted';
  markup.deletedAt = now();
  markup.deletedByUserId = actor.id;
  markup.updatedByUserId = actor.id;
  markup.updatedAt = now();
  markup.sourceSnapshot = { ...(markup.sourceSnapshot || {}), deletion: { mode: 'soft-delete', reason: String(input.reason || input.deleteReason || input.delete_reason || '').trim(), deletedByUserId: actor.id, deletedAt: markup.deletedAt } };
  audit(state, actor, 'Soft-deleted CAST CAD markup', 'CAST_CAD_MARKUP', markup.id, previous, markup, 'Markup is archived/deleted by default filters but retained for audit history.');
  return { ok: true, deleted: true, hardDeleted: false, markup };
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
function commentMentionTransportConfigured() { return Boolean(process.env.CAST_CAD_COMMENT_NOTIFICATION_TRANSPORT || process.env.CAST_CAD_EMAIL_PROVIDER || process.env.CAST_CAD_REALTIME_PROVIDER); }
function createCommentMentionDelivery(state, input = {}, actor) {
  state.commentMentionEvents ||= [];
  const permission = requireCastCad(actor.role, 'create_markup');
  if (!permission.ok) return permission;
  const commentId = input.commentId || input.comment_id;
  const comment = state.comments.find((row) => row.id === commentId);
  if (!comment) return { ok: false, status: 404, error: 'CAST CAD markup comment not found.' };
  const markup = state.markups.find((row) => row.id === comment.markupId);
  if (!markup) return { ok: false, status: 404, error: 'CAST CAD markup for comment not found.' };
  const mentions = (Array.isArray(input.mentions) && input.mentions.length ? input.mentions : comment.mentions || [])
    .map((mention) => String(mention || '').replace(/^@/, '').trim().toLowerCase())
    .filter(Boolean);
  const recipients = [...new Set(mentions)].map((mention) => ({
    mention,
    email: mention.includes('@') ? mention : '',
    userHandle: mention.includes('@') ? '' : mention,
    status: commentMentionTransportConfigured() ? 'queued' : 'provider-required',
  }));
  if (!recipients.length) return { ok: false, status: 422, errors: ['At least one @mention recipient is required before delivery can be requested.'] };
  const providerReady = commentMentionTransportConfigured();
  const event = {
    id: id('cad_mention_event'),
    projectId: markup.projectId,
    sheetId: markup.sheetId,
    markupId: markup.id,
    commentId: comment.id,
    deliveryType: input.deliveryType || input.delivery_type || 'markup-comment-mention',
    status: providerReady ? 'queued' : 'provider-required',
    providerRequired: !providerReady,
    requiredEnvVars: providerReady ? [] : ['CAST_CAD_COMMENT_NOTIFICATION_TRANSPORT or CAST_CAD_EMAIL_PROVIDER or CAST_CAD_REALTIME_PROVIDER'],
    provider: process.env.CAST_CAD_COMMENT_NOTIFICATION_TRANSPORT || (process.env.CAST_CAD_EMAIL_PROVIDER ? 'email-provider' : process.env.CAST_CAD_REALTIME_PROVIDER ? 'realtime-provider' : 'unconfigured'),
    recipientCount: recipients.length,
    recipients,
    publicExposure: false,
    noPublicLinks: true,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    message: String(input.message || comment.body || '').slice(0, 2000),
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.commentMentionEvents.push(event);
  audit(state, actor, 'Created CAST CAD markup mention notification event', 'CAST_CAD_COMMENT_MENTION', event.id, null, event, event.providerRequired ? 'Mention notification transport is not configured; no external email/realtime message or public link was fabricated.' : 'Mention notification queued for configured private transport.');
  if (!providerReady) return { ok: false, status: 503, code: 'provider-required', error: 'CAST CAD comment mention delivery requires CAST_CAD_COMMENT_NOTIFICATION_TRANSPORT, CAST_CAD_EMAIL_PROVIDER, or CAST_CAD_REALTIME_PROVIDER; refusing to fabricate delivered notifications.', requiredEnvVars: event.requiredEnvVars, mentionEvent: event };
  return { ok: true, mentionEvent: event };
}
function listCommentMentionEvents(state, filters = {}) {
  state.commentMentionEvents ||= [];
  let rows = state.commentMentionEvents.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.markupId) rows = rows.filter((row) => row.markupId === filters.markupId);
  if (filters.commentId) rows = rows.filter((row) => row.commentId === filters.commentId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  return rows;
}
function listMarkupComments(state, markupId) {
  return state.comments.filter((row) => !markupId || row.markupId === markupId);
}
function listMarkupAudit(state, markupId) {
  if (!markupId) return state.auditLog.slice();
  const commentIds = new Set(state.comments.filter((row) => row.markupId === markupId).map((row) => row.id));
  const attachmentIds = new Set((state.attachments || []).filter((row) => row.markupId === markupId || commentIds.has(row.commentId)).map((row) => row.id));
  const mentionEventIds = new Set((state.commentMentionEvents || []).filter((row) => row.markupId === markupId || commentIds.has(row.commentId)).map((row) => row.id));
  return state.auditLog.filter((row) => row.entityId === markupId || commentIds.has(row.entityId) || attachmentIds.has(row.entityId) || mentionEventIds.has(row.entityId));
}
function attachmentStorageConfigured() { return Boolean(process.env.CAST_CAD_ATTACHMENT_STORAGE_ADAPTER || process.env.CAST_CAD_ATTACHMENT_STORAGE_URL); }
function normalizeAttachment(input = {}, actor) {
  const originalFileName = safeFileName(input.originalFileName || input.fileName || input.filename || input.name || 'cast-cad-attachment.bin');
  return {
    id: input.id || id('cad_attachment'),
    projectId: input.projectId || input.project_id || 'default',
    sheetId: input.sheetId || input.sheet_id || '',
    markupId: input.markupId || input.markup_id || '',
    commentId: input.commentId || input.comment_id || '',
    originalFileName,
    contentType: String(input.contentType || input.content_type || 'application/octet-stream').toLowerCase(),
    byteSize: Number(input.byteSize || input.byte_size || input.size || 0),
    contentHash: String(input.contentHash || input.content_hash || '').trim(),
    caption: String(input.caption || '').trim(),
    source: input.source || 'cast-cad-attachment-manifest',
    storageStatus: attachmentStorageConfigured() ? 'pending-provider-write' : 'provider-required',
    providerRequired: !attachmentStorageConfigured(),
    requiredEnvVars: attachmentStorageConfigured() ? [] : ['CAST_CAD_ATTACHMENT_STORAGE_ADAPTER'],
    publicExposure: false,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    storedObjectKey: attachmentStorageConfigured() ? String(input.storedObjectKey || input.stored_object_key || '').trim() : '',
    createdByUserId: actor.id,
    createdAt: now(),
  };
}
function validateAttachment(state, attachment) {
  const errors = [];
  if (!attachment.projectId) errors.push('projectId is required.');
  if (!attachment.markupId) errors.push('markupId is required.');
  if (!state.markups.some((row) => row.id === attachment.markupId)) errors.push('markupId must reference an existing CAST CAD markup.');
  if (attachment.commentId && !state.comments.some((row) => row.id === attachment.commentId && row.markupId === attachment.markupId)) errors.push('commentId must belong to the same markup thread.');
  if (!attachment.originalFileName) errors.push('originalFileName is required.');
  if (!attachment.byteSize || attachment.byteSize < 1) errors.push('byteSize must be greater than zero.');
  if (attachment.byteSize > 50 * 1024 * 1024) errors.push('Attachment metadata is capped at 50 MB unless a private storage adapter signs the upload.');
  if (!attachment.contentHash) errors.push('contentHash is required so private evidence files can be deduplicated and audited without exposing bytes.');
  if (!/^image\/(jpeg|png|webp|heic)$|^application\/pdf$|^text\/plain$/.test(attachment.contentType)) errors.push('contentType must be an approved evidence type: image/jpeg, image/png, image/webp, image/heic, application/pdf, or text/plain.');
  return errors;
}
function createMarkupAttachment(state, input = {}, actor) {
  state.attachments ||= [];
  const permission = requireCastCad(actor.role, 'create_markup');
  if (!permission.ok) return permission;
  const attachment = normalizeAttachment(input, actor);
  const errors = validateAttachment(state, attachment);
  if (errors.length) return { ok: false, status: 422, errors };
  if ((input.authoritative || input.durable || input.uploadBytes || input.upload_bytes) && !attachmentStorageConfigured()) {
    return { ok: false, status: 503, code: 'provider-required', error: 'Private attachment storage is not configured; refusing to claim durable evidence-file persistence.', requiredEnvVars: ['CAST_CAD_ATTACHMENT_STORAGE_ADAPTER'], attachment };
  }
  state.attachments.push(attachment);
  audit(state, actor, 'Registered CAST CAD private attachment manifest', 'CAST_CAD_ATTACHMENT', attachment.id, null, attachment, attachment.providerRequired ? 'Manifest/audit only; configure CAST_CAD_ATTACHMENT_STORAGE_ADAPTER for durable private bytes.' : 'Private storage adapter configured; upload/write must complete provider-side.');
  return { ok: true, attachment, contract: attachmentContract() };
}
function listMarkupAttachments(state, filters = {}) {
  state.attachments ||= [];
  let rows = state.attachments.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.markupId) rows = rows.filter((row) => row.markupId === filters.markupId);
  if (filters.commentId) rows = rows.filter((row) => row.commentId === filters.commentId);
  return rows;
}
function attachmentContract() {
  return { privateArtifacts: true, publicExposure: false, requiresAuth: true, cacheControl: 'private, max-age=0, no-store', durableAdapterRequired: 'CAST_CAD_ATTACHMENT_STORAGE_ADAPTER', acceptedContentTypes: ['image/jpeg','image/png','image/webp','image/heic','application/pdf','text/plain'] };
}
function privateUploadStorageConfigured(purpose = '') {
  if (process.env.CAST_CAD_PRIVATE_UPLOAD_STORAGE_ADAPTER) return true;
  if (/drawing|pdf|annotation/i.test(purpose)) return Boolean(process.env.CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER || process.env.CAST_CAD_DOCUMENT_STORAGE_ADAPTER || process.env.CAST_SERVER_DOCUMENT_API_URL || process.env.DROPBOX_ACCESS_TOKEN);
  if (/attachment|evidence|photo/i.test(purpose)) return Boolean(process.env.CAST_CAD_ATTACHMENT_STORAGE_ADAPTER || process.env.CAST_CAD_ATTACHMENT_STORAGE_URL);
  if (/model|cad|ifc|dwg|dxf|rvt/i.test(purpose)) return Boolean(process.env.CAST_CAD_MODEL_UPLOAD_STORAGE_ADAPTER || process.env.CAST_CAD_MODEL_INGESTION_WORKER || process.env.CAST_CAD_DOCUMENT_STORAGE_ADAPTER);
  return false;
}
function privateUploadRequiredEnvVars(purpose = '') {
  if (/attachment|evidence|photo/i.test(purpose)) return ['CAST_CAD_ATTACHMENT_STORAGE_ADAPTER'];
  if (/model|cad|ifc|dwg|dxf|rvt/i.test(purpose)) return ['CAST_CAD_MODEL_UPLOAD_STORAGE_ADAPTER or CAST_CAD_DOCUMENT_STORAGE_ADAPTER or CAST_CAD_MODEL_INGESTION_WORKER'];
  return ['CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER or CAST_CAD_DOCUMENT_STORAGE_ADAPTER or CAST_SERVER_DOCUMENT_API_URL or DROPBOX_ACCESS_TOKEN'];
}
function privateUploadLeaseContract() {
  return {
    endpoint: '/api/cast-cad-exports',
    type: 'private-upload-lease',
    publicExposure: false,
    noPublicUrls: true,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    acceptedPurposes: ['drawing-pdf','annotation-pdf','attachment-evidence','model-source'],
    requiredBefore: ['drawing-upload-package sourcePointer','pdf-annotation-import sourcePointer','model-ingestion sourcePointer','markup attachment byte upload'],
  };
}
function normalizePrivateUploadLease(input = {}, actor) {
  const purpose = String(input.purpose || input.uploadPurpose || input.upload_purpose || 'drawing-pdf').trim().toLowerCase();
  return {
    id: input.id || id('cad_upload_lease'),
    type: 'private-upload-lease',
    projectId: input.projectId || input.project_id || 'default',
    sheetId: input.sheetId || input.sheet_id || '',
    purpose,
    fileName: safeFileName(input.fileName || input.file_name || input.name || 'cast-cad-upload.bin'),
    contentType: String(input.contentType || input.content_type || 'application/pdf').toLowerCase(),
    byteSize: Number(input.byteSize || input.byte_size || input.size || 0),
    contentHash: String(input.contentHash || input.content_hash || '').trim(),
    expiresAt: new Date(Date.now() + Number(input.expiresInSeconds || input.expires_in_seconds || 900) * 1000).toISOString(),
    status: privateUploadStorageConfigured(purpose) ? 'ready' : 'provider-required',
    providerRequired: !privateUploadStorageConfigured(purpose),
    requiredEnvVars: privateUploadStorageConfigured(purpose) ? [] : privateUploadRequiredEnvVars(purpose),
    provider: process.env.CAST_CAD_PRIVATE_UPLOAD_STORAGE_ADAPTER || process.env.CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER || process.env.CAST_CAD_ATTACHMENT_STORAGE_ADAPTER || process.env.CAST_CAD_MODEL_UPLOAD_STORAGE_ADAPTER || process.env.CAST_CAD_DOCUMENT_STORAGE_ADAPTER || (process.env.CAST_SERVER_DOCUMENT_API_URL ? 'cast-server-document-api' : process.env.DROPBOX_ACCESS_TOKEN ? 'dropbox' : 'unconfigured'),
    uploadUrl: '',
    sourcePointer: '',
    publicExposure: false,
    noPublicUrls: true,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    createdByUserId: actor.id,
    createdAt: now(),
  };
}
function validatePrivateUploadLease(lease) {
  const errors = [];
  if (!lease.projectId) errors.push('projectId is required.');
  if (!['drawing-pdf','annotation-pdf','attachment-evidence','model-source'].includes(lease.purpose)) errors.push('purpose must be one of: drawing-pdf, annotation-pdf, attachment-evidence, model-source.');
  if (!lease.fileName) errors.push('fileName is required.');
  if (!lease.byteSize || lease.byteSize < 1) errors.push('byteSize must be greater than zero.');
  if (lease.byteSize > 1024 * 1024 * 1024) errors.push('CAST CAD private upload leases are capped at 1 GB before a provider-specific multipart adapter is configured.');
  if (!lease.contentHash) errors.push('contentHash is required before a private upload lease can be audited.');
  if ((lease.purpose === 'drawing-pdf' || lease.purpose === 'annotation-pdf') && lease.contentType !== 'application/pdf') errors.push('drawing-pdf and annotation-pdf uploads must use contentType application/pdf.');
  if (lease.purpose === 'attachment-evidence' && !/^image\/(jpeg|png|webp|heic)$|^application\/pdf$|^text\/plain$/.test(lease.contentType)) errors.push('attachment-evidence contentType must be an approved evidence type.');
  if (lease.purpose === 'model-source' && !/\.(ifc|dwg|dxf|rvt|rfa|skp|obj|glb|gltf)$/i.test(lease.fileName)) errors.push('model-source upload fileName must be an approved CAD/model extension.');
  return errors;
}
function createPrivateUploadLease(state, input = {}, actor) {
  state.privateUploadLeases ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const purpose = String(input.purpose || input.uploadPurpose || input.upload_purpose || 'drawing-pdf').toLowerCase();
  const permissionName = /attachment|evidence|photo/i.test(purpose) ? 'create_markup' : /model|cad/i.test(purpose) ? 'export' : 'manage_drawing_sets';
  const permission = requireCastCad(actor.role, permissionName);
  if (!permission.ok) return permission;
  const lease = normalizePrivateUploadLease(input, actor);
  const errors = validatePrivateUploadLease(lease);
  if (errors.length) return { ok: false, status: 422, errors, contract: privateUploadLeaseContract() };
  state.privateUploadLeases.push(lease);
  audit(state, actor, lease.providerRequired ? 'Blocked CAST CAD private upload lease until storage provider configured' : 'Created CAST CAD private upload lease', 'CAST_CAD_PRIVATE_UPLOAD_LEASE', lease.id, null, lease, lease.providerRequired ? 'No public upload URL or source pointer was fabricated; configure the named private storage adapter/provider.' : 'Private provider must issue the upload URL/source pointer without public exposure.');
  if (lease.providerRequired) return { ok: false, status: 503, code: 'provider-required', error: 'CAST CAD private upload leases require a configured private storage provider; refusing to fabricate public upload URLs or source pointers.', requiredEnvVars: lease.requiredEnvVars, lease, contract: privateUploadLeaseContract() };
  return { ok: true, status: 201, lease, contract: privateUploadLeaseContract() };
}
function listPrivateUploadLeases(state, filters = {}) {
  state.privateUploadLeases ||= [];
  let rows = state.privateUploadLeases.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.purpose) rows = rows.filter((row) => row.purpose === filters.purpose);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  return rows;
}
function listMarkups(state, filters = {}) {
  let rows = state.markups.slice();
  if (!filters.includeDeleted) rows = rows.filter((row) => !row.deletedAt && row.status !== 'Deleted');
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.priority) rows = rows.filter((row) => row.priority === filters.priority);
  if (filters.tool) rows = rows.filter((row) => row.tool === filters.tool);
  if (filters.trade) rows = rows.filter((row) => row.trade === filters.trade);
  if (filters.costCode || filters.cost_code) rows = rows.filter((row) => row.costCode === (filters.costCode || filters.cost_code));
  if (filters.layer) rows = rows.filter((row) => row.layer === filters.layer);
  if (filters.groupId || filters.group_id) rows = rows.filter((row) => row.groupId === (filters.groupId || filters.group_id));
  if (filters.assigneeUserId || filters.assignee_user_id) rows = rows.filter((row) => row.assigneeUserId === (filters.assigneeUserId || filters.assignee_user_id));
  if (filters.reviewState === 'needs-review' || filters.review_state === 'needs-review') rows = rows.filter((row) => row.status === 'Needs Review' || row.measurement?.humanReviewRequired || row.sourceSnapshot?.humanReviewRequired);
  if (filters.search) { const q = String(filters.search).toLowerCase(); rows = rows.filter((row) => `${row.subject} ${row.body} ${row.trade} ${row.costCode}`.toLowerCase().includes(q)); }
  return rows;
}
function normalizeMarkupViewFilters(input = {}) {
  const source = input.filters || input;
  return ['projectId','sheetId','status','priority','tool','trade','costCode','layer','groupId','assigneeUserId','reviewState','search','includeDeleted'].reduce((filters, key) => {
    const snake = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    const value = source[key] !== undefined ? source[key] : source[snake];
    if (value !== undefined && value !== null && value !== '') filters[key] = key === 'includeDeleted' ? Boolean(value) : String(value);
    return filters;
  }, {});
}
function createSavedMarkupView(state, input = {}, actor) {
  const permission = requireCastCad(actor.role, 'view');
  if (!permission.ok) return permission;
  const name = String(input.name || input.viewName || input.view_name || '').trim();
  if (!name) return { ok: false, status: 422, errors: ['Saved markup view name is required.'] };
  const filters = normalizeMarkupViewFilters(input);
  if (!filters.projectId) filters.projectId = input.projectId || input.project_id || 'default';
  const previewRows = listMarkups(state, filters);
  state.savedMarkupViews ||= [];
  const view = {
    id: input.id || id('cad_markup_view'),
    projectId: filters.projectId,
    name,
    description: String(input.description || '').trim(),
    filters,
    rowCountAtSave: previewRows.length,
    privateReport: true,
    publicExposure: false,
    requiresAuth: true,
    durableAdapterRequired: 'CAST_CAD_MARKUP_DATABASE_ADAPTER or CAST_CAD_DATABASE_URL',
    createdByUserId: actor.id,
    createdAt: now(),
    updatedAt: now(),
  };
  state.savedMarkupViews.push(view);
  audit(state, actor, 'Saved CAST CAD markup filter/report view', 'CAST_CAD_MARKUP_VIEW', view.id, null, view, 'Saved view stores filters only; no private markup data is exposed publicly.');
  return { ok: true, view, previewCount: previewRows.length, markups: previewRows };
}
function listSavedMarkupViews(state, filters = {}) {
  let rows = (state.savedMarkupViews || []).slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.createdByUserId) rows = rows.filter((row) => row.createdByUserId === filters.createdByUserId);
  return rows;
}
function runSavedMarkupView(state, viewId, extraFilters = {}) {
  const view = (state.savedMarkupViews || []).find((row) => row.id === viewId);
  if (!view) return { ok: false, status: 404, error: 'Saved markup view not found.' };
  const filters = { ...view.filters, ...normalizeMarkupViewFilters(extraFilters) };
  const markups = listMarkups(state, filters);
  return { ok: true, view, filters, count: markups.length, markups };
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
function normalizeViewportMapping(input = {}, actor) {
  const pageWidth = Number(input.pageWidth ?? input.page_width ?? input.mediaBoxWidth ?? input.media_box_width ?? 0);
  const pageHeight = Number(input.pageHeight ?? input.page_height ?? input.mediaBoxHeight ?? input.media_box_height ?? 0);
  const viewportWidth = Number(input.viewportWidth ?? input.viewport_width ?? pageWidth);
  const viewportHeight = Number(input.viewportHeight ?? input.viewport_height ?? pageHeight);
  const scale = Number(input.scale || 1);
  const rotation = ((Number(input.rotation || 0) % 360) + 360) % 360;
  return {
    id: input.id || id('cad_viewport'),
    projectId: input.projectId || input.project_id || 'default',
    sheetId: input.sheetId || input.sheet_id || '',
    pageNumber: Number(input.pageNumber || input.page_number || 1),
    pageWidth,
    pageHeight,
    viewportWidth,
    viewportHeight,
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
    rotation,
    coordinateSystem: 'pdf-points-bottom-left',
    normalizedOrigin: 'top-left-percent',
    renderer: input.renderer || 'browser-pdf-contract',
    source: input.source || 'cast-cad-workbench',
    calibration: input.calibration || null,
    updatedByUserId: actor.id,
    createdAt: input.createdAt || input.created_at || now(),
    updatedAt: now(),
  };
}
function validateViewportMapping(mapping) {
  const errors = [];
  if (!mapping.projectId) errors.push('projectId is required.');
  if (!mapping.sheetId) errors.push('sheetId is required.');
  if (!Number.isFinite(mapping.pageNumber) || mapping.pageNumber < 1) errors.push('pageNumber must be a positive number.');
  if (!Number.isFinite(mapping.pageWidth) || mapping.pageWidth <= 0) errors.push('pageWidth must be a positive number.');
  if (!Number.isFinite(mapping.pageHeight) || mapping.pageHeight <= 0) errors.push('pageHeight must be a positive number.');
  if (!Number.isFinite(mapping.viewportWidth) || mapping.viewportWidth <= 0) errors.push('viewportWidth must be a positive number.');
  if (!Number.isFinite(mapping.viewportHeight) || mapping.viewportHeight <= 0) errors.push('viewportHeight must be a positive number.');
  if (![0, 90, 180, 270].includes(mapping.rotation)) errors.push('rotation must be 0, 90, 180, or 270 degrees.');
  return errors;
}
function normalizedPointToPdfPoint(mapping, point = {}) {
  const xPct = Math.max(0, Math.min(100, Number(point.x ?? point.normalizedX ?? point.normalized_x ?? 0)));
  const yPct = Math.max(0, Math.min(100, Number(point.y ?? point.normalizedY ?? point.normalized_y ?? 0)));
  const x = (xPct / 100) * mapping.pageWidth;
  const yTop = (yPct / 100) * mapping.pageHeight;
  const y = mapping.pageHeight - yTop;
  if (mapping.rotation === 90) return { x: Number(y.toFixed(3)), y: Number((mapping.pageWidth - x).toFixed(3)) };
  if (mapping.rotation === 180) return { x: Number((mapping.pageWidth - x).toFixed(3)), y: Number((mapping.pageHeight - y).toFixed(3)) };
  if (mapping.rotation === 270) return { x: Number((mapping.pageHeight - y).toFixed(3)), y: Number(x.toFixed(3)) };
  return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
}
function saveViewportMapping(state, input = {}, actor) {
  state.viewportMappings ||= [];
  const permission = requireCastCad(actor.role, 'view');
  if (!permission.ok) return permission;
  const mapping = normalizeViewportMapping(input, actor);
  const errors = validateViewportMapping(mapping);
  if (errors.length) return { ok: false, status: 422, errors };
  const previous = state.viewportMappings.find((row) => row.projectId === mapping.projectId && row.sheetId === mapping.sheetId && row.pageNumber === mapping.pageNumber) || null;
  const previousSnapshot = previous ? clone(previous) : null;
  if (previous) Object.assign(previous, mapping, { id: previous.id, createdAt: previous.createdAt });
  else state.viewportMappings.push(mapping);
  const current = previous || mapping;
  const samplePoint = normalizedPointToPdfPoint(current, input.samplePoint || input.sample_point || { x: 50, y: 50 });
  audit(state, actor, previous ? 'Updated CAST CAD viewport coordinate mapping' : 'Saved CAST CAD viewport coordinate mapping', 'CAST_CAD_VIEWPORT_MAPPING', current.id, previousSnapshot, current, 'Provider-independent PDF coordinate contract; renderer worker can consume this mapping without fabricating private PDF artifacts.');
  return { ok: true, mapping: current, samplePoint, contract: { normalizedOrigin: current.normalizedOrigin, coordinateSystem: current.coordinateSystem, durableAdapterRequired: 'CAST_CAD_DOCUMENT_METADATA_ADAPTER', rendererWorkerStillRequired: 'PDF.js/commercial renderer integration' } };
}
function listViewportMappings(state, filters = {}) {
  let rows = state.viewportMappings || [];
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.pageNumber) rows = rows.filter((row) => Number(row.pageNumber) === Number(filters.pageNumber));
  return clone(rows);
}

function scaleCalibrationDurableAdapterConfigured() { return Boolean(process.env.CAST_CAD_SCALE_CALIBRATION_ADAPTER || process.env.CAST_CAD_MARKUP_DATABASE_ADAPTER || process.env.CAST_CAD_DATABASE_URL); }
function scaleCalibrationContract() {
  return { publicExposure: false, requiresAuth: true, durableAdapterRequired: 'CAST_CAD_SCALE_CALIBRATION_ADAPTER or CAST_CAD_MARKUP_DATABASE_ADAPTER or CAST_CAD_DATABASE_URL', humanReviewRequiredBeforeVerifiedScale: true, coordinateSystem: 'normalized-overlay-percent', noBudgetAuthorityWithoutHumanReview: true };
}
function normalizeScaleCalibration(input = {}, actor) {
  const pointA = input.pointA || input.firstPoint || input.startPoint || {};
  const pointB = input.pointB || input.secondPoint || input.endPoint || {};
  const knownLength = Number(input.knownLength || input.known_length || 0);
  const percentDistance = Number(input.percentDistance || input.percent_distance || Math.hypot(Number(pointB.x || 0) - Number(pointA.x || 0), Number(pointB.y || 0) - Number(pointA.y || 0)));
  const unit = String(input.unit || 'FT').trim().toUpperCase();
  const status = input.status || (input.humanReviewApproved ? 'Verified' : 'Needs Review');
  return {
    id: input.id || input.calibrationId || id('cad_scale'),
    projectId: input.projectId || input.project_id || 'default',
    sheetId: input.sheetId || input.sheet_id || '',
    pageNumber: Number(input.pageNumber || input.page_number || 1),
    knownLength,
    unit,
    percentDistance,
    pointA: { x: Number(pointA.x || 0), y: Number(pointA.y || 0) },
    pointB: { x: Number(pointB.x || 0), y: Number(pointB.y || 0) },
    scaleLabel: input.scaleLabel || input.scale_label || `${knownLength} ${unit}`,
    status,
    humanReviewApproved: Boolean(input.humanReviewApproved || input.human_review_approved),
    authoritative: Boolean(input.authoritative || input.budgetAuthoritative || input.budget_authoritative),
    publicExposure: false,
    requiresAuth: true,
    providerRequired: !scaleCalibrationDurableAdapterConfigured(),
    requiredEnvVars: ['CAST_CAD_SCALE_CALIBRATION_ADAPTER or CAST_CAD_MARKUP_DATABASE_ADAPTER or CAST_CAD_DATABASE_URL'],
    createdByUserId: actor.id,
    createdAt: now(),
    updatedAt: now(),
  };
}
function validateScaleCalibration(calibration) {
  if (!calibration.sheetId) return 'sheetId is required.';
  if (!Number.isFinite(calibration.knownLength) || calibration.knownLength <= 0) return 'knownLength must be greater than zero.';
  if (!['FT','IN','LF','SF','EA','M','CM','MM'].includes(calibration.unit)) return 'unit is not supported for CAST CAD scale calibration.';
  if (!Number.isFinite(calibration.percentDistance) || calibration.percentDistance <= 0) return 'percentDistance must be greater than zero.';
  if (![calibration.pointA.x, calibration.pointA.y, calibration.pointB.x, calibration.pointB.y].every(Number.isFinite)) return 'Calibration points must be numeric normalized-overlay coordinates.';
  return '';
}
function upsertScaleCalibration(state, input = {}, actor) {
  const auth = requireAuthenticatedActor(actor); if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'edit_markup'); if (!permission.ok) return permission;
  const calibration = normalizeScaleCalibration(input, actor);
  const validation = validateScaleCalibration(calibration); if (validation) return { ok: false, status: 422, error: validation };
  const verifiedRequested = calibration.status === 'Verified' || calibration.authoritative;
  if (verifiedRequested && !calibration.humanReviewApproved) return { ok: false, status: 409, code: 'human-review-required', error: 'Human review approval is required before a CAST CAD scale calibration can become verified or budget-authoritative.', contract: scaleCalibrationContract() };
  if ((input.durable || calibration.authoritative) && !scaleCalibrationDurableAdapterConfigured()) return { ok: false, status: 503, code: 'provider-required', error: 'Durable/authoritative scale calibration persistence requires a configured CAST CAD calibration/database adapter.', requiredEnvVars: calibration.requiredEnvVars, contract: scaleCalibrationContract(), calibration };
  state.scaleCalibrations = state.scaleCalibrations || [];
  const existingIndex = state.scaleCalibrations.findIndex((row) => row.id === calibration.id || (row.projectId === calibration.projectId && row.sheetId === calibration.sheetId && Number(row.pageNumber) === Number(calibration.pageNumber)));
  const previous = existingIndex >= 0 ? clone(state.scaleCalibrations[existingIndex]) : null;
  const next = { ...(previous || {}), ...calibration, id: previous?.id || calibration.id, createdAt: previous?.createdAt || calibration.createdAt, updatedAt: now() };
  if (existingIndex >= 0) state.scaleCalibrations[existingIndex] = next; else state.scaleCalibrations.push(next);
  audit(state, actor, previous ? 'Updated CAST CAD scale calibration' : 'Created CAST CAD scale calibration', 'CAST_CAD_SCALE_CALIBRATION', next.id, previous, next, 'Provider-independent normalized sheet scale calibration.');
  return { ok: true, status: previous ? 200 : 201, calibration: next, contract: scaleCalibrationContract() };
}
function listScaleCalibrations(state, filters = {}) {
  let rows = state.scaleCalibrations || [];
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.pageNumber) rows = rows.filter((row) => Number(row.pageNumber) === Number(filters.pageNumber));
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  return clone(rows);
}
function createTakeoffWorkbookExport(state, { projectId, sheetId, format = 'xlsx' }, actor) {
  const permission = requireCastCad(actor.role, 'export');
  if (!permission.ok) return permission;
  const markups = listMarkups(state, { projectId, sheetId }).filter((row) => row.measurement || /count|measure|area|length/i.test(row.tool));
  const rows = markups.map((m) => ({ sheetId: m.sheetId, subject: m.subject, trade: m.trade, costCode: m.costCode, quantity: m.measurement?.value || 1, unit: m.measurement?.unit || 'EA', status: m.status, sourceMarkupId: m.id }));
  const workerConfigured = Boolean(process.env.CAST_CAD_TAKEOFF_WORKBOOK_WORKER || process.env.CAST_CAD_XLSX_EXPORT_WORKER);
  const exportJob = { id: id('cad_export'), projectId, sheetId: sheetId || '', type: 'takeoff-workbook', format, status: workerConfigured ? 'queued' : 'provider-required', rowCount: rows.length, rows, providerRequired: !workerConfigured, requiredEnvVars: workerConfigured ? [] : ['CAST_CAD_TAKEOFF_WORKBOOK_WORKER or CAST_CAD_XLSX_EXPORT_WORKER'], privateArtifacts: true, cacheControl: 'private, max-age=0, no-store', outputPointer: workerConfigured ? `/api/cast-cad/export/${projectId || 'project'}-${Date.now()}.${format}` : '', contract: { endpoint: '/api/cast-cad-exports', type: 'takeoff-workbook', inputs: ['projectId','sheetId','format'], outputs: ['workbookPointer','measurementRows','auditLog'], workerRequired: 'CAST_CAD_TAKEOFF_WORKBOOK_WORKER or CAST_CAD_XLSX_EXPORT_WORKER', privateArtifacts: true, cacheControl: 'private, max-age=0, no-store' }, createdByUserId: actor.id, createdAt: now() };
  state.exportJobs.push(exportJob);
  audit(state, actor, 'Created takeoff workbook export job', 'CAST_CAD_EXPORT', exportJob.id, null, exportJob, exportJob.providerRequired ? 'Takeoff workbook/XLSX worker not configured; captured audited rows only and did not fabricate a private workbook artifact.' : 'Queued for takeoff workbook/XLSX worker.');
  return { ok: true, exportJob };
}
function createAnnotatedPdfExport(state, { projectId, sheetId, flatten = true }, actor) {
  const permission = requireCastCad(actor.role, 'export');
  if (!permission.ok) return permission;
  const markups = listMarkups(state, { projectId, sheetId });
  const exportJob = { id: id('cad_export'), projectId, sheetId: sheetId || '', type: 'annotated-pdf', format: 'pdf', status: process.env.CAST_CAD_PDF_EXPORT_WORKER ? 'queued' : 'provider-required', flatten: Boolean(flatten), markupCount: markups.length, providerRequired: !process.env.CAST_CAD_PDF_EXPORT_WORKER, requiredEnvVars: process.env.CAST_CAD_PDF_EXPORT_WORKER ? [] : ['CAST_CAD_PDF_EXPORT_WORKER'], privateArtifacts: true, cacheControl: 'private, max-age=0, no-store', outputPointer: process.env.CAST_CAD_PDF_EXPORT_WORKER ? `/api/cast-cad/export/${projectId || 'project'}-${Date.now()}.pdf` : '', contract: { endpoint: '/api/cast-cad-exports', type: 'annotated-pdf', inputs: ['projectId','sheetId','flatten'], outputs: ['privatePdfPointer','auditLog'], workerRequired: 'CAST_CAD_PDF_EXPORT_WORKER', privateArtifacts: true, cacheControl: 'private, max-age=0, no-store' }, createdByUserId: actor.id, createdAt: now() };
  state.exportJobs.push(exportJob);
  audit(state, actor, 'Created annotated PDF export job', 'CAST_CAD_EXPORT', exportJob.id, null, exportJob, exportJob.providerRequired ? 'PDF export worker not configured yet.' : 'Queued for PDF export worker.');
  return { ok: true, exportJob };
}
function createPdfAnnotationImportJob(state, input = {}, actor) {
  const permission = requireCastCad(actor.role, 'create_markup');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id || 'default';
  const sheetId = input.sheetId || input.sheet_id || '';
  const sourcePointer = input.sourcePointer || input.source_pointer || input.pdfPointer || input.pdf_pointer || '';
  const mode = String(input.mode || input.importMode || input.import_mode || 'import-unflattened').toLowerCase();
  if (!sheetId) return { ok: false, status: 422, errors: ['sheetId is required for PDF annotation import/unflatten jobs.'] };
  if (!sourcePointer) return { ok: false, status: 422, errors: ['sourcePointer is required and must reference a private PDF/annotation source; public URLs are forbidden.'] };
  if (/^https?:\/\//i.test(sourcePointer)) return { ok: false, status: 422, code: 'public-url-forbidden', errors: ['PDF annotation import refuses public URLs; pass a private provider pointer or stream lease id.'] };
  const allowedModes = ['import-unflattened', 'import-flattened', 'xfdf-import', 'fdf-import', 'sync-existing'];
  if (!allowedModes.includes(mode)) return { ok: false, status: 422, errors: [`mode must be one of: ${allowedModes.join(', ')}.`] };
  const workerConfigured = Boolean(process.env.CAST_CAD_PDF_ANNOTATION_IMPORT_WORKER || process.env.CAST_CAD_PDF_EXPORT_WORKER);
  const job = {
    id: id('cad_pdf_annotation_import'), projectId, sheetId, type: 'pdf-annotation-import', mode,
    sourcePointer, status: workerConfigured ? 'queued' : 'provider-required', providerRequired: !workerConfigured,
    requiredEnvVars: workerConfigured ? [] : ['CAST_CAD_PDF_ANNOTATION_IMPORT_WORKER or CAST_CAD_PDF_EXPORT_WORKER'],
    privateArtifacts: true, publicExposure: false, requiresAuth: true, cacheControl: 'private, max-age=0, no-store', outputPointer: '', importedMarkupCount: 0,
    contract: { endpoint: '/api/cast-cad-exports', type: 'pdf-annotation-import', inputs: ['projectId','sheetId','sourcePointer','mode'], outputs: ['importedMarkupDrafts','auditLog'], workerRequired: 'CAST_CAD_PDF_ANNOTATION_IMPORT_WORKER or CAST_CAD_PDF_EXPORT_WORKER', noPublicUrls: true, privateArtifacts: true, cacheControl: 'private, max-age=0, no-store', humanReviewRequiredBeforeAuthoritativeMarkups: true },
    createdByUserId: actor.id, createdAt: now()
  };
  state.exportJobs.push(job);
  audit(state, actor, 'Created PDF annotation import/unflatten job', 'CAST_CAD_EXPORT', job.id, null, job, job.providerRequired ? 'PDF annotation import worker not configured; refused to fabricate imported markups or public PDF artifacts.' : 'Queued for configured PDF annotation import worker.');
  return { ok: true, exportJob: job };
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
function normalizeWorkflowType(value) {
  const raw = String(value || 'rfi').toLowerCase().replace(/[_\s]+/g, '-');
  if (['rfi','submittal','change-event','issue','observation'].includes(raw)) return raw;
  return '';
}
function createWorkflowLinkFromMarkup(state, markupId, actor, input = {}) {
  state.workflowLinks ||= [];
  const permission = requireCastCad(actor.role, 'create_rfi');
  if (!permission.ok) return permission;
  const markup = state.markups.find((row) => row.id === markupId);
  if (!markup) return { ok: false, status: 404, error: 'Markup not found.' };
  const workflowType = normalizeWorkflowType(input.workflowType || input.workflow_type || input.type);
  if (!workflowType) return { ok: false, status: 422, errors: ['workflowType must be one of: rfi, submittal, change-event, issue, observation.'] };
  const externalProviderConfigured = Boolean(process.env.CAST_CAD_WORKFLOW_PROVIDER || process.env.PROCORE_CLIENT_ID || process.env.CAST_SERVER_WORKFLOW_API_URL);
  const requestedExternal = Boolean(input.createExternal || input.create_external || input.externalProvider || input.external_provider);
  if (requestedExternal && !externalProviderConfigured) {
    return { ok: false, status: 503, code: 'provider-required', error: 'External workflow creation requires CAST_CAD_WORKFLOW_PROVIDER, PROCORE_CLIENT_ID, or CAST_SERVER_WORKFLOW_API_URL; refusing to fabricate provider records.', requiredEnvVars: ['CAST_CAD_WORKFLOW_PROVIDER or PROCORE_CLIENT_ID or CAST_SERVER_WORKFLOW_API_URL'] };
  }
  const link = {
    id: input.id || id('cad_workflow'),
    markupId: markup.id,
    projectId: markup.projectId,
    sheetId: markup.sheetId,
    pageNumber: markup.pageNumber,
    workflowType,
    title: String(input.title || input.subject || markup.subject || `${workflowType} draft`).trim(),
    description: String(input.description || input.body || markup.body || '').trim(),
    status: requestedExternal && externalProviderConfigured ? 'queued-for-provider' : 'draft-snapshot',
    linkStatus: requestedExternal && externalProviderConfigured ? 'queued-for-provider' : 'draft-snapshot',
    providerRequired: requestedExternal && !externalProviderConfigured,
    requiredEnvVars: externalProviderConfigured ? [] : ['CAST_CAD_WORKFLOW_PROVIDER', 'PROCORE_CLIENT_ID', 'CAST_SERVER_WORKFLOW_API_URL'],
    externalProvider: externalProviderConfigured ? (process.env.CAST_CAD_WORKFLOW_PROVIDER || (process.env.PROCORE_CLIENT_ID ? 'procore' : 'cast-server-workflow-api')) : 'unconfigured',
    externalId: '',
    externalUrl: '',
    snapshotPointer: { sheetId: markup.sheetId, pageNumber: markup.pageNumber, geometry: markup.geometry, subject: markup.subject, body: markup.body, status: markup.status, sourceMarkupId: markup.id, capturedAt: now() },
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.workflowLinks.push(link);
  audit(state, actor, `Created CAST CAD ${workflowType} workflow snapshot from markup`, 'CAST_CAD_WORKFLOW_LINK', link.id, null, link, link.status === 'draft-snapshot' ? 'Provider-independent draft snapshot only; no external provider record was fabricated.' : 'Queued for configured workflow provider.');
  return { ok: true, workflowLink: link };
}
function listWorkflowLinks(state, filters = {}) {
  state.workflowLinks ||= [];
  let rows = state.workflowLinks.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.markupId) rows = rows.filter((row) => row.markupId === filters.markupId);
  if (filters.workflowType) rows = rows.filter((row) => row.workflowType === normalizeWorkflowType(filters.workflowType));
  return rows;
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
function normalizedDrawingRef(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[–—]/g, '-');
}
function drawingAutoLinkContract() {
  return {
    privateLinksOnly: true,
    publicExposure: false,
    requiresAuth: true,
    humanReviewRequiredBeforePublish: true,
    noPublicUrls: true,
    sourceCitationRequired: true,
    durableAdapterRequired: 'CAST_CAD_DOCUMENT_METADATA_ADAPTER',
    workerRequiredForProductionExtraction: 'CAST_CAD_OCR_WORKER or CAST_CAD_AUTOLINK_WORKER',
  };
}
function detectDrawingReferences(text) {
  const refs = new Set();
  const source = String(text || '');
  const patterns = [
    /\b[A-Z]{1,3}[.-]?\d{1,3}(?:\.\d+)?\b/g,
    /\b(?:SHEET|DWG|DRAWING|DETAIL)\s+([A-Z]{1,3}[.-]?\d{1,3}(?:\.\d+)?)\b/gi,
  ];
  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(source)) !== null) refs.add(normalizedDrawingRef(match[1] || match[0]));
  });
  return [...refs];
}
function createDrawingAutoLinks(state, input = {}, actor) {
  state.ocrPages ||= [];
  state.drawingDocuments ||= [];
  state.drawingAutoLinkRuns ||= [];
  const permission = requireCastCad(actor.role, 'edit_markup');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id || 'default';
  const sourceSheetId = input.sourceSheetId || input.source_sheet_id || input.sheetId || input.sheet_id || '';
  const pages = state.ocrPages.filter((page) => page.projectId === projectId && (!sourceSheetId || page.sheetId === sourceSheetId));
  if (!pages.length) return { ok: false, status: 422, code: 'source-index-required', error: 'CAST CAD Auto Link requires indexed OCR/search text for the source sheet before link candidates can be created.' };
  const docs = state.drawingDocuments.filter((doc) => doc.projectId === projectId);
  const docMap = new Map();
  docs.forEach((doc) => {
    [doc.sheetId, doc.drawingNumber, doc.fileName].filter(Boolean).forEach((key) => docMap.set(normalizedDrawingRef(String(key).replace(/\.pdf$/i, '')), doc));
  });
  const candidates = [];
  pages.forEach((page) => {
    detectDrawingReferences(`${page.text || ''} ${(page.symbols || []).join(' ')}`).forEach((ref) => {
      const target = docMap.get(ref);
      if (!target || target.sheetId === page.sheetId) return;
      if (candidates.some((row) => row.sourceSheetId === page.sheetId && row.targetSheetId === target.sheetId && row.referenceText === ref)) return;
      candidates.push({
        id: id('cad_autolink_candidate'),
        projectId,
        sourceSheetId: page.sheetId,
        sourcePageNumber: page.pageNumber,
        targetSheetId: target.sheetId,
        targetDrawingNumber: target.drawingNumber,
        targetDocumentId: target.id,
        referenceText: ref,
        confidence: Math.min(99, Math.max(50, Number(page.confidence || 75))),
        status: 'Needs Review',
        humanReviewRequired: true,
        sourceCitation: { kind: 'ocr', ocrPageId: page.id, sheetId: page.sheetId, pageNumber: page.pageNumber, excerpt: excerpt(page.text || (page.symbols || []).join(' '), ref.toLowerCase()) },
        linkType: 'private-sheet-link',
        publicExposure: false,
        noPublicUrls: true,
      });
    });
  });
  const publishRequested = Boolean(input.publish || input.publishLinks || input.publish_links || input.authoritative);
  if (publishRequested && !(input.humanReviewApproved || input.human_review_approved)) {
    return { ok: false, status: 409, code: 'human-review-required', error: 'CAST CAD Auto Link candidates cannot be published as navigable sheet links without human review approval.', candidates, contract: drawingAutoLinkContract() };
  }
  const providerReady = Boolean(process.env.CAST_CAD_DOCUMENT_METADATA_ADAPTER || process.env.CAST_CAD_DATABASE_URL);
  if (publishRequested && !providerReady) {
    return { ok: false, status: 503, code: 'provider-required', error: 'CAST CAD Auto Link publishing requires CAST_CAD_DOCUMENT_METADATA_ADAPTER or CAST_CAD_DATABASE_URL; refusing to fabricate durable private sheet links.', requiredEnvVars: ['CAST_CAD_DOCUMENT_METADATA_ADAPTER or CAST_CAD_DATABASE_URL'], candidates, contract: drawingAutoLinkContract() };
  }
  const run = {
    id: input.id || id('cad_autolink_run'),
    projectId,
    sourceSheetId,
    status: publishRequested ? 'ready-to-publish' : 'needs-review',
    candidateCount: candidates.length,
    candidates,
    providerRequired: !providerReady,
    requiredEnvVars: providerReady ? [] : ['CAST_CAD_DOCUMENT_METADATA_ADAPTER or CAST_CAD_DATABASE_URL'],
    contract: drawingAutoLinkContract(),
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.drawingAutoLinkRuns.push(run);
  audit(state, actor, 'Created CAST CAD drawing Auto Link candidates', 'CAST_CAD_DRAWING_AUTOLINK_RUN', run.id, null, run, 'Provider-independent private sheet-link candidates require human review before publication; no public links were fabricated.');
  return { ok: true, autoLinkRun: run, candidates, contract: drawingAutoLinkContract() };
}
function listDrawingAutoLinks(state, filters = {}) {
  state.drawingAutoLinkRuns ||= [];
  let rows = state.drawingAutoLinkRuns.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sourceSheetId || filters.sheetId) {
    const sheetId = filters.sourceSheetId || filters.sheetId;
    rows = rows.filter((row) => row.sourceSheetId === sheetId);
  }
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  return rows;
}
function normalizeAiFinding(input = {}, actor) {
  const sourceCitations = Array.isArray(input.sourceCitations || input.source_citations) ? (input.sourceCitations || input.source_citations) : [];
  return {
    id: input.id || id('cad_ai_finding'),
    projectId: input.projectId || input.project_id || '',
    sheetId: input.sheetId || input.sheet_id || '',
    pageNumber: Number(input.pageNumber || input.page_number || 1),
    findingType: String(input.findingType || input.finding_type || 'coordination').trim(),
    title: String(input.title || '').trim(),
    body: String(input.body || input.description || '').trim(),
    severity: input.severity || 'Medium',
    confidence: Math.max(0, Math.min(100, Number(input.confidence || 0))),
    sourceCitations: sourceCitations.map((citation) => ({
      kind: citation.kind || citation.type || 'sheet',
      sheetId: citation.sheetId || citation.sheet_id || input.sheetId || input.sheet_id || '',
      pageNumber: Number(citation.pageNumber || citation.page_number || input.pageNumber || input.page_number || 1),
      pointer: citation.pointer || citation.ocrPageId || citation.ocr_page_id || citation.markupId || citation.markup_id || '',
      excerpt: String(citation.excerpt || '').slice(0, 500),
    })),
    suggestedAction: String(input.suggestedAction || input.suggested_action || '').trim(),
    status: input.status || 'AI Detected',
    humanVerified: Boolean(input.humanVerified || input.human_verified),
    linkedMarkupId: input.linkedMarkupId || input.linked_markup_id || '',
    provider: input.provider || 'provider-independent-contract',
    createdByUserId: input.createdByUserId || input.created_by_user_id || actor.id,
    reviewedByUserId: input.reviewedByUserId || input.reviewed_by_user_id || '',
    createdAt: input.createdAt || input.created_at || now(),
    updatedAt: now(),
  };
}
function validateAiFinding(finding) {
  const errors = [];
  if (!finding.projectId) errors.push('projectId is required.');
  if (!finding.sheetId) errors.push('sheetId is required.');
  if (!finding.title) errors.push('title is required.');
  if (!finding.body) errors.push('body is required.');
  if (!finding.sourceCitations.length) errors.push('At least one sheet/page/OCR/markup source citation is required.');
  if (finding.humanVerified || finding.status === 'Human Verified') errors.push('AI findings cannot be created as human verified; use the review contract after human approval.');
  return errors;
}
function createAiFinding(state, input = {}, actor) {
  state.aiFindings ||= [];
  const permission = requireCastCad(actor.role, 'admin');
  if (!permission.ok) return permission;
  const providerReady = Boolean(process.env.CAST_CAD_AI_REVIEW_WORKER || input.provider === 'manual-test-fixture' || input.provider === 'provider-independent-contract');
  const finding = normalizeAiFinding(input, actor);
  const errors = validateAiFinding(finding);
  if (errors.length) return { ok: false, status: 422, errors };
  finding.status = 'AI Detected';
  finding.humanVerified = false;
  finding.providerRequired = !providerReady;
  if (!providerReady) finding.workerStatus = 'provider-required';
  state.aiFindings.push(finding);
  audit(state, actor, 'Recorded CAST CAD AI-detected finding', 'CAST_CAD_AI_FINDING', finding.id, null, finding, finding.providerRequired ? 'AI review worker not configured; stored contract finding only.' : 'AI finding requires human verification before action.');
  return { ok: true, finding };
}
function reviewAiFinding(state, findingId, input = {}, actor) {
  state.aiFindings ||= [];
  const permission = requireCastCad(actor.role, 'edit_markup');
  if (!permission.ok) return permission;
  const finding = state.aiFindings.find((row) => row.id === findingId);
  if (!finding) return { ok: false, status: 404, error: 'AI finding not found.' };
  if (!(input.humanReviewApproved || input.human_review_approved)) return { ok: false, status: 409, code: 'human-review-required', error: 'AI findings cannot be accepted, rejected, verified, or converted without human review approval.', finding };
  const previous = clone(finding);
  const decision = input.decision || input.status || 'Human Verified';
  finding.status = decision === 'reject' || decision === 'Rejected' ? 'Rejected by Human' : decision === 'convert-to-markup' ? 'Human Verified' : decision;
  finding.humanVerified = finding.status === 'Human Verified' || Boolean(input.humanVerified || input.human_verified);
  finding.reviewNotes = String(input.reviewNotes || input.review_notes || '').trim();
  finding.reviewedByUserId = actor.id;
  finding.updatedAt = now();
  let markup = null;
  if ((input.createMarkup || input.create_markup || decision === 'convert-to-markup') && finding.humanVerified) {
    const created = createMarkup(state, {
      projectId: finding.projectId,
      sheetId: finding.sheetId,
      pageNumber: finding.pageNumber,
      tool: input.tool || 'AI Review Finding',
      markupType: 'ai-finding',
      subject: input.subject || finding.title,
      body: `${finding.body}${finding.suggestedAction ? `\nSuggested action: ${finding.suggestedAction}` : ''}`,
      status: input.markupStatus || input.markup_status || 'Needs Review',
      priority: input.priority || finding.severity,
      sourceSnapshot: { aiFindingId: finding.id, label: 'AI detected · human verified', sourceCitations: finding.sourceCitations, humanReviewApproved: true },
    }, actor);
    if (!created.ok) return created;
    markup = created.markup;
    finding.linkedMarkupId = markup.id;
  }
  audit(state, actor, 'Human reviewed CAST CAD AI finding', 'CAST_CAD_AI_FINDING', finding.id, previous, finding, finding.humanVerified ? 'AI finding is human verified.' : 'AI finding reviewed without verification.');
  return { ok: true, finding, markup };
}
function listAiFindings(state, filters = {}) {
  state.aiFindings ||= [];
  let rows = state.aiFindings.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.humanVerified !== undefined) rows = rows.filter((row) => row.humanVerified === Boolean(filters.humanVerified));
  return rows;
}
function createReviewRoom(state, input, actor) {
  state.reviewRooms ||= [];
  const permission = requireCastCad(actor.role, 'review_room');
  if (!permission.ok) return permission;
  const participants = (input.participants || []).map((p) => ({ ...p, invitedAt: now(), status: 'Pending Delivery' }));
  const room = { id: input.id || id('cad_room'), projectId: input.projectId, name: input.name || 'CAST CAD Review Room', status: input.status || 'Active', sheetIds: input.sheetIds || [], markupIds: input.markupIds || [], participants, inviteDelivery: { status: 'not-requested', providerRequired: true, requiredEnvVars: ['CAST_CAD_REVIEW_ROOM_TRANSPORT or CAST_CAD_EMAIL_PROVIDER or CAST_CAD_REALTIME_PROVIDER'] }, auditRequired: true, createdByUserId: actor.id, createdAt: now(), updatedAt: now() };
  state.reviewRooms.push(room);
  audit(state, actor, 'Created CAST CAD review room', 'CAST_CAD_REVIEW_ROOM', room.id, null, room);
  return { ok: true, room };
}
function reviewRoomTransportConfigured() { return Boolean(process.env.CAST_CAD_REVIEW_ROOM_TRANSPORT || process.env.CAST_CAD_EMAIL_PROVIDER || process.env.CAST_CAD_REALTIME_PROVIDER); }
function createReviewRoomInviteDelivery(state, input = {}, actor) {
  state.reviewRooms ||= [];
  state.reviewRoomInviteEvents ||= [];
  const permission = requireCastCad(actor.role, 'review_room');
  if (!permission.ok) return permission;
  const roomId = input.roomId || input.room_id || input.reviewRoomId || input.review_room_id;
  const room = state.reviewRooms.find((row) => row.id === roomId);
  if (!room) return { ok: false, status: 404, error: 'CAST CAD review room not found.' };
  const recipients = (Array.isArray(input.recipients) && input.recipients.length ? input.recipients : room.participants || [])
    .map((recipient) => ({
      userId: String(recipient.userId || recipient.user_id || '').trim(),
      email: String(recipient.email || '').trim().toLowerCase(),
      name: String(recipient.name || '').trim(),
      role: normalizeRole(recipient.role || 'Read Only Viewer'),
      status: reviewRoomTransportConfigured() ? 'queued' : 'provider-required',
    }))
    .filter((recipient) => recipient.userId || recipient.email);
  if (!recipients.length) return { ok: false, status: 422, errors: ['At least one review-room recipient with userId or email is required.'] };
  const providerReady = reviewRoomTransportConfigured();
  const event = {
    id: id('cad_room_invite'),
    projectId: room.projectId,
    roomId: room.id,
    deliveryType: input.deliveryType || input.delivery_type || 'review-room-invite',
    status: providerReady ? 'queued' : 'provider-required',
    providerRequired: !providerReady,
    requiredEnvVars: providerReady ? [] : ['CAST_CAD_REVIEW_ROOM_TRANSPORT or CAST_CAD_EMAIL_PROVIDER or CAST_CAD_REALTIME_PROVIDER'],
    provider: process.env.CAST_CAD_REVIEW_ROOM_TRANSPORT || (process.env.CAST_CAD_EMAIL_PROVIDER ? 'email-provider' : process.env.CAST_CAD_REALTIME_PROVIDER ? 'realtime-provider' : 'unconfigured'),
    recipientCount: recipients.length,
    recipients,
    noPublicJoinLinks: true,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    message: String(input.message || '').slice(0, 2000),
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.reviewRoomInviteEvents.push(event);
  const previous = clone(room);
  room.inviteDelivery = { status: event.status, providerRequired: event.providerRequired, requiredEnvVars: event.requiredEnvVars, lastInviteEventId: event.id, recipientCount: event.recipientCount, updatedAt: now() };
  room.participants = room.participants.map((participant) => {
    const key = String(participant.userId || participant.user_id || participant.email || '').toLowerCase();
    const matched = recipients.find((recipient) => key && [recipient.userId, recipient.email].includes(key));
    return matched ? { ...participant, status: matched.status === 'queued' ? 'Invite Queued' : 'Provider Required', inviteEventId: event.id } : participant;
  });
  room.updatedAt = now();
  audit(state, actor, 'Created CAST CAD review room invite delivery event', 'CAST_CAD_REVIEW_ROOM_INVITE', event.id, null, event, event.providerRequired ? 'Invite delivery transport is not configured; no external email/realtime invite or public join link was fabricated.' : 'Invite delivery queued for configured private transport.');
  audit(state, actor, 'Updated CAST CAD review room invite delivery status', 'CAST_CAD_REVIEW_ROOM', room.id, previous, room);
  if (!providerReady) return { ok: false, status: 503, code: 'provider-required', error: 'Review Room invite delivery requires CAST_CAD_REVIEW_ROOM_TRANSPORT, CAST_CAD_EMAIL_PROVIDER, or CAST_CAD_REALTIME_PROVIDER; refusing to fabricate delivered invites.', requiredEnvVars: event.requiredEnvVars, inviteEvent: event, room };
  return { ok: true, inviteEvent: event, room };
}
function listReviewRoomInviteEvents(state, filters = {}) {
  state.reviewRoomInviteEvents ||= [];
  let rows = state.reviewRoomInviteEvents.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.roomId) rows = rows.filter((row) => row.roomId === filters.roomId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  return rows;
}
function normalizeDrawingDocumentMetadata(input = {}, actor) {
  const sourcePath = String(input.sourcePath || input.source_path || input.path || '').trim();
  const drawingNumber = String(input.drawingNumber || input.drawing_number || input.sheetNumber || input.sheet_number || input.name || sourcePath.replace(/\.pdf$/i, '')).trim();
  const sheetId = String(input.sheetId || input.sheet_id || input.id || safeSegment(sourcePath || drawingNumber)).trim();
  return {
    id: input.id || id('cad_doc'),
    projectId: input.projectId || input.project_id || 'default',
    setId: input.setId || input.set_id || 'current',
    sheetId,
    drawingNumber,
    drawingTitle: String(input.drawingTitle || input.drawing_title || input.title || '').trim(),
    discipline: String(input.discipline || '').trim(),
    revisionLabel: input.revisionLabel || input.revision_label || input.revision || '',
    revisionDate: input.revisionDate || input.revision_date || '',
    sourcePath,
    fileName: safeFileName(input.fileName || input.file_name || input.name || `${drawingNumber || sheetId}.pdf`),
    extension: String(input.extension || 'pdf').replace(/^\./, '').toLowerCase(),
    contentHash: input.contentHash || input.content_hash || '',
    pageCount: input.pageCount === undefined && input.page_count === undefined ? null : Number(input.pageCount ?? input.page_count),
    status: input.status || 'indexed',
    storagePointer: input.storagePointer || input.storage_pointer || '',
    streamContractEndpoint: '/api/cast-cad-pdf-stream',
    cacheControl: 'private, max-age=0, no-store',
    publicExposure: false,
    requiresAuth: true,
    authoritative: Boolean(input.authoritative),
    providerRequired: !process.env.CAST_CAD_DOCUMENT_METADATA_ADAPTER,
    requiredEnvVars: process.env.CAST_CAD_DOCUMENT_METADATA_ADAPTER ? [] : ['CAST_CAD_DOCUMENT_METADATA_ADAPTER'],
    persistenceMode: process.env.CAST_CAD_DOCUMENT_METADATA_ADAPTER ? 'provider-adapter' : 'memory-contract-only',
    humanReviewApproved: Boolean(input.humanReviewApproved || input.human_review_approved),
    updatedByUserId: actor.id,
    createdAt: input.createdAt || input.created_at || now(),
    updatedAt: now(),
  };
}
function validateDrawingDocumentMetadata(doc) {
  const errors = [];
  if (!doc.projectId) errors.push('projectId is required.');
  if (!doc.sheetId) errors.push('sheetId is required.');
  if (!doc.drawingNumber) errors.push('drawingNumber is required.');
  if (!doc.sourcePath) errors.push('sourcePath is required.');
  if (doc.extension !== 'pdf') errors.push('Only PDF drawing metadata is supported by the CAST CAD stream contract.');
  if (doc.pageCount !== null && (!Number.isFinite(doc.pageCount) || doc.pageCount < 1)) errors.push('pageCount must be a positive number when provided.');
  if (!['indexed','current','superseded','archived'].includes(doc.status)) errors.push('status must be indexed, current, superseded, or archived.');
  return errors;
}
function upsertDrawingDocumentMetadata(state, input = {}, actor) {
  state.drawingDocuments ||= [];
  const permission = requireCastCad(actor.role, 'manage_drawing_sets');
  if (!permission.ok) return permission;
  const doc = normalizeDrawingDocumentMetadata(input, actor);
  const errors = validateDrawingDocumentMetadata(doc);
  if (errors.length) return { ok: false, status: 422, errors };
  const wantsAuthoritative = doc.authoritative || doc.status === 'current' || input.persistDurably || input.persist_durably;
  if (wantsAuthoritative && !doc.humanReviewApproved) return { ok: false, status: 409, code: 'human-review-required', error: 'Authoritative drawing metadata changes require human review approval before becoming current or durable.', document: doc };
  if ((input.persistDurably || input.persist_durably || doc.authoritative) && doc.providerRequired) return { ok: false, status: 503, code: 'provider-required', error: 'Durable drawing document metadata persistence requires CAST_CAD_DOCUMENT_METADATA_ADAPTER.', requiredEnvVars: doc.requiredEnvVars, document: doc };
  const existing = state.drawingDocuments.find((row) => row.projectId === doc.projectId && row.setId === doc.setId && row.sheetId === doc.sheetId);
  const previous = existing ? clone(existing) : null;
  if (existing) Object.assign(existing, doc, { id: existing.id, createdAt: existing.createdAt });
  else state.drawingDocuments.push(doc);
  const current = existing || doc;
  audit(state, actor, previous ? 'Updated CAST CAD drawing document metadata' : 'Indexed CAST CAD drawing document metadata', 'CAST_CAD_DRAWING_DOCUMENT', current.id, previous, current, current.providerRequired ? 'Database adapter not configured; metadata is a provider-independent contract record only.' : 'Metadata ready for configured persistence adapter.');
  return { ok: true, document: current };
}
function importDrawingDocumentMetadataFromIndex(state, input = {}, actor) {
  const permission = requireCastCad(actor.role, 'manage_drawing_sets');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id || 'default';
  const setId = input.setId || input.set_id || 'current';
  const files = Array.isArray(input.files) ? input.files : Array.isArray(input.index?.files) ? input.index.files : [];
  if (!files.length) return { ok: false, status: 422, errors: ['At least one PDF drawing index file is required.'] };
  const imported = [];
  const rejected = [];
  files.filter((file) => String(file.extension || file.name || file.path || '').toLowerCase().includes('pdf')).forEach((file) => {
    const result = upsertDrawingDocumentMetadata(state, { ...file, projectId, setId, sourcePath: file.path || file.sourcePath, drawingNumber: file.drawingNumber || file.sheetNumber || file.name, drawingTitle: file.title || file.drawingTitle, status: input.status || 'indexed', humanReviewApproved: input.humanReviewApproved || input.human_review_approved }, actor);
    if (result.ok) imported.push(result.document); else rejected.push({ file: file.path || file.name || file.id, error: result.error || result.errors, code: result.code });
  });
  const summary = { id: id('cad_doc_import'), projectId, setId, importedCount: imported.length, rejectedCount: rejected.length, providerRequired: !process.env.CAST_CAD_DOCUMENT_METADATA_ADAPTER, requiredEnvVars: process.env.CAST_CAD_DOCUMENT_METADATA_ADAPTER ? [] : ['CAST_CAD_DOCUMENT_METADATA_ADAPTER'], importedDocumentIds: imported.map((row) => row.id), rejected, createdByUserId: actor.id, createdAt: now() };
  audit(state, actor, 'Imported CAST CAD drawing index metadata', 'CAST_CAD_DRAWING_DOCUMENT_IMPORT', summary.id, null, summary);
  return { ok: rejected.length === 0, status: rejected.length ? 207 : 200, summary, documents: imported };
}
function listDrawingDocumentMetadata(state, filters = {}) {
  state.drawingDocuments ||= [];
  let rows = state.drawingDocuments.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.setId) rows = rows.filter((row) => row.setId === filters.setId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.search) { const q = String(filters.search).toLowerCase(); rows = rows.filter((row) => `${row.sheetId} ${row.drawingNumber} ${row.drawingTitle} ${row.discipline} ${row.sourcePath}`.toLowerCase().includes(q)); }
  return rows;
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

function costCatalogAdapterConfigured() { return Boolean(process.env.CAST_CAD_COST_CATALOG_ADAPTER || process.env.CAST_CAD_COST_DATABASE_ADAPTER); }
function normalizeCostCatalogItem(input = {}, actor) {
  const quantityBasis = String(input.quantityBasis || input.quantity_basis || input.unit || 'EA').trim().toUpperCase();
  return {
    id: input.id || id('cad_cost_item'),
    projectId: input.projectId || input.project_id || 'global',
    costCode: String(input.costCode || input.cost_code || '').trim(),
    assemblyCode: String(input.assemblyCode || input.assembly_code || '').trim(),
    description: String(input.description || input.name || '').trim(),
    trade: String(input.trade || 'Coordination').trim(),
    quantityBasis,
    unitCost: Number(input.unitCost ?? input.unit_cost),
    currency: String(input.currency || 'USD').trim().toUpperCase(),
    source: String(input.source || 'cast-cad-cost-catalog-contract').trim(),
    effectiveDate: String(input.effectiveDate || input.effective_date || now().slice(0, 10)).slice(0, 10),
    status: input.status || 'active',
    humanReviewApproved: Boolean(input.humanReviewApproved || input.human_review_approved),
    providerRequired: !costCatalogAdapterConfigured(),
    requiredEnvVars: costCatalogAdapterConfigured() ? [] : ['CAST_CAD_COST_CATALOG_ADAPTER or CAST_CAD_COST_DATABASE_ADAPTER'],
    persistenceMode: costCatalogAdapterConfigured() ? 'provider-adapter' : 'memory-contract-only',
    budgetAuthoritative: false,
    createdByUserId: input.createdByUserId || input.created_by_user_id || actor.id,
    updatedByUserId: actor.id,
    createdAt: input.createdAt || input.created_at || now(),
    updatedAt: now(),
  };
}
function validateCostCatalogItem(item) {
  const errors = [];
  if (!item.costCode) errors.push('costCode is required.');
  if (!item.description) errors.push('description is required.');
  if (!Number.isFinite(item.unitCost) || item.unitCost < 0) errors.push('unitCost must be a non-negative number.');
  if (!item.quantityBasis) errors.push('quantityBasis is required.');
  if (item.status && !['active','draft','archived'].includes(item.status)) errors.push('status must be active, draft, or archived.');
  return errors;
}
function costCatalogContract() {
  return { privateCostData: true, budgetAuthoritative: false, humanReviewRequiredBeforeBudgetUse: true, durableAdapterRequired: 'CAST_CAD_COST_CATALOG_ADAPTER or CAST_CAD_COST_DATABASE_ADAPTER', cacheControl: 'private, max-age=0, no-store' };
}
function upsertCostCatalogItem(state, input = {}, actor) {
  state.costCatalogItems ||= [];
  const permission = requireCastCad(actor.role, 'admin');
  if (!permission.ok) return permission;
  const item = normalizeCostCatalogItem(input, actor);
  const errors = validateCostCatalogItem(item);
  if (errors.length) return { ok: false, status: 422, errors };
  if ((input.persistDurably || input.persist_durably || input.authoritative || input.budgetAuthoritative) && item.providerRequired) return { ok: false, status: 503, code: 'provider-required', error: 'Durable or budget-authoritative CAST CAD cost catalog persistence requires CAST_CAD_COST_CATALOG_ADAPTER or CAST_CAD_COST_DATABASE_ADAPTER.', requiredEnvVars: item.requiredEnvVars, item, contract: costCatalogContract() };
  if ((input.authoritative || input.budgetAuthoritative) && !item.humanReviewApproved) return { ok: false, status: 409, code: 'human-review-required', error: 'Budget-authoritative cost catalog changes require human review approval before use.', item, contract: costCatalogContract() };
  const idx = state.costCatalogItems.findIndex((row) => row.id === item.id || (row.projectId === item.projectId && row.costCode === item.costCode && row.assemblyCode === item.assemblyCode && row.quantityBasis === item.quantityBasis));
  const previous = idx >= 0 ? clone(state.costCatalogItems[idx]) : null;
  const current = previous ? { ...previous, ...item, id: previous.id, createdAt: previous.createdAt, createdByUserId: previous.createdByUserId, budgetAuthoritative: false, updatedByUserId: actor.id, updatedAt: now() } : item;
  if (idx >= 0) state.costCatalogItems[idx] = current; else state.costCatalogItems.push(current);
  audit(state, actor, previous ? 'Updated CAST CAD cost catalog item' : 'Created CAST CAD cost catalog item', 'CAST_CAD_COST_CATALOG_ITEM', current.id, previous, current, current.providerRequired ? 'Cost database adapter not configured; item is a provider-independent contract record only and is not budget-authoritative.' : 'Cost catalog adapter configured; item still requires human review before budget authority.');
  return { ok: true, item: current, contract: costCatalogContract() };
}
function importCostCatalogItems(state, input = {}, actor) {
  state.costCatalogImports ||= [];
  const rows = Array.isArray(input.items) ? input.items : [];
  const imported = [];
  const rejected = [];
  rows.forEach((row, index) => {
    const result = upsertCostCatalogItem(state, { ...row, projectId: row.projectId || input.projectId || input.project_id || 'global' }, actor);
    if (result.ok) imported.push(result.item); else rejected.push({ index, errors: result.errors || [result.error || result.code || 'rejected'] });
  });
  const summary = { id: id('cad_cost_import'), projectId: input.projectId || input.project_id || 'global', importedCount: imported.length, rejectedCount: rejected.length, providerRequired: !costCatalogAdapterConfigured(), requiredEnvVars: costCatalogAdapterConfigured() ? [] : ['CAST_CAD_COST_CATALOG_ADAPTER or CAST_CAD_COST_DATABASE_ADAPTER'], importedItemIds: imported.map((row) => row.id), rejected, createdByUserId: actor.id, createdAt: now() };
  state.costCatalogImports.push(summary);
  audit(state, actor, 'Imported CAST CAD cost catalog contract rows', 'CAST_CAD_COST_CATALOG_IMPORT', summary.id, null, summary, summary.providerRequired ? 'Imported as audited memory contract only; no provider-backed cost database was claimed.' : 'Imported for configured cost catalog adapter review.');
  return { ok: rejected.length === 0, status: rejected.length ? 207 : 200, summary, items: imported, contract: costCatalogContract() };
}
function listCostCatalogItems(state, filters = {}) {
  state.costCatalogItems ||= [];
  let rows = state.costCatalogItems.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId || row.projectId === 'global');
  if (filters.costCode) rows = rows.filter((row) => row.costCode === filters.costCode);
  if (filters.assemblyCode) rows = rows.filter((row) => row.assemblyCode === filters.assemblyCode);
  if (filters.trade) rows = rows.filter((row) => row.trade === filters.trade);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.search) { const q = String(filters.search).toLowerCase(); rows = rows.filter((row) => `${row.costCode} ${row.assemblyCode} ${row.description} ${row.trade}`.toLowerCase().includes(q)); }
  return rows;
}
function buildComparisonJob(state, input, actor) {
  const permission = requireCastCad(actor.role, 'export');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id || '';
  const baseSheetId = input.baseSheetId || input.base_sheet_id || input.baseRevisionId || input.base_revision_id || '';
  const revisedSheetId = input.revisedSheetId || input.revised_sheet_id || input.revisedRevisionId || input.revised_revision_id || '';
  const errors = [];
  if (!projectId) errors.push('projectId is required.');
  if (!baseSheetId) errors.push('baseSheetId is required.');
  if (!revisedSheetId) errors.push('revisedSheetId is required.');
  if (baseSheetId && revisedSheetId && baseSheetId === revisedSheetId) errors.push('baseSheetId and revisedSheetId must be different revisions or sheets.');
  if (errors.length) return { ok: false, status: 422, errors };
  const providerReady = Boolean(process.env.CAST_CAD_COMPARISON_WORKER);
  const job = {
    id: id('cad_compare'),
    projectId,
    baseSheetId,
    revisedSheetId,
    status: providerReady ? 'queued' : 'provider-required',
    providerRequired: !providerReady,
    requiredEnvVars: providerReady ? [] : ['CAST_CAD_COMPARISON_WORKER'],
    contract: {
      endpoint: '/api/cast-cad-exports',
      type: 'comparison',
      inputs: ['projectId', 'baseSheetId', 'revisedSheetId'],
      outputs: ['deltaReportPointer', 'overlayPointer', 'changeSummary'],
      privateArtifacts: true,
      cacheControl: 'private, max-age=0, no-store',
    },
    deltaReportPointer: '',
    overlayPointer: '',
    changeSummary: [],
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.comparisonJobs.push(job);
  audit(state, actor, 'Created drawing comparison job', 'CAST_CAD_COMPARISON_JOB', job.id, null, job, job.providerRequired ? 'Comparison worker not configured; job is provider-required and no private artifact is fabricated.' : 'Queued for comparison worker.');
  return { ok: true, job };
}
function createModelIngestionJob(state, input = {}, actor) {
  state.modelIngestionJobs ||= [];
  const permission = requireCastCad(actor.role, 'export');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id || '';
  const sourcePointer = String(input.sourcePointer || input.source_pointer || '').trim();
  const fileName = safeFileName(input.fileName || input.file_name || sourcePointer.split('/').pop() || 'cast-cad-model.ifc');
  const extension = String(input.extension || fileName.split('.').pop() || '').toLowerCase();
  const supported = new Set(['ifc','dwg','dxf','rvt','rfa','skp','obj','glb','gltf']);
  const errors = [];
  if (!projectId) errors.push('projectId is required.');
  if (!sourcePointer) errors.push('sourcePointer is required and must reference a private CAD/model provider object or upload lease.');
  if (/^https?:\/\//i.test(sourcePointer)) errors.push('Public model/CAD URLs are forbidden; pass a private provider pointer or upload lease id.');
  if (!supported.has(extension)) errors.push('extension must be one of ifc, dwg, dxf, rvt, rfa, skp, obj, glb, or gltf.');
  if (errors.length) return { ok: false, status: 422, code: errors.some((msg) => msg.includes('Public')) ? 'public-url-forbidden' : 'validation-error', errors };
  const workerReady = Boolean(process.env.CAST_CAD_MODEL_INGESTION_WORKER || process.env.CAST_CAD_IFC_CONVERSION_WORKER || process.env.CAST_CAD_CAD_CONVERSION_WORKER);
  const job = {
    id: input.id || id('cad_model_ingest'), projectId, type: 'model-ingestion', sourcePointer, fileName, extension,
    discipline: input.discipline || '', status: workerReady ? 'queued' : 'provider-required', providerRequired: !workerReady,
    requiredEnvVars: workerReady ? [] : ['CAST_CAD_MODEL_INGESTION_WORKER or CAST_CAD_IFC_CONVERSION_WORKER or CAST_CAD_CAD_CONVERSION_WORKER'],
    privateArtifacts: true, publicExposure: false, cacheControl: 'private, max-age=0, no-store',
    outputPointers: { viewerManifest: '', geometryIndex: '', thumbnail: '' },
    contract: { endpoint: '/api/cast-cad-exports', type: 'model-ingestion', inputs: ['projectId','sourcePointer','fileName'], outputs: ['viewerManifest','geometryIndex','thumbnail'], privateArtifacts: true, noPublicUrls: true, cacheControl: 'private, max-age=0, no-store', humanReviewRequiredBeforeLinkedQuantities: true },
    createdByUserId: actor.id, createdAt: now(),
  };
  state.modelIngestionJobs.push(job);
  audit(state, actor, 'Created CAST CAD model/CAD ingestion job', 'CAST_CAD_MODEL_INGESTION_JOB', job.id, null, job, job.providerRequired ? 'Model/CAD ingestion worker not configured; no viewer manifest, geometry index, or thumbnail artifact was fabricated.' : 'Queued for configured private model/CAD ingestion worker.');
  return { ok: true, job };
}
function listModelIngestionJobs(state, filters = {}) {
  state.modelIngestionJobs ||= [];
  let rows = state.modelIngestionJobs.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.extension) rows = rows.filter((row) => row.extension === String(filters.extension).toLowerCase());
  return rows;
}
function modelQuantityLinkContract() {
  return {
    endpoint: '/api/cast-cad-exports',
    type: 'model-quantity-link',
    privateArtifacts: true,
    publicExposure: false,
    cacheControl: 'private, max-age=0, no-store',
    inputs: ['projectId','sheetId','modelIngestionJobId','elementId','quantity','unit'],
    outputs: ['reviewGatedTakeoffRow','optionalMarkupId','auditLog'],
    humanReviewRequiredBeforeVerifiedQuantities: true,
    budgetAuthoritative: false,
    workerStillRequiredForExtraction: 'CAST_CAD_MODEL_INGESTION_WORKER or CAST_CAD_IFC_CONVERSION_WORKER or CAST_CAD_CAD_CONVERSION_WORKER',
  };
}
function createModelQuantityLink(state, input = {}, actor) {
  state.modelIngestionJobs ||= [];
  state.modelQuantityLinks ||= [];
  const permission = requireCastCad(actor.role, 'export');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id || '';
  const sheetId = input.sheetId || input.sheet_id || '';
  const modelIngestionJobId = input.modelIngestionJobId || input.model_ingestion_job_id || input.jobId || input.job_id || '';
  const sourcePointer = String(input.sourcePointer || input.source_pointer || '').trim();
  const elementId = String(input.elementId || input.element_id || input.modelElementId || input.model_element_id || '').trim();
  const quantity = Number(input.quantity ?? input.measurementValue ?? input.measurement_value);
  const unit = String(input.unit || input.measurementUnit || input.measurement_unit || '').trim().toUpperCase();
  const errors = [];
  if (!projectId) errors.push('projectId is required.');
  if (!sheetId) errors.push('sheetId is required.');
  if (!modelIngestionJobId && !sourcePointer) errors.push('modelIngestionJobId or private sourcePointer is required.');
  if (sourcePointer && /^https?:\/\//i.test(sourcePointer)) errors.push('Public model quantity source URLs are forbidden; pass a private provider pointer, upload lease id, or model ingestion job id.');
  if (modelIngestionJobId && !state.modelIngestionJobs.some((row) => row.id === modelIngestionJobId)) errors.push('modelIngestionJobId must reference an audited CAST CAD model ingestion job.');
  if (!elementId) errors.push('elementId is required so the linked quantity is source-cited to a model element.');
  if (!Number.isFinite(quantity) || quantity <= 0) errors.push('quantity must be a positive number.');
  if (!unit) errors.push('unit is required.');
  if (errors.length) return { ok: false, status: 422, code: errors.some((msg) => msg.includes('Public')) ? 'public-url-forbidden' : 'validation-error', errors, contract: modelQuantityLinkContract() };
  const requestedVerified = ['Verified','Resolved'].includes(input.status) || input.budgetAuthoritative || input.budget_authoritative;
  const humanReviewApproved = Boolean(input.humanReviewApproved || input.human_review_approved);
  if (requestedVerified && !humanReviewApproved) return { ok: false, status: 409, code: 'human-review-required', error: 'Model-derived quantities cannot become verified/resolved or budget-authoritative without human review approval.', contract: modelQuantityLinkContract() };
  const link = {
    id: input.id || id('cad_model_qty'), projectId, sheetId, modelIngestionJobId, sourcePointer, elementId,
    type: 'model-quantity-link',
    elementName: String(input.elementName || input.element_name || '').trim(), discipline: String(input.discipline || '').trim(),
    quantity, unit, costCode: input.costCode || input.cost_code || '', assemblyCode: input.assemblyCode || input.assembly_code || '',
    status: humanReviewApproved ? (input.status || 'Reviewed') : 'Needs Review', humanReviewApproved,
    budgetAuthoritative: false, providerRequired: false, privateArtifacts: true, publicExposure: false,
    cacheControl: 'private, max-age=0, no-store', sourceCitation: { kind: 'model-element', modelIngestionJobId, sourcePointer, elementId },
    createdByUserId: actor.id, createdAt: now(),
  };
  let linkedMarkup = null;
  if (input.createMarkup || input.create_markup) {
    const created = createMarkup(state, {
      projectId, sheetId, tool: input.tool || 'Model Quantity', subject: input.subject || `Model quantity ${elementId}`,
      body: input.body || `Model-derived quantity from ${elementId}. Human review required before budget use.`,
      status: link.status, trade: input.trade || link.discipline || 'Coordination', costCode: link.costCode,
      measurement: { value: quantity, unit, source: 'model-quantity-link', humanReviewRequired: !humanReviewApproved, assemblyCode: link.assemblyCode },
      geometry: input.geometry || { type: 'point', points: input.points || [{ x: Number(input.x ?? 50), y: Number(input.y ?? 50) }] },
      sourceSnapshot: { label: 'Model quantity link', modelQuantityLinkId: link.id, elementId, humanReviewApproved, budgetAuthoritative: false },
    }, actor);
    if (!created.ok) return created;
    linkedMarkup = created.markup;
    link.markupId = linkedMarkup.id;
  }
  state.modelQuantityLinks.push(link);
  audit(state, actor, 'Created CAST CAD model-derived quantity link', 'CAST_CAD_MODEL_QUANTITY_LINK', link.id, null, link, 'Provider-independent reviewed model quantity contract; no public model artifact or budget-authoritative quantity was fabricated.');
  return { ok: true, quantityLink: link, markup: linkedMarkup, contract: modelQuantityLinkContract() };
}
function listModelQuantityLinks(state, filters = {}) {
  state.modelQuantityLinks ||= [];
  let rows = state.modelQuantityLinks.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetId === filters.sheetId);
  if (filters.modelIngestionJobId) rows = rows.filter((row) => row.modelIngestionJobId === filters.modelIngestionJobId);
  if (filters.elementId) rows = rows.filter((row) => row.elementId === filters.elementId);
  return rows;
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
function drawingUploadStorageConfigured() {
  return Boolean(process.env.CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER || process.env.CAST_CAD_DOCUMENT_STORAGE_ADAPTER || process.env.CAST_SERVER_DOCUMENT_API_URL || process.env.DROPBOX_ACCESS_TOKEN);
}
function normalizeDrawingUploadFile(file = {}, index) {
  const fileName = safeFileName(file.fileName || file.file_name || file.name || `sheet-${index + 1}.pdf`);
  const sourcePointer = String(file.sourcePointer || file.source_pointer || file.privatePointer || file.private_pointer || '').trim();
  const drawingNumber = String(file.drawingNumber || file.drawing_number || file.sheetNumber || file.sheet_number || fileName.replace(/\.pdf$/i, '')).trim();
  const extension = String(file.extension || fileName.split('.').pop() || '').toLowerCase();
  return {
    id: file.id || id('cad_upload_sheet'), sheetId: file.sheetId || file.sheet_id || safeSegment(drawingNumber || fileName), drawingNumber,
    drawingTitle: file.drawingTitle || file.drawing_title || file.title || '', discipline: file.discipline || '', fileName, extension,
    contentType: file.contentType || file.content_type || 'application/pdf', byteSize: Number(file.byteSize || file.byte_size || 0), contentHash: file.contentHash || file.content_hash || '', sourcePointer,
    storageStatus: drawingUploadStorageConfigured() ? 'queued-for-private-storage' : 'provider-required', publicExposure: false, requiresAuth: true, cacheControl: 'private, max-age=0, no-store',
  };
}
function createDrawingUploadPackage(state, input = {}, actor) {
  state.drawingUploadPackages ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'manage_drawing_sets');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id;
  const files = Array.isArray(input.files) ? input.files : [];
  const publishAsCurrent = Boolean(input.publishAsCurrent || input.publish_as_current || input.authoritative);
  if (!projectId) return { ok: false, status: 422, errors: ['projectId is required.'] };
  if (!files.length) return { ok: false, status: 422, errors: ['At least one drawing PDF file manifest is required.'] };
  if (files.length > 300) return { ok: false, status: 422, errors: ['A drawing upload package may include at most 300 sheets. Split larger sets into separate audited packages.'] };
  const sheets = files.map(normalizeDrawingUploadFile);
  const rejected = [];
  sheets.forEach((sheet) => {
    const source = sheet.sourcePointer.toLowerCase();
    if (sheet.extension !== 'pdf' || sheet.contentType !== 'application/pdf') rejected.push({ sheetId: sheet.sheetId, fileName: sheet.fileName, error: 'Only PDF drawing sheets are accepted by this upload package contract.' });
    if (source.startsWith('http://') || source.startsWith('https://')) rejected.push({ sheetId: sheet.sheetId, fileName: sheet.fileName, error: 'Public drawing upload URLs are forbidden; provide a private upload lease/source pointer.' });
  });
  if (rejected.length) return { ok: false, status: 422, code: rejected.some((row) => row.error.includes('Public')) ? 'public-url-forbidden' : 'invalid-upload-package', errors: rejected };
  if (publishAsCurrent && !(input.humanReviewApproved || input.human_review_approved)) return { ok: false, status: 409, code: 'human-review-required', error: 'Publishing an uploaded drawing package as current requires human review approval before current sheet authority changes.', rejectedCount: 0 };
  const storageConfigured = drawingUploadStorageConfigured();
  const metadataConfigured = Boolean(process.env.CAST_CAD_DOCUMENT_METADATA_ADAPTER);
  const packageRow = {
    id: input.id || id('cad_drawing_upload'), type: 'drawing-upload-package', projectId, setId: input.setId || input.set_id || 'current', name: input.name || 'CAST CAD Drawing Upload Package', revisionLabel: input.revisionLabel || input.revision_label || now().slice(0, 10),
    status: storageConfigured && (!publishAsCurrent || metadataConfigured) ? 'queued' : 'provider-required', sheetCount: sheets.length, sheets, publishAsCurrent, humanReviewApproved: Boolean(input.humanReviewApproved || input.human_review_approved),
    publicExposure: false, requiresAuth: true, cacheControl: 'private, max-age=0, no-store', noPublicUrls: true, durableStorage: storageConfigured, metadataAdapterConfigured: metadataConfigured, providerRequired: !(storageConfigured && (!publishAsCurrent || metadataConfigured)),
    requiredEnvVars: storageConfigured && (!publishAsCurrent || metadataConfigured) ? [] : [storageConfigured ? null : 'CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER or CAST_CAD_DOCUMENT_STORAGE_ADAPTER or CAST_SERVER_DOCUMENT_API_URL or DROPBOX_ACCESS_TOKEN', publishAsCurrent && !metadataConfigured ? 'CAST_CAD_DOCUMENT_METADATA_ADAPTER' : null].filter(Boolean),
    contract: { privateBytesOnly: true, noStore: true, publicUrlsForbidden: true, maxSheetCount: 300, currentSetPublishRequiresHumanReview: true, currentSetPublishRequiresMetadataAdapter: true, followOnEndpoint: '/api/cast-cad-exports', followOnType: 'drawing-set-version' },
    createdByUserId: actor.id, createdAt: now(),
  };
  state.drawingUploadPackages.push(packageRow);
  audit(state, actor, packageRow.providerRequired ? 'Blocked CAST CAD drawing upload package until private storage/metadata provider configured' : 'Created CAST CAD drawing upload package', 'CAST_CAD_DRAWING_UPLOAD_PACKAGE', packageRow.id, null, { ...packageRow, sheets: sheets.map((sheet) => ({ sheetId: sheet.sheetId, fileName: sheet.fileName, sourcePointer: sheet.sourcePointer ? 'private-pointer-redacted' : '' })) }, 'No public drawing URL or durable byte claim is fabricated.');
  if (publishAsCurrent && packageRow.providerRequired) return { ok: false, status: 503, code: 'provider-required', package: packageRow, requiredEnvVars: packageRow.requiredEnvVars, error: 'Private drawing upload storage and document metadata adapters are required before this package can become the authoritative current set.' };
  return { ok: true, status: packageRow.providerRequired ? 202 : 201, package: packageRow };
}
function listDrawingUploadPackages(state, filters = {}) {
  state.drawingUploadPackages ||= [];
  let rows = state.drawingUploadPackages.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.setId) rows = rows.filter((row) => row.setId === filters.setId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  return rows;
}
function transmittalTransportConfigured() {
  return Boolean(process.env.CAST_CAD_TRANSMITTAL_TRANSPORT || process.env.CAST_CAD_EMAIL_PROVIDER || process.env.CAST_SERVER_WORKFLOW_API_URL);
}
function normalizeTransmittalRecipient(recipient = {}) {
  return {
    userId: String(recipient.userId || recipient.user_id || '').trim(),
    name: String(recipient.name || recipient.company || '').trim(),
    email: String(recipient.email || '').trim().toLowerCase(),
    role: String(recipient.role || '').trim(),
    deliveryStatus: 'Pending Delivery',
  };
}
function createDrawingTransmittal(state, input = {}, actor) {
  state.drawingTransmittals ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'manage_drawing_sets');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id;
  const sheetIds = Array.isArray(input.sheetIds || input.sheet_ids) ? (input.sheetIds || input.sheet_ids).map(String).filter(Boolean) : [];
  const recipients = (Array.isArray(input.recipients) ? input.recipients : []).map(normalizeTransmittalRecipient).filter((row) => row.email || row.userId);
  if (!projectId) return { ok: false, status: 422, errors: ['projectId is required.'] };
  if (!sheetIds.length) return { ok: false, status: 422, errors: ['At least one sheetId is required for a drawing transmittal.'] };
  if (!recipients.length) return { ok: false, status: 422, errors: ['At least one recipient email or userId is required.'] };
  if ((input.issueFor || input.issue_for || '').toLowerCase() === 'construction' && !(input.humanReviewApproved || input.human_review_approved)) return { ok: false, status: 409, code: 'human-review-required', error: 'Issue-for-construction drawing transmittals require human review approval before release.' };
  const providerReady = transmittalTransportConfigured();
  const transmittal = {
    id: input.id || id('cad_transmittal'), type: 'drawing-transmittal', projectId, setId: input.setId || input.set_id || 'current', revisionLabel: input.revisionLabel || input.revision_label || '',
    subject: input.subject || 'CAST CAD drawing transmittal', message: input.message || '', issueFor: input.issueFor || input.issue_for || 'review', sheetIds, recipients,
    status: providerReady ? 'queued' : 'provider-required', providerRequired: !providerReady, requiredEnvVars: providerReady ? [] : ['CAST_CAD_TRANSMITTAL_TRANSPORT or CAST_CAD_EMAIL_PROVIDER or CAST_SERVER_WORKFLOW_API_URL'],
    publicExposure: false, noPublicLinks: true, requiresAuth: true, cacheControl: 'private, max-age=0, no-store', humanReviewApproved: Boolean(input.humanReviewApproved || input.human_review_approved),
    contract: { endpoint: '/api/cast-cad-exports', type: 'drawing-transmittal', noPublicLinks: true, privateSheetAccessOnly: true, deliveryRequiresTransport: 'CAST_CAD_TRANSMITTAL_TRANSPORT or CAST_CAD_EMAIL_PROVIDER or CAST_SERVER_WORKFLOW_API_URL', issueForConstructionRequiresHumanReview: true },
    createdByUserId: actor.id, createdAt: now(),
  };
  state.drawingTransmittals.push(transmittal);
  audit(state, actor, 'Created CAST CAD drawing transmittal release record', 'CAST_CAD_DRAWING_TRANSMITTAL', transmittal.id, null, transmittal, transmittal.providerRequired ? 'Transmittal is audit-only until private delivery/workflow transport is configured; no public sheet links or delivered notices were fabricated.' : 'Queued for configured private transmittal transport.');
  if (!providerReady) return { ok: false, status: 503, code: 'provider-required', error: 'CAST CAD drawing transmittal delivery requires CAST_CAD_TRANSMITTAL_TRANSPORT, CAST_CAD_EMAIL_PROVIDER, or CAST_SERVER_WORKFLOW_API_URL; refusing to fabricate delivered notices or public sheet links.', transmittal, requiredEnvVars: transmittal.requiredEnvVars };
  return { ok: true, status: 202, transmittal, requiredEnvVars: [] };
}
function listDrawingTransmittals(state, filters = {}) {
  state.drawingTransmittals ||= [];
  let rows = state.drawingTransmittals.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.setId) rows = rows.filter((row) => row.setId === filters.setId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  return rows;
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
function drawingApprovalContract() {
  return {
    type: 'drawing-approval-package',
    publicExposure: false,
    noPublicLinks: true,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    humanReviewRequiredBeforeIssueForConstruction: true,
    reviewerDecisionContract: 'Named reviewer approve/reject/revise decisions are audited per package; final approved-for-release status requires all reviewers approved plus explicit humanReviewApproved.',
    durableAdapterRequired: 'CAST_CAD_DRAWING_APPROVAL_ADAPTER or CAST_CAD_DATABASE_URL',
    transmittalGate: 'Approved drawing packages can be cited before drawing transmittal delivery; external delivery still requires CAST_CAD_TRANSMITTAL_TRANSPORT, CAST_CAD_EMAIL_PROVIDER, or CAST_SERVER_WORKFLOW_API_URL.',
  };
}
function normalizeApprovalDecision(decision) {
  const value = String(decision || '').trim().toLowerCase();
  if (['approve','approved','accepted'].includes(value)) return 'Approved';
  if (['reject','rejected','denied'].includes(value)) return 'Rejected';
  if (['revise','revise-and-resubmit','revise_resubmit','revise and resubmit','changes-required'].includes(value)) return 'Revise and Resubmit';
  return 'Pending';
}
function createDrawingApprovalPackage(state, input = {}, actor) {
  state.drawingApprovalPackages ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'manage_drawing_sets');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id;
  const sheetIds = Array.isArray(input.sheetIds || input.sheet_ids) ? (input.sheetIds || input.sheet_ids).filter(Boolean) : [];
  const reviewers = Array.isArray(input.reviewers) ? input.reviewers.filter((row) => row && (row.email || row.userId || row.user_id || row.name)) : [];
  const errors = [];
  if (!projectId) errors.push('projectId is required.');
  if (!sheetIds.length) errors.push('At least one sheetId is required for a drawing approval package.');
  if (!reviewers.length) errors.push('At least one reviewer is required for a drawing approval package.');
  if (errors.length) return { ok: false, status: 422, errors, contract: drawingApprovalContract() };
  const durableReady = Boolean(process.env.CAST_CAD_DRAWING_APPROVAL_ADAPTER || process.env.CAST_CAD_DATABASE_URL);
  const wantsIfc = ['issue-for-construction','ifc','approved'].includes(String(input.issueFor || input.issue_for || input.status || '').toLowerCase());
  const humanReviewApproved = Boolean(input.humanReviewApproved || input.human_review_approved);
  if (wantsIfc && !humanReviewApproved) return { ok: false, status: 409, code: 'human-review-required', error: 'Issue-for-construction drawing approval packages require human review approval before release.', contract: drawingApprovalContract() };
  const packageRow = {
    id: input.id || id('cad_drawing_approval'),
    type: 'drawing-approval-package',
    projectId,
    setId: input.setId || input.set_id || 'current',
    name: input.name || 'CAST CAD Drawing Approval Package',
    sheetIds,
    reviewerCount: reviewers.length,
    reviewers: reviewers.map((reviewer) => ({ userId: reviewer.userId || reviewer.user_id || '', email: String(reviewer.email || '').toLowerCase(), name: reviewer.name || '', role: normalizeRole(reviewer.role || 'Consultant'), decision: reviewer.decision || 'Pending', decidedAt: reviewer.decidedAt || reviewer.decided_at || '' })),
    status: wantsIfc && reviewers.every((reviewer) => normalizeApprovalDecision(reviewer.decision) === 'Approved') ? 'approved-for-release' : input.status || 'pending-review',
    issueFor: input.issueFor || input.issue_for || (wantsIfc ? 'issue-for-construction' : 'review'),
    humanReviewApproved,
    providerRequired: !durableReady,
    requiredEnvVars: durableReady ? [] : ['CAST_CAD_DRAWING_APPROVAL_ADAPTER or CAST_CAD_DATABASE_URL'],
    durablePersistence: durableReady,
    publicExposure: false,
    noPublicLinks: true,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    sourceRevisionIds: Array.isArray(input.sourceRevisionIds || input.source_revision_ids) ? (input.sourceRevisionIds || input.source_revision_ids) : [],
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.drawingApprovalPackages.push(packageRow);
  audit(state, actor, packageRow.providerRequired ? 'Created audit-only CAST CAD drawing approval package pending durable adapter' : 'Created durable CAST CAD drawing approval package', 'CAST_CAD_DRAWING_APPROVAL_PACKAGE', packageRow.id, null, packageRow, 'Private approval package has no public links; IFC release is human-review gated.');
  return { ok: true, status: packageRow.providerRequired ? 202 : 201, approvalPackage: packageRow, contract: drawingApprovalContract() };
}
function listDrawingApprovalPackages(state, filters = {}) {
  state.drawingApprovalPackages ||= [];
  let rows = state.drawingApprovalPackages.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.setId) rows = rows.filter((row) => row.setId === filters.setId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.sheetId) rows = rows.filter((row) => row.sheetIds.includes(filters.sheetId));
  return rows;
}
function reviewDrawingApprovalPackage(state, input = {}, actor) {
  state.drawingApprovalPackages ||= [];
  state.drawingApprovalDecisions ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'manage_drawing_sets');
  if (!permission.ok) return permission;
  const packageId = input.packageId || input.package_id || input.approvalPackageId || input.approval_package_id;
  const packageRow = state.drawingApprovalPackages.find((row) => row.id === packageId);
  if (!packageRow) return { ok: false, status: 404, error: 'CAST CAD drawing approval package not found.', contract: drawingApprovalContract() };
  const decision = normalizeApprovalDecision(input.decision);
  if (decision === 'Pending') return { ok: false, status: 422, errors: ['decision must be approve, reject, or revise-and-resubmit.'], contract: drawingApprovalContract() };
  const reviewerEmail = String(input.reviewerEmail || input.reviewer_email || actor.email || '').trim().toLowerCase();
  const reviewerUserId = String(input.reviewerUserId || input.reviewer_user_id || actor.id || '').trim();
  const reviewer = packageRow.reviewers.find((row) => (reviewerEmail && row.email === reviewerEmail) || (reviewerUserId && row.userId === reviewerUserId));
  if (!reviewer) return { ok: false, status: 403, code: 'reviewer-not-named', error: 'Only named reviewers on the private drawing approval package can record approval decisions.' };
  const previous = clone(packageRow);
  const decidedAt = now();
  Object.assign(reviewer, { decision, decidedAt, reviewNotes: String(input.reviewNotes || input.review_notes || '').trim(), decidedByUserId: actor.id });
  const event = {
    id: id('cad_approval_decision'),
    type: 'drawing-approval-decision',
    packageId: packageRow.id,
    projectId: packageRow.projectId,
    setId: packageRow.setId,
    sheetIds: packageRow.sheetIds.slice(),
    reviewerEmail,
    reviewerUserId,
    decision,
    reviewNotes: reviewer.reviewNotes,
    publicExposure: false,
    noPublicLinks: true,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    createdByUserId: actor.id,
    createdAt: decidedAt,
  };
  state.drawingApprovalDecisions.push(event);
  const decisions = packageRow.reviewers.map((row) => row.decision || 'Pending');
  const allApproved = decisions.length > 0 && decisions.every((row) => row === 'Approved');
  const anyRejected = decisions.some((row) => row === 'Rejected');
  const anyRevise = decisions.some((row) => row === 'Revise and Resubmit');
  const wantsIfc = ['issue-for-construction','ifc','approved'].includes(String(packageRow.issueFor || '').toLowerCase());
  if (wantsIfc && allApproved && !Boolean(input.humanReviewApproved || input.human_review_approved || packageRow.humanReviewApproved)) packageRow.status = 'approval-complete-human-review-required';
  else if (wantsIfc && allApproved) { packageRow.status = 'approved-for-release'; packageRow.humanReviewApproved = true; }
  else if (anyRejected) packageRow.status = 'rejected';
  else if (anyRevise) packageRow.status = 'revise-and-resubmit';
  else packageRow.status = allApproved ? 'approved' : 'pending-review';
  packageRow.updatedByUserId = actor.id;
  packageRow.updatedAt = decidedAt;
  audit(state, actor, 'Recorded CAST CAD drawing approval reviewer decision', 'CAST_CAD_DRAWING_APPROVAL_DECISION', event.id, previous, packageRow, 'Named reviewer decision was audited with no public approval links or sheet exposure.');
  if (wantsIfc && allApproved && packageRow.status === 'approval-complete-human-review-required') return { ok: false, status: 409, code: 'human-review-required', error: 'All named reviewers approved, but issue-for-construction release still requires explicit human review approval.', approvalPackage: packageRow, decisionEvent: event, contract: drawingApprovalContract() };
  return { ok: true, status: 202, approvalPackage: packageRow, decisionEvent: event, contract: drawingApprovalContract() };
}
function drawingIndexQaContract() {
  return {
    durableAdapterRequired: !Boolean(process.env.CAST_CAD_DRAWING_QA_ADAPTER || process.env.CAST_CAD_DOCUMENT_METADATA_ADAPTER || process.env.CAST_CAD_DATABASE_URL),
    requiredEnvVars: ['CAST_CAD_DRAWING_QA_ADAPTER or CAST_CAD_DOCUMENT_METADATA_ADAPTER or CAST_CAD_DATABASE_URL'],
    checks: ['missing-drawing-number','missing-title','missing-discipline','duplicate-drawing-number','non-pdf-entry','missing-private-source-path','unreviewed-current-set-publish'],
    privateArtifacts: true,
    publicExposure: false,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
  };
}
function normalizeQaSheet(input = {}) {
  const fileName = String(input.fileName || input.file_name || input.name || '').trim();
  const sourcePath = String(input.sourcePath || input.source_path || input.path || '').trim();
  const drawingNumber = String(input.drawingNumber || input.drawing_number || '').trim();
  const drawingTitle = String(input.drawingTitle || input.drawing_title || '').trim();
  return {
    sheetId: String(input.sheetId || input.sheet_id || input.id || drawingNumber || sourcePath || fileName).trim(),
    fileName,
    sourcePath,
    extension: String(input.extension || (fileName.split('.').pop() || '')).toLowerCase(),
    drawingNumber,
    drawingTitle,
    discipline: String(input.discipline || '').trim(),
    revisionLabel: String(input.revisionLabel || input.revision_label || '').trim(),
  };
}
function runDrawingIndexQa(state, input = {}, actor) {
  state.drawingIndexQaReports ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'manage_drawing_sets');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id;
  const setId = input.setId || input.set_id || 'current';
  const sheets = Array.isArray(input.sheets || input.files) ? (input.sheets || input.files).map(normalizeQaSheet) : [];
  const errors = [];
  if (!projectId) errors.push('projectId is required.');
  if (!sheets.length) errors.push('At least one sheet/file is required for drawing index QA.');
  if (errors.length) return { ok: false, status: 422, errors, contract: drawingIndexQaContract() };
  const numberCounts = new Map();
  sheets.forEach((sheet) => { if (sheet.drawingNumber) numberCounts.set(sheet.drawingNumber.toLowerCase(), (numberCounts.get(sheet.drawingNumber.toLowerCase()) || 0) + 1); });
  const findings = [];
  sheets.forEach((sheet) => {
    const base = { sheetId: sheet.sheetId, drawingNumber: sheet.drawingNumber, fileName: sheet.fileName, sourcePath: sheet.sourcePath, publicExposure: false };
    if (!sheet.drawingNumber) findings.push({ ...base, code: 'missing-drawing-number', severity: 'critical', message: 'Drawing number is required before current-set publication.' });
    if (!sheet.drawingTitle) findings.push({ ...base, code: 'missing-title', severity: 'warning', message: 'Drawing title is missing from the index metadata.' });
    if (!sheet.discipline) findings.push({ ...base, code: 'missing-discipline', severity: 'warning', message: 'Drawing discipline is missing from the index metadata.' });
    if (sheet.drawingNumber && numberCounts.get(sheet.drawingNumber.toLowerCase()) > 1) findings.push({ ...base, code: 'duplicate-drawing-number', severity: 'critical', message: 'Duplicate drawing number found in the selected set.' });
    if (sheet.extension && sheet.extension !== 'pdf') findings.push({ ...base, code: 'non-pdf-entry', severity: 'warning', message: 'Current CAST CAD drawing packages expect private PDF sheet entries.' });
    if (!sheet.sourcePath || /^https?:\/\//i.test(sheet.sourcePath)) findings.push({ ...base, code: 'missing-private-source-path', severity: 'critical', message: 'Sheet requires a private provider/source path; public URLs are forbidden.' });
  });
  if (Boolean(input.publishAsCurrent || input.publish_as_current) && !Boolean(input.humanReviewApproved || input.human_review_approved)) findings.push({ sheetId: '', drawingNumber: '', fileName: '', sourcePath: '', publicExposure: false, code: 'unreviewed-current-set-publish', severity: 'critical', message: 'Publishing a QA report/current drawing set requires explicit human review approval.' });
  const criticalCount = findings.filter((finding) => finding.severity === 'critical').length;
  const durableReady = !drawingIndexQaContract().durableAdapterRequired;
  const report = {
    id: input.id || id('cad_drawing_qa'),
    type: 'drawing-index-qa',
    projectId,
    setId,
    sheetCount: sheets.length,
    findingCount: findings.length,
    criticalCount,
    status: criticalCount ? 'blocked' : 'review-ready',
    providerRequired: !durableReady,
    requiredEnvVars: durableReady ? [] : drawingIndexQaContract().requiredEnvVars,
    durablePersistence: durableReady,
    publicExposure: false,
    noPublicLinks: true,
    requiresAuth: true,
    cacheControl: 'private, max-age=0, no-store',
    findings,
    createdByUserId: actor.id,
    createdAt: now(),
  };
  state.drawingIndexQaReports.push(report);
  audit(state, actor, report.providerRequired ? 'Created audit-only CAST CAD drawing index QA report pending durable adapter' : 'Created durable CAST CAD drawing index QA report', 'CAST_CAD_DRAWING_INDEX_QA', report.id, null, report, 'Private drawing index QA found missing/duplicate/publish-gate issues without public links or fabricated current-set authority.');
  return { ok: true, status: report.providerRequired ? 202 : 201, report, contract: drawingIndexQaContract() };
}
function listDrawingIndexQaReports(state, filters = {}) {
  state.drawingIndexQaReports ||= [];
  let rows = state.drawingIndexQaReports.slice();
  if (filters.projectId) rows = rows.filter((row) => row.projectId === filters.projectId);
  if (filters.setId) rows = rows.filter((row) => row.setId === filters.setId);
  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  return rows;
}
function normalizeProjectMember(input = {}, actor) {
  const role = normalizeRole(input.role || 'Read Only Viewer');
  return {
    id: input.id || id('cad_member'),
    projectId: input.projectId || input.project_id || 'default',
    userId: String(input.userId || input.user_id || input.email || '').trim(),
    name: String(input.name || input.userName || input.user_name || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    role,
    permissions: CAST_CAD_PERMISSIONS[role].slice(),
    status: input.status || 'active',
    source: input.source || 'cast-cad-admin-contract',
    updatedByUserId: actor.id,
    createdAt: input.createdAt || input.created_at || now(),
    updatedAt: now(),
  };
}
function validateProjectMember(member) {
  const errors = [];
  if (!member.projectId) errors.push('projectId is required.');
  if (!member.userId && !member.email) errors.push('userId or email is required.');
  if (!CAST_CAD_ROLES.includes(member.role)) errors.push(`role must be one of: ${CAST_CAD_ROLES.join(', ')}.`);
  if (!['active','invited','suspended'].includes(member.status)) errors.push('status must be active, invited, or suspended.');
  return errors;
}
function buildPermissionMatrix() {
  return CAST_CAD_ROLES.map((role) => ({ role, permissions: CAST_CAD_PERMISSIONS[role].slice() }));
}
function upsertProjectMemberRole(state, input = {}, actor) {
  state.projectMembers ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'admin');
  if (!permission.ok) return permission;
  const member = normalizeProjectMember(input, actor);
  const errors = validateProjectMember(member);
  if (errors.length) return { ok: false, status: 422, errors };
  const existing = state.projectMembers.find((row) => row.projectId === member.projectId && ((member.userId && row.userId === member.userId) || (member.email && row.email === member.email)));
  const previous = existing ? clone(existing) : null;
  if (existing) Object.assign(existing, member, { id: existing.id, createdAt: existing.createdAt });
  else state.projectMembers.push(member);
  const current = existing || member;
  audit(state, actor, previous ? 'Updated CAST CAD project member role' : 'Assigned CAST CAD project member role', 'CAST_CAD_PROJECT_MEMBER', current.id, previous, current, `Effective permissions: ${current.permissions.join(', ')}`);
  return { ok: true, member: current, permissionMatrix: buildPermissionMatrix() };
}
function listProjectMembers(state, filters = {}, actor = { role: 'Read Only Viewer' }) {
  state.projectMembers ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'audit');
  if (!permission.ok) return permission;
  let members = state.projectMembers.slice();
  if (filters.projectId) members = members.filter((row) => row.projectId === filters.projectId);
  if (filters.role) members = members.filter((row) => row.role === filters.role);
  if (filters.status) members = members.filter((row) => row.status === filters.status);
  return { ok: true, members, memberCount: members.length, permissionMatrix: buildPermissionMatrix() };
}
function getEffectivePermissions(state, input = {}, actor = { role: 'Read Only Viewer' }) {
  state.projectMembers ||= [];
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'view');
  if (!permission.ok) return permission;
  const projectId = input.projectId || input.project_id || 'default';
  const userId = input.userId || input.user_id || actor.id;
  const email = String(input.email || actor.email || '').toLowerCase();
  const member = state.projectMembers.find((row) => row.projectId === projectId && ((userId && row.userId === userId) || (email && row.email === email)) && row.status === 'active');
  const role = member ? member.role : actor.role;
  return { ok: true, projectId, userId, email, role, permissions: CAST_CAD_PERMISSIONS[role].slice(), source: member ? 'project-member-role' : 'actor-header-role' };
}
function readCastCadAuditLog(state, filters = {}, actor = { role: 'Read Only Viewer' }) {
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return auth;
  const permission = requireCastCad(actor.role, 'audit');
  if (!permission.ok) return permission;
  let rows = state.auditLog.slice();
  if (filters.entityType) rows = rows.filter((row) => row.entityType === filters.entityType);
  if (filters.entityId) rows = rows.filter((row) => row.entityId === filters.entityId);
  if (filters.actorUserId) rows = rows.filter((row) => row.actorUserId === filters.actorUserId);
  return { ok: true, auditLog: rows, auditCount: rows.length };
}
function envChoiceReady(choices) {
  return choices.some((choice) => String(choice || '').split('|').some((name) => Boolean(process.env[String(name || '').trim()])));
}
function castCadProductionReadiness() {
  const gates = [
    { id: 'auth-session', label: 'Verified production identity/session', category: 'auth', requiredEnvVars: ['CAST_CAD_REQUIRE_AUTH'], providerDecision: 'Select the production identity provider that verifies x-cast-user-* headers before CAST_CAD_REQUIRE_AUTH=true is enabled.', ready: process.env.CAST_CAD_REQUIRE_AUTH === 'true' },
    { id: 'private-pdf-stream', label: 'Authenticated raw PDF stream/proxy', category: 'documents', requiredEnvVars: ['CAST_CAD_PDF_STREAM_BASE|DROPBOX_ACCESS_TOKEN|CAST_SERVER_DOCUMENT_API_URL'], providerDecision: 'Choose CAST Server document API, Dropbox, or an approved private PDF stream base.', ready: envChoiceReady(['CAST_CAD_PDF_STREAM_BASE|DROPBOX_ACCESS_TOKEN|CAST_SERVER_DOCUMENT_API_URL']) },
    { id: 'pdf-renderer', label: 'Private PDF renderer/thumbnails/search', category: 'renderer', requiredEnvVars: ['CAST_CAD_PDF_RENDERER_WORKER|CAST_CAD_PDFJS_WORKER_URL|CAST_CAD_PDF_SDK_PROVIDER'], providerDecision: 'Choose private PDF.js worker URL, commercial PDF SDK, or CAST CAD renderer worker.', ready: pdfRendererWorkerConfigured() },
    { id: 'document-metadata', label: 'Durable drawing metadata registry', category: 'database', requiredEnvVars: ['CAST_CAD_DOCUMENT_METADATA_ADAPTER'], providerDecision: 'Choose the database/document metadata adapter used for current-set authority.', ready: Boolean(process.env.CAST_CAD_DOCUMENT_METADATA_ADAPTER) },
    { id: 'markup-database', label: 'Durable markup/comment/audit database', category: 'database', requiredEnvVars: ['CAST_CAD_MARKUP_DATABASE_ADAPTER|CAST_CAD_DATABASE_URL'], providerDecision: 'Choose the CAST CAD database adapter/URL for markups, comments, saved views, roles, and audit history.', ready: envChoiceReady(['CAST_CAD_MARKUP_DATABASE_ADAPTER|CAST_CAD_DATABASE_URL']) },
    { id: 'drawing-upload-storage', label: 'Private drawing upload/package storage', category: 'documents', requiredEnvVars: ['CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER|CAST_CAD_DOCUMENT_STORAGE_ADAPTER|CAST_SERVER_DOCUMENT_API_URL|DROPBOX_ACCESS_TOKEN'], providerDecision: 'Choose the private document storage provider for 300-sheet upload packages.', ready: envChoiceReady(['CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER|CAST_CAD_DOCUMENT_STORAGE_ADAPTER|CAST_SERVER_DOCUMENT_API_URL|DROPBOX_ACCESS_TOKEN']) },
    { id: 'private-upload-leases', label: 'Private upload lease signer for drawings, evidence, annotations, and models', category: 'documents', requiredEnvVars: ['CAST_CAD_PRIVATE_UPLOAD_STORAGE_ADAPTER|CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER|CAST_CAD_ATTACHMENT_STORAGE_ADAPTER|CAST_CAD_MODEL_UPLOAD_STORAGE_ADAPTER|CAST_CAD_DOCUMENT_STORAGE_ADAPTER'], providerDecision: 'Choose the private signed-upload/storage adapter that issues no-public-URL source pointers before users upload drawing PDFs, evidence, annotation PDFs, or CAD/model sources.', ready: envChoiceReady(['CAST_CAD_PRIVATE_UPLOAD_STORAGE_ADAPTER|CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER|CAST_CAD_ATTACHMENT_STORAGE_ADAPTER|CAST_CAD_MODEL_UPLOAD_STORAGE_ADAPTER|CAST_CAD_DOCUMENT_STORAGE_ADAPTER']) },
    { id: 'pdf-export-worker', label: 'Annotated PDF export/write-back worker', category: 'exports', requiredEnvVars: ['CAST_CAD_PDF_EXPORT_WORKER'], providerDecision: 'Choose the private PDF flatten/write-back worker.', ready: Boolean(process.env.CAST_CAD_PDF_EXPORT_WORKER) },
    { id: 'takeoff-workbook-worker', label: 'Private takeoff workbook/XLSX worker', category: 'exports', requiredEnvVars: ['CAST_CAD_TAKEOFF_WORKBOOK_WORKER|CAST_CAD_XLSX_EXPORT_WORKER'], providerDecision: 'Choose the workbook/XLSX generation worker.', ready: envChoiceReady(['CAST_CAD_TAKEOFF_WORKBOOK_WORKER|CAST_CAD_XLSX_EXPORT_WORKER']) },
    { id: 'ocr-ai-workers', label: 'OCR/search and AI review workers', category: 'ai-search', requiredEnvVars: ['CAST_CAD_OCR_WORKER', 'CAST_CAD_AI_REVIEW_WORKER'], providerDecision: 'Choose private OCR/symbol extraction and AI review workers with source-citation output.', ready: Boolean(process.env.CAST_CAD_OCR_WORKER && process.env.CAST_CAD_AI_REVIEW_WORKER) },
    { id: 'comparison-worker', label: 'Private drawing comparison worker', category: 'comparison', requiredEnvVars: ['CAST_CAD_COMPARISON_WORKER'], providerDecision: 'Choose the private PDF comparison/delta renderer.', ready: Boolean(process.env.CAST_CAD_COMPARISON_WORKER) },
    { id: 'collaboration-transport', label: 'Review-room/comment/transmittal delivery transport', category: 'collaboration', requiredEnvVars: ['CAST_CAD_REVIEW_ROOM_TRANSPORT|CAST_CAD_COMMENT_NOTIFICATION_TRANSPORT|CAST_CAD_TRANSMITTAL_TRANSPORT|CAST_CAD_EMAIL_PROVIDER|CAST_CAD_REALTIME_PROVIDER|CAST_SERVER_WORKFLOW_API_URL'], providerDecision: 'Choose email/realtime/workflow transport for private invites, mentions, and drawing transmittals.', ready: envChoiceReady(['CAST_CAD_REVIEW_ROOM_TRANSPORT|CAST_CAD_COMMENT_NOTIFICATION_TRANSPORT|CAST_CAD_TRANSMITTAL_TRANSPORT|CAST_CAD_EMAIL_PROVIDER|CAST_CAD_REALTIME_PROVIDER|CAST_SERVER_WORKFLOW_API_URL']) },
    { id: 'model-cad-worker', label: 'Private CAD/model ingestion and viewer artifacts', category: 'cad-model', requiredEnvVars: ['CAST_CAD_MODEL_INGESTION_WORKER|CAST_CAD_IFC_CONVERSION_WORKER|CAST_CAD_CAD_CONVERSION_WORKER'], providerDecision: 'Choose IFC/CAD/Revit/DWG conversion worker and private model artifact storage.', ready: envChoiceReady(['CAST_CAD_MODEL_INGESTION_WORKER|CAST_CAD_IFC_CONVERSION_WORKER|CAST_CAD_CAD_CONVERSION_WORKER']) },
    { id: 'cost-catalog', label: 'Private cost catalog/database adapter', category: 'cost', requiredEnvVars: ['CAST_CAD_COST_CATALOG_ADAPTER|CAST_CAD_COST_DATABASE_ADAPTER'], providerDecision: 'Choose the cost catalog/database adapter before costs are durable or budget-authoritative.', ready: envChoiceReady(['CAST_CAD_COST_CATALOG_ADAPTER|CAST_CAD_COST_DATABASE_ADAPTER']) },
  ].map((gate) => ({ ...gate, status: gate.ready ? 'ready' : 'provider-required', publicExposure: false, noPublicLinks: true, secretValuesExposed: false }));
  const readyCount = gates.filter((gate) => gate.ready).length;
  const blocked = gates.filter((gate) => !gate.ready);
  return {
    ok: true,
    status: blocked.length ? 'provider-required' : 'ready',
    readyCount,
    blockedCount: blocked.length,
    gateCount: gates.length,
    gates,
    missingRequiredEnvChoices: blocked.map((gate) => ({ id: gate.id, label: gate.label, requiredEnvVars: gate.requiredEnvVars, providerDecision: gate.providerDecision })),
    contract: { publicExposure: false, noPublicLinks: true, noStore: true, secretValuesExposed: false, failClosedUntilProvidersConfigured: true },
  };
}
function markupsCsv(markups) {
  const cols = ['id','projectId','sheetId','pageNumber','tool','subject','status','priority','trade','costCode','quantity','unit','createdByUserId','createdAt'];
  return [cols.join(','), ...markups.map((m) => cols.map((c) => csvEscape(c === 'quantity' ? (m.measurement?.value || '') : c === 'unit' ? (m.measurement?.unit || '') : m[c])).join(','))].join('\n');
}

module.exports = {
  CAST_CAD_ROLES, CAST_CAD_PERMISSIONS, canCastCad, requireCastCad, requireAuthenticatedActor, getActor, getState, resetState, privateResponseHeaders, applyPrivateResponseHeaders, json, privateCsv, readBody, audit,
  buildPdfStreamContract, createPdfStreamLease, createPdfRendererSession, listPdfRendererSessions, pdfRendererContract, sheetFromIndex, buildServerPdfUrls, createPrivateUploadLease, listPrivateUploadLeases, privateUploadLeaseContract, createMarkup, updateMarkup, deleteMarkup, listMarkups, createSavedMarkupView, listSavedMarkupViews, runSavedMarkupView, createTakeoffWorkbookExport, createAnnotatedPdfExport, createPdfAnnotationImportJob,
  createMarkupComment, listMarkupComments, createCommentMentionDelivery, listCommentMentionEvents, listMarkupAudit, createMarkupAttachment, listMarkupAttachments, attachmentContract,
  defaultViewerPreferences, normalizeViewerPreferences, getViewerPreferences, saveViewerPreferences, saveViewportMapping, listViewportMappings, normalizedPointToPdfPoint, upsertScaleCalibration, listScaleCalibrations, scaleCalibrationContract,
  createRfiFromMarkup, createWorkflowLinkFromMarkup, listWorkflowLinks, indexOcrPage, searchOcr, createDrawingAutoLinks, listDrawingAutoLinks, drawingAutoLinkContract, createAiFinding, reviewAiFinding, listAiFindings, createReviewRoom, createReviewRoomInviteDelivery, listReviewRoomInviteEvents,
  upsertDrawingDocumentMetadata, importDrawingDocumentMetadataFromIndex, listDrawingDocumentMetadata,
  createToolLibraryItem, updateToolLibraryItem, listToolLibraryItems, applyToolLibraryItemToMarkup,
  upsertCostCatalogItem, importCostCatalogItems, listCostCatalogItems, costCatalogContract,
  buildComparisonJob, createModelIngestionJob, listModelIngestionJobs, createModelQuantityLink, listModelQuantityLinks, modelQuantityLinkContract, createBatchOperation, listBatchOperations, createFieldPackage, syncFieldPackageDeltas, listFieldPackages,
  createDrawingUploadPackage, listDrawingUploadPackages, createDrawingTransmittal, listDrawingTransmittals, createDrawingSetVersion, slipSheetRevision, listDrawingSetVersions, createDrawingApprovalPackage, reviewDrawingApprovalPackage, listDrawingApprovalPackages, drawingApprovalContract, runDrawingIndexQa, listDrawingIndexQaReports, drawingIndexQaContract,
  upsertProjectMemberRole, listProjectMembers, buildPermissionMatrix, getEffectivePermissions, readCastCadAuditLog, castCadProductionReadiness,
  markupsCsv,
};
