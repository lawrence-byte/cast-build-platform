'use strict';
const { getActor, getState, json, readBody, createRfiFromMarkup, createWorkflowLinkFromMarkup, listWorkflowLinks } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      return json(res, 200, { ok: true, rfiLinks: state.rfiLinks, workflowLinks: listWorkflowLinks(state, { projectId: url.searchParams.get('projectId'), markupId: url.searchParams.get('markupId'), workflowType: url.searchParams.get('workflowType') }) });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const wantsWorkflow = Boolean(body.workflowType || body.workflow_type || ['submittal','change-event','issue','observation'].includes(String(body.type || '').toLowerCase()));
    const result = wantsWorkflow ? createWorkflowLinkFromMarkup(state, body.markupId || body.id, actor, body) : createRfiFromMarkup(state, body.markupId || body.id, actor, body);
    return json(res, result.ok ? 201 : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
