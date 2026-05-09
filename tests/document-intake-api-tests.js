const assert = require('assert');
const { Readable } = require('stream');
const { handleDocumentIntake, validatePayload, buildStoragePlan } = require('../api/_lib/document-intake-api');

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

  res = await call('POST', { fileName: 'RFI 012.pdf' });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'AUTH_REQUIRED');

  res = await call('POST', {
    fileName: 'RFI 012.pdf',
    fileSize: 1200,
    projectId: 'golden-hill',
    module: 'RFIs',
    folder: '/projects/golden-hill/rfis/2026',
    confirmedAt: new Date().toISOString(),
  }, { authorization: 'Bearer test' });
  assert.equal(res.status, 501);
  assert.equal(res.body.code, 'DOCUMENT_STORAGE_NOT_CONFIGURED');
  assert(res.body.storagePlan.objectKey.includes('projects/golden-hill/rfis/2026'));

  const errors = validatePayload({ fileName: 'bad.exe', module: 'RFIs', projectId: 'golden-hill', folder: '/projects/golden-hill/rfis', confirmedAt: 'now' });
  assert(errors.some((e) => e.includes('Unsupported file extension')));

  const plan = buildStoragePlan({ fileName: 'Signed Agreement #1.pdf', projectId: 'golden-hill', module: 'Contracts', folder: '/projects/golden-hill/contracts/2026', linkedRecords: ['Commitment 001'], confirmedAt: 'now' });
  assert.equal(plan.module, 'Contracts');
  assert(plan.objectKey.includes('Signed Agreement'));
  console.log('Document intake API tests passed.');
})().catch((err) => { console.error(err); process.exit(1); });
