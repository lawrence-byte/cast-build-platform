'use strict';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 250_000) { reject(new Error('REQUEST_TOO_LARGE')); req.destroy(); }
    });
    req.on('end', () => { if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { reject(new Error('INVALID_JSON')); } });
    req.on('error', reject);
  });
}
function actionType(text) {
  const lower = String(text || '').toLowerCase();
  if (/email|send|reply|correspond|notice|letter|subcontractor|vendor|owner|architect|notify|notification|direction/.test(lower)) return 'correspondence_draft';
  if (/schedule|lookahead|delay|start|finish|push|pull|sequence|manpower|crew|blocked|behind|late|recovery|inspection|rfi|submittal/.test(lower)) return 'schedule_adjustment_request';
  if (/daily log|field update|progress|percent|%|weather|delivery|inspection/.test(lower)) return 'field_update';
  return 'coordination_note';
}
function extractTrade(text) {
  const trades = ['electrical','plumbing','mechanical','hvac','drywall','framing','concrete','roofing','waterproofing','paint','fire alarm','fire sprinkler','low voltage','flooring','doors','windows','sitework','sdge'];
  const lower = String(text || '').toLowerCase();
  return trades.find((trade) => lower.includes(trade)) || '';
}
function extractPercent(text) { const match = String(text || '').match(/(\d{1,3})\s*(?:%|percent)/i); return match ? Math.min(100, Number(match[1])) : ''; }
function extractLocation(text) { const match = String(text || '').match(/(?:at|in|on)\s+((?:level|floor|area|unit|corridor|roof|garage|pod|zone|building)\s*[a-z0-9-]*)/i); return match ? match[1] : ''; }
function subjectFrom(text) { const cleaned = String(text || '').replace(/\s+/g, ' ').trim(); return cleaned.length > 72 ? `${cleaned.slice(0, 69)}…` : cleaned || 'CAST Build coordination request'; }
function isBehind(text) { return /behind|late|delayed|delay|missed|not ready|cannot meet|won't meet|blocked|recovery/i.test(String(text || '')); }
function buildSuperintendentDirection(message, projectName = 'Alüm') {
  const trade = extractTrade(message) || 'Trade team';
  const location = extractLocation(message);
  const percent = extractPercent(message);
  return `Subject: Schedule recovery direction — ${subjectFrom(location || trade)}\n\n${trade},\n\nThe superintendent has flagged your work${location ? ` at ${location}` : ''} as behind or at risk against the current ${projectName} schedule${percent !== '' ? ` (${percent}% reported complete)` : ''}.\n\nDirection requested today:\n1. Confirm actual percent complete and remaining work.\n2. Provide crew count for today and next workday.\n3. Identify blockers needing CAST/GC action.\n4. Provide a recovery plan with date-certain completion.\n\nThis direction is for schedule coordination only. It does not approve extra cost, time extension, acceleration cost, change order, or contract modification.\n\n— CAST Build / Superintendent Direction`;
}
function buildDraft(message, projectName = 'Alüm') {
  const trade = extractTrade(message) || 'Team';
  const location = extractLocation(message);
  const subject = /schedule|delay|finish|start|inspection|manpower/i.test(message)
    ? `Schedule confirmation / recovery plan — ${subjectFrom(location || trade)}`
    : `CAST Build coordination request — ${subjectFrom(trade)}`;
  return `Subject: ${subject}\n\n${trade},\n\nCAST Build is coordinating the current ${projectName} field plan. ${String(message || '').trim()}\n\nPlease reply with:\n1. Current status and percent complete.\n2. Crew count / manpower plan.\n3. Material, access, inspection, RFI, or submittal blockers.\n4. Date-certain recovery plan if the current schedule cannot be met.\n\nThis is a coordination request only. It does not approve cost, time, acceleration, contract changes, or change-order rights.\n\n— CAST Build Team Assistant`;
}
function planResponse({ message, projectName }) {
  const type = actionType(message);
  const trade = extractTrade(message);
  const location = extractLocation(message);
  const percent = extractPercent(message);
  if (type === 'correspondence_draft') {
    return { ok: true, type, message: 'Correspondence drafted and queued for PM/superintendent review. Sending is approval-gated.', draft: buildDraft(message, projectName) };
  }
  if (type === 'schedule_adjustment_request') {
    return { ok: true, type, message: isBehind(message) ? `Schedule update queued and superintendent direction drafted${trade ? ` for ${trade}` : ''}${location ? ` at ${location}` : ''}. Send/writeback remains approval-gated.` : `Schedule adjustment request queued${trade ? ` for ${trade}` : ''}${location ? ` at ${location}` : ''}. Source-system writeback remains approval-gated.`, schedulePatch: { trade, location, percent, status: isBehind(message) ? 'behind_needs_superintendent_direction' : 'field_update_received' }, notificationDraft: isBehind(message) ? buildSuperintendentDirection(message, projectName) : '' }; 
  }
  if (type === 'field_update') {
    return { ok: true, type, message: 'Field update captured for the daily-log/schedule queue. It remains local draft data until reviewed.', fieldUpdate: { trade, location, percent } };
  }
  return { ok: true, type, message: 'Coordination note captured. Ask for a schedule adjustment or correspondence draft to turn it into an action.' };
}

module.exports = async function castTeamAssistantRoute(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      endpoint: 'CAST Build Team Assistant',
      modes: ['coordination_note','field_update','schedule_adjustment_request','correspondence_draft','superintendent_direction_draft'],
      guardrails: ['No external email send or external text send from this endpoint.','No Procore or CAST BUILD A.O writeback.','No cost/time/contract approvals.','Drafts require PM/superintendent review.'],
      authRequiredForFutureWrites: true,
    });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  let body;
  try { body = await readBody(req); } catch (error) { return json(res, 400, { ok: false, code: error.message }); }
  if (!body.message || String(body.message).trim().length < 2) return json(res, 422, { ok: false, code: 'MESSAGE_REQUIRED', message: 'A field update or request is required.' });
  return json(res, 200, planResponse({ message: String(body.message).slice(0, 5000), projectName: body.projectName || 'Alüm' }));
};

module.exports._private = { actionType, buildDraft, buildSuperintendentDirection, planResponse };
