const assert = require('assert');
const { Readable } = require('stream');
const { handleDocumentIntake, validatePayload, buildStoragePlan } = require('../api/_lib/document-intake-api');
const { classifyDocument } = require('../api/_lib/document-classification');
const { workflowDecision } = require('../api/_lib/document-workflow');
const { canOverrideClassification, canViewModule } = require('../api/_lib/document-permissions');
const { matchLinkedRecords, extractFinancialMetadata, extractFieldMetadata, extractDrawingMetadata } = require('../api/_lib/document-matching');
const { DROPBOX_LINK_TYPES, createDropboxLinkRecord } = require('../api/_lib/document-dropbox-links');
const { EMAIL_TEMPLATES, createDistributionRecord } = require('../api/_lib/document-email-distribution');
const { SEARCH_FIELDS, SAVED_VIEWS, buildSearchQuery } = require('../api/_lib/document-search');

function mockReq(method, body, headers = {}) {
  const req = new Readable({ read() {} });
  req.method = method;
  req.headers = headers;
  if (body !== undefined) req.push(typeof body === 'string' ? body : JSON.stringify(body));
  req.push(null);
  return req;
}
function mockRes() { return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(payload) { this.payload = payload; } }; }
async function call(method, body, headers) { const res = mockRes(); await handleDocumentIntake(mockReq(method, body, headers), res); return { status: res.statusCode, body: JSON.parse(res.payload) }; }

(async () => {
  let res = await call('GET');
  assert.equal(res.status, 200);
  assert(res.body.supportedModules.includes('RFIs'));
  assert(res.body.supportedExtensions.includes('pdf'));
  assert.equal(res.body.storageHierarchy, '/server_storage/projects/{projectSlug}/documents/{module_folder}');

  res = await call('POST', { fileName: 'RFI 012.pdf' });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'AUTH_REQUIRED');

  res = await call('POST', { fileName: 'RFI 012.pdf', fileSize: 1200, projectId: 'golden-hill', module: 'RFIs', confirmedAt: new Date().toISOString() }, { authorization: 'Bearer test', 'x-cast-role': 'Admin', 'x-cast-user-name': 'Admin User', 'x-cast-user-email': 'admin@cast-dev.com', 'x-cast-company': 'CAST' });
  assert.equal(res.status, 501);
  assert.equal(res.body.code, 'DOCUMENT_STORAGE_NOT_CONFIGURED');
  assert(res.body.structuredClassification);
  assert.equal(res.body.structuredClassification.module, 'RFIs');
  assert.equal(typeof res.body.structuredClassification.confidenceScore, 'number');
  assert(res.body.structuredClassification.suggestedFolderPath.includes('/server_storage/projects/golden-hill/documents/rfis'));
  assert(res.body.storagePlan.originalStoragePath.includes('/server_storage/projects/golden-hill/documents/rfis/original/'));
  assert(res.body.storagePlan.processedTextPath.includes('/processed_text/'));
  assert(res.body.storagePlan.metadata.extractedMetadata.fileExtension === 'pdf');
  assert.equal(res.body.uploaderContact.email, 'admin@cast-dev.com');
  assert(res.body.auditLog.some((x) => x.action === 'document.upload.confirmed'));

  res = await call('POST', { fileName: 'Invoice.pdf', fileSize: 1200, projectId: 'golden-hill', module: 'Invoices', adminOverrideNote: 'Move to invoice queue', confirmedAt: new Date().toISOString() }, { authorization: 'Bearer test', 'x-cast-role': 'Field Staff' });
  assert.equal(res.status, 422);
  assert(res.body.errors.some((x) => x.includes('Only admins and project managers')));

  const classification = classifyDocument({ fileName: 'SUB 118 Storefront shop drawings.pdf', projectId: 'golden-hill', textSnippet: 'Approved as noted by architect. Contact pm@example.com. Cost $1,250.00.' });
  for (const key of ['projectId','projectName','module','documentType','confidenceScore','suggestedFolderPath','suggestedRecordLinks','extractedMetadata','requiresHumanReview','reasoningSummary','workflow']) assert(Object.prototype.hasOwnProperty.call(classification, key), `classification missing ${key}`);
  assert.equal(classification.module, 'Submittals');
  assert(classification.extractedMetadata.emailAddresses.includes('pm@example.com'));
  assert(classification.extractedMetadata.contactSuggestions.some((x) => x.email === 'pm@example.com'));
  assert(classification.extractedMetadata.costValues.includes('$1,250.00'));
  assert(classification.suggestedRecordLinks.some((x) => x.linkType === 'responded_submittal_link'));

  const rfi = classifyDocument({ fileName: 'RFI 24 Architect Response.pdf', projectId: 'golden-hill', textSnippet: 'RFI Number 24 Answer by Engineer Response' });
  assert(rfi.suggestedRecordLinks.some((x) => x.linkType === 'responded_rfi_link'));

  const contract = classifyDocument({ fileName: 'Signed subcontract agreement PO ABC-123.pdf', projectId: 'golden-hill', textSnippet: 'Executed contract amount $25,000 retainage payment terms signature' });
  assert.equal(contract.module, 'Contracts');
  assert(contract.suggestedRecordLinks.some((x) => x.extractionTargets && x.extractionTargets.includes('contractAmount')));
  assert(contract.workflow.sensitiveDocument);

  assert.equal(workflowDecision({ confidenceScore: 0.95, module: 'Documents', suggestedRecordLinks: [] }).action, 'Ready to File');
  assert.equal(workflowDecision({ confidenceScore: 0.65, module: 'Documents', suggestedRecordLinks: [] }).nextStatus, 'Needs Review');
  assert.equal(canOverrideClassification('Project Manager'), true);
  assert.equal(canOverrideClassification('Field Staff'), false);
  assert.equal(canViewModule('Accounting', 'Financials'), true);
  assert.equal(canViewModule('Field Staff', 'Financials'), false);
  assert.equal(canViewModule('Subcontractor', 'RFIs', { assignedToUser: true, externalUser: true }), true);


  const financialMatches = matchLinkedRecords({ fileName: 'Invoice INV-77 Pay Application 12 cost code 03-100 retainage.pdf', textSnippet: 'Current payment due $10,000 prior payments $5,000 Change Order CO-02' });
  assert(financialMatches.some((x) => x.linkType === 'financial_document_link'));
  const financialMeta = extractFinancialMetadata('Invoice INV-77 Pay Application 12 cost code 03-100 retainage current payment due $10,000 prior payments $5,000 Change Order CO-02');
  assert(financialMeta.invoiceNumbers.includes('INV-77'));
  assert(financialMeta.dollarAmounts.includes('$10,000'));
  assert(financialMeta.costCodes.includes('03-100'));

  const fieldMatches = matchLinkedRecords({ fileName: 'Daily Report field photos weather manpower Area Level 3 electrical.pdf' });
  assert(fieldMatches.some((x) => x.linkType === 'field_document_link'));
  assert(extractFieldMetadata('weather manpower area Level 3 electrical safety').trades.includes('electrical'));

  const drawingMatches = matchLinkedRecords({ fileName: 'ASI 04 A2.01 Revision 3 Architectural bulletin.pdf' });
  assert(drawingMatches.some((x) => x.linkType === 'drawing_register_link'));
  assert.equal(extractDrawingMetadata('A2.01 Revision 3 Architectural').sheetNumber, 'A2.01');

  assert(DROPBOX_LINK_TYPES.includes('dropbox_source_link'));
  const link = createDropboxLinkRecord({ documentId: 'doc1', linkedModule: 'RFIs', linkedRecordId: '24', linkType: 'dropbox_issued_document_link', url: 'https://dropbox.com/s/doc', userId: 'u1' });
  assert.equal(link.userWhoAddedLink, 'u1');

  assert(EMAIL_TEMPLATES.rfi_issued);
  const dist = createDistributionRecord({ templateKey: 'drawing_update_distributed', documentId: 'doc1', linkedModule: 'Drawings', recipients: ['pm@cast-dev.com'], manualRecipients: ['new@example.com'], sender: 'u1', data: { documentTitle: 'A2.01', projectName: 'Alüm', secureLink: 'https://secure/link' } });
  assert.equal(dist.sendSecureLinksNotRawAttachments, true);
  assert(dist.contactDirectorySuggestions.some((x) => x.email === 'new@example.com'));

  assert(SEARCH_FIELDS.includes('dropboxLinks'));
  assert(SAVED_VIEWS.includes('Ready to Distribute'));
  assert.equal(buildSearchQuery({ module: 'RFIs' }).requiresPermissionFilter, true);

  const errors = validatePayload({ fileName: 'bad.exe', module: 'RFIs', projectId: 'golden-hill', confirmedAt: 'now' });
  assert(errors.some((e) => e.includes('Unsupported file extension')));

  const plan = buildStoragePlan({ fileName: 'Signed Agreement #1.pdf', projectId: 'golden-hill', module: 'Contracts', linkedRecords: ['Commitment 001'], confirmedAt: 'now' });
  assert.equal(plan.module, 'Contracts');
  assert(plan.objectKey.includes('server_storage/projects/golden-hill/documents/contracts/original'));
  assert(plan.originalStoragePath.includes('Signed Agreement'));
  console.log('Document intake API tests passed.');
})().catch((err) => { console.error(err); process.exit(1); });
