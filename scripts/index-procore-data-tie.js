#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const defaultLocalPath = '/Users/lawrencehoward/CAST Community Dropbox/CAST Automation/CAST Build Management Platform/Alüm/00_PROCORE DATA TIE';
const currentBudgetPath = path.join(defaultLocalPath, '001_CURRENT BUDGET');
const sourceRoot = process.env.PROCORE_DATA_TIE_PATH || defaultLocalPath;
const outData = path.join(root, 'data/projects/golden-hill/procore-information/procore-data-tie-index.json');
const outPublic = path.join(root, 'public/data/projects/golden-hill/procore-information/procore-data-tie-index.json');

function humanBytes(n) {
  const u = ['B', 'KB', 'MB', 'GB']; let v = n; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}
function walk(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (name === '.DS_Store') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, base));
    else out.push({
      path: path.relative(base, full).split(path.sep).join('/'),
      name,
      size: stat.size,
      sizeLabel: humanBytes(stat.size),
      extension: path.extname(name).replace(/^\./, '').toLowerCase() || 'none',
      modifiedAt: stat.mtime.toISOString(),
      topFolder: path.relative(base, full).split(path.sep)[0] || '(root)',
    });
  }
  return out;
}
function writeBoth(index) {
  for (const file of [outData, outPublic]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(index, null, 2)}\n`);
  }
}

const exists = fs.existsSync(sourceRoot) && fs.statSync(sourceRoot).isDirectory();
if (!exists) {
  const index = {
    projectName: 'Alüm',
    source: 'Local Dropbox sync folder for CAST BUILD A.O exports',
    localPath: sourceRoot,
    currentBudgetPath,
    currentBudgetStatus: fs.existsSync(currentBudgetPath) ? 'available' : 'not_mounted_or_not_available_on_this_host',
    status: 'not_mounted_or_not_available_on_this_host',
    generatedAt: new Date().toISOString(),
    totalFiles: 0,
    totalBytes: 0,
    files: [],
    note: 'Lawrence identified this as the authoritative CAST BUILD A.O Information/Data Tie folder, but this OpenClaw host cannot currently see that local path.',
  };
  writeBoth(index);
  console.log(`CAST BUILD A.O Data Tie path not available on this host: ${sourceRoot}`);
  process.exit(0);
}

const files = walk(sourceRoot);
const extensionCounts = {};
const topFolderCounts = {};
for (const f of files) {
  extensionCounts[f.extension] = (extensionCounts[f.extension] || 0) + 1;
  topFolderCounts[f.topFolder] = (topFolderCounts[f.topFolder] || 0) + 1;
}
const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
const index = {
  projectName: 'Alüm',
  source: 'Local Dropbox sync folder for CAST BUILD A.O exports',
  localPath: sourceRoot,
  currentBudgetPath,
  currentBudgetStatus: fs.existsSync(currentBudgetPath) ? 'available' : 'not_found_under_data_tie',
  status: 'indexed',
  generatedAt: new Date().toISOString(),
  totalFiles: files.length,
  totalBytes,
  totalSizeLabel: humanBytes(totalBytes),
  extensionCounts: Object.fromEntries(Object.entries(extensionCounts).sort((a, b) => b[1] - a[1])),
  topFolderCounts: Object.fromEntries(Object.entries(topFolderCounts).sort((a, b) => b[1] - a[1])),
  files,
};
writeBoth(index);
console.log(`Indexed CAST BUILD A.O Data Tie: ${files.length} files (${humanBytes(totalBytes)}) from ${sourceRoot}`);
