'use strict';
const path = require('path');
const fs = require('fs');
const { getActor, json, buildPdfStreamContract, sheetFromIndex } = require('./_lib/cast-cad-production');

async function proxyPdf(res, result, sheet) {
  const contract = result.contract || {};
  let response;
  if (contract.provider === 'dropbox' && process.env.DROPBOX_ACCESS_TOKEN) {
    response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
        'dropbox-api-arg': JSON.stringify({ path: `/${sheet.path}` }),
      },
    });
  } else if (contract.streamUrl) {
    response = await fetch(contract.streamUrl, { headers: { accept: 'application/pdf' } });
  }
  if (!response) return json(res, 503, { ok: false, error: 'PDF stream provider is configured, but no stream URL could be derived for this sheet.', contract });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/pdf')) {
    const body = await response.text().catch(() => '');
    return json(res, response.ok ? 502 : response.status, { ok: false, error: `PDF provider did not return a PDF${response.ok ? '' : ` (HTTP ${response.status})`}.`, provider: contract.provider, detail: body.slice(0, 500), contract });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  res.statusCode = 200;
  res.setHeader('content-type', 'application/pdf');
  res.setHeader('cache-control', contract.cacheControl || 'private, max-age=0, no-store');
  res.setHeader('content-disposition', contract.disposition || `inline; filename="${path.basename(sheet.name || 'drawing.pdf')}"`);
  res.end(buffer);
}


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
    const accept = String(req.headers.accept || '');
    if (result.ok && accept.includes('application/pdf')) return proxyPdf(res, result, sheet);
    return json(res, result.ok ? 200 : (result.status || 503), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
