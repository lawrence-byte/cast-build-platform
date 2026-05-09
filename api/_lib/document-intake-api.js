'use strict';

const { classifyDocument, MODULES: MODULE_LIST } = require('./document-classification');
const { matchLinkedRecords } = require('./document-matching');
const { extractTextFallback } = require('./document-ocr');
const { buildFilingPath, storageConfig } = require('./document-storage');

const MODULES = new Set(MODULE_LIST);
const ALLOWED_EXTENSIONS = new Set(['pdf','doc','docx','xls','xlsx','csv','jpg','jpeg','png','heic','dwg','dxf','eml','msg','txt']);
const MAX_FILE_BYTES = 75 * 1024 * 1024;

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
      if (raw.length > 1_000_000) {
        reject(new Error('REQUEST_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { reject(new Error('INVALID_JSON')); }
    });
    req.on('error', reject);
  });
}

function getExtension(fileName = '') {
  const parts = String(fileName).split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function getActor(req) {
  // Production hook: replace bearer-token placeholder with real CAST auth/session validation.
  // This endpoint intentionally fails closed unless a caller presents auth AND storage is configured.
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return { id: 'authenticated-api-caller', permissions: ['document:upload'] };
}

function validatePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('Payload is required.');
  if (!body.fileName) errors.push('fileName is required.');
  const ext = getExtension(body.fileName);
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) errors.push(`Unsupported file extension: ${ext}.`);
  if (Number(body.fileSize || 0) > MAX_FILE_BYTES) errors.push('File exceeds the 75 MB intake limit.');
  if (!body.projectId) errors.push('projectId is required.');
  if (!MODULES.has(body.module)) errors.push('module must be a supported CAST filing module.');
  if (!body.folder || !String(body.folder).startsWith('/projects/')) errors.push('folder must be a project-scoped storage folder.');
  if (!body.confirmedAt) errors.push('User confirmation is required before filing.');
  return errors;
}

function buildStoragePlan(body) {
  const safeName = String(body.fileName || 'document').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
  return {
    projectId: body.projectId,
    module: body.module,
    folder: body.folder,
    objectKey: `${body.folder.replace(/^\/+/, '')}/${Date.now()}-${safeName}`,
    linkedRecords: body.linkedRecords || [],
    metadata: {
      originalFileName: body.fileName,
      mimeType: body.mimeType || '',
      size: body.fileSize || 0,
      classification: body.classification || null,
      adminOverrideNote: body.adminOverrideNote || '',
      confirmedAt: body.confirmedAt,
    },
  };
}

async function handleDocumentIntake(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      endpoint: 'CAST Document Intake',
      supportedModules: [...MODULES],
      supportedExtensions: [...ALLOWED_EXTENSIONS],
      maxFileBytes: MAX_FILE_BYTES,
      authRequired: true,
      storage: storageConfig(),
      storageRequiredEnv: ['DOCUMENT_STORAGE_ROOT or CAST_DOCUMENT_STORAGE_ROOT or CAST_DOCUMENT_BUCKET', 'DOCUMENT_DATABASE_URL or CAST_DOCUMENT_DATABASE_URL'],
      optionalEnv: ['DOCUMENT_PUBLIC_LINK_BASE','EMAIL_PROVIDER','EMAIL_FROM_ADDRESS','OCR_PROVIDER','OCR_API_KEY','DROPBOX_ENABLED','DROPBOX_APP_KEY','DROPBOX_APP_SECRET','CLASSIFICATION_PROVIDER','CLASSIFICATION_MODEL','MAX_UPLOAD_SIZE_MB'],
    });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Use POST to file a confirmed intake document.' });
  const actor = getActor(req);
  if (!actor || !actor.permissions.includes('document:upload')) return json(res, 401, { ok: false, code: 'AUTH_REQUIRED', message: 'Authenticated document upload permission is required.' });
  let body;
  try { body = await readBody(req); } catch (err) { return json(res, 400, { ok: false, code: err.message, message: 'Invalid document intake request body.' }); }
  const errors = validatePayload(body);
  if (errors.length) return json(res, 422, { ok: false, code: 'VALIDATION_FAILED', errors });
  const ocr = await extractTextFallback(body);
  const classification = body.classification || classifyDocument({ fileName: body.fileName, mimeType: body.mimeType, textSnippet: ocr.text });
  const linkedRecordSuggestions = body.linkedRecords?.length ? body.linkedRecords : matchLinkedRecords({ fileName: body.fileName, textSnippet: ocr.text }).map((m) => m.label);
  const storagePlan = { ...buildStoragePlan({ ...body, classification }), suggestedPath: buildFilingPath({ projectId: body.projectId, module: body.module, documentType: classification.documentType, fileName: body.fileName, uploadedAt: body.confirmedAt }) };
  storagePlan.linkedRecords = linkedRecordSuggestions;
  if (!process.env.DOCUMENT_STORAGE_ROOT && !process.env.CAST_DOCUMENT_STORAGE_ROOT && !process.env.CAST_DOCUMENT_BUCKET) {
    return json(res, 501, { ok: false, code: 'DOCUMENT_STORAGE_NOT_CONFIGURED', message: 'Server document storage is not configured. The client should retain a local queued intake record.', ocr, classification, linkedRecordSuggestions, storagePlan });
  }
  if (!process.env.DOCUMENT_DATABASE_URL && !process.env.CAST_DOCUMENT_DATABASE_URL) {
    return json(res, 501, { ok: false, code: 'DOCUMENT_DATABASE_NOT_CONFIGURED', message: 'Document metadata database is not configured. Filing is blocked to avoid orphaned files.', ocr, classification, linkedRecordSuggestions, storagePlan });
  }
  return json(res, 501, { ok: false, code: 'HANDLER_NOT_IMPLEMENTED', message: 'Storage adapter is configured but write handler is not implemented in this static scaffold.', ocr, classification, linkedRecordSuggestions, storagePlan });
}

module.exports = { handleDocumentIntake, buildStoragePlan, validatePayload, MODULES, ALLOWED_EXTENSIONS };
