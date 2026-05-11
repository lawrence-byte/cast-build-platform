#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const projectRoot = path.join(root, 'data/projects/golden-hill');
const alumRoot = path.join(projectRoot, 'dropbox-intake/extracted-20260506-050901/Alüm');
const outDataDir = path.join(projectRoot, 'document-intelligence');
const outPublicDir = path.join(root, 'public/data/projects/golden-hill/document-intelligence');
const venvPython = '/Users/broderick/.openclaw/workspace/skills/pdf-ocr-skill/.venv/bin/python';
const localDataTiePath = '/Users/lawrencehoward/CAST Community Dropbox/CAST Automation/CAST Build Management Platform/Alüm/00_PROCORE DATA TIE';
const currentBudgetPath = `${localDataTiePath}/001_CURRENT BUDGET`;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.DS_Store') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.pdf$/i.test(name)) out.push(full);
  }
  return out;
}
function runPython(script, args = []) {
  const res = spawnSync(venvPython, ['-c', script, ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 80 });
  if (res.status !== 0) throw new Error(res.stderr || res.stdout || `python failed ${res.status}`);
  return res.stdout;
}
function parsePythonJson(stdout) {
  const s = String(stdout || '').trim();
  const start = s.lastIndexOf('\n[');
  const json = start >= 0 ? s.slice(start + 1) : s;
  return JSON.parse(json);
}
function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }
function safeProjectPath(relToAlum) {
  return String(relToAlum || '').split('/').filter(Boolean).join('/');
}
function sanitizeError(error) {
  if (!error) return error;
  return String(error)
    .replace(/filename='[^']*'/g, "filename='private-source-file-redacted'")
    .replace(/\/Users\/[^"'\n\r]*/g, 'private-local-path-redacted')
    .replace(/data\/projects\/golden-hill\/dropbox-intake\/extracted-[^"'\n\r]+/g, 'private-intake-redacted');
}
function publicDataWrite(name, value) {
  for (const dir of [outDataDir, outPublicDir]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
  }
}
function textPreview(text, max = 900) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const pdfs = fs.existsSync(alumRoot) ? walk(alumRoot) : [];
const analysisScript = `
import fitz, json, sys
rows=[]
for p in sys.argv[1:]:
    try:
        doc=fitz.open(p)
        native=''
        for i in range(min(2,len(doc))): native += doc[i].get_text() or ''
        rows.append({'path':p,'pages':len(doc),'nativeTextCharsFirst2':len(native.strip()),'nativePreview':native[:500]})
    except Exception as e:
        rows.append({'path':p,'pages':0,'nativeTextCharsFirst2':0,'error':str(e)})
print(json.dumps(rows))
`;
const chunks = [];
for (let i = 0; i < pdfs.length; i += 200) chunks.push(pdfs.slice(i, i + 200));
let analyzed = [];
for (const chunk of chunks) analyzed = analyzed.concat(parsePythonJson(runPython(analysisScript, chunk)));
const byPath = new Map(analyzed.map((r) => [r.path, r]));
const candidateRows = analyzed
  .map((r) => {
    const p = r.path;
    const stat = fs.statSync(p);
    const relToAlum = path.relative(alumRoot, p).split(path.sep).join('/');
    const parts = relToAlum.split('/');
    const category = parts[0] || '(root)';
    const subcategory = parts.length > 2 ? parts.slice(1, -1).join('/') : parts[1] || '';
    let priority = 0;
    if (r.nativeTextCharsFirst2 === 0) priority += 40;
    if (/scan|permit|invoice|rfi|proposal|cert|fire|sdge|take off|bid/i.test(relToAlum)) priority += 20;
    if (/Current Drawings|08\. RFI|02\. BUDGET|04\. INSURANCE|10\. COMMITMENTS/.test(category)) priority += 10;
    if (r.pages <= 5) priority += 10;
    return {
      fileName: path.basename(p),
      fullPath: p,
      projectPath: safeProjectPath(relToAlum),
      category,
      subcategory,
      pages: r.pages,
      sizeBytes: stat.size,
      nativeTextCharsFirst2: r.nativeTextCharsFirst2,
      ocrCandidate: r.nativeTextCharsFirst2 < 80,
      priority,
      error: sanitizeError(r.error),
    };
  })
  .sort((a, b) => b.priority - a.priority || a.nativeTextCharsFirst2 - b.nativeTextCharsFirst2 || b.sizeBytes - a.sizeBytes);

const wanted = [
  /Current Drawings\/Fire-Protection\/FS-01-FIRE-SERVICE/i,
  /08\. RFI's\/GHA - RFI #083 Plumbing Underground Backfill/i,
  /02\. BUDGET\/GMP Subcontractors\/Roofing\/Scan2025-05-20_112040/i,
  /04\. INSURANCE\/Certificates\/GL Invoice/i,
  /Current Drawings\/SDGE-\/487162-PERMANENT-POWER-UG/i,
  /10\. COMMITMENTS\/23 00 00 HVAC\/02\. COR's\/2503-12/i,
];
const samplePaths = [];
for (const rx of wanted) {
  const hit = pdfs.find((p) => rx.test(path.relative(alumRoot, p).split(path.sep).join('/')));
  if (hit && !samplePaths.includes(hit)) samplePaths.push(hit);
}
for (const c of candidateRows) {
  const full = c.fullPath;
  if (samplePaths.length >= 6) break;
  if (!samplePaths.includes(full) && c.ocrCandidate && c.pages > 0 && c.pages <= 5) samplePaths.push(full);
}

const ocrScript = `
import fitz, json, subprocess, tempfile, pathlib, sys, os
out=[]
for p in sys.argv[1:]:
    item={'path':p,'pagesProcessed':0,'text':''}
    try:
        doc=fitz.open(p)
        for i in range(min(2,len(doc))):
            page=doc[i]
            pix=page.get_pixmap(matrix=fitz.Matrix(2,2), alpha=False)
            tmp=tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tmp.close()
            pix.save(tmp.name)
            res=subprocess.run(['tesseract', tmp.name, 'stdout', '-l', 'eng', '--psm', '6'], text=True, capture_output=True, timeout=90)
            os.unlink(tmp.name)
            item['pagesProcessed'] += 1
            item['text'] += f'\\n--- Page {i+1} ---\\n' + (res.stdout or '')
            if res.stderr: item.setdefault('stderr',''); item['stderr'] += res.stderr[-500:]
    except Exception as e:
        item['error']=str(e)
    out.append(item)
print(json.dumps(out))
`;
const ocrResults = parsePythonJson(runPython(ocrScript, samplePaths));
const samples = ocrResults.map((r) => {
  const p = r.path;
  const info = byPath.get(p) || {};
  const relToAlum = path.relative(alumRoot, p).split(path.sep).join('/');
  const nativeChars = info.nativeTextCharsFirst2 || 0;
  const ocrChars = String(r.text || '').trim().length;
  const extractedTerms = [...new Set((r.text || '').match(/\b[A-Z][A-Z0-9&\-/#.]{2,}\b/g) || [])].slice(0, 12);
  const reviewFlags = [];
  if (nativeChars === 0 && ocrChars > 0) reviewFlags.push('No native text layer; OCR recovered searchable text.');
  if (ocrChars < 80) reviewFlags.push('Low OCR yield; likely drawing/image-heavy or needs manual review.');
  if (/invoice|premium|proposal|bid|contract/i.test(relToAlum)) reviewFlags.push('Financial/procurement document; verify extracted amounts manually.');
  if (/rfi/i.test(relToAlum)) reviewFlags.push('RFI-related document; cross-link to RFI log before relying on extracted text.');
  if (/drawing|fire|sdge|plan/i.test(relToAlum)) reviewFlags.push('Drawing/plan content; OCR is assistive only, not design/takeoff authority.');
  return {
    fileName: path.basename(p),
    projectPath: safeProjectPath(relToAlum),
    category: relToAlum.split('/')[0] || '(root)',
    pages: info.pages || 0,
    pagesProcessed: r.pagesProcessed,
    nativeTextCharsFirst2: nativeChars,
    ocrTextChars: ocrChars,
    extractionStatus: r.error ? 'error' : (ocrChars > nativeChars ? 'ocr_improved_searchability' : 'ocr_low_yield'),
    extractedTerms,
    textPreview: textPreview(r.text),
    reviewFlags,
    error: sanitizeError(r.error),
  };
});

const candidates = candidateRows.map(({ fullPath, ...safe }) => safe);

const summary = {
  projectName: 'Alüm',
  generatedAt: new Date().toISOString(),
  sourceBoundary: 'private_project_archive_metadata_only',
  dataTieStatus: fs.existsSync(localDataTiePath) ? 'mounted' : 'not_mounted_or_not_available_on_this_host',
  currentBudgetStatus: fs.existsSync(currentBudgetPath) ? 'mounted' : 'not_mounted_or_not_available_on_this_host',
  pdfCount: analyzed.length,
  ocrCandidateCount: candidates.filter((c) => c.ocrCandidate).length,
  zeroNativeTextCount: candidates.filter((c) => c.nativeTextCharsFirst2 === 0).length,
  sampleOcrCount: samples.length,
  skills: [
    { name: 'ocr-document-processor', status: 'ready', role: 'General scanned docs/images, tables, structured extraction.' },
    { name: 'pdf-ocr-extractor', status: 'ready', role: 'Tesseract-based local OCR for scanned PDFs.' },
    { name: 'pdf-ocr', status: 'ready', role: 'Dual OCR pipeline using local Python 3.12 venv and RapidOCR.' },
    { name: 'drawing-analyzer', status: 'ready-caution', role: 'Experimental construction drawing metadata/dimensions/symbol extraction.' },
    { name: 'floor-plan', status: 'ready', role: 'Draw.io-style generated layout diagrams.' },
  ],
  pipeline: [
    { step: 'Intake', status: 'live', detail: 'Approved private project archive, CAST BUILD A.O exports, and Telegram attachments are indexed locally.' },
    { step: 'Classify', status: 'live', detail: '4,674-file Alüm data room is grouped by section/category.' },
    { step: 'Extract', status: 'pilot', detail: 'OCR pilot identifies PDFs with weak/no native text and extracts representative samples.' },
    { step: 'Publish', status: 'live', detail: 'Document intelligence JSON feeds the CAST Build UI.' },
  ],
  guardrails: [
    'OCR is assistive; verify anything affecting cost, scope, code, life safety, structure, permits, or schedule.',
    'Prefer native CSV/PDF text exports over OCR when available.',
    'Do not run low-trust drawing analysis against sensitive documents without human review.',
  ],
};

publicDataWrite('summary.json', summary);
publicDataWrite('ocr-candidates.json', candidates.slice(0, 500));
publicDataWrite('ocr-samples.json', samples);
console.log(`Document intelligence built: ${summary.pdfCount} PDFs, ${summary.ocrCandidateCount} OCR candidates, ${samples.length} OCR samples.`);
