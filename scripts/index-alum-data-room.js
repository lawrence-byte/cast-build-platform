#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const intakeBase = path.join(root, 'data/projects/golden-hill/dropbox-intake');
const dataOutDir = path.join(root, 'data/projects/golden-hill');
const publicOutDir = path.join(root, 'public/data/projects/golden-hill');
const approvedBoundary = 'https://www.dropbox.com/scl/fo/kkjixjyb4nc5sacfq7gwv/AOt0NM09D4VbDc_F8cb802E?rlkey=571qvd76rehr706qjzni0h87w&dl=0';

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((name) => path.join(dir, name)).filter((p) => fs.statSync(p).isDirectory());
}

function latestExtractionRoot() {
  if (process.env.ALUM_DATA_ROOM_SOURCE_DIR) {
    const configured = path.resolve(process.env.ALUM_DATA_ROOM_SOURCE_DIR);
    if (!fs.existsSync(configured) || !fs.statSync(configured).isDirectory()) {
      throw new Error(`Configured ALUM_DATA_ROOM_SOURCE_DIR is not available: ${configured}`);
    }
    return configured;
  }
  const candidates = listDirs(intakeBase)
    .filter((p) => path.basename(p).startsWith('extracted-'))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!candidates.length) throw new Error(`No extracted-* Dropbox intake folders under ${intakeBase}`);
  return candidates[0];
}

function findProjectRoot(extractRoot) {
  if (fs.existsSync(path.join(extractRoot, '08. RFI\'s')) || fs.existsSync(path.join(extractRoot, '00_PROCORE DATA TIE'))) return extractRoot;
  const candidate = path.join(extractRoot, 'Alüm');
  if (fs.existsSync(candidate)) return candidate;
  const found = listDirs(extractRoot).find((p) => /Al/i.test(path.basename(p)));
  if (!found) throw new Error(`No Alüm folder found under ${extractRoot}`);
  return found;
}

function walk(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (name === '.DS_Store' || name === '.extracted-ok') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, base));
    else out.push({ full, rel: path.relative(base, full).split(path.sep).join('/'), stat });
  }
  return out;
}

function sanitizePublishedRel(rel) {
  return rel.replace(/^00_PROCORE DATA TIE(?=\/|$)/, '00. Project Data Tie');
}
function firstSegment(rel) { return rel.split('/')[0] || 'root'; }
function extension(rel) { return path.extname(rel).replace(/^\./, '').toLowerCase() || 'none'; }
function topSectionFrom(seg) {
  const m = seg.match(/^(\d{2})(?:\.|_|\s|-)?\s*(.*)$/);
  if (m) return { number: m[1], name: (m[2] || seg).trim() || seg, key: `${m[1]}. ${(m[2] || seg).trim()}` };
  if (/^Current Drawings$/i.test(seg)) return { number: '06A', name: 'Current Drawings', key: '06A. Current Drawings' };
  if (/^Construction Schedule$/i.test(seg)) return { number: '15A', name: 'Construction Schedule', key: '15A. Construction Schedule' };
  if (/^RFIs$/i.test(seg)) return { number: '08A', name: 'RFI Source Logs', key: '08A. RFI Source Logs' };
  if (/^Submittals$/i.test(seg)) return { number: '09A', name: 'Submittal Source Logs', key: '09A. Submittal Source Logs' };
  return { number: 'UN', name: seg, key: `UN. ${seg}` };
}
function tradeCodeFromRel(rel) {
  const parts = rel.split('/').slice(1);
  for (const part of parts) {
    const m = part.match(/^(\d{2}(?:\s?\d{2}){1,3})(?:\s|-|$)(.*)$/);
    if (m) return { code: m[1].replace(/\s+/g, ' ').trim(), name: (m[2] || '').trim() };
  }
  return null;
}
function humanBytes(n) {
  const u = ['B','KB','MB','GB']; let v = n; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}
function addCount(obj, key, n = 1) { obj[key] = (obj[key] || 0) + n; }

function main() {
  const extractRoot = latestExtractionRoot();
  const projectRoot = findProjectRoot(extractRoot);
  const rawFiles = walk(projectRoot);
  const files = rawFiles.map(({ rel, stat }, idx) => {
    const publishedRel = sanitizePublishedRel(rel);
    const seg = firstSegment(publishedRel);
    const top = topSectionFrom(seg);
    const trade = tradeCodeFromRel(publishedRel);
    return {
      id: idx + 1,
      path: publishedRel,
      name: path.basename(publishedRel),
      topFolder: seg,
      topNumber: top.number,
      topName: top.name,
      topKey: top.key,
      subpath: publishedRel.split('/').slice(1).join('/'),
      extension: extension(publishedRel),
      size: stat.size,
      sizeLabel: humanBytes(stat.size),
      modifiedAt: stat.mtime.toISOString(),
      tradeCode: trade && trade.code,
      tradeName: trade && trade.name,
    };
  });

  const sections = {};
  const extensions = {};
  const tradeCodes = {};
  for (const f of files) {
    if (!sections[f.topKey]) sections[f.topKey] = { key: f.topKey, number: f.topNumber, name: f.topName, topFolder: f.topFolder, fileCount: 0, totalBytes: 0, extensions: {}, childFolders: {} };
    const section = sections[f.topKey];
    section.fileCount += 1;
    section.totalBytes += f.size;
    addCount(section.extensions, f.extension);
    const child = f.subpath.split('/')[0] || '(root)';
    addCount(section.childFolders, child);
    addCount(extensions, f.extension);
    if (f.tradeCode) {
      const key = `${f.tradeCode}${f.tradeName ? ` ${f.tradeName}` : ''}`;
      if (!tradeCodes[key]) tradeCodes[key] = { key, code: f.tradeCode, name: f.tradeName || '', fileCount: 0, sections: {} };
      tradeCodes[key].fileCount += 1;
      addCount(tradeCodes[key].sections, f.topKey);
    }
  }
  const sectionList = Object.values(sections)
    .map((s) => ({ ...s, totalSizeLabel: humanBytes(s.totalBytes), extensions: Object.fromEntries(Object.entries(s.extensions).sort((a,b)=>b[1]-a[1])), childFolders: Object.fromEntries(Object.entries(s.childFolders).sort((a,b)=>b[1]-a[1]).slice(0, 80)) }))
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  const manifest = {
    projectName: 'Alüm',
    formerName: 'Golden Hill Apartments',
    generatedAt: new Date().toISOString(),
    source: process.env.ALUM_DATA_ROOM_SOURCE_DIR ? 'Private synced Alüm project data room' : 'CAST Automation Storage Dropbox shared-folder ZIP',
    approvedBoundary,
    extractionRoot: process.env.ALUM_DATA_ROOM_SOURCE_DIR ? 'private-dropbox-path-redacted' : path.relative(root, extractRoot).split(path.sep).join('/'),
    projectRoot: process.env.ALUM_DATA_ROOM_SOURCE_DIR ? 'private-dropbox-path-redacted' : path.relative(root, projectRoot).split(path.sep).join('/'),
    totalFiles: files.length,
    totalBytes: files.reduce((sum, f) => sum + f.size, 0),
    totalSizeLabel: humanBytes(files.reduce((sum, f) => sum + f.size, 0)),
    sectionCount: sectionList.length,
    sections: sectionList,
    extensionCounts: Object.fromEntries(Object.entries(extensions).sort((a,b)=>b[1]-a[1])),
    tradeCodes: Object.values(tradeCodes).sort((a,b)=>a.code.localeCompare(b.code, undefined, { numeric: true })),
    files,
  };
  fs.mkdirSync(dataOutDir, { recursive: true });
  fs.mkdirSync(publicOutDir, { recursive: true });
  for (const outDir of [dataOutDir, publicOutDir]) {
    fs.writeFileSync(path.join(outDir, 'alum-data-room-index.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const summary = [
    '# Alüm Full Data Room Index', '',
    `Generated: ${manifest.generatedAt}`,
    `Extraction root: ${manifest.extractionRoot}`,
    `Total files: ${manifest.totalFiles}`,
    `Total size: ${manifest.totalSizeLabel}`,
    `Top-level sections: ${manifest.sectionCount}`, '',
    '## Numbered / mapped sections',
    ...sectionList.map((s) => `- ${s.key}: ${s.fileCount} files (${s.totalSizeLabel})`),
    '', '## Extension counts',
    ...Object.entries(manifest.extensionCounts).map(([k,v]) => `- ${k}: ${v}`),
  ].join('\n');
  fs.writeFileSync(path.join(dataOutDir, 'alum-data-room-summary.md'), `${summary}\n`);
  console.log(summary);
}
main();
