'use strict';
const path = require('path');
function safeSegment(value) { return String(value || 'uncategorized').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'uncategorized'; }
function buildFilingPath({ projectId, module, documentType, fileName, uploadedAt = new Date().toISOString() }) {
  const year = new Date(uploadedAt).getFullYear();
  const safeName = String(fileName || 'document').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
  const folder = `/projects/${safeSegment(projectId)}/${safeSegment(module)}/${safeSegment(documentType)}/${year}`;
  return { folder, objectKey: `${folder.replace(/^\/+/, '')}/${Date.now()}-${safeName}` };
}
function storageConfig() {
  return {
    root: process.env.DOCUMENT_STORAGE_ROOT || process.env.CAST_DOCUMENT_STORAGE_ROOT || '',
    publicLinkBase: process.env.DOCUMENT_PUBLIC_LINK_BASE || '',
    maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB || 75),
    dropboxEnabled: /^true$/i.test(process.env.DROPBOX_ENABLED || ''),
  };
}
module.exports = { buildFilingPath, storageConfig, safeSegment };
