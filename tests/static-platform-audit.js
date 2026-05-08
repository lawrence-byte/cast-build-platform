const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const files = ['public/index.html', 'public/admin.html', 'public/projects.html', 'public/procore.html', 'public/construction-cost-forecasting.html', 'public/schedule-brain.html', 'public/projects/alum-rfis.html', 'public/projects/alum-rfis.js', 'public/projects/alum-submittals.html', 'public/projects/alum-submittals.js', 'public/projects/alum-change-events.html', 'public/projects/alum-change-events.js', 'public/projects/alum-daily-log.html', 'public/projects/alum-daily-log.js', 'public/projects/alum-executive-report.html', 'public/projects/alum-executive-report.js', 'public/projects/alum-command-center.html', 'public/projects/alum-command-center.js', 'public/projects/alum-meeting-minutes.html', 'public/projects/alum-meeting-minutes.js', 'public/projects/alum-schedule.html', 'public/projects/alum-schedule.js', 'public/projects/alum-closeout.html', 'public/projects/alum-closeout.js', 'public/projects/alum-directory.html', 'public/projects/alum-directory.js', 'public/projects/alum-quality.html', 'public/projects/alum-quality.js', 'public/projects/alum-punch-list.html', 'public/projects/alum-punch-list.js', 'public/projects/alum-contracts.html', 'public/projects/alum-contracts.js', 'public/projects/alum-owner-billings.html', 'public/projects/alum-owner-billings.js', 'public/projects/alum-specifications.html', 'public/projects/alum-specifications.js', 'public/projects/alum-reports.html', 'docs/cast-build-platform-map.md', 'docs/procore-integration-plan.md', 'docs/platform-guardrails.md'];
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
for (const requiredPortalLink of ['alum-directory.html', 'alum-quality.html', 'alum-punch-list.html', 'alum-contracts.html', 'alum-owner-billings.html', 'alum-specifications.html', 'alum-reports.html']) {
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
  ['public/projects/alum-contracts.html', 'Prime Contract'],
  ['public/projects/alum-owner-billings.html', 'Owner Billings'],
  ['public/projects/alum-specifications.html', 'Specifications'],
  ['public/projects/alum-reports.html', 'Reports Hub'],
];
for (const [moduleFile, label] of procoreSystemPages) {
  const text = fs.readFileSync(path.join(root, moduleFile), 'utf8');
  if (!text.includes(label) || !text.includes('project-sidebar-group')) {
    console.error(`${moduleFile} must use grouped project navigation and include ${label}.`);
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
for (const requiredScheduleBrainSignal of ['CAST Build Schedule Brain', 'Open Alüm Workbench', 'Voice Intake', 'Delay Detection', 'Recovery Pressure', 'No auto-send', 'Human approval gate']) {
  if (!scheduleBrainPage.includes(requiredScheduleBrainSignal)) {
    console.error(`Schedule Brain platform page missing signal: ${requiredScheduleBrainSignal}`);
    failed = true;
  }
}
for (const requiredScheduleSourceSignal of ['schedule-source-index.json', 'data-schedule-source-status']) {
  if (!scheduleBrainPage.includes(requiredScheduleSourceSignal)) {
    console.error(`Schedule Brain platform page missing source-index signal: ${requiredScheduleSourceSignal}`);
    failed = true;
  }
}
const scheduleSourceIndex = JSON.parse(fs.readFileSync(path.join(root, 'public/data/projects/golden-hill/schedule/schedule-source-index.json'), 'utf8'));
if (!scheduleSourceIndex.source_status || !scheduleSourceIndex.publish_guardrail || /\/Users\/|CAST Community Dropbox|\.pdf|\.xlsx|\.mpp|\.xml|\.xer/i.test(JSON.stringify(scheduleSourceIndex))) {
  console.error('Schedule source index must be sanitized and avoid private paths/raw artifact extensions.');
  failed = true;
}
if (!/projects\/alum-schedule\.html/.test(scheduleBrainPage) || !/schedule-brain\.html/.test(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'))) {
  console.error('CAST Build landing must link to Schedule Brain and Schedule Brain must link to Alüm workbench.');
  failed = true;
}
const pricingModelsPage = fs.readFileSync(path.join(root, 'public/pricing-models.html'), 'utf8');

const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rewriteMap = new Map((vercelConfig.rewrites || []).map((r) => [r.source, r.destination]));
if (rewriteMap.get('/schedule-brain') !== '/schedule-brain.html' || rewriteMap.get('/schedule') !== '/schedule-brain.html') {
  console.error('Missing schedule-brain rewrite routes.');
  failed = true;
}

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
if (!/alum-executive-report\.html/.test(alumReplicaPage)) {
  console.error('Alüm replica page must link to the executive reporting layer.');
  failed = true;
}
if (!/alum-command-center\.html/.test(alumReplicaPage) || !/alum-meeting-minutes\.html/.test(alumReplicaPage) || !/alum-schedule\.html/.test(alumReplicaPage) || !/alum-closeout\.html/.test(alumReplicaPage)) {
  console.error('Alüm replica page must link to command center, meeting minutes, schedule control, and closeout modules.');
  failed = true;
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
const dailyLogModuleScript = fs.readFileSync(path.join(root, 'public/projects/alum-daily-log.js'), 'utf8');
for (const requiredRfiSignal of ['costImpactYes', 'scheduleImpactYes', 'topManagers', 'topContractors']) {
  if (!rfiModuleScript.includes(requiredRfiSignal)) {
    console.error(`RFI module script missing signal: ${requiredRfiSignal}`);
    failed = true;
  }
}
for (const requiredSubmittalSignal of ['topSpecSections', 'typeCounts', 'Revise & Resubmit', 'Responsible Contractor']) {
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
if (!fs.existsSync(accountingTieoutPath) || !fs.existsSync(publicAccountingTieoutPath)) {
  console.error('Accounting budget tie-out JSON must be generated for private and public metadata views.');
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
if (!/Accounting Budget Tie-Out/.test(accountingTieoutPage) || !/data-check-rows/.test(accountingTieoutPage)) {
  console.error('Accounting tie-out page must include tie-out checks.');
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
if (!/Executive Report/.test(executiveReportPage) || !/Cross-Module Action Drilldowns/.test(executiveReportPage) || !/Read-first executive report/i.test(executiveReportPage)) {
  console.error('Executive report page must state reporting purpose, drilldowns, and read-first posture.');
  failed = true;
}
for (const requiredExecutiveSignal of ['rfi-summary.json', 'submittal-summary.json', 'budget-revisions-register.json', 'budget-summary.json', 'accounting-budget-tieout.json', 'Executive Risk Board']) {
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
const schedulePage = fs.readFileSync(path.join(root, 'public/projects/alum-schedule.html'), 'utf8');
const scheduleScript = fs.readFileSync(path.join(root, 'public/projects/alum-schedule.js'), 'utf8');
if (!/Field-First Schedule Intelligence/.test(schedulePage) || !/Voice Field Updates/.test(schedulePage) || !/3-Week Lookahead/.test(schedulePage) || !/Constraint Log/.test(schedulePage) || !/Draft-only/i.test(schedulePage)) {
  console.error('Schedule intelligence must include voice intake, constraints, lookahead, and draft-only correspondence posture.');
  failed = true;
}
for (const requiredScheduleSignal of ['rfi-summary.json', 'submittal-summary.json', 'schedule-source-index.json', 'data-source-index-status', 'alumScheduleFieldUpdates', 'alumScheduleLookahead', 'SpeechRecognition', 'Recovery Plan Required', 'localStorage']) {
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
for (const source of ['/admin', '/projects', '/procore', '/document-tools', '/projects/golden-hill', '/projects/overlook']) {
  const rewrite = rewrites.find((row) => row.source === source);
  if (!rewrite || !routeExists(rewrite.destination)) fail(`Missing or invalid Vercel rewrite for ${source}`);
}

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
