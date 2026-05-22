'use strict';
const { getActor, getState, json, readBody, createTakeoffWorkbookExport, createAnnotatedPdfExport, buildComparisonJob, createDrawingSetVersion, slipSheetRevision, listDrawingSetVersions } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      if (url.searchParams.get('type') === 'drawing-sets') {
        const rows = listDrawingSetVersions(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId') });
        return json(res, 200, { ok: true, versionCount: rows.versions.length, revisionCount: rows.revisions.length, ...rows });
      }
      return json(res, 200, { ok: true, exportJobs: state.exportJobs, comparisonJobs: state.comparisonJobs });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const type = body.type || 'takeoff-workbook';
    const result = type === 'drawing-set-version' ? createDrawingSetVersion(state, body, actor) : type === 'slip-sheet' ? slipSheetRevision(state, body, actor) : type === 'annotated-pdf' ? createAnnotatedPdfExport(state, body, actor) : type === 'comparison' ? buildComparisonJob(state, body, actor) : createTakeoffWorkbookExport(state, body, actor);
    return json(res, result.ok ? 202 : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
