'use strict';
const { getActor, getState, json, readBody, createWorkflowLinkFromMarkup, listWorkflowLinks } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const workflowLinks = listWorkflowLinks(state, { projectId: url.searchParams.get('projectId'), markupId: url.searchParams.get('markupId'), workflowType: url.searchParams.get('workflowType') });
      return json(res, 200, { ok: true, linkCount: workflowLinks.length, workflowLinks, contract: { supportedTypes: ['submittal','change-event','rfi'], privateSnapshots: true, requiredEnvVars: ['CAST_CAD_SUBMITTAL_ADAPTER','CAST_CAD_CHANGE_EVENT_ADAPTER'] } });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const result = createWorkflowLinkFromMarkup(state, body, actor);
    return json(res, result.ok ? 201 : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
