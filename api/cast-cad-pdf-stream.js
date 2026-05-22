'use strict';
const path = require('path');
const fs = require('fs');
const { getActor, json, buildPdfStreamContract, sheetFromIndex } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET' });
  const actor = getActor(req);
  const url = new URL(req.url, 'http://localhost');
  const sheetId = url.searchParams.get('sheetId') || url.searchParams.get('path') || '';
  try {
    const indexPath = path.join(process.cwd(), 'public/safe-data/projects/golden-hill/procore-information/procore-data-tie-index.json');
    const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : { files: [] };
    const sheet = sheetFromIndex(index, sheetId) || (sheetId ? { path: sheetId, name: path.basename(sheetId), extension: 'pdf' } : null);
    const result = buildPdfStreamContract({ sheet, actor });
    return json(res, result.ok ? 200 : (result.status || 503), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
