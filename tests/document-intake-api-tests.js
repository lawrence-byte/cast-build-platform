const assert = require('assert');
const { Readable } = require('stream');
const { handleDocumentIntake, validatePayload, buildStoragePlan } = require('../api/_lib/document-intake-api');
const { classifyDocument } = require('../api/_lib/document-classification');

function mockReq(method, body, headers = {}) {
  const req = new Readable({ read() {} });
  req.method = method;
  req.headers = headers;
  if (body !== undefined) req.push(typeof body === 'string' ? body : JSON.stringify(body));
  req.push(null);
  return req;
}
function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(payload) { this.payload = payload; },
  };
}
async function call(method, body, headers) {
  const res = mockRes();
  await handleDocumentIntake(mockReq(method, body, headers), res);
  return { status: res.statusCode, body: JSON.parse(res.payload) };
}

(async () => {
  let res = await call('GET');
  assert.equal(res.status, 200);
  assert(res.body.supportedModules.includes('RFIs'));
  assert(res.body.supportedExtensions.includes('pdf'));
  assert.equal(res.body.storageHierarchy, '/server_storage/projects/{projectSlug}/documents/{module_folder}');

  res = await call('POST', { fileName: 'RFI 012.pdf' });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'AUTH_REQUIRED');

  res = await call('POST', {
    fileName: 'RFI 012.pdf',
    fileSize: 1200,
    projectId: 'golden-hill',
    module: 'RFIs',
    confirmedAt: new Date().toISOString(),
  }, { authorization: 'Bearer test', 'x-cast-role': 'Admin' });
  assert.equal(res.status, 501);
  assert.equal(res.body.code, 'DOCUMENT_STORAGE_NOT_CONFIGURED');
  assert(res.body.structuredClassification);
  assert.equal(res.body.structuredClassification.module, 'RFIs');
  assert.equal(typeof res.body.structuredClassification.confidenceScore, 'number');
  assert(res.body.structuredClassification.suggestedFolderPath.includes('/server_storage/projects/golden-hill/documents/rfis'));
  assert(res.body.storagePlan.originalStoragePath.includes('/server_storage/projects/golden-hill/documents/rfis/original/'));
  assert(res.body.storagePlan.processedTextPath.includes('/processed_text/'));
  assert(res.body.storagePlan.metadata.extractedMetadata.fileExtension === 'pdf');

  const classification = classifyDocument({ fileName: 'SUB 118 Storefront shop drawings.pdf', projectId: 'golden-hill', textSnippet: 'Approved as noted by architect. Contact pm@example.com. Cost $1,250.00.' });
  for (const key of ['projectId','projectName','module','documentType','confidenceScore','suggestedFolderPath','suggestedRecordLinks','extractedMetadata','requiresHumanReview','reasoningSummary']) {
    assert(Object.prototype.hasOwnProperty.call(classification, key), `classification missing ${key}`);
  }
  assert.equal(classification.module, 'Submittals');
  assert(classification.extractedMetadata.emailAddresses.includes('pm@example.com'));
  assert(classification.extractedMetadata.costValues.includes('$1,250.00'));

  const errors = validatePayload({ fileName: 'bad.exe', module: 'RFIs', projectId: 'golden-hill', confirmedAt: 'now' });
  assert(errors.some((e) => e.includes('Unsupported file extension')));

  const plan = buildStoragePlan({ fileName: 'Signed Agreement #1.pdf', projectId: 'golden-hill', module: 'Contracts', linkedRecords: ['Commitment 001'], confirmedAt: 'now' });
  assert.equal(plan.module, 'Contracts');
  assert(plan.objectKey.includes('server_storage/projects/golden-hill/documents/contracts/original'));
  assert(plan.originalStoragePath.includes('Signed Agreement'));
  console.log('Document intake API tests passed.');
})().catch((err) => { console.error(err); process.exit(1); });
