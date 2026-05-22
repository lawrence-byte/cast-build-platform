'use strict';
const { getActor, getState, json, readBody, createDrawingSetVersion, compareDrawingSetVersions, slipSheetDrawingSet, getDrawingSetVersion } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState();
  const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const action = url.searchParams.get('action');
      if (action === 'compare') {
        const base = getDrawingSetVersion(state, url.searchParams.get('baseVersionId') || url.searchParams.get('base'));
        const revised = getDrawingSetVersion(state, url.searchParams.get('revisedVersionId') || url.searchParams.get('revised'));
        if (!base || !revised) return json(res, 404, { ok: false, error: 'Base and revised drawing set versions are required.' });
        return json(res, 200, { ok: true, baseVersionId: base.id, revisedVersionId: revised.id, diff: compareDrawingSetVersions(base, revised) });
      }
      return json(res, 200, {
        ok: true,
        drawingSets: state.drawingSets,
        versions: state.drawingSetVersions,
        slipSheetJobs: state.slipSheetJobs,
      });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const result = body.action === 'slip-sheet' || body.action === 'slipsheet'
        ? slipSheetDrawingSet(state, body, actor)
        : createDrawingSetVersion(state, body, actor);
      return json(res, result.ok ? 201 : (result.status || 422), result);
    }
    return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
