const REQUIRED_MANIFEST_FIELDS = [
  'projectId',
  'sourceSystem',
  'sourceViewName',
  'sourceStableKey',
  'sourceExportedAt',
  'ingestedAt',
  'rowCountExpected',
  'rowCountNormalized',
  'rowCountReconciled',
  'reconciliationStatus',
  'reconciliationNotes',
  'sourceWritebackEnabled',
  'reviewOnly',
];

const REQUIRED_RECORD_LINKAGE_FIELDS = [
  'projectId',
  'sourceSystem',
  'sourceManifestId',
  'sourceStableKey',
  'sourceRecordId',
  'sourceExportedAt',
  'normalizedAt',
  'sourceWritebackEnabled',
  'reviewOnly',
];

const ALLOWED_RECONCILIATION_STATUSES = new Set(['pass', 'warning', 'blocked', 'not-applicable']);
const PRIVATE_SOURCE_PATTERN = /(^|[/\\])(source-logs|dropbox-intake|source-artifacts|raw|private)([/\\]|$)|\/Users\/|CAST Community Dropbox|\/Volumes\//i;

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function isIsoLikeTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validateSafeStableKey(sourceStableKey, errors, fieldName = 'sourceStableKey') {
  if (typeof sourceStableKey !== 'string' || !sourceStableKey.trim()) {
    errors.push(`${fieldName} must be a non-empty sanitized stable key.`);
    return;
  }
  if (PRIVATE_SOURCE_PATTERN.test(sourceStableKey)) {
    errors.push(`${fieldName} must not expose private folders or local source paths.`);
  }
}

function validateSourceManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Source manifest must be an object.'] };
  }

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!hasValue(manifest[field])) errors.push(`Missing required source manifest field: ${field}.`);
  }

  validateSafeStableKey(manifest.sourceStableKey, errors);

  for (const timestampField of ['sourceExportedAt', 'ingestedAt']) {
    if (hasValue(manifest[timestampField]) && !isIsoLikeTimestamp(manifest[timestampField])) {
      errors.push(`${timestampField} must be an ISO-like timestamp.`);
    }
  }

  for (const countField of ['rowCountExpected', 'rowCountNormalized']) {
    if (!Number.isInteger(manifest[countField]) || manifest[countField] < 0) {
      errors.push(`${countField} must be a non-negative integer.`);
    }
  }

  if (typeof manifest.rowCountReconciled !== 'boolean') {
    errors.push('rowCountReconciled must be boolean.');
  }
  if (!ALLOWED_RECONCILIATION_STATUSES.has(manifest.reconciliationStatus)) {
    errors.push('reconciliationStatus must be pass, warning, blocked, or not-applicable.');
  }
  if (manifest.sourceWritebackEnabled !== false) {
    errors.push('sourceWritebackEnabled must remain false for read-first imports.');
  }
  if (manifest.reviewOnly !== true) {
    errors.push('reviewOnly must remain true for read-first imports.');
  }
  if (manifest.rowCountReconciled && manifest.rowCountExpected !== manifest.rowCountNormalized) {
    errors.push('rowCountReconciled cannot be true when expected and normalized row counts differ.');
  }
  if (manifest.reconciliationStatus === 'pass' && !manifest.rowCountReconciled) {
    errors.push('reconciliationStatus pass requires rowCountReconciled true.');
  }

  return { valid: errors.length === 0, errors };
}

function validateNormalizedRecordLinkage(record, manifest) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors: ['Normalized record must be an object.'] };
  }
  for (const field of REQUIRED_RECORD_LINKAGE_FIELDS) {
    if (!hasValue(record[field])) errors.push(`Missing required normalized record linkage field: ${field}.`);
  }
  validateSafeStableKey(record.sourceStableKey, errors, 'record.sourceStableKey');
  if (hasValue(record.sourceExportedAt) && !isIsoLikeTimestamp(record.sourceExportedAt)) {
    errors.push('record.sourceExportedAt must be an ISO-like timestamp.');
  }
  if (hasValue(record.normalizedAt) && !isIsoLikeTimestamp(record.normalizedAt)) {
    errors.push('record.normalizedAt must be an ISO-like timestamp.');
  }
  if (record.sourceWritebackEnabled !== false) {
    errors.push('record.sourceWritebackEnabled must remain false.');
  }
  if (record.reviewOnly !== true) {
    errors.push('record.reviewOnly must remain true.');
  }

  if (manifest && typeof manifest === 'object') {
    for (const field of ['projectId', 'sourceSystem', 'sourceStableKey', 'sourceExportedAt']) {
      if (hasValue(record[field]) && hasValue(manifest[field]) && record[field] !== manifest[field]) {
        errors.push(`Normalized record ${field} must match its source manifest.`);
      }
    }
    if (hasValue(manifest.manifestId) && hasValue(record.sourceManifestId) && record.sourceManifestId !== manifest.manifestId) {
      errors.push('Normalized record sourceManifestId must match manifestId.');
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  REQUIRED_MANIFEST_FIELDS,
  REQUIRED_RECORD_LINKAGE_FIELDS,
  validateSourceManifest,
  validateNormalizedRecordLinkage,
};
