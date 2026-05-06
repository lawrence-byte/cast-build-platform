#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'data/projects/golden-hill/procore-information/budget-changes');
const publicDir = path.join(root, 'public/data/projects/golden-hill/procore-information/budget-changes');
const pdfDir = 'data/projects/golden-hill/procore-information/001_CURRENT_BUDGET/budget-revisions/pdfs';
const c = (code, description, amount) => ({ budgetCode: code, description, amount });
const change = (number, name, adjustments, extra = {}) => ({
  number,
  status: 'APPROVED',
  name,
  addToOwnerInvoice: true,
  budgetChangeEstimate: 0,
  pdfFolder: pdfDir,
  adjustments: adjustments.map((a, i) => ({ adjustmentNumber: a.n || i + 1, comment: a.comment || '', lines: a.lines })),
  ...extra,
});
const pair = (n, to, from, comment='') => ({ n, comment, lines: [to, from] });
const changes = [
change(1, 'INTERNAL BUDGET ADJUSTMENT - MAY 2025', [
  pair(1,c('A.02-5000.S','Utilities',40410),c('A.16-1000.S','Building Electrical',-40410)),
  pair(2,c('A.05-7000.S','Decorative Railing',5000),c('A.07-2000.S','Insulation',-5000)),
  pair(3,c('A.07-1000.S','Waterproofing',39724),c('A.34-1000.S','Automated Parking',-39724)),
  pair(4,c('A.14-2000.S','Elevators',16650),c('A.34-1000.S','Automated Parking',-16650)),
  pair(5,c('A.27-1000.S','Fire Alarm',18540),c('A.34-1000.S','Automated Parking',-18540)),
  pair(6,c('A.16-4200.S','2 Way Communications',24737),c('A.16-4000.S','Communications/Low Voltage',-24737)),
  pair(7,c('A.16-4100.S','ERCC',61035),c('A.16-4000.S','Communications/Low Voltage',-61035)),
]),
change(2, 'Mass Timber Install', [pair(1,c('A.06-1100.S','Mass Timber (Install)',155000),c('A.06-1000.S','Mass Timber',-155000),'FROM 06-1000 Mass Timber TO Mass Timber Install')]),
change(3, 'Move Funds From Electrical for Temp Power (Power Plus)', [pair(1,c('A.16-1100.S','Power Plus',43555),c('A.16-1000.S','Building Electrical',-43555),'FROM 16-1000 Electrical TO 16-1100 Power Plus')]),
change(4, 'Move Funds from Hoist to Covered Walkway', [pair(1,c('B.00-1340.S','Temp Covered Walkways',5975),c('B.00-1960.S','Temp Hoist',-5975),'FROM 00-1960 Temp Hoist TO 00-1340 Temp Covered Walkway')]),
change(5, 'Move Funds from Electrical to Fixtures', [pair(1,c('A.16-1200.S','Electrical Fixtures',97317.41),c('A.16-1000.S','Building Electrical',-97317.41),'FROM 16-1000 Electrical TO 16-1200 Electrical Fixtures')]),
change(6, 'Move Funds for HVAC Install', [pair(1,c('A.15-7200.S','HVAC Install',544296.45),c('A.15-7000.S','HVAC (units)',-544296.45),'FROM 15-7000 HVAC TO 15-7200 HVAC Install')]),
change(7, 'Move Funds from Electrical for HVAC Install', [pair(1,c('A.15-7200.S','HVAC Install',62703.55),c('A.16-1000.S','Building Electrical',-62703.55),'FROM 16-1000 Electrical TO 15-7200 HVAC Install')]),
change(8, 'Move Funds From Electrical to Demo', [pair(1,c('A.02-4000.S','Site Demolition',2000),c('A.16-1000.S','Building Electrical',-2000),'FROM 16-1000 Electrical TO 02-4000 Site Demo')]),
change(9, 'Wood Flooring - Site Office', [pair(1,c('A.09-6000.SVC','Wood Flooring Site Office',9607.44),c('A.09-6000.S','Wood Flooring',-9607.44),'Move Funds from 09-6000.S to 09-6000.SVC for Site Office Flooring; Howards Inv 32726-1 6.10.25')]),
change(10, 'Tile - Site Office', [pair(1,c('A.09-3000.SVC','Tile - Site Office',4500),c('A.09-3000.S','Tile',-4500),'Move funds from 09-3000.S to 09-3000.SVC for site office tile; Joe Tinsely Stone & Tile Inv 10325')]),
change(11, 'Traffic Control - Permits', [pair(1,c('B.00-1310.O','Traffic Control - Permits',4460.46),c('B.00-1310.S','Temporary Traffic Control',-4460.46),'Move funds from 00-1310.S to 00-1310.O for DSD permits')]),
change(12, 'Establish GC Excess', [pair(1,c('C.01-5000.O','GC Excess',190208),c('C.01-1001.L','Operations Manager',-190208),'Move funds from 01-1001 Ops Manager to 01-5000 GC Excess')]),
change(13, 'July Budget Adjustment', [
  pair(1,c('A.08-8000.S','Glazing',605.15),c('A.16-4000.S','Communications/Low Voltage',-605.15)),
  pair(2,c('A.11-1000.S','Window Washing Equipment',0.46),c('A.16-4000.S','Communications/Low Voltage',-0.46)),
  pair(3,c('A.09-9000.S','Painting (interior)',25925),c('A.16-4000.S','Communications/Low Voltage',-25925)),
  pair(4,c('A.07-1000.S','Waterproofing',2329),c('A.16-4000.S','Communications/Low Voltage',-2329)),
  pair(5,c('A.11-4500.S','Residential Appliances',75000),c('B.00-1960.S','Temp Hoist',-75000)),
  pair(6,c('A.11-4500.S','Residential Appliances',50050),c('A.16-1000.S','Building Electrical',-50050)),
  pair(7,c('A.11-4500.S','Residential Appliances',18181.52),c('A.12-3000.S','Casework',-18181.52)),
  pair(8,c('A.09-2000.S','Drywall',50050),c('A.09-2400.S','Plaster',-50050)),
  pair(9,c('A.07-4000.S','Roofing',43927.46),c('A.07-6000.S','Sheet Metal',-43927.46)),
  pair(10,c('A.07-4000.S','Roofing',12250),c('A.02-4800.S','Earthwork (Grading)',-12250)),
  pair(11,c('A.07-4000.S','Roofing',690),c('A.07-2000.S','Insulation',-690)),
]),
change(14, 'August Pay App #6 Budget Adjustments', [
  pair(1,c('A.16-1000.SVC','Building Electrical - Testing',1450),c('A.16-1000.S','Building Electrical',-1450)),
  pair(2,c('A.27-1000.O','Fire Alarm - Permit',4909.89),c('A.16-4000.S','Communications/Low Voltage',-4909.89)),
  pair(3,c('B.00-1310.O','Traffic Control - Permits',907.16),c('B.00-1310.S','Temporary Traffic Control',-907.16)),
  pair(4,c('B.00-1310.L','Traffic Control - Labor',756),c('B.00-1310.S','Temporary Traffic Control',-756)),
  pair(6,c('A.03-1000.M','Crawlspace Access Panel',2205.36),c('A.03-1000.S','Concrete',-2205.36)),
  pair(7,c('A.02-4500.S','Shoring & Special Foundations',5300),c('A.09-2400.S','Plaster',-5300)),
  pair(8,c('A.08-2000.S','Common Area Doors',372069.73),c('A.08-1000.S','Interior Doors',-372069.73)),
  pair(10,c('A.08-2000.M','Common Area Door Hardware',67402.09),c('A.08-1000.S','Interior Doors',-67402.09)),
]),
change(15, 'September 2025 Budget Adjustments', [
  pair(1,c('B.00-1970.O','Temp Crane - other generator',745.70),c('B.00-1970.S','Temp Crane',-745.70)),
  {n:2,comment:'Move Funds from Misc Metals and Common Area Doors to Decorative Railing',lines:[c('A.05-7000.S','Decorative Railing',6264),c('A.05-5000.S','Structural Steel/Misc. Metals',-5027),c('A.08-2000.S','Common Area Doors',-1237)]},
  pair(3,c('A.09-9000.S','Painting (interior)',2800),c('A.12-2000.S','Window Coverings',-2800)),
  pair(4,c('B.00-1310.O','Traffic Control - Permits',658.50),c('B.00-1310.S','Temporary Traffic Control',-658.50)),
]),
change(16, 'October Budget Adjustments', [
  pair(1,c('A.09-1000.S','Scaffold',99335),c('A.09-2400.S','Plaster',-99335)),
  pair(2,c('A.07-2000.S','Insulation',3600),c('A.12-2000.S','Window Coverings',-3600),'Office improvement project'),
  pair(3,c('A.09-2000.S','Drywall',10080),c('A.12-2000.S','Window Coverings',-10080),'Office improvement project'),
  pair(4,c('B.00-1970.O','Temp Crane - other generator',60000),c('B.00-1960.S','Temp Hoist',-60000),'Generator fuel'),
  pair(5,c('B.00-1310.O','Traffic Control - Permits',737.25),c('B.00-1310.S','Temporary Traffic Control',-737.25),'TCP Permit'),
  pair(6,c('A.27-1000.O','Fire Alarm - Permit',1466.25),c('A.16-1000.S','Building Electrical',-1466.25),'Fire alarm permit fee'),
  pair(7,c('B.00-1310.S','Temporary Traffic Control',585.54),c('B.00-1900.SVC','Jobsite Utilities/Misc Equip.',-585.54),'Cover overage'),
  pair(8,c('A.16-1200.S','Electrical Fixtures',26749.01),c('A.16-1000.S','Building Electrical',-26749.01),'Integris PO'),
]),
change(17, 'November Budget Adjustments', [
  pair(1,c('B.00-1970.O','Temp Crane - other generator',9272.69),c('B.00-1960.S','Temp Hoist',-9272.69),'Generator & fuel'),
  pair(2,c('B.00-1310.O','Traffic Control - Permits',328.50),c('B.00-1365.S','SWPP',-328.50)),
  pair(3,c('A.21-1000.O','Fire Sprinkler - Permits',3273.76),c('A.21-1000.S','Fire Sprinkler',-3273.76)),
  pair(4,c('B.00-1800.SVC','Field Engineer (Survey)',5512),c('A.16-1000.S','Building Electrical',-5512)),
]),
change(18, 'December 2025 Budget Adjustments', [
  pair(1,c('A.02-4000.S','Site Demolition',5889),c('A.02-4800.S','Earthwork (Grading)',-5889),'Cover commitment CO - in scope'),
  pair(2,c('B.00-1800.SVC','Field Engineer (Survey)',6343),c('B.00-1970.S','Temp Crane',-6343)),
  pair(3,c('A.21-1000.O','Fire Sprinkler - Permits',14719.08),c('A.12-2000.S','Window Coverings',-14719.08),'Cover permits'),
  pair(4,c('B.00-1310.O','Traffic Control - Permits',5398.50),c('A.12-2000.S','Window Coverings',-5398.50),'Cover permits'),
  pair(5,c('B.00-1960.L','Temp-Hoist (Labor)',3200),c('B.00-1960.S','Temp Hoist',-3200),'Hoist operator labor'),
  pair(6,c('B.00-1960.O','Temp Hoist - other generator',1705),c('B.00-1960.S','Temp Hoist',-1705),'Generator for hoist'),
  pair(7,c('B.00-1970.O','Temp Crane - other generator',20147.02),c('B.00-1960.S','Temp Hoist',-20147.02),'Generator for crane'),
  pair(8,c('A.09-4000.M','Stone - Material',70150.33),c('A.09-4000.S','Stone Countertops',-70150.33),'Moved from stone countertops to material line item'),
  pair(9,c('A.16-1200.S','Electrical Fixtures',3006.69),c('A.16-1000.S','Building Electrical',-3006.69),'Tax on added inverters'),
]),
change(19, 'January 2026 Budget Adjustments', [
  pair(1,c('A.05-5000.O','Structural Steel/Misc Metals - permit',330.76),c('A.06-2000.S','Finish Carpentry',-330.76),'Cover permit'),
  pair(2,c('B.00-1310.S','Temporary Traffic Control',200),c('A.06-2000.S','Finish Carpentry',-200),'Traffic control overage'),
  pair(3,c('B.00-1960.O','Temp Hoist - other generator',8591.12),c('A.03-1000.S','Concrete',-8591.12),'Temp hoist generator'),
  pair(4,c('B.00-1960.L','Temp-Hoist (Labor)',5169.04),c('B.00-1960.S','Temp Hoist',-5169.04),'Hoist labor'),
  pair(5,c('B.00-1970.O','Temp Crane - other generator',19168.26),c('A.03-1000.S','Concrete',-19168.26),'Crane generator'),
  {n:6,comment:'Cover stone material PO',lines:[c('A.09-4000.M','Stone - Material',189184.10),c('A.09-4000.S','Stone Countertops',-72721.67),c('A.09-2400.S','Plaster',-63737),c('A.12-2000.S','Window Coverings',-8864.42),c('A.16-4000.S','Communications/Low Voltage',-43861.01)]},
  pair(7,c('A.21-1000.S','Fire Sprinkler',1510.76),c('A.12-3000.S','Casework',-1510.76),'Cover commitment overage'),
  pair(8,c('B.00-1800.SVC','Field Engineer (Survey)',6342.50),c('A.03-1000.S','Concrete',-6342.50),'Cover overage'),
  pair(9,c('A.03-1000.M','Crawlspace Access Panel',6399.41),c('A.03-1000.S','Concrete',-6399.41),'Trucking & fill'),
]),
change(20, 'January 2026 - GC internal adjustment', [pair(1,c('C.01-3050.O','Field Office - Printing (reprographics)',2500),c('C.01-3040.O','Field Office - Software',-2500))]),
change(21, 'February 2026 Budget Adjustments', [
  pair(1,c('B.00-1970.O','Temp Crane - other generator',33950.46),c('B.00-1970.S','Temp Crane',-33950.46),'Crane generator invoices'),
  pair(2,c('A.05-7000.S','Decorative Railing',10505),c('A.07-6000.S','Sheet Metal',-10505),'Cover commitment overage'),
  pair(4,c('A.09-2000.S','Drywall',5651),c('A.08-2000.S','Common Area Doors',-5651),'Cover commitment overage'),
  pair(5,c('B.00-1960.O','Temp Hoist - other generator',14350.63),c('B.00-1960.S','Temp Hoist',-14350.63),'Generator invoices'),
  pair(6,c('B.00-1960.L','Temp-Hoist (Labor)',5695.49),c('B.00-1960.S','Temp Hoist',-5695.49),'Hoist labor'),
  pair(7,c('A.05-5000.O','Structural Steel/Misc Metals - permit',330.76),c('A.05-5000.S','Structural Steel/Misc. Metals',-330.76),'Permit'),
  pair(8,c('A.34-1000.O','Automated Parking - Permits',330.76),c('A.34-1000.S','Automated Parking',-330.76),'Permit'),
  pair(9,c('B.00-1310.O','Traffic Control - Permits',246.75),c('B.00-1310.S','Temporary Traffic Control',-246.75),'Permit'),
  pair(10,c('B.00-1310.S','Temporary Traffic Control',1516.75),c('B.00-1365.S','SWPP',-1516.75),'VCON CO & permit'),
]),
change(22, 'March 2026 Budget Adjustments', [
  pair(1,c('A.04-2000.M','Material - exterior partitions',23658.80),c('A.04-2000.S','CMU',-23658.80),'Crystalia invoice material'),
  pair(2,c('A.05-5000.M','Misc Metals Material',980.09),c('A.05-5000.S','Structural Steel/Misc. Metals',-980.09),'IMS metal plates'),
  pair(3,c('A.08-8000.O','Window Wall Permits',661.52),c('A.08-8000.S','Glazing',-661.52),'Window Wall Permits'),
  pair(4,c('A.09-3000.M','Tile - Material',11561.12),c('A.09-3000.S','Tile',-11561.12),'Global Tile invoice'),
  pair(5,c('A.10-1000.M','Mirrors',9375.29),c('A.10-1000.S','Specialties',-9375.29),'Moon Mirror invoice'),
  pair(6,c('B.00-1310.O','Traffic Control - Permits',1311),c('B.00-1365.S','SWPP',-1311),'Traffic control permits'),
  pair(7,c('B.00-1960.L','Temp-Hoist (Labor)',4790.43),c('B.00-1960.S','Temp Hoist',-4790.43),'Temp hoist labor March'),
  pair(8,c('B.00-1970.O','Temp Crane - other generator',165),c('B.00-1970.S','Temp Crane',-165),'Permit'),
  pair(9,c('A.07-1000.S','Waterproofing',5420),c('A.08-1000.S','Interior Doors',-5420),'Cover commitment overage'),
  pair(10,c('A.14-2000.S','Elevators',4500),c('A.08-1000.S','Interior Doors',-4500),'Cover commitment overage'),
]),
change(23, "April - Internal Adjustment for GC's (accountant)", [pair(1,c('C.01-1005.L','Accountant',100000),c('C.01-5000.O','GC Excess',-100000),'Move Funds for Accountant')]),
change(24, 'April 2026 Budget Adjustment', [
  {n:1,comment:'Microcement subcontract',lines:[c('A.09-3500.S','Microcement',323657.88),c('A.09-3000.S','Tile',-298657.88),c('A.03-1000.S','Concrete',-25000)]},
  pair(2,c('A.06-1000.O','Mass Timber - Other',490.05),c('A.02-7500.S','Site Concrete',-490.05),'IMS purchase for Mass Timber'),
  pair(3,c('B.00-1200.SVC','Portable Toilets/Handwash',16000),c('B.00-1365.S','SWPP',-16000),'Projected overage'),
  pair(4,c('B.00-1310.S','Temporary Traffic Control',1431.92),c('B.00-1900.SVC','Jobsite Utilities/Misc Equip.',-1431.92),'Traffic control supplies and submittals'),
  pair(5,c('B.00-1720.S','Safety',5000),c('B.00-1320.SVC','General Labor',-5000),'Safety consultant overage'),
  pair(6,c('B.00-1960.L','Temp-Hoist (Labor)',4588.57),c('B.00-1960.S','Temp Hoist',-4588.57),'Hoist operator'),
  {n:7,comment:'Crane overage',lines:[c('B.00-1970.S','Temp Crane',52246.93),c('B.00-1960.S','Temp Hoist',-30000),c('C.01-3010.S','Field -Temp Utility - Power',-22246.93)]},
  pair(8,c('B.00-1970.O','Temp Crane - other generator',820),c('B.00-1970.S','Temp Crane',-820),'Generator'),
  pair(9,c('A.08-2000.O','Common Area Doors - Other',125),c('A.08-2000.S','Common Area Doors',-125)),
]),
];
for (const ch of changes) {
  ch.adjustmentCount = ch.adjustments.length;
  ch.lineCount = ch.adjustments.reduce((s,a)=>s+a.lines.length,0);
  ch.positiveTotal = ch.adjustments.flatMap(a=>a.lines).filter(l=>l.amount>0).reduce((s,l)=>s+l.amount,0);
  ch.negativeTotal = ch.adjustments.flatMap(a=>a.lines).filter(l=>l.amount<0).reduce((s,l)=>s+l.amount,0);
  ch.net = Math.round((ch.positiveTotal + ch.negativeTotal)*100)/100;
  const codes = new Map();
  for (const l of ch.adjustments.flatMap(a=>a.lines)) codes.set(l.budgetCode, l.description);
  ch.budgetCodeTies = [...codes].map(([budgetCode, description]) => ({ budgetCode, description, role: 'line item' }));
  ch.tieConfidence = 'exact-pdf';
  ch.tieNotes = 'Exact line-level adjustment extracted from CAST BUILD A.O budget revision PDF.';
}
const totals = {
  changeCount: changes.length,
  adjustmentCount: changes.reduce((s,c)=>s+c.adjustmentCount,0),
  lineCount: changes.reduce((s,c)=>s+c.lineCount,0),
  positiveTotal: changes.reduce((s,c)=>s+c.positiveTotal,0),
  negativeTotal: changes.reduce((s,c)=>s+c.negativeTotal,0),
};
totals.net = Math.round((totals.positiveTotal + totals.negativeTotal)*100)/100;
const byBudgetCode = {};
for (const ch of changes) for (const adj of ch.adjustments) for (const l of adj.lines) {
  byBudgetCode[l.budgetCode] ??= { budgetCode: l.budgetCode, description: l.description, netAmount: 0, positiveAmount: 0, negativeAmount: 0, lineCount: 0, changes: [] };
  const b = byBudgetCode[l.budgetCode];
  b.netAmount += l.amount; if (l.amount > 0) b.positiveAmount += l.amount; else b.negativeAmount += l.amount; b.lineCount++; if (!b.changes.includes(ch.number)) b.changes.push(ch.number);
}
for (const b of Object.values(byBudgetCode)) for (const k of ['netAmount','positiveAmount','negativeAmount']) b[k] = Math.round(b[k]*100)/100;
let currentBudgetReconciliation = null;
const budgetSummaryPath = path.join(root, 'data/projects/golden-hill/procore-information/budget/budget-summary.json');
if (fs.existsSync(budgetSummaryPath)) {
  const budgetSummary = JSON.parse(fs.readFileSync(budgetSummaryPath, 'utf8'));
  const exactByCode = Object.fromEntries(Object.values(byBudgetCode).map((b) => [b.budgetCode, Math.round(b.netAmount * 100) / 100]));
  const mismatches = [];
  const budgetCodes = new Set();
  for (const row of budgetSummary.rows || []) {
    const code = row['Budget Code'];
    budgetCodes.add(code);
    const approved = Math.round(Number(row['Approved Budget Changes'] || 0) * 100) / 100;
    const exact = exactByCode[code] || 0;
    const diff = Math.round((approved - exact) * 100) / 100;
    if (diff) mismatches.push({ budgetCode: code, approvedBudgetChanges: approved, exactRevisionNet: exact, difference: diff });
  }
  currentBudgetReconciliation = {
    currentBudgetSourceFile: budgetSummary.sourceFile,
    currentBudgetRows: (budgetSummary.rows || []).length,
    exactRevisionBudgetCodes: Object.keys(exactByCode).length,
    missingFromCurrentBudget: Object.keys(exactByCode).filter((code) => !budgetCodes.has(code)),
    mismatchCount: mismatches.length,
    mismatches,
    status: mismatches.length ? 'needs_review' : 'matches_current_budget_approved_budget_changes',
  };
}
const register = {
  projectName: 'Alüm',
  formerName: 'Golden Hill Apartments',
  source: 'CAST BUILD A.O Budget Revision PDFs in 001_CURRENT BUDGET',
  generatedAt: new Date().toISOString(),
  pdfFolder: pdfDir,
  localDropboxPath: '/Users/lawrencehoward/CAST Community Dropbox/CAST Automation/CAST Build Management Platform/Alüm/00_PROCORE DATA TIE/001_CURRENT BUDGET',
  totals,
  currentBudgetReconciliation,
  byBudgetCode: Object.values(byBudgetCode).sort((a,b)=>Math.abs(b.netAmount)-Math.abs(a.netAmount)),
  changes
};
fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'budget-revisions-register.json'), JSON.stringify(register,null,2)+'\n');
fs.writeFileSync(path.join(publicDir, 'budget-revisions-register.json'), JSON.stringify(register,null,2)+'\n');
const rows = [['Change #','Name','Adjustment #','Budget Code','Description','Amount','Comment']];
for (const ch of changes) for (const adj of ch.adjustments) for (const l of adj.lines) rows.push([ch.number,ch.name,adj.adjustmentNumber,l.budgetCode,l.description,l.amount,adj.comment]);
const csv = rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n')+'\n';
fs.writeFileSync(path.join(outDir, 'budget-revisions-lines.csv'), csv);
fs.writeFileSync(path.join(publicDir, 'budget-revisions-lines.csv'), csv);
console.log(`Built budget revisions register: ${totals.changeCount} changes, ${totals.adjustmentCount} adjustments, ${totals.lineCount} lines, net ${totals.net}`);
