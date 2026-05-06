const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const root = path.join(__dirname, '..');
const projectRoot = path.join(root, 'data/projects/golden-hill');
const intakeRoot = path.join(projectRoot, 'dropbox-intake/extracted-20260506-050901/Alüm');
const accountingRoot = path.join(intakeRoot, '16. ACCOUNTING');
const budgetRoot = path.join(intakeRoot, '02. BUDGET');
const outDir = path.join(projectRoot, 'accounting-budget');
const publicOutDir = path.join(root, 'public/data/projects/golden-hill/accounting-budget');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
function rel(file) { return path.relative(projectRoot, file).replaceAll(path.sep, '/'); }
function relIntake(file) { return path.relative(intakeRoot, file).replaceAll(path.sep, '/'); }
function num(value) {
  if (value === null || value === undefined || value === '') return 0;
  let s = String(value).replace(/[$,\s]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  const parsed = Number(s);
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : 0;
}
function round(n) { return Math.round(Number(n || 0) * 100) / 100; }
function readRows(file, sheetName) {
  const wb = XLSX.readFile(file, { cellDates: true });
  const sheet = wb.Sheets[sheetName || wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
}
function latestByMtime(files) {
  return files.slice().sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}
function tie(name, source, target, tolerance = 1) {
  const delta = round(source - target);
  return { name, source: round(source), target: round(target), delta, status: Math.abs(delta) <= tolerance ? 'pass' : 'review', tolerance };
}

const budgetSummary = JSON.parse(fs.readFileSync(path.join(projectRoot, 'procore-information/budget/budget-summary.json'), 'utf8'));
const revisionRegister = JSON.parse(fs.readFileSync(path.join(projectRoot, 'procore-information/budget-changes/budget-revisions-register.json'), 'utf8'));
const metrics = budgetSummary.metrics;

const allAccountingFiles = walk(accountingRoot);
const allBudgetFiles = walk(budgetRoot);
const spreadsheetFiles = allAccountingFiles.concat(allBudgetFiles).filter(f => /\.(xlsx|xlsm|xls|csv)$/i.test(f));
const budgetRelatedFiles = allAccountingFiles.concat(allBudgetFiles).filter(f => /budget|forecast|commitment|pay app|payment|invoice|cost|change order|buyout|qbo|quickbooks|purchase|draw|sov/i.test(f));

const budgetImportFiles = spreadsheetFiles.filter(f => /Budget -GHA\/CAST Build GHA budget import \(final\) REV\.xlsx$/i.test(relIntake(f)));
const budgetImportFile = budgetImportFiles[0] || spreadsheetFiles.find(f => /budget import \(final\).*\.xlsx$/i.test(f));
const budgetImportRows = budgetImportFile ? readRows(budgetImportFile, 'Budget Line Items') : [];
const budgetImportLineItems = budgetImportRows.slice(1).filter(r => String(r[1] || '').match(/^\d{2}-/)).map(r => ({
  subJob: String(r[0] || ''),
  costCode: String(r[1] || ''),
  costType: String(r[2] || ''),
  description: String(r[3] || ''),
  budgetAmount: round(num(r[8]))
}));
const budgetImportTotal = round(budgetImportLineItems.reduce((s, r) => s + r.budgetAmount, 0));

const buyoutFile = path.join(budgetRoot, 'Golden Hill Apartments_Buyout Log_live.xls');
const buyoutRows = fs.existsSync(buyoutFile) ? readRows(buyoutFile, 'Buyout') : [];
const buyoutLineItems = buyoutRows.slice(2).filter(r => String(r[2] || '').match(/^\d{2}/)).map(r => ({
  specialist: String(r[0] || ''),
  priority: String(r[1] || ''),
  description: String(r[2] || ''),
  gmpBudget: round(num(r[3])),
  targetWOExecutedDate: String(r[4] || ''),
  draftWOSent: String(r[6] || ''),
  executed: String(r[7] || ''),
  subcontractor: String(r[8] || ''),
  subcontractAmount: round(num(r[9])),
  plugsAllowances: round(num(r[11])),
  buyoutDelta: round(num(r[12])),
  notes: String(r[13] || '')
}));
const buyoutSummary = {
  sourceFile: rel(buyoutFile),
  rowCount: buyoutLineItems.length,
  gmpBudget: round(buyoutLineItems.reduce((s, r) => s + r.gmpBudget, 0)),
  subcontractAmount: round(buyoutLineItems.reduce((s, r) => s + r.subcontractAmount, 0)),
  plugsAllowances: round(buyoutLineItems.reduce((s, r) => s + r.plugsAllowances, 0)),
  buyoutDelta: round(buyoutLineItems.reduce((s, r) => s + r.buyoutDelta, 0)),
  executedCount: buyoutLineItems.filter(r => /^y$/i.test(r.executed)).length,
  draftCount: buyoutLineItems.filter(r => /^y$/i.test(r.draftWOSent)).length,
  tbdCount: buyoutLineItems.filter(r => /tbd/i.test(r.subcontractor)).length
};

const commitmentFiles = spreadsheetFiles.filter(f => /01\.Pay Applications\/.+Commitments.*\.(xlsx|csv)$/i.test(relIntake(f)) && !/archive/i.test(relIntake(f)));
const commitmentSnapshots = commitmentFiles.map(file => {
  const rows = readRows(file).slice(1).filter(r => /^SC-/i.test(String(r[0] || '')));
  return {
    sourceFile: rel(file),
    folder: relIntake(path.dirname(file)),
    rowCount: rows.length,
    originalContractAmount: round(rows.reduce((s, r) => s + num(r[4]), 0)),
    approvedChangeOrders: round(rows.reduce((s, r) => s + num(r[5]), 0)),
    revisedContractAmount: round(rows.reduce((s, r) => s + num(r[6]), 0)),
    pendingChangeOrders: round(rows.reduce((s, r) => s + num(r[7]), 0)),
    draftChangeOrders: round(rows.reduce((s, r) => s + num(r[8]), 0)),
    invoiced: round(rows.reduce((s, r) => s + num(r[9]), 0)),
    paymentsIssued: round(rows.reduce((s, r) => s + num(r[10]), 0)),
    remainingBalanceOutstanding: round(rows.reduce((s, r) => s + num(r[12]), 0))
  };
}).sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));
const latestCommitmentSnapshot = commitmentSnapshots[commitmentSnapshots.length - 1] || null;

const purchaseFiles = spreadsheetFiles.filter(f => /01\.Pay Applications\/.+(GC\s*&\s*GR Purchases|Purchases by Product_Service Detail).*\.xlsx$/i.test(relIntake(f)) && !/archive/i.test(relIntake(f)));
const purchaseReports = purchaseFiles.map(file => {
  const rows = readRows(file);
  const transactionRows = rows.filter(r => String(r[1] || '').match(/^\d{1,2}\/\d{1,2}\/\d{4}/));
  return {
    sourceFile: rel(file),
    folder: relIntake(path.dirname(file)),
    rowCount: transactionRows.length,
    amount: round(transactionRows.reduce((s, r) => s + num(r[8]), 0))
  };
}).filter(r => r.rowCount || r.amount).sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));

const forecastFiles = spreadsheetFiles.filter(f => /Budget -GHA\/CAST Build GHA budget GC's Forecast.*\.xlsx$/i.test(relIntake(f)) && !/archive/i.test(relIntake(f)));
const forecastSnapshots = forecastFiles.map(file => {
  const rows = readRows(file);
  const lineRows = rows.filter(r => String(r[1] || '').match(/^\d{2}-/));
  return {
    sourceFile: rel(file),
    rowCount: lineRows.length,
    listedBudget: round(lineRows.reduce((s, r) => s + num(r[2]), 0)),
    listedCostToComplete: round(lineRows.reduce((s, r) => s + num(r[3]), 0)),
    fileMtime: fs.statSync(file).mtime.toISOString()
  };
}).sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));
const latestForecastSnapshot = forecastSnapshots[forecastSnapshots.length - 1] || null;

const checks = [
  tie('Accounting budget import total ties to CAST BUILD A.O Original Budget Amount', budgetImportTotal, metrics['Original Budget Amount'], 1),
  tie('Current budget formula: Original + Approved COs + Approved Budget Changes = Revised', metrics['Original Budget Amount'] + metrics['Approved COs'] + metrics['Approved Budget Changes'], metrics['Revised Budget'], 1),
  tie('Approved budget revision register net ties to zero', revisionRegister.summary?.netApprovedBudgetChanges || 0, 0, 1),
  tie('Buyout GMP budget ties to CAST BUILD A.O Construction division revised budget', buyoutSummary.gmpBudget, (budgetSummary.byDivision || []).find(d => d.key === 'A')?.['Revised Budget'] || 0, 1000),
  tie('Buyout subcontract amount ties to CAST BUILD A.O committed costs', buyoutSummary.subcontractAmount, metrics['Committed Costs'], 1000),
];
if (latestCommitmentSnapshot) {
  checks.push(tie('Latest accounting commitments revised contracts tie to CAST BUILD A.O committed costs', latestCommitmentSnapshot.revisedContractAmount, metrics['Committed Costs'], 1000));
  checks.push(tie('Latest accounting commitments invoiced tie to CAST BUILD A.O job-to-date costs', latestCommitmentSnapshot.invoiced, metrics['Job to Date Costs'], 1000));
}

const exceptions = checks.filter(c => c.status !== 'pass').map(c => ({
  severity: Math.abs(c.delta) > 1000000 ? 'high' : 'review',
  check: c.name,
  delta: c.delta,
  nextStep: c.name.includes('commitments') ? 'Reconcile whether non-subcontract/direct/GC costs are intentionally outside the commitments workbook, then map those costs by cost code.' : c.name.includes('Buyout') ? 'Review buyout log rows, plugs/allowances, and construction-division budget scope before treating this as a variance.' : 'Review source workbook against CAST BUILD A.O export.'
}));

const result = {
  projectName: 'Alüm',
  formerName: 'Golden Hill Apartments',
  source: 'Approved Dropbox accounting folder snapshot plus CAST BUILD A.O metadata exports',
  generatedAt: new Date().toISOString(),
  guardrail: 'Read-first metadata extraction only. Raw PDFs/XLS/XLSX/CSV files remain local/private and are not published.',
  accountingFolder: rel(accountingRoot),
  budgetFolder: rel(budgetRoot),
  fileInventory: {
    accountingFiles: allAccountingFiles.length,
    budgetFolderFiles: allBudgetFiles.length,
    spreadsheetFiles: spreadsheetFiles.length,
    budgetRelatedFiles: budgetRelatedFiles.length
  },
  currentCastBuildAOMetrics: metrics,
  budgetImport: {
    sourceFile: budgetImportFile ? rel(budgetImportFile) : null,
    rowCount: budgetImportLineItems.length,
    total: budgetImportTotal,
    byCostType: Object.values(budgetImportLineItems.reduce((acc, r) => {
      acc[r.costType] ||= { costType: r.costType, rowCount: 0, budgetAmount: 0 };
      acc[r.costType].rowCount += 1;
      acc[r.costType].budgetAmount = round(acc[r.costType].budgetAmount + r.budgetAmount);
      return acc;
    }, {}))
  },
  buyoutSummary,
  latestCommitmentSnapshot,
  commitmentSnapshots,
  forecastSnapshots,
  latestForecastSnapshot,
  purchaseReports,
  checks,
  exceptions,
  topBuyoutRows: buyoutLineItems.slice().sort((a, b) => Math.abs(b.buyoutDelta) - Math.abs(a.buyoutDelta)).slice(0, 20),
  topCommitmentDeltas: latestCommitmentSnapshot ? [] : []
};

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(publicOutDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'accounting-budget-tieout.json'), JSON.stringify(result, null, 2));
function sanitizePublic(value) {
  if (Array.isArray(value)) return value.map(sanitizePublic);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizePublic(v)]));
  if (typeof value === 'string') {
    return value
      .replace(/^dropbox-intake\/extracted-[^/]+\/Alüm\//, '')
      .replace(/^dropbox-intake\/extracted-[^/]+\//, '')
      .replace(/^data\/projects\/golden-hill\//, '');
  }
  return value;
}
const publicResult = sanitizePublic(result);
publicResult.guardrail = 'Read-first metadata extraction only. Raw accounting files remain private and are excluded from the preview bundle.';
fs.writeFileSync(path.join(publicOutDir, 'accounting-budget-tieout.json'), JSON.stringify(publicResult, null, 2));
console.log(`Accounting budget tie-out generated with ${checks.filter(c => c.status === 'pass').length}/${checks.length} passing checks.`);
console.log(`Exceptions requiring review: ${exceptions.length}`);
