'use strict';

const MODULE_FOLDER = {
  Documents: 'general',
  Contracts: 'contracts',
  Financials: 'financials',
  Field: 'field',
  Drawings: 'drawings',
  RFIs: 'rfis',
  Submittals: 'submittals',
  'Change Orders': 'change_orders',
  'Pay Applications': 'pay_applications',
  Invoices: 'invoices',
  Insurance: 'insurance',
  Permits: 'permits',
  'Meeting Minutes': 'meeting_minutes',
  Closeout: 'closeout',
  Uncategorized: 'uncategorized',
};
function safeSegment(value) { return String(value || 'uncategorized').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'uncategorized'; }
function safeFileName(value) { return String(value || 'document').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180); }
function moduleFolder(module) { return MODULE_FOLDER[module] || 'uncategorized'; }
function buildStructuredFolder({ projectSlug, projectId, module }) {
  return `/server_storage/projects/${safeSegment(projectSlug || projectId)}/documents/${moduleFolder(module)}`;
}
function buildFilingPath({ projectSlug, projectId, module, documentType, fileName, uploadedAt = new Date().toISOString(), versionNumber = 1 }) {
  const storedFileName = `${Date.now()}-v${versionNumber}-${safeFileName(fileName)}`;
  const folder = buildStructuredFolder({ projectSlug, projectId, module });
  return {
    folder,
    originalStoragePath: `${folder}/original/${storedFileName}`,
    processedTextPath: `${folder}/processed_text/${storedFileName}.txt`,
    metadataPath: `${folder}/metadata/${storedFileName}.json`,
    versionPath: `${folder}/versions/v${versionNumber}/${storedFileName}`,
    storedFileName,
    objectKey: `${folder.replace(/^\/+/, '')}/original/${storedFileName}`,
    downloadLink: `/api/document-intake/download/${encodeURIComponent(storedFileName)}`,
    viewLink: `/api/document-intake/view/${encodeURIComponent(storedFileName)}`,
    shareLink: `/api/document-intake/share/${encodeURIComponent(storedFileName)}`,
    documentType: documentType || module,
    uploadedAt,
  };
}
function storageConfig() {
  return {
    root: process.env.DOCUMENT_STORAGE_ROOT || process.env.CAST_DOCUMENT_STORAGE_ROOT || '/server_storage',
    publicLinkBase: process.env.DOCUMENT_PUBLIC_LINK_BASE || '',
    maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB || 75),
    dropboxEnabled: /^true$/i.test(process.env.DROPBOX_ENABLED || ''),
    supportedProviders: ['local','s3','dropbox','google-drive','sharepoint','box'],
  };
}
module.exports = { MODULE_FOLDER, buildStructuredFolder, buildFilingPath, storageConfig, safeSegment, safeFileName, moduleFolder };
