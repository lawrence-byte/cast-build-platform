const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = ['public/index.html', 'public/admin.html', 'public/projects.html', 'public/procore.html', 'public/projects/alum-rfis.html', 'public/projects/alum-rfis.js', 'public/projects/alum-submittals.html', 'public/projects/alum-submittals.js', 'public/projects/alum-change-events.html', 'public/projects/alum-change-events.js', 'public/projects/alum-daily-log.html', 'public/projects/alum-daily-log.js', 'public/projects/alum-executive-report.html', 'public/projects/alum-executive-report.js', 'public/projects/alum-command-center.html', 'public/projects/alum-command-center.js', 'public/projects/alum-meeting-minutes.html', 'public/projects/alum-meeting-minutes.js', 'public/projects/alum-schedule.html', 'public/projects/alum-schedule.js', 'public/projects/alum-closeout.html', 'public/projects/alum-closeout.js', 'docs/cast-build-platform-map.md', 'docs/procore-integration-plan.md'];
let failed = false;
for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing ${file}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  if (/APIFY_TOKEN|PROCORE_CLIENT_SECRET|password\s*=|sk-[A-Za-z0-9]/.test(text)) {
    console.error(`Potential secret pattern in ${file}`);
    failed = true;
  }
}
const procorePage = fs.readFileSync(path.join(root, 'public/procore.html'), 'utf8');
if (!/no CAST BUILD A.O authentication/i.test(procorePage) || !/write API calls/i.test(procorePage)) {
  console.error('CAST BUILD A.O page must state integration guardrails.');
  failed = true;
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
if (!/No dedicated daily-log export/.test(dailyLogModuleScript) || !/ready/.test(fs.readFileSync(path.join(root, 'public/projects/alum-daily-log.html'), 'utf8'))) {
  console.error('Daily Log module must remain an explicit placeholder until approved metadata exists.');
  failed = true;
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
if (!/Schedule Control Board/.test(schedulePage) || !/3-Week Lookahead/.test(schedulePage) || !/Constraint Log/.test(schedulePage) || !/Read-first schedule planner/i.test(schedulePage)) {
  console.error('Schedule control must include constraints, lookahead, and read-first posture.');
  failed = true;
}
for (const requiredScheduleSignal of ['rfi-summary.json', 'submittal-summary.json', 'alumScheduleMilestones', 'alumScheduleLookahead', 'localStorage']) {
  if (!scheduleScript.includes(requiredScheduleSignal) && !schedulePage.includes(requiredScheduleSignal)) {
    console.error(`Schedule control missing signal/control: ${requiredScheduleSignal}`);
    failed = true;
  }
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

const distDir = path.join(root, 'dist');
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
