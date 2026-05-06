#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceFile = path.join(root, 'data/projects/golden-hill/procore-information/budget/budget_details_2.csv');
const dataOut = path.join(root, 'data/projects/golden-hill/procore-information/budget/budget-summary.json');
const publicOut = path.join(root, 'public/data/projects/golden-hill/procore-information/budget/budget-summary.json');
const publicEmbeddedOut = path.join(root, 'public/projects/alum-budget-data.js');
const numericColumns = ['Original Budget Amount','Approved Budget Changes','Approved COs','Revised Budget','Pending COs','Projected Budget','Committed Costs','Direct Costs','Job to Date Costs','Pending Cost Changes','Projected Costs','Forecast To Complete','Estimated Cost at Completion','Projected over Under','Owner Invoiced cost to date'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); if (row.some((x) => x !== '')) rows.push(row); }
  const headers = rows.shift() || [];
  return rows.map((values, i) => Object.fromEntries(headers.map((h, j) => [h.replace(/^\uFEFF/, ''), values[j] ?? ''])).valueOf()).map((r, i) => ({ ...r, _row: i + 1 }));
}
function num(v) { const n = Number(String(v || '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; }
function sum(rows, col) { return Math.round(rows.reduce((a, r) => a + r[col], 0) * 100) / 100; }
function splitCodeName(v) { const s = String(v || 'None'); const idx = s.indexOf(' - '); return idx >= 0 ? [s.slice(0, idx), s.slice(idx + 3)] : [s, s]; }
function addGroup(map, key, name, row) {
  if (!map[key]) map[key] = { key, name, rowCount: 0, ...Object.fromEntries(numericColumns.map((c) => [c, 0])) };
  const g = map[key];
  g.rowCount += 1;
  for (const c of numericColumns) g[c] += row[c];
}
function finalizeGroup(g) {
  for (const c of numericColumns) g[c] = Math.round(g[c] * 100) / 100;
  g.variancePct = g['Revised Budget'] ? Math.round((g['Projected over Under'] / g['Revised Budget']) * 10000) / 100 : 0;
  return g;
}

function main() {
  if (!fs.existsSync(sourceFile)) throw new Error(`Missing ${sourceFile}`);
  const raw = parseCsv(fs.readFileSync(sourceFile, 'utf8'));
  const rows = raw.map((r) => {
    for (const c of numericColumns) r[c] = num(r[c]);
    const [division, divisionName] = splitCodeName(r['Sub Job']);
    const [costCode, costCodeName] = splitCodeName(r['Cost Code Tier 1']);
    const [costTypeCode, costTypeName] = splitCodeName(r['Cost Type']);
    return { ...r, division, divisionName, costCode, costCodeName, costTypeCode, costTypeName };
  });
  const valid = rows.filter((r) => r['Budget Code'] || r['Budget Code Description']);
  const metrics = Object.fromEntries(numericColumns.map((c) => [c, sum(valid, c)]));
  metrics.rowCount = valid.length;
  metrics.rawRowCount = rows.length;
  metrics.variancePct = metrics['Revised Budget'] ? Math.round((metrics['Projected over Under'] / metrics['Revised Budget']) * 10000) / 100 : 0;
  metrics.committedPctOfRevised = metrics['Revised Budget'] ? Math.round((metrics['Committed Costs'] / metrics['Revised Budget']) * 10000) / 100 : 0;
  metrics.jtdPctOfRevised = metrics['Revised Budget'] ? Math.round((metrics['Job to Date Costs'] / metrics['Revised Budget']) * 10000) / 100 : 0;
  const byDivision = {}, byCostType = {}, byCostCode = {};
  for (const r of valid) {
    addGroup(byDivision, r.division, r.divisionName, r);
    addGroup(byCostType, r.costTypeCode, r.costTypeName, r);
    addGroup(byCostCode, r.costCode, r.costCodeName, r);
  }
  const out = {
    projectName: 'Alüm',
    formerName: 'Golden Hill Apartments',
    source: 'CAST BUILD A.O budget details CSV export',
    sourceFile: 'data/projects/golden-hill/procore-information/budget/budget_details_2.csv',
    generatedAt: new Date().toISOString(),
    metrics,
    byDivision: Object.values(byDivision).map(finalizeGroup).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    byCostType: Object.values(byCostType).map(finalizeGroup).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    byCostCode: Object.values(byCostCode).map(finalizeGroup).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    topBudgetRiskRows: valid.filter((r) => r['Projected over Under'] < 0).sort((a, b) => a['Projected over Under'] - b['Projected over Under']).slice(0, 20),
    topBudgetSavingsRows: valid.filter((r) => r['Projected over Under'] > 0).sort((a, b) => b['Projected over Under'] - a['Projected over Under']).slice(0, 20),
    rows: valid,
  };
  for (const file of [dataOut, publicOut]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  }
  fs.mkdirSync(path.dirname(publicEmbeddedOut), { recursive: true });
  fs.writeFileSync(publicEmbeddedOut, `window.__ALUM_BUDGET_SUMMARY__ = ${JSON.stringify(out, null, 2)};\n`);
  console.log(`Indexed ${metrics.rowCount} CAST BUILD A.O budget rows; revised=${metrics['Revised Budget']}; EAC=${metrics['Estimated Cost at Completion']}; O/U=${metrics['Projected over Under']}`);
}
main();
