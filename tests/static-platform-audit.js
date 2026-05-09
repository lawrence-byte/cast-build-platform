const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const files = ['public/index.html', 'public/admin.html', 'public/projects.html', 'public/procore.html', 'public/construction-cost-forecasting.html', 'public/schedule-brain.html', 'public/projects/alum-rfis.html', 'public/projects/alum-rfis.js', 'public/projects/alum-submittals.html', 'public/projects/alum-submittals.js', 'public/projects/alum-change-events.html', 'public/projects/alum-change-events.js', 'public/projects/alum-daily-log.html', 'public/projects/alum-daily-log.js', 'public/projects/alum-executive-report.html', 'public/projects/alum-executive-report.js', 'public/projects/alum-command-center.html', 'public/projects/alum-command-center.js', 'public/projects/alum-meeting-minutes.html', 'public/projects/alum-meeting-minutes.js', 'public/projects/alum-schedule.html', 'public/projects/alum-schedule.js', 'public/projects/alum-management-control-center.html', 'public/projects/alum-management-control-center.js', 'public/projects/alum-closeout.html', 'public/projects/alum-closeout.js', 'public/projects/alum-directory.html', 'public/projects/alum-directory.js', 'public/projects/alum-quality.html', 'public/projects/alum-quality.js', 'public/projects/alum-punch-list.html', 'public/projects/alum-punch-list.js', 'public/projects/alum-contracts.html', 'public/projects/alum-contracts.js', 'public/projects/alum-potential-change-orders.html', 'public/projects/alum-potential-change-orders.js', 'public/projects/alum-owner-billings.html', 'public/projects/alum-owner-billings.js', 'public/projects/alum-specifications.html', 'public/projects/alum-specifications.js', 'public/projects/alum-reports.html', 'public/cast-xlsx-export.js', 'public/cast-document-intake.js', 'public/cast-document-intake.css', 'public/projects/cast-project-controls-data.js', 'public/projects/cast-rfi-tracker.html', 'public/projects/cast-rfi-tracker.js', 'public/projects/cast-drawing-log.html', 'public/projects/cast-drawing-log.js', 'public/projects/cast-document-register.html', 'public/projects/cast-document-register.js', 'public/projects/cast-submittal-controls-data.js', 'public/projects/cast-submittal-tracker.html', 'public/projects/cast-submittal-tracker.js', 'docs/cast-build-platform-map.md', 'docs/procore-integration-plan.md', 'docs/platform-guardrails.md'];
let failed = false;
function fail(message) {
  console.error(message);
  failed = true;
}
function walk(dir, visitor) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visitor);
    else visitor(full);
  }
}
function stripHashAndQuery(value) {
  return value.split('#')[0].split('?')[0];
}
function publicRelFromUrl(url) {
  const cleaned = stripHashAndQuery(url.trim());
  if (!cleaned || cleaned === '/') return 'index.html';
  if (/^(https?:|mailto:|tel:|javascript:|data:|#)/i.test(cleaned)) return null;
  const withoutSlash = cleaned.startsWith('/') ? cleaned.slice(1) : cleaned;
  if (!withoutSlash || withoutSlash.endsWith('/')) return `${withoutSlash}index.html`;
  return withoutSlash;
}
function routeExists(route) {
  const rel = publicRelFromUrl(route);
  if (rel === null) return true;
  const direct = path.join(publicDir, rel);
  if (fs.existsSync(direct)) return true;
  const asHtml = path.join(publicDir, `${rel}.html`);
  if (!path.extname(rel) && fs.existsSync(asHtml)) return true;
  return false;
}
const secretPattern = /APIFY_TOKEN|PROCORE_CLIENT_SECRET|password\s*=|sk-[A-Za-z0-9]/;
const rawArtifactPathPattern = /(^|[/\\])(source-logs|dropbox-intake|source-artifacts|raw|private)([/\\]|$)|\.(pdf|xlsx?|csv|zip)$/i;
const privateSourceStringPattern = /dropbox-intake|source-logs|source-artifacts|\/Users\/|CAST Community Dropbox|\/Volumes\/CAST Drive|00_PROCORE DATA TIE/i;
const brandBlocklistPattern = /CAST\s+Capital/i;
const developmentUnderwritingPattern = /underwriting|pre-development|feasibility|unit[- ]mix|parking\s*\+|entitlement|acquisition|market rent|rent support|development cost/i;
const developmentUnderwritingAllowlist = new Set(['tests/static-platform-audit.js', 'docs/platform-guardrails.md', 'docs/cast-build-platform-map.md']);
const selfReferenceAllowlist = new Set(['tests/static-platform-audit.js', 'docs/platform-guardrails.md']);
const allowedRawMentions = [
  'tests/static-platform-audit.js',
  'docs/deployment-readiness.md',
  'docs/platform-guardrails.md',
  'public/projects/alum-data-room.js',
  'public/projects/golden-hill-procore.js',
  'public/projects/alum-daily-log.html',
  'public/projects/alum-change-events.js',
  'public/projects/alum-closeout.js',
  'public/projects/alum-command-center.js',
  'public/projects/alum-executive-report.js',
  'scripts/build-static.js',
];
function isAllowedRawMention(rel) {
  return allowedRawMentions.includes(rel.replace(/\\/g, '/'));
}
for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing ${file}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  if (secretPattern.test(text)) {
    fail(`Potential secret pattern in ${file}`);
  }
}

const alumPortalPage = fs.readFileSync(path.join(root, 'public/projects/golden-hill.html'), 'utf8');
for (const requiredPortalLink of ['alum-directory.html', 'alum-quality.html', 'alum-punch-list.html', 'alum-contracts.html', 'alum-potential-change-orders.html', 'alum-owner-billings.html', 'alum-specifications.html', 'alum-reports.html']) {
  if (!alumPortalPage.includes(requiredPortalLink)) {
    console.error(`Alüm portal missing Procore-style system link: ${requiredPortalLink}`);
    failed = true;
  }
}
for (const forbiddenUiCopy of ['Read-first project controls', 'Metadata only', 'Safe next steps', 'Project links']) {
  if (alumPortalPage.includes(forbiddenUiCopy)) {
    console.error(`Alüm portal should not expose internal framing copy: ${forbiddenUiCopy}`);
    failed = true;
  }
}
const procoreSystemPages = [
  ['public/projects/alum-directory.html', 'Directory'],
  ['public/projects/alum-quality.html', 'Observations / Inspections'],
  ['public/projects/alum-punch-list.html', 'Punch List'],
  ['public/projects/alum-contracts.html', 'Contracts'],
  ['public/projects/alum-potential-change-orders.html', 'Potential Change Orders'],
  ['public/projects/alum-owner-billings.html', 'Owner Billings'],
  ['public/projects/alum-specifications.html', 'Specifications'],
  ['public/projects/alum-reports.html', 'Reports'],
];
for (const [moduleFile, label] of procoreSystemPages) {
  const text = fs.readFileSync(path.join(root, moduleFile), 'utf8');
  if (!text.includes(label) || !text.includes('project-sidebar-group')) {
    console.error(`${moduleFile} must use grouped project navigation and include ${label}.`);
    failed = true;
  }
}


const rfiTrackerPage = fs.readFileSync(path.join(root, 'public/projects/cast-rfi-tracker.html'), 'utf8');
const rfiTrackerScript = fs.readFileSync(path.join(root, 'public/projects/cast-rfi-tracker.js'), 'utf8');
const alumRfiPage = fs.readFileSync(path.join(root, 'public/projects/alum-rfis.html'), 'utf8');
const controlsDataScript = fs.readFileSync(path.join(root, 'public/projects/cast-project-controls-data.js'), 'utf8');
for (const requiredRfiMvpSignal of ['RFIs moved to Documents', '/projects/alum-rfis.html#create-rfi']) {
  if (!rfiTrackerPage.includes(requiredRfiMvpSignal)) {
    console.error(`Retired CAST RFI tracker page missing redirect signal: ${requiredRfiMvpSignal}`);
    failed = true;
  }
}
for (const requiredRfiPortalSignal of ['Alüm · Documents', 'data-rfi-create-form', 'data-rfi-rows', 'Create RFI']) {
  if (!alumRfiPage.includes(requiredRfiPortalSignal)) {
    console.error(`Alüm Documents RFI portal missing create/action signal: ${requiredRfiPortalSignal}`);
    failed = true;
  }
}
for (const requiredRfiDomainSignal of ['generateRfiNumber', 'validateRfi', 'markOfficialResponse', 'closeRfi', 'reopenRfi', 'reviseRfi', 'auditLog', 'notifications']) {
  if (!controlsDataScript.includes(requiredRfiDomainSignal)) {
    console.error(`CAST RFI data service missing domain signal: ${requiredRfiDomainSignal}`);
    failed = true;
  }
}
if (!rfiTrackerScript.includes('/projects/alum-rfis.html#create-rfi')) {
  console.error('Retired CAST RFI tracker script must redirect to the Documents RFI portal.');
  failed = true;
}

const submittalTrackerPage = fs.readFileSync(path.join(root, 'public/projects/cast-submittal-tracker.html'), 'utf8');
const submittalTrackerScript = fs.readFileSync(path.join(root, 'public/projects/cast-submittal-tracker.js'), 'utf8');
const alumSubmittalPage = fs.readFileSync(path.join(root, 'public/projects/alum-submittals.html'), 'utf8');
const submittalDataScript = fs.readFileSync(path.join(root, 'public/projects/cast-submittal-controls-data.js'), 'utf8');
for (const requiredSubmittalSignal of ['Submittals moved to Documents', '/projects/alum-submittals.html#create-submittal']) {
  if (!submittalTrackerPage.includes(requiredSubmittalSignal)) {
    console.error(`Retired CAST submittal tracker page missing redirect signal: ${requiredSubmittalSignal}`);
    failed = true;
  }
}
for (const requiredSubmittalPortalSignal of ['Alüm · Documents', 'data-form', 'data-rows', 'data-detail', 'Export Submittal Log Excel', 'Submit for Review']) {
  if (!alumSubmittalPage.includes(requiredSubmittalPortalSignal)) {
    console.error(`Alüm Documents Submittal portal missing workflow signal: ${requiredSubmittalPortalSignal}`);
    failed = true;
  }
}
for (const requiredSubmittalDomainSignal of ['generateSubmittalNumber', 'generatePackageNumber', 'validateSubmittal', 'startWorkflow', 'submitSubmittalResponse', 'markOfficialSubmittalResponse', 'returnSubmittal', 'closeSubmittal', 'reviseSubmittal', 'workingDaysFrom']) {
  if (!submittalDataScript.includes(requiredSubmittalDomainSignal)) {
    console.error(`CAST submittal service missing domain signal: ${requiredSubmittalDomainSignal}`);
    failed = true;
  }
}
if (!submittalTrackerScript.includes('/projects/alum-submittals.html#create-submittal')) {
  console.error('Retired CAST submittal tracker script must redirect to the Documents Submittals portal.');
  failed = true;
}

for (const requiredScaffold of [['public/projects/cast-drawing-log.html', 'Drawing Log'], ['public/projects/cast-document-register.html', 'Document Register']]) {
  const text = fs.readFileSync(path.join(root, requiredScaffold[0]), 'utf8');
  if (!text.includes(requiredScaffold[1]) || !text.includes('RFIs')) {
    console.error(`${requiredScaffold[0]} missing document-control scaffold signals.`);
    failed = true;
  }
}


const intakeScript = fs.readFileSync(path.join(root, 'public/cast-document-intake.js'), 'utf8');
const intakeCss = fs.readFileSync(path.join(root, 'public/cast-document-intake.css'), 'utf8');
const navScript = fs.readFileSync(path.join(root, 'public/projects/alum-project-nav.js'), 'utf8');
const adminPageForIntake = fs.readFileSync(path.join(root, 'public/admin.html'), 'utf8');
const adminIntakeScript = fs.readFileSync(path.join(root, 'public/admin-document-intake.js'), 'utf8');
for (const requiredIntakeSignal of ['CAST Document Intake', 'Upload and File Document', 'data-intake-drop', 'Confirm and File', 'classification', 'linkedRecords', '/api/document-intake', 'document:upload']) {
  if (!intakeScript.includes(requiredIntakeSignal)) {
    console.error(`Global document intake missing signal: ${requiredIntakeSignal}`);
    failed = true;
  }
}
for (const requiredIntakeModule of ['Documents','Contracts','Financials','Field','Drawings','RFIs','Submittals','Change Orders','Pay Applications','Invoices','Insurance','Permits','Meeting Minutes','Closeout','Uncategorized']) {
  if (!intakeScript.includes(requiredIntakeModule)) {
    console.error(`Global document intake missing classification module: ${requiredIntakeModule}`);
    failed = true;
  }
}
if (!fs.existsSync(path.join(root, 'public/assets/cast-upload-logo.png'))) {
  console.error('Missing CAST upload logo asset placeholder at public/assets/cast-upload-logo.png');
  failed = true;
}
for (const requiredNavIntakeSignal of ['cast-document-intake.js', 'cast-document-intake.css', 'mountButton(topNav)']) {
  if (!navScript.includes(requiredNavIntakeSignal)) {
    console.error(`Alüm global nav missing document intake integration: ${requiredNavIntakeSignal}`);
    failed = true;
  }
}
if (!adminPageForIntake.includes('/cast-document-intake.js') || !adminPageForIntake.includes("mountButton(document.querySelector('.topbar'))")) {
  console.error('Admin page must mount the global CAST document intake button.');
  failed = true;
}
for (const requiredIntakeCssSignal of ['.cast-intake-button', '.cast-intake-overlay', '.cast-intake-panel']) {
  if (!intakeCss.includes(requiredIntakeCssSignal)) {
    console.error(`Global document intake CSS missing signal: ${requiredIntakeCssSignal}`);
    failed = true;
  }
}
const intakeApi = fs.readFileSync(path.join(root, 'api/_lib/document-intake-api.js'), 'utf8');
for (const requiredApiSignal of ['AUTH_REQUIRED', 'DOCUMENT_STORAGE_NOT_CONFIGURED', 'DOCUMENT_STORAGE_ROOT', 'DOCUMENT_DATABASE_URL', 'validatePayload', 'buildStoragePlan', 'structuredClassification']) {
  if (!intakeApi.includes(requiredApiSignal)) {
    console.error(`Document intake API contract missing signal: ${requiredApiSignal}`);
    failed = true;
  }
}


for (const requiredAdminQueueSignal of ['Admin Document Intake Review Queue', 'data-intake-review-rows', 'Approve', 'Reject', 'Reclassify', 'Move folder', 'Link to existing record', 'Create new record', 'Dropbox']) {
  if (!adminPageForIntake.includes(requiredAdminQueueSignal)) {
    console.error(`Admin document intake review queue missing signal: ${requiredAdminQueueSignal}`);
    failed = true;
  }
}
for (const requiredAdminQueueScriptSignal of ['castDocumentIntakeReviewQueue.v1', 'duplicateWarning', 'classification', 'emailDistribution', 'contacts', 'Admin debug']) {
  if (!adminIntakeScript.includes(requiredAdminQueueScriptSignal)) {
    console.error(`Admin document intake review script missing signal: ${requiredAdminQueueScriptSignal}`);
    failed = true;
  }
}
for (const requiredIntakeDoc of ['docs/document-intake-system.md', 'database/document-intake-schema.sql', 'api/_lib/document-storage.js', 'api/_lib/document-classification.js', 'api/_lib/document-ocr.js', 'api/_lib/document-matching.js']) {
  if (!fs.existsSync(path.join(root, requiredIntakeDoc))) {
    console.error(`Missing document intake deliverable: ${requiredIntakeDoc}`);
    failed = true;
  }
}


const classificationService = fs.readFileSync(path.join(root, 'api/_lib/document-classification.js'), 'utf8');
for (const requiredClassificationField of ['projectId','projectName','module','documentType','confidenceScore','suggestedFolderPath','suggestedRecordLinks','extractedMetadata','requiresHumanReview','reasoningSummary']) {
  if (!classificationService.includes(requiredClassificationField)) {
    console.error(`Document classifier missing structured field: ${requiredClassificationField}`);
    failed = true;
  }
}
const storageService = fs.readFileSync(path.join(root, 'api/_lib/document-storage.js'), 'utf8');
for (const requiredStorageSignal of ['/server_storage/projects', "RFIs: 'rfis'", 'processed_text', 'metadataPath', 'downloadLink', 'viewLink', 'shareLink']) {
  if (!storageService.includes(requiredStorageSignal)) {
    console.error(`Document storage planner missing required signal: ${requiredStorageSignal}`);
    failed = true;
  }
}
const permissionsService = fs.readFileSync(path.join(root, 'api/_lib/document-permissions.js'), 'utf8');
for (const requiredRole of ['Admin','Project Executive','Project Manager','Assistant Project Manager','Superintendent','Field Staff','Accounting','Owner','Consultant','Architect','Engineer','Subcontractor','Vendor','Read Only']) {
  if (!permissionsService.includes(requiredRole)) {
    console.error(`Document permission contract missing role: ${requiredRole}`);
    failed = true;
  }
}
const intakeSchema = fs.readFileSync(path.join(root, 'database/document-intake-schema.sql'), 'utf8');
for (const requiredTable of ['document_intake_uploads','document_versions','document_audit_log','document_links','project_contact_directory']) {
  if (!intakeSchema.includes(requiredTable)) {
    console.error(`Document intake schema missing table: ${requiredTable}`);
    failed = true;
  }
}
for (const requiredUploadField of ['original_file_name','stored_file_name','file_extension','original_storage_path','processed_text_path','module_classification','confidence_score','suggested_folder_path','final_folder_path','requires_human_review','extracted_metadata_json','linked_records_json','upload_source']) {
  if (!intakeSchema.includes(requiredUploadField)) {
    console.error(`Document intake schema missing upload field: ${requiredUploadField}`);
    failed = true;
  }
}


const workflowService = fs.readFileSync(path.join(root, 'api/_lib/document-workflow.js'), 'utf8');
for (const requiredWorkflowSignal of ['Uploaded','Processing','Classified','Needs Review','Approved for Filing','Filed','Distributed','Rejected','Archived','Ready to File','Sensitive document requires human confirmation','auditEvent']) {
  if (!workflowService.includes(requiredWorkflowSignal)) {
    console.error(`Document workflow service missing signal: ${requiredWorkflowSignal}`);
    failed = true;
  }
}
const contactCaptureService = fs.readFileSync(path.join(root, 'api/_lib/document-contact-capture.js'), 'utf8');
for (const requiredContactSignal of ['dateFirstSeen','dateLastSeen','uploadCountIncrement','relatedDocuments','relatedRFIs','relatedSubmittals','relatedContracts','requiresAdminApprovalBeforeOverwrite']) {
  if (!contactCaptureService.includes(requiredContactSignal)) {
    console.error(`Document contact capture missing signal: ${requiredContactSignal}`);
    failed = true;
  }
}
const matchingService = fs.readFileSync(path.join(root, 'api/_lib/document-matching.js'), 'utf8');
for (const requiredMatchingSignal of ['issued_rfi_link','responded_rfi_link','issued_submittal_link','responded_submittal_link','create_new_rfi_candidate','create_new_submittal_candidate','emailDistributionHistory','contractAmount','retainage','paymentTerms','signatureStatus']) {
  if (!matchingService.includes(requiredMatchingSignal)) {
    console.error(`Document matching service missing signal: ${requiredMatchingSignal}`);
    failed = true;
  }
}
for (const requiredPermissionSignal of ['document:override_classification','document:view_financial_sensitive','document:view_contract_sensitive','externalRule','canOverrideClassification','canViewModule']) {
  if (!permissionsService.includes(requiredPermissionSignal)) {
    console.error(`Document permission contract missing signal: ${requiredPermissionSignal}`);
    failed = true;
  }
}
for (const requiredContactSchemaSignal of ['document_contact_capture_rollups','upload_count','related_documents','related_rfis','related_submittals','related_contracts','requires_admin_approval_before_overwrite']) {
  if (!intakeSchema.includes(requiredContactSchemaSignal)) {
    console.error(`Document contact schema missing signal: ${requiredContactSchemaSignal}`);
    failed = true;
  }
}


for (const requiredService of ['api/_lib/document-dropbox-links.js','api/_lib/document-email-distribution.js','api/_lib/document-search.js']) {
  if (!fs.existsSync(path.join(root, requiredService))) {
    console.error(`Missing document infrastructure service: ${requiredService}`);
    failed = true;
  }
}
const dropboxLinkService = fs.readFileSync(path.join(root, 'api/_lib/document-dropbox-links.js'), 'utf8');
for (const requiredDropboxSignal of ['dropbox_source_link','dropbox_issued_document_link','dropbox_responded_document_link','dropbox_supporting_backup_link','dropbox_drawing_link','dropbox_folder_link','external_shared_link_note','validateSecureUrl']) {
  if (!dropboxLinkService.includes(requiredDropboxSignal)) {
    console.error(`Dropbox link service missing signal: ${requiredDropboxSignal}`);
    failed = true;
  }
}
const emailDistributionService = fs.readFileSync(path.join(root, 'api/_lib/document-email-distribution.js'), 'utf8');
for (const requiredEmailSignal of ['document_filed_notice','rfi_issued','rfi_response_received','submittal_issued','submittal_response_received','contract_uploaded_for_review','financial_document_uploaded_for_approval','field_report_distributed','drawing_update_distributed','sendSecureLinksNotRawAttachments','exportableDistributionLog']) {
  if (!emailDistributionService.includes(requiredEmailSignal)) {
    console.error(`Email distribution service missing signal: ${requiredEmailSignal}`);
    failed = true;
  }
}
const searchService = fs.readFileSync(path.join(root, 'api/_lib/document-search.js'), 'utf8');
for (const requiredSearchSignal of ['fileName','documentType','costCode','rfiNumber','submittalNumber','contractNumber','changeOrderNumber','invoiceNumber','drawingSheetNumber','extractedText','dropboxLinks','Needs Review','Ready to Distribute']) {
  if (!searchService.includes(requiredSearchSignal)) {
    console.error(`Document search service missing signal: ${requiredSearchSignal}`);
    failed = true;
  }
}
for (const requiredComplianceSchemaSignal of ['document_external_links','document_email_distributions','document_saved_views','archived_at','soft_deleted_at','delete_requested_at','Upload, View, Download, Classification']) {
  if (!intakeSchema.includes(requiredComplianceSchemaSignal)) {
    console.error(`Document schema missing distribution/search/compliance signal: ${requiredComplianceSchemaSignal}`);
    failed = true;
  }
}

const procorePage = fs.readFileSync(path.join(root, 'public/procore.html'), 'utf8');
if (!/no CAST BUILD A.O authentication/i.test(procorePage) || !/write API calls/i.test(procorePage)) {
  console.error('CAST BUILD A.O page must state integration guardrails.');
  failed = true;
}
const constructionForecastPage = fs.readFileSync(path.join(root, 'public/construction-cost-forecasting.html'), 'utf8');

const scheduleBrainPage = fs.readFileSync(path.join(root, 'public/schedule-brain.html'), 'utf8');
for (const requiredScheduleBrainSignal of ['Schedule Dashboard', 'Current Schedule Items', 'Daily Superintendent Huddle', 'Recovery Watch', 'Field Update Intake', 'Recovery Request Draft', 'RFI / Submittal Constraints', '3-Week Lookahead', 'Export Excel', 'Copy Huddle Board']) {
  if (!scheduleBrainPage.includes(requiredScheduleBrainSignal)) {
    console.error(`Schedule Brain platform page missing signal: ${requiredScheduleBrainSignal}`);
    failed = true;
  }
}
for (const forbiddenScheduleBrainCopy of ['Field reality into schedule pressure', 'Less admin', 'Talk, don\'t type', 'Find the drag', 'Pressure without chaos', 'Why It Matters']) {
  if (scheduleBrainPage.includes(forbiddenScheduleBrainCopy)) {
    console.error(`Schedule Brain platform page must not expose slogan/catch-line copy: ${forbiddenScheduleBrainCopy}`);
    failed = true;
  }
}
for (const requiredScheduleSourceSignal of ['schedule-source-index.json', 'data-source-index-status']) {
  if (!scheduleBrainPage.includes(requiredScheduleSourceSignal)) {
    console.error(`Schedule Brain platform page missing source-index signal: ${requiredScheduleSourceSignal}`);
    failed = true;
  }
}

try {
  let capturedXlsxBlob;
  class AuditBlob {
    constructor(parts, options = {}) {
      this.parts = parts;
      this.type = options.type || '';
    }
    toBuffer() {
      return Buffer.concat(this.parts.map((part) => {
        if (Buffer.isBuffer(part)) return part;
        if (ArrayBuffer.isView(part)) return Buffer.from(part.buffer, part.byteOffset, part.byteLength);
        return Buffer.from(String(part));
      }));
    }
  }
  const xlsxContext = {
    window: {},
    TextEncoder,
    Blob: AuditBlob,
    URL: { createObjectURL(blob) { capturedXlsxBlob = blob; return 'blob:audit'; }, revokeObjectURL() {} },
    document: { createElement() { return { click() {} }; } },
    setTimeout(fn) { fn(); },
  };
  vm.createContext(xlsxContext);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/cast-xlsx-export.js'), 'utf8'), xlsxContext);
  xlsxContext.window.CastXlsxExport.downloadXlsx('audit.csv', 'Audit/Bad:*?', [{ key: 'label', header: 'Label' }, { key: 'amount', header: 'Amount' }], [{ label: 'Excel export', amount: 42 }]);
  const workbook = XLSX.read(capturedXlsxBlob.toBuffer(), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  if (workbook.SheetNames[0] !== 'Audit Bad') fail('XLSX export helper did not sanitize Excel sheet names.');
  if (rows[0][0] !== 'Label' || rows[1][1] !== 42) fail('XLSX export helper produced an unreadable workbook.');
} catch (err) {
  fail(`XLSX export helper validation failed: ${err.message}`);
}

const scheduleSourceIndex = JSON.parse(fs.readFileSync(path.join(root, 'public/data/projects/golden-hill/schedule/schedule-source-index.json'), 'utf8'));
if (!scheduleSourceIndex.source_status || !scheduleSourceIndex.publish_guardrail || /\/Users\/|CAST Community Dropbox|\.pdf|\.xlsx|\.mpp|\.xml|\.xer/i.test(JSON.stringify(scheduleSourceIndex))) {
  console.error('Schedule source index must be sanitized and avoid private paths/raw artifact extensions.');
  failed = true;
}
const publicIndex = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const castBuildCss = fs.readFileSync(path.join(root, 'public/cast-build.css'), 'utf8');
if (!/projects\/alum-schedule\.html/.test(scheduleBrainPage)) {
  console.error('Schedule Brain must link to Alüm workbench.');
  failed = true;
}
for (const removedLandingToolCard of ['/schedule-brain.html', '/construction-cost-forecasting.html', '/document-tools.html']) {
  if (publicIndex.includes(`href="${removedLandingToolCard}"`)) {
    console.error(`CAST Build landing must not expose standalone tool card: ${removedLandingToolCard}`);
    failed = true;
  }
}
if (!publicIndex.includes('ALÜM PROJECT')) {
  console.error('CAST Build landing missing retained platform entry: ALÜM PROJECT');
  failed = true;
}
for (const removedLandingProjectShortcut of ['RFI Log', 'href="/projects/alum-rfis.html"']) {
  if (publicIndex.includes(removedLandingProjectShortcut)) {
    console.error(`CAST Build landing must consolidate project shortcut into portals: ${removedLandingProjectShortcut}`);
    failed = true;
  }
}
if (!publicIndex.includes('/assets/brand/cast-community-logo-transparent.png') || !/alt="CAST COMMUNITY"/.test(publicIndex)) {
  console.error('CAST Build landing top-left must use the transparent CAST Community logo.');
  failed = true;
}
if (!publicIndex.includes('/assets/brand/cast-automation-horizontal-white-on-charcoal.png') || !/alt="CAST AUTOMATION"/.test(publicIndex)) {
  console.error('CAST Build landing top-right must use the CAST Automation logo.');
  failed = true;
}
for (const asset of ['cast-community-logo-transparent.png', 'cast-build-logo-transparent.png', 'cast-automation-horizontal-white-on-charcoal.png', 'alum-building-linen-sketch.png']) {
  if (!fs.existsSync(path.join(root, 'public/assets/brand', asset))) {
    console.error(`Missing transparent landing brand asset: ${asset}`);
    failed = true;
  }
}
if (!publicIndex.includes('cast-landing-building-sketch') || !publicIndex.includes('/assets/brand/alum-building-linen-sketch.png')) {
  console.error('CAST Build landing must include the Alüm linen building sketch asset.');
  failed = true;
}
if (!/class="cast-landing-building-sketch"[^>]*alt=""[^>]*width="898"[^>]*height="1032"[^>]*aria-hidden="true"/.test(publicIndex)) {
  console.error('CAST Build landing sketch must remain decorative with explicit dimensions for CLS safety.');
  failed = true;
}
if (/cast-landing-building-sketch[^>]*fetchpriority="high"/.test(publicIndex)) {
  console.error('Decorative landing sketch must not use high fetch priority.');
  failed = true;
}
if (!/\.cast-family-top img\{width:95px;height:auto/.test(castBuildCss) || !/\.cast-access-logo\{[^}]*width:min\(380px,100%\)/.test(castBuildCss)) {
  console.error('CAST Build landing must use reduced CAST Community top-left sizing and reduced CAST Build desktop sizing.');
  failed = true;
}
if (!/\.automation-top img\{width:190px;height:auto/.test(castBuildCss)) {
  console.error('CAST Build landing must use reduced CAST Automation desktop sizing.');
  failed = true;
}
if (!/\.cast-landing-building-sketch\{[^}]*right:clamp\(-406px,-25\.2vw,-329px\);[^}]*width:min\(620px,49vw\)/.test(castBuildCss)) {
  console.error('CAST Build landing building sketch must sit cropped on the far right.');
  failed = true;
}
if (!/@media\(max-width:900px\)[\s\S]*\.cast-access-logo\{[^}]*width:min\(320px,86vw\)/.test(castBuildCss) || !/@media\(max-width:900px\)[\s\S]*\.automation-top img\{width:66px;height:auto/.test(castBuildCss)) {
  console.error('CAST Build landing must use reduced mobile CAST Build and CAST Automation sizing.');
  failed = true;
}
const projectCss = fs.readFileSync(path.join(root, 'public/projects/golden-hill-procore.css'), 'utf8');
for (const requiredResponsiveRule of ['Responsive sheet hardening', '.dashboard,.card,.head,.body,.modulemap,.modulemap a,.metricgrid,.controls{min-width:0;max-width:100%;}', 'html,body{max-width:100%;overflow-x:hidden;}', 'table{min-width:680px;}']) {
  if (!projectCss.includes(requiredResponsiveRule)) {
    console.error(`Project CSS missing command-center responsive guard: ${requiredResponsiveRule}`);
    failed = true;
  }
}
const pricingModelsPage = fs.readFileSync(path.join(root, 'public/pricing-models.html'), 'utf8');


for (const [forecastFile, forecastText] of [['public/construction-cost-forecasting.html', constructionForecastPage], ['public/pricing-models.html', pricingModelsPage]]) {
  for (const requiredSignal of ['Construction Cost Forecasting', 'Revised budget', 'Approved commitments', 'Job to date', 'Cost to complete', 'Pending changes', 'Schedule risk allowance', 'Next draw request', 'RFI/submittal risk', 'localStorage']) {
    if (!forecastText.includes(requiredSignal)) {
      console.error(`${forecastFile} missing construction cost forecast signal: ${requiredSignal}`);
      failed = true;
    }
  }
  for (const forbiddenDevelopmentSignal of ['Monthly NOI', 'Value @ cap', 'Yield on cost', 'Average rent / unit', 'Stabilized occupancy', 'Exit cap rate', 'Total development cost']) {
    if (forecastText.includes(forbiddenDevelopmentSignal)) {
      console.error(`${forecastFile} must not expose development underwriting/pricing model signal: ${forbiddenDevelopmentSignal}`);
      failed = true;
    }
  }
}
const budgetSummary = JSON.parse(fs.readFileSync(path.join(root, 'data/projects/golden-hill/procore-information/budget/budget-summary.json'), 'utf8'));
const budgetAuditPath = path.join(root, 'data/projects/golden-hill/procore-information/budget/budget-audit.json');
const budgetEmbedded = fs.readFileSync(path.join(root, 'public/projects/alum-budget-data.js'), 'utf8');
const budgetPage = fs.readFileSync(path.join(root, 'public/projects/alum-budget.html'), 'utf8');
if (!budgetEmbedded.includes('window.__ALUM_BUDGET_SUMMARY__') || !budgetEmbedded.includes('"Revised Budget"')) {
  console.error('Budget page must include embedded budget data for reliable preview loading.');
  failed = true;
}
if (!/Budget Input \+ Audit/.test(budgetPage) || !/data-audit-rows/.test(budgetPage)) {
  console.error('Budget page must include input and audit controls.');
  failed = true;
}
if (!/alum-budget-exceptions\.html/.test(budgetPage)) {
  console.error('Budget page must link to budget exceptions / needs review.');
  failed = true;
}
if (!/alum-commitments\.html/.test(budgetPage)) {
  console.error('Budget page must link to commitments / procurement review.');
  failed = true;
}
if (!/alum-accounting-tieout\.html/.test(budgetPage)) {
  console.error('Budget page must link to accounting budget tie-out.');
  failed = true;
}
if (!/Editable Budget Workspace/.test(budgetPage) || !/editableBudgetRows/.test(budgetPage)) {
  console.error('Budget page must include an editable local planning workspace.');
  failed = true;
}
const budgetScript = fs.readFileSync(path.join(root, 'public/projects/alum-budget.js'), 'utf8');
for (const requiredEditableControl of ['budgetDelta', 'eacOverride', 'Export Budget Edits', 'localStorage']) {
  if (!budgetScript.includes(requiredEditableControl) && !budgetPage.includes(requiredEditableControl)) {
    console.error(`Editable budget workspace missing control: ${requiredEditableControl}`);
    failed = true;
  }
}
const dynamicForecastPage = fs.readFileSync(path.join(root, 'public/projects/alum-dynamic-forecast.html'), 'utf8');
const dynamicForecastScript = fs.readFileSync(path.join(root, 'public/projects/alum-dynamic-forecast.js'), 'utf8');
if (!/Dynamic Forecast \+ Cost Mapping/.test(dynamicForecastPage) || !/forecastRows/.test(dynamicForecastPage)) {
  console.error('Dynamic forecast page must include editable forecast rows and cost mapping.');
  failed = true;
}
for (const requiredForecastControl of ['Cost Mapping', 'ETC Override', 'risk', 'bucket', 'localStorage']) {
  if (!dynamicForecastPage.includes(requiredForecastControl) && !dynamicForecastScript.includes(requiredForecastControl)) {
    console.error(`Dynamic forecast missing control: ${requiredForecastControl}`);
    failed = true;
  }
}
const accountingTieoutPath = path.join(root, 'data/projects/golden-hill/accounting-budget/accounting-budget-tieout.json');
const publicAccountingTieoutPath = path.join(root, 'public/data/projects/golden-hill/accounting-budget/accounting-budget-tieout.json');
const safeAccountingTieoutPath = path.join(root, 'public/safe-data/projects/golden-hill/accounting-budget/accounting-budget-tieout.json');
const budgetExceptionsPage = fs.readFileSync(path.join(root, 'public/projects/alum-budget-exceptions.html'), 'utf8');
const budgetExceptionsScript = fs.readFileSync(path.join(root, 'public/projects/alum-budget-exceptions.js'), 'utf8');
if (!/Budget Exceptions \/ Needs Review/.test(budgetExceptionsPage) || !/Read-first/.test(budgetExceptionsPage)) {
  console.error('Budget exceptions page must state its needs-review and read-first purpose.');
  failed = true;
}
for (const requiredFlag of ['Projected O/U negative', 'Pending cost changes', 'EAC exceeds revised budget', 'Low commitment coverage', 'Audit/reconciliation issue']) {
  if (!budgetExceptionsScript.includes(requiredFlag)) {
    console.error(`Budget exceptions script missing flag: ${requiredFlag}`);
    failed = true;
  }
}
for (const requiredData of ['budget-summary.json', 'budget-audit.json', 'budget-revisions-register.json', 'forecast-summary.json']) {
  if (!budgetExceptionsScript.includes(requiredData)) {
    console.error(`Budget exceptions script must use ${requiredData}.`);
    failed = true;
  }
}
if (!fs.existsSync(budgetAuditPath)) {
  console.error('Budget audit JSON must be generated.');
  failed = true;
} else {
  const budgetAudit = JSON.parse(fs.readFileSync(budgetAuditPath, 'utf8'));
  if (budgetAudit.status !== 'pass' || budgetAudit.summary?.revisedBudget !== budgetSummary.metrics['Revised Budget']) {
    console.error('Budget audit must pass and match current budget summary.');
    failed = true;
  }
}
const alumReplicaPage = fs.readFileSync(path.join(root, 'public/projects/golden-hill-procore.html'), 'utf8');
if (/source-logs\//i.test(alumReplicaPage)) {
  console.error('Alüm replica page must not link directly to private source-log artifacts.');
  failed = true;
}
if (!/CAST BUILD A\.O Module Map/.test(alumReplicaPage) || !/Action Queue/.test(alumReplicaPage)) {
  console.error('Alüm replica page must include module map and action queue.');
  failed = true;
}
if (!/alum-open-items\.html/.test(alumReplicaPage)) {
  console.error('Alüm replica page must link to the open-items control center.');
  failed = true;
}
if (!/alum-budget-exceptions\.html/.test(alumReplicaPage)) {
  console.error('Alüm replica page must link to the budget exceptions control center.');
  failed = true;
}
if (!/alum-commitments\.html/.test(alumReplicaPage)) {
  console.error('Alüm replica page must link to the commitments control center.');
  failed = true;
}
if (!/alum-accounting-tieout\.html/.test(alumReplicaPage)) {
  console.error('Alüm replica page must link to the accounting tie-out control center.');
  failed = true;
}
if (!/alum-dynamic-forecast\.html/.test(alumReplicaPage)) {
  console.error('Alüm replica page must link to the dynamic forecast control center.');
  failed = true;
}
if (!/alum-management-control-center\.html/.test(alumReplicaPage) || !/alum-schedule\.html/.test(alumReplicaPage)) {
  console.error('Alüm replica page must link to the management center and schedule controls.');
  failed = true;
}
if (!/alum-command-center\.html/.test(alumReplicaPage) || !/alum-meeting-minutes\.html/.test(alumReplicaPage) || !/alum-schedule\.html/.test(alumReplicaPage) || !/alum-closeout\.html/.test(alumReplicaPage)) {
  console.error('Alüm replica page must link to command center, meeting minutes, schedule control, and closeout modules.');
  failed = true;
}
for (const integratedToolSignal of ['Schedule intelligence', 'Cost engine', 'Document tools']) {
  if (!alumReplicaPage.includes(integratedToolSignal)) {
    console.error(`Alüm module map must integrate landing tool stack signal: ${integratedToolSignal}`);
    failed = true;
  }
}
for (const requiredModule of ['alum-rfis.html', 'alum-submittals.html', 'alum-change-events.html', 'alum-daily-log.html']) {
  if (!alumReplicaPage.includes(requiredModule)) {
    console.error(`Alüm replica page must link to dedicated project-management module: ${requiredModule}`);
    failed = true;
  }
}
for (const moduleFile of ['public/projects/alum-rfis.html', 'public/projects/alum-submittals.html', 'public/projects/alum-change-events.html', 'public/projects/alum-daily-log.html']) {
  const moduleText = fs.readFileSync(path.join(root, moduleFile), 'utf8');
  if (!/Read-first|Read-only|read-first|read-only/i.test(moduleText) || !/CAST BUILD A\.O/.test(moduleText)) {
    console.error(`${moduleFile} must state CAST BUILD A.O read-first/read-only posture.`);
    failed = true;
  }
  if (/source-logs|dropbox-intake|\/Users\/|\.pdf|\.xlsx|\.xls|\.csv|\.zip/i.test(moduleText)) {
    console.error(`${moduleFile} must not publish raw file links, private source paths, or raw artifact extensions.`);
    failed = true;
  }
}
const rfiModuleScript = fs.readFileSync(path.join(root, 'public/projects/alum-rfis.js'), 'utf8');
const submittalModuleScript = fs.readFileSync(path.join(root, 'public/projects/alum-submittals.js'), 'utf8');
const changeEventModuleScript = fs.readFileSync(path.join(root, 'public/projects/alum-change-events.js'), 'utf8');
const potentialChangeOrdersPage = fs.readFileSync(path.join(root, 'public/projects/alum-potential-change-orders.html'), 'utf8');
const potentialChangeOrdersScript = fs.readFileSync(path.join(root, 'public/projects/alum-potential-change-orders.js'), 'utf8');
const dailyLogModuleScript = fs.readFileSync(path.join(root, 'public/projects/alum-daily-log.js'), 'utf8');
for (const requiredRfiSignal of ['costImpactYes', 'scheduleImpactYes', 'topManagers', 'topContractors', 'setupCreateRfi', 'LOCAL_RFI_KEY']) {
  if (!rfiModuleScript.includes(requiredRfiSignal)) {
    console.error(`RFI module script missing signal: ${requiredRfiSignal}`);
    failed = true;
  }
}
for (const requiredSubmittalSignal of ['startWorkflow', 'submitSubmittalResponse', 'markOfficialSubmittalResponse', 'returnSubmittal', 'closeSubmittal', 'reviseSubmittal', 'Responsible Contractor']) {
  if (!submittalModuleScript.includes(requiredSubmittalSignal)) {
    console.error(`Submittal module script missing signal: ${requiredSubmittalSignal}`);
    failed = true;
  }
}
for (const requiredChangeSignal of ['11. CHANGE EVENTS', '12. OWNER CHANGE ORDERS', 'budget-revisions-register.json', 'raw log remains private']) {
  if (!changeEventModuleScript.includes(requiredChangeSignal)) {
    console.error(`Change Events module script missing signal: ${requiredChangeSignal}`);
    failed = true;
  }
}
for (const requiredPcoSignal of ['Contracts', 'Potential Change Orders', 'data-pco-rows', 'data-contingency-remaining', 'Contingency Bridge']) {
  if (!potentialChangeOrdersPage.includes(requiredPcoSignal)) {
    console.error(`Potential Change Orders page missing signal: ${requiredPcoSignal}`);
    failed = true;
  }
}
for (const requiredPcoScriptSignal of ['Pending Cost Changes', 'Projected over Under', 'topBudgetRiskRows', 'contingencyTie', 'remainingContingency']) {
  if (!potentialChangeOrdersScript.includes(requiredPcoScriptSignal)) {
    console.error(`Potential Change Orders script missing budget/contingency tie: ${requiredPcoScriptSignal}`);
    failed = true;
  }
}
const dailyLogPage = fs.readFileSync(path.join(root, 'public/projects/alum-daily-log.html'), 'utf8');
if (!/Read-first \/ local-write module/.test(dailyLogPage) || !/localStorage/.test(dailyLogModuleScript) || !/data-review-rows/.test(dailyLogPage)) {
  console.error('Daily Log module must stay browser-local, read-first, and include a PM review queue.');
  failed = true;
}
for (const requiredDailyLogControl of ['data-save', 'data-export', 'data-reset', 'alum-daily-log-local-export.json']) {
  if (!dailyLogPage.includes(requiredDailyLogControl) && !dailyLogModuleScript.includes(requiredDailyLogControl)) {
    console.error(`Daily Log module missing local control: ${requiredDailyLogControl}`);
    failed = true;
  }
}
if (!fs.existsSync(accountingTieoutPath) || !fs.existsSync(publicAccountingTieoutPath) || !fs.existsSync(safeAccountingTieoutPath)) {
  console.error('Accounting budget tie-out JSON must be generated for private, public, and safe deployed metadata views.');
  failed = true;
} else {
  const accountingTieout = JSON.parse(fs.readFileSync(accountingTieoutPath, 'utf8'));
  const publicAccountingTieout = fs.readFileSync(publicAccountingTieoutPath, 'utf8');
  if (accountingTieout.budgetImport?.total !== budgetSummary.metrics['Original Budget Amount']) {
    console.error('Accounting budget import must tie to the current original budget amount.');
    failed = true;
  }
  if (/dropbox-intake|source-logs/.test(publicAccountingTieout)) {
    console.error('Public accounting tie-out metadata must not expose raw intake/source-log paths.');
    failed = true;
  }
}
const accountingTieoutPage = fs.readFileSync(path.join(root, 'public/projects/alum-accounting-tieout.html'), 'utf8');
const accountingTieoutScript = fs.readFileSync(path.join(root, 'public/projects/alum-accounting-tieout.js'), 'utf8');
if (!/Accounting Budget Tie-Out/.test(accountingTieoutPage) || !/data-check-rows/.test(accountingTieoutPage)) {
  console.error('Accounting tie-out page must include tie-out checks.');
  failed = true;
}
if (!accountingTieoutScript.includes('/safe-data/')) {
  console.error('Accounting tie-out page must prefer safe-data JSON so live deployments do not 404 on /data paths.');
  failed = true;
}
const commitmentsPage = fs.readFileSync(path.join(root, 'public/projects/alum-commitments.html'), 'utf8');
const commitmentsScript = fs.readFileSync(path.join(root, 'public/projects/alum-commitments.js'), 'utf8');
if (!/Commitments \/ Procurement Review/.test(commitmentsPage) || !/data-queue-rows/.test(commitmentsPage)) {
  console.error('Commitments page must include procurement review queues.');
  failed = true;
}
for (const requiredQueue of ['Over-committed', 'Low commitment coverage', 'No commitment with spend']) {
  if (!commitmentsScript.includes(requiredQueue)) {
    console.error(`Commitments script missing queue: ${requiredQueue}`);
    failed = true;
  }
}
const openItemsPage = fs.readFileSync(path.join(root, 'public/projects/alum-open-items.html'), 'utf8');
const openItemsScript = fs.readFileSync(path.join(root, 'public/projects/alum-open-items.js'), 'utf8');
if (!/Open Item Control Center/.test(openItemsPage) || !/Read-first replica/i.test(openItemsPage)) {
  console.error('Open-items page must state its read-first control-center purpose.');
  failed = true;
}
if (!/Priority Action Drilldown/.test(openItemsPage) || !/data-priority-queue/.test(openItemsPage) || !/Accounting/.test(openItemsScript)) {
  console.error('Open-items page must include deeper cross-module priority drilldowns.');
  failed = true;
}
if (/source-logs\//i.test(openItemsPage)) {
  console.error('Open-items page must not link directly to private source-log artifacts.');
  failed = true;
}
const executiveReportPage = fs.readFileSync(path.join(root, 'public/projects/alum-executive-report.html'), 'utf8');
const executiveReportScript = fs.readFileSync(path.join(root, 'public/projects/alum-executive-report.js'), 'utf8');
if (!/Status Report/.test(executiveReportPage) || !/Cross-Module Action Drilldowns/.test(executiveReportPage) || !/metadata-only control layer/i.test(executiveReportPage)) {
  console.error('Status report page must state reporting purpose, drilldowns, and metadata-only posture.');
  failed = true;
}
for (const requiredExecutiveSignal of ['rfi-summary.json', 'submittal-summary.json', 'budget-revisions-register.json', 'budget-summary.json', 'accounting-budget-tieout.json', 'Risk Board']) {
  if (!executiveReportScript.includes(requiredExecutiveSignal) && !executiveReportPage.includes(requiredExecutiveSignal)) {
    console.error(`Executive report missing signal: ${requiredExecutiveSignal}`);
    failed = true;
  }
}


const meetingMinutesPage = fs.readFileSync(path.join(root, 'public/projects/alum-meeting-minutes.html'), 'utf8');
const meetingMinutesScript = fs.readFileSync(path.join(root, 'public/projects/alum-meeting-minutes.js'), 'utf8');
if (!/Meeting Minutes \/ OAC Prep Board/.test(meetingMinutesPage) || !/Local Meeting Notes/.test(meetingMinutesPage) || !/Read-first meeting planner/i.test(meetingMinutesPage)) {
  console.error('Meeting minutes must include OAC prep, local notes, and read-first posture.');
  failed = true;
}
for (const requiredMeetingSignal of ['rfi-summary.json', 'submittal-summary.json', 'budget-summary.json', 'budget-revisions-register.json', 'accounting-budget-tieout.json', 'alumMeetingMinutesNotes', 'alumMeetingAttendees', 'Copy Packet']) {
  if (!meetingMinutesScript.includes(requiredMeetingSignal) && !meetingMinutesPage.includes(requiredMeetingSignal)) {
    console.error(`Meeting minutes missing signal/control: ${requiredMeetingSignal}`);
    failed = true;
  }
}
if (/source-logs|dropbox-intake|\/Users\/|\.pdf|\.xlsx|\.xls|\.csv|\.zip/i.test(meetingMinutesPage)) {
  console.error('Meeting minutes page must not publish raw file links, private source paths, or raw artifact extensions.');
  failed = true;
}

const commandCenterPage = fs.readFileSync(path.join(root, 'public/projects/alum-command-center.html'), 'utf8');
const commandCenterScript = fs.readFileSync(path.join(root, 'public/projects/alum-command-center.js'), 'utf8');
if (!/Construction Command Center/.test(commandCenterPage) || !/OAC Agenda/.test(commandCenterPage) || !/Local Decision/.test(commandCenterPage) || !/Read-first operating layer/i.test(commandCenterPage)) {
  console.error('Command center must include OAC agenda, local decisions, and read-first posture.');
  failed = true;
}
for (const requiredCommandSignal of ['rfi-summary.json', 'submittal-summary.json', 'budget-summary.json', 'accounting-budget-tieout.json', 'localStorage', 'alumCommandDecisions']) {
  if (!commandCenterScript.includes(requiredCommandSignal) && !commandCenterPage.includes(requiredCommandSignal)) {
    console.error(`Command center missing signal/control: ${requiredCommandSignal}`);
    failed = true;
  }
}
const projectHomeScript = fs.readFileSync(path.join(root, 'public/projects/golden-hill-procore.js'), 'utf8');
for (const requiredTimelineSignal of ['Activity over time — bucket by day', 'timelineKeys', 'buckets[k] || 0']) {
  if (!projectHomeScript.includes(requiredTimelineSignal)) {
    console.error(`Project home activity timeline missing visible daily bucket guard: ${requiredTimelineSignal}`);
    failed = true;
  }
}

const managementCenterPage = fs.readFileSync(path.join(root, 'public/projects/alum-management-control-center.html'), 'utf8');
const managementCenterScript = fs.readFileSync(path.join(root, 'public/projects/alum-management-control-center.js'), 'utf8');
for (const requiredMgmtSignal of ['Comprehensive Project Dashboard', 'Management Priorities', 'Project Controls by Management Area', 'Management Needs / Next Actions', 'Operations Snapshot', 'Superintendent / Trade Coordination Focus', 'data-focus-rows', 'project-control-center.json']) {
  if (!managementCenterPage.includes(requiredMgmtSignal) && !managementCenterScript.includes(requiredMgmtSignal)) {
    console.error(`Management control center missing signal: ${requiredMgmtSignal}`);
    failed = true;
  }
}
const managementCenterData = JSON.parse(fs.readFileSync(path.join(root, 'public/data/projects/golden-hill/project-control-center.json'), 'utf8'));
if (!managementCenterData.scan_scope?.file_count || !managementCenterData.management_areas?.length || !managementCenterData.control_priorities?.length) {
  console.error('Management control center data must include scan scope, management areas, and priorities.');
  failed = true;
}
if (!managementCenterData.management_snapshot?.active_work_packages || !managementCenterData.coordination_focus?.some(item => /Superintendent trade huddle/.test(item.lane)) || !managementCenterData.coordination_focus?.some(item => /Budget \/ change control/.test(item.lane))) {
  console.error('Management control center data must include an operations snapshot and superintendent/trade coordination focus lanes.');
  failed = true;
}
if (/\/Users\/|CAST Community Dropbox|\/Volumes\/CAST Drive|\.pdf|\.xlsx|\.mpp|\.xml|source-logs|dropbox-intake/i.test(JSON.stringify(managementCenterData))) {
  console.error('Management control center data must not leak private paths or raw artifact extensions.');
  failed = true;
}

const schedulePage = fs.readFileSync(path.join(root, 'public/projects/alum-schedule.html'), 'utf8');
const scheduleScript = fs.readFileSync(path.join(root, 'public/projects/alum-schedule.js'), 'utf8');
if (!/Schedule Dashboard/.test(schedulePage) || !/Field Update Intake/.test(schedulePage) || !/Current Schedule Items/.test(schedulePage) || !/Daily Superintendent Huddle/.test(schedulePage) || !/3-Week Lookahead/.test(schedulePage) || !/RFI \/ Submittal Constraints/.test(schedulePage) || !/Draft only/i.test(schedulePage)) {
  console.error('Schedule dashboard must include schedule items, huddle, field intake, constraints, lookahead, and draft-only correspondence posture.');
  failed = true;
}
for (const requiredSchedulePageSignal of ['schedule-modern', 'Modern CAST Build schedule page alignment', 'schedule-hero{background:transparent', 'schedule-row{grid-template-columns:96px minmax(180px,1.2fr)', 'Two-Week Lookahead Gantt', 'data-lookahead-gantt', '10-Week Critical Items to Consider', 'data-critical-gantt']) {
  if (!schedulePage.includes(requiredSchedulePageSignal)) {
    console.error(`Alüm schedule page missing modern project-page alignment guard: ${requiredSchedulePageSignal}`);
    failed = true;
  }
}
for (const forbiddenSchedulePageCopy of ['Field-First Schedule Intelligence', 'Voice-first schedule brain', 'Field reality into schedule pressure', 'Less admin']) {
  if (schedulePage.includes(forbiddenSchedulePageCopy)) {
    console.error(`Alüm schedule page must not expose slogan/catch-line copy: ${forbiddenSchedulePageCopy}`);
    failed = true;
  }
}
for (const requiredScheduleSignal of ['rfi-summary.json', 'submittal-summary.json', 'schedule-source-index.json', 'data-source-index-status', 'alumScheduleFieldUpdates', 'alumScheduleLookahead', 'SpeechRecognition', 'Recovery Plan Required', 'localStorage', 'renderLookaheadGantt', 'data-lookahead-range', 'renderCriticalGantt', 'criticalReason', 'data-critical-range']) {
  if (!scheduleScript.includes(requiredScheduleSignal) && !schedulePage.includes(requiredScheduleSignal)) {
    console.error(`Schedule control missing signal/control: ${requiredScheduleSignal}`);
    failed = true;
  }
}



const overlookPage = fs.readFileSync(path.join(root, 'public/projects/overlook.html'), 'utf8');
const overlookWorkspacePage = fs.readFileSync(path.join(root, 'public/projects/overlook-workspace.html'), 'utf8');
const overlookWorkspaceScript = fs.readFileSync(path.join(root, 'public/projects/overlook-workspace.js'), 'utf8');
const overlookSample = fs.readFileSync(path.join(root, 'public/data/projects/overlook/construction-controls-sample.json'), 'utf8');
if (!/Overlook Dashboard/.test(overlookPage) || !/overlook-workspace\.html/.test(overlookPage)) {
  console.error('Overlook dashboard must link to the practical workspace.');
  failed = true;
}
for (const requiredOverlookModule of ['Construction Cost Forecast Dashboard', 'Action / Risk Register', 'Evidence / Data-Room Shell', 'Draw + Project-Control Tracker']) {
  if (!overlookWorkspacePage.includes(requiredOverlookModule)) {
    console.error(`Overlook workspace missing module: ${requiredOverlookModule}`);
    failed = true;
  }
}
for (const requiredOverlookSignal of ['construction-controls-sample.json', 'data-actions', 'data-evidence', 'data-draws']) {
  if (!overlookWorkspacePage.includes(requiredOverlookSignal) && !overlookWorkspaceScript.includes(requiredOverlookSignal)) {
    console.error(`Overlook workspace missing signal/control: ${requiredOverlookSignal}`);
    failed = true;
  }
}
if (!/Sample construction-controls metadata only/.test(overlookSample) || !/No raw\/private files/.test(overlookPage + overlookWorkspacePage + overlookSample)) {
  console.error('Overlook workspace must clearly label construction-controls sample metadata and no raw/private data posture.');
  failed = true;
}
if (/source-logs|dropbox-intake|\/Users\/|\.pdf|\.xlsx|\.xls|\.csv|\.zip/i.test(overlookPage + overlookWorkspacePage + overlookWorkspaceScript + overlookSample)) {
  console.error('Overlook workspace must not publish raw file links, private source paths, or raw artifact extensions.');
  failed = true;
}
if (developmentUnderwritingPattern.test(overlookPage + overlookWorkspacePage + overlookWorkspaceScript + overlookSample)) {
  console.error('Overlook workspace must stay construction-only and avoid development/underwriting copy.');
  failed = true;
}

const closeoutPage = fs.readFileSync(path.join(root, 'public/projects/alum-closeout.html'), 'utf8');
const closeoutScript = fs.readFileSync(path.join(root, 'public/projects/alum-closeout.js'), 'utf8');
if (!/Closeout Readiness Board/.test(closeoutPage) || !/Local Closeout Checklist/.test(closeoutPage) || !/Read-first closeout planner/i.test(closeoutPage)) {
  console.error('Closeout readiness must include checklist and read-first posture.');
  failed = true;
}
for (const requiredCloseoutSignal of ['submittal-summary.json', 'document-intelligence/summary.json', 'alumCloseoutChecklist', 'localStorage']) {
  if (!closeoutScript.includes(requiredCloseoutSignal) && !closeoutPage.includes(requiredCloseoutSignal)) {
    console.error(`Closeout readiness missing signal/control: ${requiredCloseoutSignal}`);
    failed = true;
  }
}

const publicLeaks = [];
const textExtensions = new Set(['.html', '.js', '.json', '.css', '.txt', '.md', '.svg']);
walk(publicDir, (full) => {
  const rel = path.relative(root, full).replace(/\\/g, '/');
  const publicRel = path.relative(publicDir, full).replace(/\\/g, '/');
  if (rawArtifactPathPattern.test(publicRel)) publicLeaks.push(`raw artifact path: ${rel}`);
  if (!textExtensions.has(path.extname(full).toLowerCase())) return;
  const text = fs.readFileSync(full, 'utf8');
  if (secretPattern.test(text)) publicLeaks.push(`secret-like string: ${rel}`);
  if (brandBlocklistPattern.test(text)) publicLeaks.push(`CAST Capital brand reference: ${rel}`);
  if (developmentUnderwritingPattern.test(text) && !developmentUnderwritingAllowlist.has(rel)) publicLeaks.push(`development/underwriting reference: ${rel}`);
  if (privateSourceStringPattern.test(text) && !isAllowedRawMention(rel)) publicLeaks.push(`private source string: ${rel}`);
});
if (publicLeaks.length) {
  fail(`Public bundle source/privacy scan failed:\n - ${publicLeaks.slice(0, 25).join('\n - ')}${publicLeaks.length > 25 ? `\n - ... ${publicLeaks.length - 25} more` : ''}`);
}

const contentDirs = ['docs', 'scripts', 'tests'];
for (const dir of contentDirs) {
  walk(path.join(root, dir), (full) => {
    if (!textExtensions.has(path.extname(full).toLowerCase())) return;
    const rel = path.relative(root, full).replace(/\\/g, '/');
    const text = fs.readFileSync(full, 'utf8');
    if (!selfReferenceAllowlist.has(rel) && secretPattern.test(text)) fail(`Potential secret pattern in ${rel}`);
    if (!selfReferenceAllowlist.has(rel) && brandBlocklistPattern.test(text)) fail(`CAST Capital brand reference in ${rel}`);
  });
}

const brokenLinks = [];
const htmlFiles = [];
walk(publicDir, (full) => {
  if (path.extname(full).toLowerCase() === '.html') htmlFiles.push(full);
});
for (const full of htmlFiles) {
  const rel = path.relative(publicDir, full).replace(/\\/g, '/');
  const text = fs.readFileSync(full, 'utf8');
  if (/Export\s+(?:[^<]{0,40}\s)?CSV/i.test(text)) fail(`User-facing spreadsheet export label must be Excel, not CSV: ${rel}`);
  const attrs = text.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi);
  for (const [, value] of attrs) {
    if (!routeExists(value)) brokenLinks.push(`${rel} -> ${value}`);
    if (rawArtifactPathPattern.test(stripHashAndQuery(value))) brokenLinks.push(`${rel} publishes raw/private route -> ${value}`);
  }
}
if (brokenLinks.length) {
  fail(`Broken or unsafe public routes:\n - ${brokenLinks.slice(0, 30).join('\n - ')}${brokenLinks.length > 30 ? `\n - ... ${brokenLinks.length - 30} more` : ''}`);
}

const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rewrites = vercelConfig.rewrites || [];
for (const source of ['/admin', '/projects', '/procore', '/document-tools', '/schedule-brain', '/schedule', '/projects/alum-management-control-center', '/projects/alum-management', '/projects/golden-hill', '/projects/overlook']) {
  const rewrite = rewrites.find((row) => row.source === source);
  if (!rewrite || !routeExists(rewrite.destination)) fail(`Missing or invalid Vercel rewrite for ${source}`);
}
const scheduleTypoRewrite = rewrites.find((row) => row.source === '/schdule-brain');
if (!scheduleTypoRewrite || scheduleTypoRewrite.destination !== '/schedule-brain.html') fail('Missing typo-tolerant /schdule-brain rewrite');

if (fs.existsSync(distDir)) {
  const leaked = [];
  const leakedStrings = [];
  function walkDist(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDist(full);
      else {
        const rel = path.relative(distDir, full);
        if (/(^|[/\\])source-logs([/\\]|$)|(^|[/\\])dropbox-intake([/\\]|$)|\.pdf$|\.xlsx$|\.xls$|\.csv$|\.zip$/i.test(rel)) leaked.push(rel);
        if (/\.(html|js|json|css|txt|md|svg)$/i.test(rel)) {
          const text = fs.readFileSync(full, 'utf8');
          if (/dropbox-intake|source-logs|source-artifacts|\/Users\/|CAST Community Dropbox|\/Volumes\/CAST Drive|00_PROCORE DATA TIE/.test(text)) leakedStrings.push(rel);
        }
      }
    }
  }
  walkDist(distDir);
  if (leaked.length) {
    console.error(`Build bundle leaked private/raw files: ${leaked.join(', ')}`);
    failed = true;
  }
  if (leakedStrings.length) {
    console.error(`Build bundle leaked private source path strings: ${leakedStrings.join(', ')}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('Static platform audit passed.');
