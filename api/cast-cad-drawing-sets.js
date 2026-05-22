'use strict';
const { getActor, getState, json, readBody, createDrawingSetVersion, slipSheetRevision, listDrawingSetVersions } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState();
  const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const rows = listDrawingSetVersions(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId') });
      return json(res, 200, { ok: true, versionCount: rows.versions.length, revisionCount: rows.revisions.length, ...rows });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const result = body.action === 'slip-sheet' || body.action === 'slipSheet'
      ? slipSheetRevision(state, body, actor)
      : createDrawingSetVersion(state, body, actor);
    return json(res, result.ok ? 201 : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
