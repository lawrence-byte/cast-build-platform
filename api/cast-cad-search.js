'use strict';
const { getActor, getState, json, readBody, indexOcrPage, searchOcr, createDrawingAutoLinks, listDrawingAutoLinks, drawingAutoLinkContract, createAiFinding, reviewAiFinding, listAiFindings, requireCastCad } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const permission = requireCastCad(actor.role, 'view');
      if (!permission.ok) return json(res, permission.status, permission);
      const url = new URL(req.url, 'http://localhost');
      if (url.searchParams.get('action') === 'ai-findings' || url.searchParams.get('type') === 'ai-findings') {
        const humanVerified = url.searchParams.has('humanVerified') ? url.searchParams.get('humanVerified') === 'true' : undefined;
        const findings = listAiFindings(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), status: url.searchParams.get('status'), humanVerified });
        return json(res, 200, { ok: true, findingCount: findings.length, findings, contract: { labelRequired: 'AI Detected', humanVerificationRequired: true, sourceCitationRequired: true } });
      }
      if (url.searchParams.get('action') === 'auto-links' || url.searchParams.get('type') === 'auto-links') {
        const runs = listDrawingAutoLinks(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId') || url.searchParams.get('sourceSheetId'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, runCount: runs.length, autoLinkRuns: runs, contract: drawingAutoLinkContract() });
      }
      const results = searchOcr(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), query: url.searchParams.get('q') || url.searchParams.get('query') });
      return json(res, 200, { ok: true, count: results.length, results });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const action = body.action || body.type || '';
      const result = action === 'ai-finding' || action === 'ai-findings'
        ? createAiFinding(state, body, actor)
        : action === 'review-ai-finding'
          ? reviewAiFinding(state, body.findingId || body.finding_id || body.id, body, actor)
          : action === 'auto-links' || action === 'drawing-auto-links' || action === 'autolink'
            ? createDrawingAutoLinks(state, body, actor)
          : indexOcrPage(state, body, actor);
      return json(res, result.ok ? 201 : (result.status || 422), result);
    }
    return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
