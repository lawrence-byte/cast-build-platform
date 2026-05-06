const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = ['public/index.html', 'public/admin.html', 'public/projects.html', 'public/procore.html', 'docs/cast-build-platform-map.md', 'docs/procore-integration-plan.md'];
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
if (!/Open Item Control Center/.test(openItemsPage) || !/Read-first replica/i.test(openItemsPage)) {
  console.error('Open-items page must state its read-first control-center purpose.');
  failed = true;
}
if (/source-logs\//i.test(openItemsPage)) {
  console.error('Open-items page must not link directly to private source-log artifacts.');
  failed = true;
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
          if (/dropbox-intake|source-logs/.test(text)) leakedStrings.push(rel);
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
