const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceDir = process.env.ALUM_SCHEDULE_SOURCE_DIR || process.argv[2] || '';
const generatedAt = new Date().toISOString();
const privateLogDir = path.join(root, 'data/projects/golden-hill/source-logs/schedule');
const dataOut = path.join(root, 'data/projects/golden-hill/schedule/schedule-source-index.json');
const publicOut = path.join(root, 'public/data/projects/golden-hill/schedule/schedule-source-index.json');

const scheduleExtensions = new Set(['.mpp', '.xml', '.xer', '.pdf', '.xlsx', '.xls', '.csv', '.docx']);
function classify(ext) {
  if (ext === '.mpp') return 'microsoft-project';
  if (ext === '.xml') return 'project-xml';
  if (ext === '.xer') return 'primavera-xer';
  if (ext === '.xlsx' || ext === '.xls') return 'spreadsheet';
  if (ext === '.pdf') return 'pdf-snapshot';
  if (ext === '.csv') return 'csv-export';
  if (ext === '.docx') return 'narrative-schedule';
  return 'other';
}
function safeTitle(file) {
  return path.basename(file, path.extname(file)).replace(/^\._/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('._') || entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (scheduleExtensions.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

const result = {
  project_id: 'golden-hill',
  module: 'schedule-brain',
  source_label: 'Alüm private schedule folder',
  source_status: 'not_configured',
  generated_at: generatedAt,
  publish_guardrail: 'Sanitized schedule metadata only. No raw artifacts, private paths, or source files are published.',
  artifact_counts: {},
  latest_artifacts: [],
  next_actions: [
    'Set ALUM_SCHEDULE_SOURCE_DIR to the private Alüm schedule folder on the machine that can access Dropbox.',
    'Run npm run intake:schedule to refresh sanitized schedule metadata.',
    'Review extracted schedule artifacts before enabling baseline comparisons or correspondence automation.'
  ]
};

if (sourceDir) {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    result.source_status = 'source_unavailable';
    result.notes = 'Configured private schedule source was not reachable from this runtime.';
  } else {
    const files = walk(sourceDir);
    const artifacts = files.map((file) => {
      const st = fs.statSync(file);
      const ext = path.extname(file).toLowerCase();
      return {
        title: safeTitle(file),
        kind: classify(ext),
        size_bytes: st.size,
        updated_at: st.mtime.toISOString(),
      };
    }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    result.source_status = artifacts.length ? 'indexed' : 'empty';
    result.artifact_counts = artifacts.reduce((acc, a) => { acc[a.kind] = (acc[a.kind] || 0) + 1; return acc; }, {});
    result.latest_artifacts = artifacts.slice(0, 12);
    result.next_actions = [
      'Identify the current baseline schedule artifact and latest update artifact.',
      'Convert baseline activities into trade/location/sequence milestones.',
      'Compare superintendent voice updates against baseline and 3-week lookahead commitments.',
      'Keep recovery-plan notices draft-only until recipients and approval log are verified.'
    ];
    writeJson(path.join(privateLogDir, `schedule-source-log-${generatedAt.replace(/[:.]/g, '-')}.json`), {
      generated_at: generatedAt,
      source_dir: sourceDir,
      files: files.map((file) => ({ path: file, bytes: fs.statSync(file).size, updated_at: fs.statSync(file).mtime.toISOString() }))
    });
  }
}

writeJson(dataOut, result);
writeJson(publicOut, result);
console.log(`Alüm schedule source index: ${result.source_status}`);
