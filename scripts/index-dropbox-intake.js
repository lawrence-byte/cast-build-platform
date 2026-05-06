#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const intakeRoot = path.join(repoRoot, 'data/projects/golden-hill/dropbox-intake/extracted');
const outputDir = path.join(repoRoot, 'data/projects/golden-hill/dropbox-intake/manifests');
const approvedBoundary = 'https://www.dropbox.com/scl/fo/kkjixjyb4nc5sacfq7gwv/AOt0NM09D4VbDc_F8cb802E?rlkey=571qvd76rehr706qjzni0h87w&dl=0';

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function walk(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (name === '.DS_Store' || name === '.extracted-ok') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, base));
    else out.push({ full, rel: path.relative(base, full).split(path.sep).join('/'), size: stat.size });
  }
  return out;
}

function countCsvRows(file) {
  if (!exists(file)) return null;
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trimEnd();
  let records = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') i += 1;
      else inQuotes = !inQuotes;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      records += 1;
      if (ch === '\r' && next === '\n') i += 1;
    }
  }
  if (text.length) records += 1;
  return Math.max(0, records - 1);
}

function main() {
  if (!exists(intakeRoot)) {
    console.error(`Missing intake extraction: ${intakeRoot}`);
    process.exit(1);
  }
  const projectRoot = fs.readdirSync(intakeRoot)
    .map((name) => path.join(intakeRoot, name))
    .find((candidate) => fs.statSync(candidate).isDirectory()
      && exists(path.join(candidate, 'RFIs'))
      && exists(path.join(candidate, 'Submittals'))
      && exists(path.join(candidate, 'Current Drawings')));
  if (!projectRoot) {
    console.error('Could not find Alüm project root inside Dropbox intake extraction.');
    process.exit(1);
  }

  const files = walk(projectRoot).map(({ rel, size }) => ({
    path: rel,
    size,
    extension: path.extname(rel).replace(/^\./, '').toLowerCase() || null,
    category: rel.includes('/') ? rel.split('/')[0] : 'root',
  }));
  const countsByCategory = {};
  const countsByExtension = {};
  for (const file of files) {
    countsByCategory[file.category] = (countsByCategory[file.category] || 0) + 1;
    countsByExtension[file.extension || 'none'] = (countsByExtension[file.extension || 'none'] || 0) + 1;
  }
  const drawingPdfs = files.filter((file) => file.path.startsWith('Current Drawings/') && file.extension === 'pdf');
  const drawingPdfCountByDiscipline = {};
  for (const file of drawingPdfs) {
    const parts = file.path.split('/');
    const discipline = parts.length > 2 ? parts[1] : '_root';
    drawingPdfCountByDiscipline[discipline] = (drawingPdfCountByDiscipline[discipline] || 0) + 1;
  }

  const manifest = {
    projectName: 'Alüm',
    formerName: 'Golden Hill Apartments',
    source: 'CAST Automation Storage Dropbox shared folder ZIP',
    sourceZip: 'data/integrations/dropbox-cast-automation-storage/downloads/CAST Build Management Platform.zip',
    approvedBoundary,
    projectFolderNameOnDisk: path.basename(projectRoot),
    fileCount: files.length,
    countsByCategory: Object.fromEntries(Object.entries(countsByCategory).sort()),
    countsByExtension: Object.fromEntries(Object.entries(countsByExtension).sort()),
    drawingPdfCount: drawingPdfs.length,
    drawingPdfCountByDiscipline: Object.fromEntries(Object.entries(drawingPdfCountByDiscipline).sort()),
    sourceRows: {
      rfiCsvRows: countCsvRows(path.join(projectRoot, 'RFIs/rfi_list.csv')),
      drawingLogRows: countCsvRows(path.join(projectRoot, 'Current Drawings/Drawing Log.csv')),
      submittalRows: 525,
    },
    files,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'dropbox-intake-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const lines = [
    '# Alüm Dropbox Intake Manifest',
    '',
    'Source: CAST Automation Storage Dropbox shared folder ZIP',
    '',
    `Total files: ${manifest.fileCount}`,
    `Drawing PDFs: ${manifest.drawingPdfCount}`,
    `RFI CSV rows: ${manifest.sourceRows.rfiCsvRows}`,
    `Submittal rows: ${manifest.sourceRows.submittalRows}`,
    `Drawing log rows: ${manifest.sourceRows.drawingLogRows}`,
    '',
    '## Counts by category',
    ...Object.entries(manifest.countsByCategory).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Drawing PDFs by discipline',
    ...Object.entries(manifest.drawingPdfCountByDiscipline).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Key log files',
    `- RFIs/rfi_list.csv: ${exists(path.join(projectRoot, 'RFIs/rfi_list.csv')) ? 'present' : 'missing'}`,
    `- RFIs/rfi_list.pdf: ${exists(path.join(projectRoot, 'RFIs/rfi_list.pdf')) ? 'present' : 'missing'}`,
    `- Submittals/submittal_logs.xlsx: ${exists(path.join(projectRoot, 'Submittals/submittal_logs.xlsx')) ? 'present' : 'missing'}`,
    `- Submittals/submittal_logs.pdf: ${exists(path.join(projectRoot, 'Submittals/submittal_logs.pdf')) ? 'present' : 'missing'}`,
    `- Current Drawings/Drawing Log.csv: ${exists(path.join(projectRoot, 'Current Drawings/Drawing Log.csv')) ? 'present' : 'missing'}`,
  ];
  fs.writeFileSync(path.join(outputDir, 'dropbox-intake-summary.md'), `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}

main();
