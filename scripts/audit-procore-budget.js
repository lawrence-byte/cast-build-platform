#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const budgetPath = path.join(root, 'data/projects/golden-hill/procore-information/budget/budget-summary.json');
const revisionsPath = path.join(root, 'data/projects/golden-hill/procore-information/budget-changes/budget-revisions-register.json');
const dataOut = path.join(root, 'data/projects/golden-hill/procore-information/budget/budget-audit.json');
const publicOut = path.join(root, 'public/data/projects/golden-hill/procore-information/budget/budget-audit.json');

const moneyFields = [
  'Original Budget Amount',
  'Approved Budget Changes',
  'Approved COs',
  'Revised Budget',
  'Pending COs',
  'Projected Budget',
  'Committed Costs',
  'Direct Costs',
  'Job to Date Costs',
  'Pending Cost Changes',
  'Projected Costs',
  'Forecast To Complete',
  'Estimated Cost at Completion',
  'Projected over Under',
  'Owner Invoiced cost to date',
];

function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }
function sum(rows, field) { return round2(rows.reduce((acc, row) => acc + Number(row[field] || 0), 0)); }
function check(condition, id, label, detail = {}) {
  return { id, label, status: condition ? 'pass' : 'fail', ...detail };
}

function main() {
  const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
  const revisions = fs.existsSync(revisionsPath) ? JSON.parse(fs.readFileSync(revisionsPath, 'utf8')) : null;
  const rows = budget.rows || [];
  const fieldChecks = moneyFields.map((field) => {
    const rowTotal = sum(rows, field);
    const metricTotal = round2(budget.metrics?.[field]);
    const delta = round2(rowTotal - metricTotal);
    return check(Math.abs(delta) < 0.01, `field-${field.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, `${field} reconciles`, { field, rowTotal, metricTotal, delta });
  });
  const rowChecks = [
    check(rows.length === budget.metrics?.rowCount, 'row-count', 'Budget row count matches metrics', { rows: rows.length, metricRowCount: budget.metrics?.rowCount }),
    check(rows.every((row) => row['Budget Code'] && row['Budget Code Description']), 'budget-code-completeness', 'Every budget row has code and description'),
    check(Number(budget.metrics?.['Revised Budget'] || 0) > 0, 'revised-budget-positive', 'Revised budget is populated'),
    check(Number(budget.metrics?.['Estimated Cost at Completion'] || 0) > 0, 'eac-positive', 'Estimated cost at completion is populated'),
  ];
  const revisionChecks = revisions ? [
    check(revisions.currentBudgetReconciliation?.status === 'matches_current_budget_approved_budget_changes', 'budget-revisions-reconcile', 'Budget revisions reconcile to current approved budget changes', { reconciliation: revisions.currentBudgetReconciliation || {} }),
    check(round2(revisions.totals?.net) === 0, 'budget-revisions-net-zero', 'Approved budget revisions net to zero', { net: round2(revisions.totals?.net) }),
  ] : [check(false, 'budget-revisions-present', 'Budget revisions register is present')];
  const checks = [...rowChecks, ...fieldChecks, ...revisionChecks];
  const failed = checks.filter((item) => item.status !== 'pass');
  const out = {
    projectName: budget.projectName,
    sourceFile: budget.sourceFile,
    generatedAt: new Date().toISOString(),
    status: failed.length ? 'fail' : 'pass',
    summary: {
      rowCount: rows.length,
      revisedBudget: round2(budget.metrics?.['Revised Budget']),
      estimatedCostAtCompletion: round2(budget.metrics?.['Estimated Cost at Completion']),
      projectedOverUnder: round2(budget.metrics?.['Projected over Under']),
      ownerInvoicedCostToDate: round2(budget.metrics?.['Owner Invoiced cost to date']),
      failedCheckCount: failed.length,
      checkCount: checks.length,
    },
    checks,
  };
  for (const file of [dataOut, publicOut]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  }
  if (failed.length) {
    console.error(`Budget audit failed: ${failed.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`Budget audit passed: ${checks.length} checks, revised=${out.summary.revisedBudget}, EAC=${out.summary.estimatedCostAtCompletion}`);
}

main();
