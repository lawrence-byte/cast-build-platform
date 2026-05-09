'use strict';

const { classifyDocument, MODULES: MODULE_LIST, ext } = require('./document-classification');
const { extractTextFallback } = require('./document-ocr');
const { buildFilingPath, buildStructuredFolder, storageConfig } = require('./document-storage');
const { permissionRulesFor, canOverrideClassification } = require('./document-permissions');
const { auditEvent } = require('./document-workflow');
const { captureUploaderContact } = require('./document-contact-capture');

const MODULES = new Set(MODULE_LIST);
const ALLOWED_EXTENSIONS = new Set(['pdf','doc','docx','xls','xlsx','csv','jpg','jpeg','png','heic','dwg','dxf','eml','msg','txt']);
const MAX_FILE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_MB || 75) * 1024 * 1024;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) { reject(new Error('REQUEST_TOO_LARGE')); req.destroy(); }
    });
    req.on('end', () => { if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { reject(new Error('INVALID_JSON')); } });
    req.on('error', reject);
  });
}
function getActor(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const role = req.headers['x-cast-role'] || 'Admin';
  return { id: req.headers['x-cast-user-id'] || 'authenticated-api-caller', name: req.headers['x-cast-user-name'] || 'Authenticated User', email: req.headers['x-cast-user-email'] || '', company: req.headers['x-cast-company'] || '', role, permissions: permissionRulesFor(role).permissions };
}
function validatePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('Payload is required.');
  if (!body.fileName) errors.push('fileName is required.');
  const fileExt = ext(body.fileName);
  if (fileExt && !ALLOWED_EXTENSIONS.has(fileExt)) errors.push(`Unsupported file extension: ${fileExt}.`);
  if (Number(body.fileSize || 0) > MAX_FILE_BYTES) errors.push('File exceeds the configured intake limit.');
  if (!body.projectId) errors.push('projectId is required.');
  if (body.module && !MODULES.has(body.module)) errors.push('module must be a supported CAST filing module.');
  if (!body.confirmedAt) errors.push('User confirmation is required before filing.');
  return errors;
}
function buildStoragePlan(body) {
  const classification = body.structuredClassification || body.classification || classifyDocument(body);
  const filing = buildFilingPath({ projectSlug: body.projectSlug || body.projectId, projectId: body.projectId, module: body.module || classification.module, documentType: classification.documentType, fileName: body.fileName, uploadedAt: body.confirmedAt, versionNumber: body.versionNumber || 1 });
  return {
    projectId: classification.projectId || body.projectId,
    projectName: classification.projectName || body.projectName || body.projectId,
    module: body.module || classification.module,
    documentType: classification.documentType,
    suggestedFolderPath: classification.suggestedFolderPath || buildStructuredFolder({ projectSlug: body.projectSlug || body.projectId, projectId: body.projectId, module: body.module || classification.module }),
    finalFolderPath: body.finalFolderPath || classification.suggestedFolderPath || filing.folder,
    storedFileName: filing.storedFileName,
    originalStoragePath: filing.originalStoragePath,
    processedTextPath: filing.processedTextPath,
    metadataPath: filing.metadataPath,
    versionPath: filing.versionPath,
    objectKey: filing.objectKey,
    downloadLink: filing.downloadLink,
    viewLink: filing.viewLink,
    shareLink: filing.shareLink,
    linkedRecords: classification.suggestedRecordLinks || body.linkedRecords || [],
    permissionRules: body.permissionRules || permissionRulesFor(body.actorRole || 'Admin'),
    requiredRecords: ['original file storage','processed text extraction storage','metadata record','version history','audit log','user upload record','approval status','module association','linked project records','permission rules','download link','view link','authorized share link'],
    metadata: {
      originalFileName: body.fileName,
      fileExtension: ext(body.fileName),
      mimeType: body.mimeType || '',
      size: body.fileSize || 0,
      classification,
      extractedMetadata: classification.extractedMetadata || {},
      adminOverrideNote: body.adminOverrideNote || '',
      uploadSource: body.uploadSource || 'global_intake',
      confirmedAt: body.confirmedAt,
    },
  };
}
async function handleDocumentIntake(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, { ok: true, endpoint: 'CAST Document Intake', supportedModules: [...MODULES], supportedExtensions: [...ALLOWED_EXTENSIONS], maxFileBytes: MAX_FILE_BYTES, authRequired: true, roles: require('./document-permissions').ROLES, storageHierarchy: '/server_storage/projects/{projectSlug}/documents/{module_folder}', storage: storageConfig(), storageRequiredEnv: ['DOCUMENT_STORAGE_ROOT','DOCUMENT_DATABASE_URL'], optionalEnv: ['DOCUMENT_PUBLIC_LINK_BASE','EMAIL_PROVIDER','EMAIL_FROM_ADDRESS','OCR_PROVIDER','OCR_API_KEY','DROPBOX_ENABLED','DROPBOX_APP_KEY','DROPBOX_APP_SECRET','CLASSIFICATION_PROVIDER','CLASSIFICATION_MODEL','MAX_UPLOAD_SIZE_MB'] });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Use POST to file a confirmed intake document.' });
  const actor = getActor(req);
  if (!actor || !actor.permissions.includes('document:upload')) return json(res, 401, { ok: false, code: 'AUTH_REQUIRED', message: 'Authenticated document upload permission is required.' });
  let body;
  try { body = await readBody(req); } catch (err) { return json(res, 400, { ok: false, code: err.message, message: 'Invalid document intake request body.' }); }
  body.actorRole = actor.role;
  const errors = validatePayload(body);
  if (body.adminOverrideNote && !canOverrideClassification(actor.role)) errors.push('Only admins and project managers can override classification.');
  if (errors.length) return json(res, 422, { ok: false, code: 'VALIDATION_FAILED', errors });
  const ocr = await extractTextFallback(body);
  const structuredClassification = body.structuredClassification || classifyDocument({ ...body, textSnippet: body.textSnippet || ocr.text, ocrUsed: Boolean(ocr.text), folderContext: body.folderContext });
  const storagePlan = buildStoragePlan({ ...body, structuredClassification, module: body.module || structuredClassification.module });
  const uploaderContact = captureUploaderContact({ user: actor, projectId: body.projectId, documentId: body.id, classification: structuredClassification });
  const auditLog = [auditEvent({ documentId: body.id, userId: actor.id, action: 'document.upload.confirmed', newValue: { fileName: body.fileName, classification: structuredClassification }, reason: body.adminOverrideNote, req })];
  if (body.adminOverrideNote) auditLog.push(auditEvent({ documentId: body.id, userId: actor.id, action: 'document.classification.override', previousValue: body.classification || null, newValue: structuredClassification, reason: body.adminOverrideNote, req }));
  if (!process.env.DOCUMENT_STORAGE_ROOT && !process.env.CAST_DOCUMENT_STORAGE_ROOT && !process.env.CAST_DOCUMENT_BUCKET) {
    return json(res, 501, { ok: false, code: 'DOCUMENT_STORAGE_NOT_CONFIGURED', message: 'Server document storage is not configured. The client should retain a local queued intake record.', ocr, structuredClassification, uploaderContact, auditLog, storagePlan });
  }
  if (!process.env.DOCUMENT_DATABASE_URL && !process.env.CAST_DOCUMENT_DATABASE_URL) {
    return json(res, 501, { ok: false, code: 'DOCUMENT_DATABASE_NOT_CONFIGURED', message: 'Document metadata database is not configured. Filing is blocked to avoid orphaned files.', ocr, structuredClassification, uploaderContact, auditLog, storagePlan });
  }
  return json(res, 501, { ok: false, code: 'HANDLER_NOT_IMPLEMENTED', message: 'Storage adapter is configured but write handler is not implemented in this static scaffold.', ocr, structuredClassification, uploaderContact, auditLog, storagePlan });
}
module.exports = { handleDocumentIntake, buildStoragePlan, validatePayload, MODULES, ALLOWED_EXTENSIONS };
