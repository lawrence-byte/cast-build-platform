'use strict';

const fs = require('fs');
const path = require('path');

const MODULE_FOLDERS = {
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

const sourceCandidates = [
  process.env.ALUM_PROJECT_SOURCE_DIR,
  '/Users/lawrencehoward/CAST Community Dropbox/CAST Automation/CAST Build Management Platform/Alüm',
  '/Users/broderick/Library/CloudStorage/Dropbox-CASTCommunity/CAST Automation/CAST Build Management Platform/Alüm',
].filter(Boolean);

function sourceRoot() {
  return sourceCandidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function safeResolve(moduleId, rel = '') {
  const root = sourceRoot();
  if (!root) return { error: 'CAST_SERVER_SOURCE_UNAVAILABLE' };
  const folder = MODULE_FOLDERS[moduleId];
  if (!folder) return { error: 'UNKNOWN_CAST_SERVER_MODULE' };
  const moduleRoot = path.resolve(root, folder);
  const target = path.resolve(moduleRoot, rel || '.');
  if (target !== moduleRoot && !target.startsWith(`${moduleRoot}${path.sep}`)) return { error: 'PATH_OUTSIDE_CAST_SERVER_MODULE' };
  return { root, moduleRoot, target, folder };
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(html);
}

function query(req) {
  const base = `http://${req.headers.host || 'localhost'}`;
  return Object.fromEntries(new URL(req.url || '/', base).searchParams.entries());
}

function handleOpenFolder(req, res) {
  const { module, path: rel = '' } = query(req);
  const resolved = safeResolve(module, rel);
  if (resolved.error) return sendJson(res, 404, resolved);
  if (!fs.existsSync(resolved.target)) return sendJson(res, 404, { error: 'CAST_SERVER_PATH_NOT_FOUND' });
  const dir = fs.statSync(resolved.target).isDirectory() ? resolved.target : path.dirname(resolved.target);
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => !entry.name.startsWith('.')).slice(0, 500).map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? 'folder' : 'file',
    module,
    path: path.relative(resolved.moduleRoot, path.join(dir, entry.name)).split(path.sep).join('/'),
  }));
  return sendJson(res, 200, { module, folder: resolved.folder, entries });
}

function handleOpenFile(req, res) {
  const { module, path: rel = '' } = query(req);
  const resolved = safeResolve(module, rel);
  if (resolved.error) return sendJson(res, 404, resolved);
  if (!fs.existsSync(resolved.target) || !fs.statSync(resolved.target).isFile()) return sendJson(res, 404, { error: 'CAST_SERVER_FILE_NOT_FOUND' });
  res.statusCode = 200;
  res.setHeader('content-disposition', `inline; filename="${path.basename(resolved.target).replace(/"/g, '')}"`);
  fs.createReadStream(resolved.target).pipe(res);
}

function handleAddFile(req, res) {
  const { module, path: rel = '' } = query(req);
  const resolved = safeResolve(module, rel);
  if (resolved.error) return sendJson(res, 404, resolved);
  const destination = fs.statSync(resolved.target).isDirectory() ? resolved.target : path.dirname(resolved.target);
  return sendHtml(res, 200, `<!doctype html><title>CAST Server Add File</title><body style="font-family:system-ui;padding:24px"><h1>Add file to CAST Server</h1><p>Destination module: <strong>${module}</strong></p><p>Destination folder is available to the server. Use the CAST upload button in the project navigation to file the document into this module, or connect this endpoint to multipart storage in the next backend pass.</p><p><a href="/projects/alum-folder-registers.html">Back to CAST Server</a></p></body>`);
}

module.exports = { handleOpenFolder, handleOpenFile, handleAddFile, MODULE_FOLDERS };
