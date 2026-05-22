'use strict';
const { getActor, getState, json, readBody, createDrawingSetRevision, listDrawingSetRevisions, createSlipSheetJob } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState();
  const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const revisions = listDrawingSetRevisions(state, { projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status') });
      return json(res, 200, {
        ok: true,
        count: revisions.length,
        revisions,
        contract: {
          providerIndependent: true,
          supports: ['drawing-set-version-index', 'sheet-revision-diff', 'slip-sheet-job-contract', 'human-review-relink-policy'],
          workerRequiredForPdfWriteBack: true,
          workerEnvVar: 'CAST_CAD_SLIP_SHEET_WORKER',
        },
      });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const result = body.action === 'slip-sheet' || body.action === 'slipsheet'
        ? createSlipSheetJob(state, body, actor)
        : createDrawingSetRevision(state, body, actor);
      return json(res, result.ok ? 201 : (result.status || 422), result);
    }
    return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
