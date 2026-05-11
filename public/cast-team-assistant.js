// CAST Build Team Assistant — local-first construction concierge.
// It drafts schedule adjustments and correspondence without source-system writeback or external sends.
(function () {
  'use strict';

  const QUEUE_KEY = 'castBuildTeamAssistantQueue.v1';
  const THREAD_KEY = 'castBuildTeamAssistantThread.v1';
  const SCHEDULE_REQUEST_KEY = 'castBuildScheduleAdjustmentRequests.v1';
  const FIELD_UPDATE_KEY = 'alumScheduleFieldUpdates';
  const NOTIFICATION_KEY = 'castBuildSuperintendentDirectionDrafts.v1';
  const API_PATH = '/api/cast-team-assistant';
  const PROJECT = { id: 'golden-hill', name: 'Alüm', address: '1101 25th Street · San Diego' };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const nowIso = () => new Date().toISOString();
  function readStore(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
  function writeStore(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function queue() { return readStore(QUEUE_KEY, []); }
  function saveQueue(rows) { writeStore(QUEUE_KEY, rows.slice(0, 80)); }
  function thread() { return readStore(THREAD_KEY, []); }
  function saveThread(rows) { writeStore(THREAD_KEY, rows.slice(-60)); }
  function pushThread(role, text, meta) { const rows = thread(); rows.push({ role, text, meta: meta || {}, createdAt: nowIso() }); saveThread(rows); renderMessages(); }

  function actionType(text) {
    const lower = String(text).toLowerCase();
    if (/email|send|reply|correspond|notice|letter|subcontractor|vendor|owner|architect|notify|notification|direction/.test(lower)) return 'correspondence_draft';
    if (/schedule|lookahead|delay|start|finish|push|pull|sequence|manpower|crew|blocked|behind|late|recovery|inspection|rfi|submittal/.test(lower)) return 'schedule_adjustment_request';
    if (/daily log|field update|progress|percent|%|weather|delivery|inspection/.test(lower)) return 'field_update';
    return 'coordination_note';
  }
  function extractTrade(text) {
    const trades = ['electrical', 'plumbing', 'mechanical', 'hvac', 'drywall', 'framing', 'concrete', 'roofing', 'waterproofing', 'paint', 'fire alarm', 'fire sprinkler', 'low voltage', 'flooring', 'doors', 'windows', 'sitework', 'sdge'];
    const lower = String(text).toLowerCase();
    return trades.find((trade) => lower.includes(trade)) || '';
  }
  function extractPercent(text) { const m = String(text).match(/(\d{1,3})\s*(?:%|percent)/i); return m ? Math.min(100, Number(m[1])) : ''; }
  function extractLocation(text) { const m = String(text).match(/(?:at|in|on)\s+((?:level|floor|area|unit|corridor|roof|garage|pod|zone|building)\s*[a-z0-9-]*)/i); return m ? m[1] : ''; }
  function subjectFrom(text) {
    const cleaned = String(text).replace(/\s+/g, ' ').trim();
    return cleaned.length > 72 ? `${cleaned.slice(0, 69)}…` : cleaned || 'CAST Build coordination request';
  }
  function isBehind(text) { return /behind|late|delayed|delay|missed|not ready|cannot meet|won't meet|blocked|recovery/i.test(String(text || '')); }
  function buildSuperintendentDirection(text) {
    const trade = extractTrade(text) || 'Trade team';
    const location = extractLocation(text);
    const percent = extractPercent(text);
    return `Subject: Schedule recovery direction — ${subjectFrom(location || trade)}\n\n${trade},\n\nThe superintendent has flagged your work${location ? ` at ${location}` : ''} as behind or at risk against the current ${PROJECT.name} schedule${percent !== '' ? ` (${percent}% reported complete)` : ''}.\n\nDirection requested today:\n1. Confirm actual percent complete and remaining work.\n2. Provide crew count for today and next workday.\n3. Identify blockers needing CAST/GC action.\n4. Provide a recovery plan with date-certain completion.\n\nThis direction is for schedule coordination only. It does not approve extra cost, time extension, acceleration cost, change order, or contract modification.\n\n— CAST Build / Superintendent Direction`;
  }
  function buildDraft(text, context) {
    const trade = extractTrade(text) || 'Team';
    const location = extractLocation(text);
    const subject = /schedule|delay|finish|start|inspection|manpower/i.test(text)
      ? `Schedule confirmation / recovery plan — ${subjectFrom(location || trade)}`
      : `CAST Build coordination request — ${subjectFrom(trade)}`;
    return `Subject: ${subject}\n\n${trade},\n\nCAST Build is coordinating the current ${PROJECT.name} field plan. ${text.trim()}\n\nPlease reply with:\n1. Current status and percent complete.\n2. Crew count / manpower plan.\n3. Material, access, inspection, RFI, or submittal blockers.\n4. Date-certain recovery plan if the current schedule cannot be met.\n\nThis is a coordination request only. It does not approve cost, time, acceleration, contract changes, or change-order rights.\n\n— CAST Build Team Assistant${context ? `\n\nContext: ${context}` : ''}`;
  }
  function localAnswer(text) {
    const type = actionType(text);
    const trade = extractTrade(text);
    const percent = extractPercent(text);
    const location = extractLocation(text);
    if (type === 'correspondence_draft') {
      return {
        type,
        message: 'I drafted correspondence and queued it for review. Sending remains approval-gated so the field team can work fast without accidentally making commitments.',
        draft: buildDraft(text),
      };
    }
    if (type === 'schedule_adjustment_request') {
      return {
        type,
        message: isBehind(text) ? `I queued the schedule update and drafted a superintendent direction for ${trade || 'the trade'}${location ? ` at ${location}` : ''}. Nothing is sent until the superintendent/PM approves it.` : `I queued this as a schedule adjustment request${trade ? ` for ${trade}` : ''}${location ? ` at ${location}` : ''}. It is local-only until a PM/superintendent approves source-system writeback.`,
        schedulePatch: { trade, location, percent, request: text.trim(), status: isBehind(text) ? 'behind_needs_superintendent_direction' : 'field_update_received' },
        notificationDraft: isBehind(text) ? buildSuperintendentDirection(text) : '',
      };
    }
    if (type === 'field_update') {
      return {
        type,
        message: 'I captured that as a field update and linked it to the schedule coordination queue. It can feed the daily log and huddle board.',
        fieldUpdate: { raw: text.trim(), trade, location, percent, note: text.trim() },
      };
    }
    return {
      type,
      message: 'I captured that as a coordination note. Ask me to turn it into a schedule adjustment, daily log item, or correspondence draft when you are ready.',
    };
  }
  function addQueueItem(type, text, payload) {
    const item = { id: `ta-${Date.now()}-${Math.random().toString(16).slice(2)}`, projectId: PROJECT.id, projectName: PROJECT.name, type, status: 'Draft / PM review required', request: text.trim(), payload: payload || {}, createdAt: nowIso(), externalWriteback: false, externalSend: false, approvalRequired: true };
    const rows = queue(); rows.unshift(item); saveQueue(rows);
    if (type === 'schedule_adjustment_request') {
      const scheduleRows = readStore(SCHEDULE_REQUEST_KEY, []); scheduleRows.unshift(item); writeStore(SCHEDULE_REQUEST_KEY, scheduleRows.slice(0, 80));
      if (payload.notificationDraft) {
        const notices = readStore(NOTIFICATION_KEY, []);
        notices.unshift({ id: item.id, createdAt: item.createdAt, projectId: item.projectId, trade: payload.trade || '', location: payload.location || '', status: 'Draft / superintendent approval required', request: text.trim(), draft: payload.notificationDraft, externalSend: false, approvalRequired: true });
        writeStore(NOTIFICATION_KEY, notices.slice(0, 80));
      }
    }
    if (type === 'field_update') {
      const updates = readStore(FIELD_UPDATE_KEY, []); updates.unshift({ createdAt: item.createdAt, trade: payload.trade || '', location: payload.location || '', percent: payload.percent || '', contractor: '', note: payload.note || text, raw: text }); writeStore(FIELD_UPDATE_KEY, updates.slice(0, 80));
    }
    window.dispatchEvent(new CustomEvent('cast-team-assistant:queue-updated', { detail: item }));
    renderQueue();
    return item;
  }

  async function askAssistant(text) {
    // Try the server contract first. It is intentionally non-sending and non-writeback.
    try {
      const response = await fetch(API_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ projectId: PROJECT.id, projectName: PROJECT.name, message: text, page: location.pathname }),
      });
      if (response.ok) return response.json();
    } catch {}
    return { ok: true, source: 'browser-local-fallback', ...localAnswer(text) };
  }

  function css() {
    if ($('#castTeamAssistantStyles')) return;
    const style = document.createElement('style');
    style.id = 'castTeamAssistantStyles';
    style.textContent = `
      .cast-team-assistant-host{position:fixed;top:12px;right:12px;left:auto;bottom:auto;transform:none;z-index:2200;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#2f2b25}
      .cast-team-assistant-host--landing{position:relative;top:auto;left:auto;right:auto;bottom:auto;transform:none;z-index:25;margin:0 auto;width:max-content}
      .cast-team-assistant-trigger{width:70px;height:70px;border-radius:999px;border:1px solid rgba(207,199,177,.75);background:#181816;color:#f7f3e8;box-shadow:0 18px 42px rgba(0,0,0,.25);display:grid;place-items:center;cursor:pointer;padding:10px;overflow:hidden}
      .cast-team-assistant-host--landing .cast-team-assistant-trigger{width:105px;height:105px;padding:15px}.cast-team-assistant-trigger img{width:100%;height:100%;object-fit:contain;display:block}.cast-team-assistant-trigger:hover{background:#2a2925;transform:translateY(-1px)}.cast-team-assistant-label{display:none}
      .cast-team-assistant-panel{position:fixed;right:12px;top:132px;left:auto;bottom:auto;transform:none;width:min(460px,calc(100vw - 32px));height:min(680px,calc(100vh - 126px));background:#f7f3e8;border:1px solid rgba(24,24,22,.2);box-shadow:0 26px 80px rgba(0,0,0,.32);display:none;grid-template-rows:auto minmax(0,1fr) auto;color:#2f2b25}
      .cast-team-assistant-panel.open{display:grid}.cast-team-assistant-head{background:#181816;color:#f7f3e8;padding:16px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.cast-team-assistant-head strong{display:block;font-family:Georgia,serif;font-size:20px;font-weight:400;letter-spacing:.04em}.cast-team-assistant-head span{display:block;margin-top:4px;color:rgba(247,243,232,.62);font-size:11px;line-height:1.4}.cast-team-assistant-close{border:0;background:transparent;color:#f7f3e8;font-size:28px;line-height:1;cursor:pointer}
      .cast-team-assistant-body{overflow:auto;padding:16px;display:grid;gap:12px;align-content:start}.cast-team-assistant-msg{display:grid;gap:4px}.cast-team-assistant-msg.user{justify-items:end}.cast-team-assistant-bubble{max-width:92%;padding:10px 12px;border:1px solid rgba(47,43,37,.12);background:#fff;line-height:1.45;font-size:13px;white-space:pre-wrap}.cast-team-assistant-msg.user .cast-team-assistant-bubble{background:#2f2b25;color:#fff}.cast-team-assistant-meta{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#827767}.cast-team-assistant-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.cast-team-assistant-chip{border:1px solid rgba(47,43,37,.16);background:#fff;color:#2f2b25;padding:7px 9px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;cursor:pointer}.cast-team-assistant-chip:hover{background:#ece4d5}
      .cast-team-assistant-queue{border-top:1px solid rgba(47,43,37,.12);padding-top:10px}.cast-team-assistant-queue h4{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#827767}.cast-team-assistant-queue-item{border:1px solid rgba(47,43,37,.12);background:#fff;padding:9px;margin-bottom:8px;font-size:12px}.cast-team-assistant-queue-item strong{display:block}.cast-team-assistant-queue-item small{color:#827767}
      .cast-team-assistant-form{border-top:1px solid rgba(47,43,37,.12);background:#fff;padding:12px;display:grid;gap:8px}.cast-team-assistant-input{width:100%;min-height:72px;resize:vertical;border:1px solid rgba(47,43,37,.18);padding:10px;font:inherit;font-size:13px}.cast-team-assistant-send{justify-self:end;border:0;background:#181816;color:#f7f3e8;padding:10px 14px;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}.cast-team-assistant-send:disabled{opacity:.45;cursor:not-allowed}.cast-team-assistant-guardrail{font-size:11px;line-height:1.45;color:#6f675b;background:rgba(207,199,177,.22);border-left:3px solid #8b6f47;padding:9px}
      @media(max-width:700px){.cast-team-assistant-host{top:14px;right:14px;bottom:auto;margin:0}.cast-team-assistant-host--landing{position:relative;top:auto;left:auto;right:auto;transform:none;margin:0 auto}.cast-team-assistant-trigger{width:62px;height:62px}.cast-team-assistant-host--landing .cast-team-assistant-trigger{width:93px;height:93px;padding:13px}.cast-team-assistant-panel{left:12px;right:12px;top:118px;bottom:auto;width:auto;transform:none}.cast-team-assistant-label{display:none}}
    `;
    document.head.appendChild(style);
  }

  function renderMessages() {
    const body = $('#castTeamAssistantMessages');
    if (!body) return;
    const rows = thread();
    body.innerHTML = rows.map((row) => `<div class="cast-team-assistant-msg ${row.role === 'user' ? 'user' : 'assistant'}"><div class="cast-team-assistant-meta">${esc(row.role === 'user' ? 'Field / team' : 'Jamas · CAST assistant')}</div><div class="cast-team-assistant-bubble">${esc(row.text)}</div></div>`).join('') || `<div class="cast-team-assistant-msg assistant"><div class="cast-team-assistant-meta">Jamas · CAST assistant</div><div class="cast-team-assistant-bubble">Tell me anything that changed in the field. I can update the schedule queue, draft daily-log notes, flag behind trades, and prepare superintendent directions/notifications. Nothing is sent or written back without approval.</div></div>`;
    body.scrollTop = body.scrollHeight;
  }
  function renderQueue() {
    const el = $('#castTeamAssistantQueue');
    if (!el) return;
    const rows = queue().slice(0, 5);
    el.innerHTML = `<h4>Draft queue</h4>${rows.map((item) => `<div class="cast-team-assistant-queue-item"><strong>${esc(item.type.replaceAll('_', ' '))}</strong><small>${esc(item.status)} · ${new Date(item.createdAt).toLocaleString()}</small><div>${esc(item.request.slice(0, 160))}${item.request.length > 160 ? '…' : ''}</div></div>`).join('') || '<div class="cast-team-assistant-queue-item">No queued drafts yet.</div>'}`;
  }
  async function copyLatestDraft() {
    const latest = queue().find((item) => item.payload?.draft);
    if (!latest) return;
    await navigator.clipboard?.writeText(latest.payload.draft);
    pushThread('assistant', 'Latest correspondence draft copied. Verify recipients before sending.');
  }
  async function handleSubmit(event) {
    event.preventDefault();
    const input = $('#castTeamAssistantInput');
    const button = $('#castTeamAssistantSend');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    button.disabled = true;
    pushThread('user', text);
    try {
      const answer = await askAssistant(text);
      const payload = { ...(answer.fieldUpdate || {}), ...(answer.schedulePatch || {}), ...(answer.draft ? { draft: answer.draft } : {}), ...(answer.notificationDraft ? { notificationDraft: answer.notificationDraft } : {}) };
      addQueueItem(answer.type || actionType(text), text, payload);
      pushThread('assistant', answer.message || 'Draft queued for review.', { type: answer.type });
    } catch (error) {
      pushThread('assistant', `I could not process that request: ${error.message}`);
    } finally {
      button.disabled = false;
      input.focus();
    }
  }
  function mount() {
    if ($('#castTeamAssistantHost')) return;
    css();
    const isLanding = location.pathname === '/' || location.pathname.endsWith('/index.html');
    const host = document.createElement('div');
    host.id = 'castTeamAssistantHost';
    host.className = `cast-team-assistant-host ${isLanding ? 'cast-team-assistant-host--landing' : 'cast-team-assistant-host--centered'}`;
    host.innerHTML = `
      <button class="cast-team-assistant-trigger" id="castTeamAssistantTrigger" type="button" aria-label="Open CAST team assistant"><img src="/assets/brand/cast-build-main-logo-supplied-transparent.png" alt="CAST Build chat"></button>
      <section class="cast-team-assistant-panel" id="castTeamAssistantPanel" aria-label="CAST Build Team Assistant">
        <header class="cast-team-assistant-head"><div><strong>CAST Build Team Assistant</strong><span>Any request · schedule updates · field texts · superintendent directions</span></div><button class="cast-team-assistant-close" id="castTeamAssistantClose" type="button" aria-label="Close">×</button></header>
        <div class="cast-team-assistant-body"><div class="cast-team-assistant-guardrail"><strong>Guardrail:</strong> Chat/text is the field intake layer. I can queue schedule updates and draft trade notifications, but external sends, Procore/CAST BUILD A.O writes, cost/time commitments, and contract changes stay blocked until authorized.</div><div class="cast-team-assistant-actions"><button class="cast-team-assistant-chip" data-suggest="Drywall is behind on level 4 and needs a recovery plan by end of day.">Behind trade</button><button class="cast-team-assistant-chip" data-suggest="Electrical is 70% complete on level 6 but waiting on inspection; draft recovery request.">Schedule recovery</button><button class="cast-team-assistant-chip" data-suggest="Draft an email to the drywall contractor asking for manpower plan and Friday finish confirmation.">Draft email</button><button class="cast-team-assistant-chip" data-suggest="Field update: plumbing rough-in at floor 5 is 80 percent complete, waiting on material delivery.">Field update</button><button class="cast-team-assistant-chip" id="castTeamAssistantCopyDraft" type="button">Copy latest draft</button></div><div id="castTeamAssistantMessages"></div><div class="cast-team-assistant-queue" id="castTeamAssistantQueue"></div></div>
        <form class="cast-team-assistant-form" id="castTeamAssistantForm"><textarea class="cast-team-assistant-input" id="castTeamAssistantInput" placeholder="Type a field update, schedule change, or correspondence request…"></textarea><button class="cast-team-assistant-send" id="castTeamAssistantSend" type="submit">Queue Draft</button></form>
      </section>`;
    const landingTarget = isLanding ? document.querySelector('.cast-access-chat-slot') : null;
    if (landingTarget) landingTarget.appendChild(host);
    else document.body.appendChild(host);
    const panel = $('#castTeamAssistantPanel');
    $('#castTeamAssistantTrigger').addEventListener('click', () => { panel.classList.toggle('open'); renderMessages(); renderQueue(); $('#castTeamAssistantInput')?.focus(); });
    $('#castTeamAssistantClose').addEventListener('click', () => panel.classList.remove('open'));
    $('#castTeamAssistantForm').addEventListener('submit', handleSubmit);
    $('#castTeamAssistantCopyDraft').addEventListener('click', copyLatestDraft);
    $$('[data-suggest]', host).forEach((button) => button.addEventListener('click', () => { $('#castTeamAssistantInput').value = button.dataset.suggest; $('#castTeamAssistantInput').focus(); }));
    renderMessages(); renderQueue();
  }
  window.CastTeamAssistant = { mount, queue, localAnswer, buildDraft, buildSuperintendentDirection };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
