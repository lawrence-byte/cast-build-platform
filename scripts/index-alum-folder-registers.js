#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceRoot = process.env.ALUM_PROJECT_SOURCE_DIR;
const dataRoot = path.join(root, 'data/projects/golden-hill');
const publicRoot = path.join(root, 'public/data/projects/golden-hill');
const safeRoot = path.join(root, 'public/safe-data/projects/golden-hill');
const generatedAt = new Date().toISOString();

const sections = {
  rfis: "08. RFI's",
  submittals: '09. SUBMITTALS',
  commitments: '10. COMMITMENTS',
  accounting: '16. ACCOUNTING',
  permits: '18. PERMITS',
  quality: '19. QUALITY CONTROL',
  inspections: '20. INSPECTIONS',
  safety: '21. SAFETY',
  punchlist: '22. PUNCHLIST',
  closeout: '23. CLOSEOUT',
  correspondence: '24. CORRESPONDENCE',
};

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function humanBytes(n) { const u = ['B','KB','MB','GB']; let v = n; let i = 0; while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; } return `${v.toFixed(i ? 1 : 0)} ${u[i]}`; }
function writeJson(rel, value) {
  for (const base of [dataRoot, publicRoot, safeRoot]) {
    const file = path.join(base, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }
}
function walk(dir, base = dir, out = []) {
  if (!exists(dir)) return out;
  for (const name of fs.readdirSync(dir).sort((a,b)=>a.localeCompare(b, undefined, { numeric: true }))) {
    if (name === '.DS_Store' || name.startsWith('._')) continue;
    const full = path.join(dir, name);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) walk(full, base, out);
    else out.push({ full, rel: path.relative(base, full).split(path.sep).join('/'), stat });
  }
  return out;
}
function add(map, key, n=1) { map[key || 'Uncategorized'] = (map[key || 'Uncategorized'] || 0) + n; }
function ext(name) { return path.extname(name).replace(/^\./, '').toLowerCase() || 'none'; }
function cleanTitle(name) { return path.basename(name, path.extname(name)).replace(/^GHA\s*-\s*/i,'').replace(/[_]+/g,' ').replace(/\s+/g,' ').trim(); }
function inferDate(text) { const m = text.match(/(20\d{2})[-_. ](\d{1,2})[-_. ](\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` : null; }
function inferSpec(text) { const m = text.match(/\b(\d{2}\s?\d{2}\s?\d{2})[-\s]+([^/]+)/); return m ? { code: m[1].replace(/\s+/g,' '), title: (m[2] || '').replace(/\s+/g,' ').trim().slice(0,120) } : null; }
function statusFromName(rel) {
  const s = rel.toUpperCase();
  if (s.includes('/+APPROVED/') || /_APP\b|_AAN\b|_NET\b/.test(s)) return 'Approved / no exceptions noted';
  if (/_RR\b|REVISE/.test(s)) return 'Revise & Resubmit';
  if (/VOID/.test(s)) return 'Void';
  return 'Filed / needs log tie-out';
}
function categoryForRel(rel) {
  const parts = rel.split('/');
  return parts.length > 1 ? parts[0] : 'root';
}
function safeFile({ rel, stat }) {
  return {
    path: rel,
    name: path.basename(rel),
    title: cleanTitle(rel),
    folder: categoryForRel(rel),
    extension: ext(rel),
    sizeBytes: stat.size,
    sizeLabel: humanBytes(stat.size),
    modifiedAt: stat.mtime.toISOString(),
    inferredDate: inferDate(rel),
  };
}
function summarizeFiles(files) {
  const extensionCounts = {}, folderCounts = {}, recent = [];
  for (const f of files) { add(extensionCounts, f.extension); add(folderCounts, f.folder); recent.push(f); }
  recent.sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
  return { totalFiles: files.length, totalBytes: files.reduce((s,f)=>s+f.sizeBytes,0), totalSizeLabel: humanBytes(files.reduce((s,f)=>s+f.sizeBytes,0)), extensionCounts: Object.fromEntries(Object.entries(extensionCounts).sort((a,b)=>b[1]-a[1])), folderCounts: Object.fromEntries(Object.entries(folderCounts).sort((a,b)=>b[1]-a[1])), recentFiles: recent.slice(0,40) };
}
function buildRfis() {
  const dir = path.join(sourceRoot, sections.rfis);
  const raw = walk(dir).map(safeFile);
  const pdfs = raw.filter(f => f.extension === 'pdf' && !/log/i.test(f.path));
  const rows = pdfs.map((f) => {
    const m = f.name.match(/RFI\s*#?\s*(\d+(?:\.\d+)?)/i);
    const number = m ? m[1].padStart(3, '0') : null;
    const subject = cleanTitle(f.name).replace(/^RFI\s*#?\s*\d+(?:\.\d+)?\s*/i,'').trim();
    return { Number: number, Subject: subject || f.title, Status: 'Filed in project folder', sourceKind: 'folder-pdf', fileName: f.name, folderPath: f.path, modifiedAt: f.modifiedAt, sizeLabel: f.sizeLabel, nextStep: 'Tie folder PDF to exported RFI log status before issuing or closing.' };
  }).sort((a,b)=>String(a.Number||'9999').localeCompare(String(b.Number||'9999'), undefined, { numeric: true }));
  const logs = raw.filter(f => /log/i.test(f.path));
  return { projectName: 'Alüm', generatedAt, source: 'Private synced Alüm RFI folder metadata', guardrail: 'Sanitized file/register metadata only; raw PDFs are not published.', ...summarizeFiles(raw), rfiPdfCount: pdfs.length, logFileCount: logs.length, latestLogs: logs.sort((a,b)=>String(b.inferredDate||b.modifiedAt).localeCompare(String(a.inferredDate||a.modifiedAt))).slice(0,20), folderItems: rows, missingTieOutCount: rows.length };
}
function buildSubmittals() {
  const dir = path.join(sourceRoot, sections.submittals);
  const raw = walk(dir).map(safeFile);
  const docs = raw.filter(f => !/\+SUBMITTAL LOGS\//i.test(f.path) && !/import_template/i.test(f.name));
  const statusCounts = {}, specCounts = {}, typeCounts = {}, divisionCounts = {};
  const rows = docs.map((f) => {
    const spec = inferSpec(f.path) || {};
    const status = statusFromName(f.path);
    const type = /SHOP DRAW/i.test(f.path) ? 'Shop Drawing' : /PRODUCT DATA|\bPD\b/i.test(f.path) ? 'Product Data' : /WARRANT/i.test(f.path) ? 'Product Warranty' : /O&M|MANUAL/i.test(f.path) ? 'Operation & Maintenance Manuals (O&Ms)' : /CERT/i.test(f.path) ? 'Qualifications/Certifications' : 'Submittal document';
    add(statusCounts, status); add(specCounts, spec.code ? `${spec.code} ${spec.title || ''}`.trim() : 'No spec inferred'); add(typeCounts, type); add(divisionCounts, f.folder);
    return { 'Submittal Number': spec.code || null, Title: cleanTitle(f.name), Type: type, Status: status, 'Spec Section': spec.code ? `${spec.code} ${spec.title || ''}`.trim() : '', Division: f.folder, sourceKind: 'folder-document', fileName: f.name, folderPath: f.path, modifiedAt: f.modifiedAt, sizeLabel: f.sizeLabel, nextStep: status === 'Filed / needs log tie-out' ? 'Tie to latest exported submittal log for formal status and ball-in-court.' : 'Verify status against latest exported submittal log before relying on folder suffix.' };
  }).sort((a,b)=>String(a['Submittal Number']||'ZZ').localeCompare(String(b['Submittal Number']||'ZZ'), undefined, { numeric: true }));
  const logs = raw.filter(f => /submittal log/i.test(f.path));
  return { projectName: 'Alüm', generatedAt, source: 'Private synced Alüm submittal folder metadata', guardrail: 'Sanitized file/register metadata only; raw PDFs/XLSX files are not published.', ...summarizeFiles(raw), documentCount: docs.length, logFileCount: logs.length, latestLogs: logs.sort((a,b)=>String(b.inferredDate||b.modifiedAt).localeCompare(String(a.inferredDate||a.modifiedAt))).slice(0,20), statusCounts: Object.fromEntries(Object.entries(statusCounts).sort((a,b)=>b[1]-a[1])), typeCounts: Object.fromEntries(Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])), topSpecSections: Object.entries(specCounts).sort((a,b)=>b[1]-a[1]).slice(0,50), divisionCounts: Object.fromEntries(Object.entries(divisionCounts).sort((a,b)=>b[1]-a[1])), folderItems: rows };
}
function buildSectionRegister(key, label) {
  const raw = walk(path.join(sourceRoot, sections[key])).map(safeFile);
  const summary = summarizeFiles(raw);
  const keywordCounts = {};
  const keywords = ['pay application','invoice','waiver','release','insurance','permit','inspection','safety','osha','hot work','concrete','soils','punch','closeout','warranty','o&m','manual','cor','proposal','change order','contract','subcontract','loi'];
  for (const f of raw) for (const kw of keywords) if (f.path.toLowerCase().includes(kw)) add(keywordCounts, kw);
  return { projectName: 'Alüm', section: label, generatedAt, source: `Private synced Alüm ${label} folder metadata`, guardrail: 'Sanitized file/register metadata only; raw source documents are not published.', ...summary, keywordCounts: Object.fromEntries(Object.entries(keywordCounts).sort((a,b)=>b[1]-a[1])), files: raw.slice(0,2000) };
}
function buildCoverage(rfi, submittals, registers) {
  const closeout = registers.closeout || buildSectionRegister('closeout','Closeout');
  const coverage = {
    projectName: 'Alüm', generatedAt, source: 'Private synced Alüm project folder metadata',
    guardrails: ['Publish sanitized metadata only.', 'Do not expose raw accounting, insurance, banking, vendor, staff, or project PDFs publicly.', 'Folder-derived statuses require log/source tie-out before acting.'],
    modules: [
      { id:'rfis', label:'RFIs', sourceFiles:rfi.totalFiles, extractedItems:rfi.folderItems.length, status:rfi.folderItems.length ? 'folder_metadata_indexed' : 'missing', nextAction:'Tie every folder PDF to the exported RFI log and expose missing/log mismatch queue.' },
      { id:'submittals', label:'Submittals', sourceFiles:submittals.totalFiles, extractedItems:submittals.folderItems.length, status:submittals.folderItems.length ? 'folder_metadata_indexed' : 'missing', nextAction:'Merge folder documents with exported submittal register and procurement log.' },
      ...Object.entries(registers).map(([id, reg]) => ({ id, label: reg.section, sourceFiles: reg.totalFiles, extractedItems: reg.files?.length || 0, status: reg.totalFiles ? 'folder_metadata_indexed' : 'missing_or_empty', nextAction: id === 'closeout' && !reg.totalFiles ? 'Generate closeout gap matrix from submittals, commitments, inspections, permits, warranties, O&M, and attic stock signals.' : 'Review high-risk/recent files and promote stable fields into module-specific registers.' }))
    ]
  };
  coverage.missingOrWeak = coverage.modules.filter(m => m.status !== 'folder_metadata_indexed' || /Tie|Merge|Generate/.test(m.nextAction));
  return coverage;
}
function mergeExistingRfi(folderIndex) {
  const file = path.join(dataRoot, 'rfi-summary.json');
  if (!exists(file)) return;
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  current.generatedAt = generatedAt.slice(0,10);
  current.folderSource = folderIndex.source;
  current.folderRfiPdfCount = folderIndex.rfiPdfCount;
  current.folderLogFileCount = folderIndex.logFileCount;
  current.folderMissingTieOutCount = folderIndex.missingTieOutCount;
  current.latestFolderLogs = folderIndex.latestLogs;
  current.folderItems = folderIndex.folderItems;
  current.totalFolderFiles = folderIndex.totalFiles;
  for (const base of [dataRoot, publicRoot, safeRoot]) fs.writeFileSync(path.join(base, 'rfi-summary.json'), `${JSON.stringify(current, null, 2)}\n`);
}
function mergeExistingSubmittals(folderIndex) {
  const file = path.join(dataRoot, 'submittal-summary.json');
  if (!exists(file)) return;
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  current.generatedAt = generatedAt.slice(0,10);
  current.folderSource = folderIndex.source;
  current.folderDocumentCount = folderIndex.documentCount;
  current.folderLogFileCount = folderIndex.logFileCount;
  current.latestFolderLogs = folderIndex.latestLogs;
  current.folderStatusCounts = folderIndex.statusCounts;
  current.folderTypeCounts = folderIndex.typeCounts;
  current.folderTopSpecSections = folderIndex.topSpecSections;
  current.folderItems = folderIndex.folderItems;
  current.totalFolderFiles = folderIndex.totalFiles;
  current.sampleItems = folderIndex.folderItems.slice(0,250);
  for (const base of [dataRoot, publicRoot, safeRoot]) fs.writeFileSync(path.join(base, 'submittal-summary.json'), `${JSON.stringify(current, null, 2)}\n`);
}
function main() {
  if (!exists(sourceRoot)) throw new Error(`Alüm source folder not available: ${sourceRoot}`);
  const rfi = buildRfis();
  const submittals = buildSubmittals();
  const registers = {
    commitments: buildSectionRegister('commitments', 'Commitments'),
    accounting: buildSectionRegister('accounting', 'Accounting'),
    permits: buildSectionRegister('permits', 'Permits'),
    quality: buildSectionRegister('quality', 'Quality Control'),
    inspections: buildSectionRegister('inspections', 'Inspections'),
    safety: buildSectionRegister('safety', 'Safety'),
    punchlist: buildSectionRegister('punchlist', 'Punchlist'),
    closeout: exists(path.join(sourceRoot, sections.closeout)) ? buildSectionRegister('closeout', 'Closeout') : { projectName:'Alüm', section:'Closeout', generatedAt, source:'Private synced Alüm closeout folder metadata', totalFiles:0, totalBytes:0, totalSizeLabel:'0 B', extensionCounts:{}, folderCounts:{}, recentFiles:[], keywordCounts:{}, files:[], status:'missing_or_empty' },
    correspondence: buildSectionRegister('correspondence', 'Correspondence'),
  };
  writeJson('folder-registers/rfi-folder-index.json', rfi);
  writeJson('folder-registers/submittal-folder-index.json', submittals);
  for (const [id, value] of Object.entries(registers)) writeJson(`folder-registers/${id}-folder-index.json`, value);
  const coverage = buildCoverage(rfi, submittals, registers);
  writeJson('folder-registers/metadata-coverage.json', coverage);
  mergeExistingRfi(rfi);
  mergeExistingSubmittals(submittals);
  console.log(`Indexed folder registers: ${rfi.rfiPdfCount} RFI PDFs, ${submittals.documentCount} submittal docs, ${coverage.modules.length} module coverage rows.`);
}
main();
