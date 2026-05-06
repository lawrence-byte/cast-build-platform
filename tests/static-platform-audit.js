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
  function walkDist(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDist(full);
      else if (/(^|[/\\])source-logs([/\\]|$)/.test(path.relative(distDir, full))) leaked.push(path.relative(distDir, full));
    }
  }
  walkDist(distDir);
  if (leaked.length) {
    console.error(`Build bundle leaked source logs: ${leaked.join(', ')}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('Static platform audit passed.');
