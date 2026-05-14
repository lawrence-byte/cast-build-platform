const assert = require('assert');
const {
  REQUIRED_MANIFEST_FIELDS,
  REQUIRED_RECORD_LINKAGE_FIELDS,
  validateSourceManifest,
  validateNormalizedRecordLinkage,
} = require('../api/_lib/source-manifest-contract');

const manifest = {
  manifestId: 'golden-hill-procore-rfis-2026-05-13',
  projectId: 'golden-hill',
  sourceSystem: 'procore',
  sourceViewName: 'RFI Log Export',
  sourceStableKey: 'procore/rfis/rfi-log-export',
  sourceExportedAt: '2026-05-13T00:00:00-07:00',
  ingestedAt: '2026-05-13T19:30:00-07:00',
  rowCountExpected: 42,
  rowCountNormalized: 42,
  rowCountReconciled: true,
  reconciliationStatus: 'pass',
  reconciliationNotes: 'All exported RFI rows normalized into the review register.',
  sourceWritebackEnabled: false,
  reviewOnly: true,
};

const normalizedRecord = {
  projectId: 'golden-hill',
  sourceSystem: 'procore',
  sourceManifestId: 'golden-hill-procore-rfis-2026-05-13',
  sourceStableKey: 'procore/rfis/rfi-log-export',
  sourceRecordId: 'rfi-001',
  sourceExportedAt: '2026-05-13T00:00:00-07:00',
  normalizedAt: '2026-05-13T19:31:00-07:00',
  sourceWritebackEnabled: false,
  reviewOnly: true,
};

assert(REQUIRED_MANIFEST_FIELDS.includes('rowCountReconciled'));
assert(REQUIRED_MANIFEST_FIELDS.includes('sourceWritebackEnabled'));
assert(REQUIRED_RECORD_LINKAGE_FIELDS.includes('sourceManifestId'));
assert(REQUIRED_RECORD_LINKAGE_FIELDS.includes('reviewOnly'));

assert.deepStrictEqual(validateSourceManifest(manifest), { valid: true, errors: [] });
assert.deepStrictEqual(validateNormalizedRecordLinkage(normalizedRecord, manifest), { valid: true, errors: [] });

const writebackAttempt = validateSourceManifest({
  ...manifest,
  sourceWritebackEnabled: true,
});
assert.strictEqual(writebackAttempt.valid, false);
assert(writebackAttempt.errors.some((error) => error.includes('sourceWritebackEnabled must remain false')));

const unreconciledPass = validateSourceManifest({
  ...manifest,
  rowCountNormalized: 41,
  rowCountReconciled: true,
});
assert.strictEqual(unreconciledPass.valid, false);
assert(unreconciledPass.errors.some((error) => error.includes('rowCountReconciled cannot be true')));

const rawSourceLeak = validateSourceManifest({
  ...manifest,
  sourceStableKey: '/Users/example/source-artifacts/rfis.csv',
});
assert.strictEqual(rawSourceLeak.valid, false);
assert(rawSourceLeak.errors.some((error) => error.includes('must not expose private folders')));

const mismatchedRecord = validateNormalizedRecordLinkage({
  ...normalizedRecord,
  sourceManifestId: 'different-manifest',
  reviewOnly: false,
}, manifest);
assert.strictEqual(mismatchedRecord.valid, false);
assert(mismatchedRecord.errors.some((error) => error.includes('sourceManifestId must match')));
assert(mismatchedRecord.errors.some((error) => error.includes('record.reviewOnly must remain true')));

console.log('Source manifest contract tests passed.');
