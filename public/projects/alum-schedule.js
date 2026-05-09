const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const set = (sel, value) => $$(sel).forEach((el) => { el.textContent = value; });

const STATE_KEY = 'castBuildAlumScheduleScenarios';
const UPDATE_KEY = 'alumScheduleFieldUpdates';
const LOOKAHEAD_KEY = 'alumScheduleLookahead';
// Data dependencies: rfi-summary.json, submittal-summary.json, schedule-source-index.json. Optional browser dictation: SpeechRecognition.
let schedule = null;
let selectedId = null;

async function loadJson(path) {
  let response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok && path.startsWith('/data/')) response = await fetch(path.replace('/data/', '/safe-data/'), { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}
function readStore(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
function writeStore(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function scenarios() { return readStore(STATE_KEY, {}); }
function saveScenario(id, patch) { const all = scenarios(); all[id] = { ...(all[id] || {}), ...patch, adjustedAt: new Date().toISOString() }; writeStore(STATE_KEY, all); }
function clearScenario(id) { const all = scenarios(); delete all[id]; writeStore(STATE_KEY, all); }
function taskWithScenario(task) { return { ...task, ...(scenarios()[task.id] || {}) }; }
function statusText(status) { return String(status || 'upcoming').replaceAll('_', ' '); }
function parseDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [y, m, d] = String(value).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateKey(date) { return date.toISOString().slice(0, 10); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function daysBetween(a, b) { const da = parseDate(a); const db = parseDate(b); if (!da || !db) return 1; return Math.max(1, Math.round((db - da) / 86400000) + 1); }
function pctFrom(text) { const m = String(text).match(/(\d{1,3})\s*(?:%|percent)/i); return m ? Math.min(100, Number(m[1])) : ''; }
function tradeFrom(text) { const trades = ['framing', 'drywall', 'electrical', 'plumbing', 'mechanical', 'hvac', 'concrete', 'roofing', 'waterproofing', 'paint', 'fire alarm', 'fire sprinkler', 'low voltage', 'flooring', 'doors', 'windows', 'sitework', 'sdge']; const lower = String(text).toLowerCase(); return trades.find((t) => lower.includes(t)) || ''; }
function locationFrom(text) { const m = String(text).match(/(?:on|at|in)\s+((?:level|floor|area|unit|building|pod|zone|corridor|roof)\s*[a-z0-9-]*)/i); return m ? m[1] : ''; }

function allTasks() { return (schedule?.work_packages || []).map(taskWithScenario); }
function currentFilters() {
  return {
    search: $('[data-search]')?.value.trim().toLowerCase() || '',
    status: $('[data-status-filter]')?.value || '',
    trade: $('[data-trade-filter]')?.value || '',
    phase: $('[data-phase-filter]')?.value || '',
    sort: $('[data-sort]')?.value || 'start',
  };
}
function filteredTasks() {
  const f = currentFilters();
  const rows = allTasks().filter((t) => {
    const hay = [t.id, t.wbs, t.title, t.trade, t.location, t.phase, t.predecessors, t.successors, t.status].join(' ').toLowerCase();
    return (!f.search || hay.includes(f.search)) && (!f.status || t.status === f.status) && (!f.trade || t.trade === f.trade) && (!f.phase || t.phase === f.phase);
  });
  rows.sort((a, b) => {
    if (f.sort === 'finish') return String(a.finish).localeCompare(String(b.finish));
    if (f.sort === 'trade') return String(a.trade).localeCompare(String(b.trade)) || String(a.start).localeCompare(String(b.start));
    if (f.sort === 'status') return String(a.status).localeCompare(String(b.status)) || String(a.start).localeCompare(String(b.start));
    return String(a.start).localeCompare(String(b.start));
  });
  return rows;
}
function populateFilters() {
  const tasks = allTasks();
  const trades = [...new Set(tasks.map((t) => t.trade).filter(Boolean))].sort();
  const phases = [...new Set(tasks.map((t) => t.phase).filter(Boolean))].sort();
  $('[data-trade-filter]').innerHTML = '<option value="">All trades</option>' + trades.map((t) => `<option>${esc(t)}</option>`).join('');
  $('[data-phase-filter]').innerHTML = '<option value="">All phases</option>' + phases.map((p) => `<option>${esc(p)}</option>`).join('');
}
function timelineWidth(task) { return Math.min(100, Math.max(8, daysBetween(task.start, task.finish) * 3)); }
function renderList() {
  const rows = filteredTasks();
  set('[data-visible-count]', `${rows.length} shown`);
  set('[data-filter-readout]', rows.length === allTasks().length ? 'All work packages' : `${rows.length} filtered work packages`);
  const list = $('[data-activity-list]');
  list.innerHTML = rows.map((t) => `
    <article class="schedule-row status-${esc(t.status)} ${String(t.id) === String(selectedId) ? 'active' : ''}" data-activity-id="${esc(t.id)}">
      <div><span class="status-dot"></span><span class="label">${esc(t.wbs || `#${t.id}`)}</span></div>
      <div><strong>${esc(t.title)}</strong><small>${esc(t.trade)} · ${esc(t.location)} · ${esc(t.phase)}</small></div>
      <div>${esc(t.start_label || t.start)} – ${esc(t.finish_label || t.finish)}</div>
      <div>${esc(t.percent_complete ?? 0)}%</div>
      <div><span class="pill ${t.status === 'active_now' ? 'open' : t.status === 'verify_complete' ? 'draft' : ''}">${esc(statusText(t.status))}</span>${scenarios()[t.id] ? '<br><span class="scenario-pill">adjusted</span>' : ''}</div>
      <div class="timeline-cell" aria-hidden="true"><span style="width:${timelineWidth(t)}%"></span></div>
    </article>`).join('') || '<div class="empty"><div><h3>No work packages match this filter</h3><p>Clear filters or search a different task/trade.</p></div></div>';
  $$('[data-activity-id]').forEach((row) => row.addEventListener('click', () => selectTask(row.dataset.activityId)));
}
function selectTask(id) { selectedId = id; renderList(); renderDrawer(); }
function selectedTask() { return allTasks().find((t) => String(t.id) === String(selectedId)) || filteredTasks()[0] || allTasks()[0]; }
function renderDrawer() {
  const t = selectedTask();
  const drawer = $('[data-activity-drawer]');
  if (!t) { drawer.innerHTML = '<p class="source">No schedule task selected.</p>'; return; }
  selectedId = t.id;
  set('[data-selected-status]', statusText(t.status));
  drawer.innerHTML = `
    <h3 class="drawer-title">${esc(t.title)}</h3>
    <div class="source">WBS ${esc(t.wbs || t.id)} · ${esc(t.trade)} · ${esc(t.location)} · ${esc(t.phase)}</div>
    <div class="drawer-grid">
      <label>Start <input type="date" data-drawer-start value="${esc(t.start || '')}"></label>
      <label>Finish <input type="date" data-drawer-finish value="${esc(t.finish || '')}"></label>
      <label>Status <select data-drawer-status><option value="complete">Complete</option><option value="verify_complete">Verify complete</option><option value="active_now">Active now</option><option value="starts_soon">Starts soon</option><option value="upcoming">Upcoming</option></select></label>
      <label>% Complete <input type="number" min="0" max="100" data-drawer-percent value="${esc(t.percent_complete ?? 0)}"></label>
    </div>
    <label class="label">Scenario / Field Note</label>
    <textarea class="scenario-note" data-drawer-note placeholder="Add local superintendent note, blocker, manpower plan, or date-change reason.">${esc(t.scenario_note || '')}</textarea>
    <div class="hero-actions" style="margin-top:14px">
      <button class="tinybtn" data-save-scenario>Save Local Adjustment</button>
      <button class="tinybtn" data-clear-scenario>Clear Adjustment</button>
      <button class="tinybtn" data-draft-activity>Draft Recovery</button>
      <button class="tinybtn" data-copy-activity>Copy Task Brief</button>
    </div>
    <div class="wide-note compact"><strong>Ask:</strong> ${esc(t.ask || 'Confirm start, finish, manpower, blockers, and recovery plan if needed.')}</div>
    <div class="source compact"><strong>Predecessors:</strong> ${esc(t.predecessors || '—')}<br><strong>Successors:</strong> ${esc(t.successors || '—')}<br><strong>Duration:</strong> ${esc(t.duration || '—')} · <strong>Critical:</strong> ${t.critical ? 'Yes' : 'No'}</div>
  `;
  $('[data-drawer-status]').value = t.status || 'upcoming';
  $('[data-save-scenario]').addEventListener('click', () => {
    saveScenario(t.id, { start: $('[data-drawer-start]').value, finish: $('[data-drawer-finish]').value, status: $('[data-drawer-status]').value, percent_complete: Number($('[data-drawer-percent]').value || 0), scenario_note: $('[data-drawer-note]').value.trim() });
    renderAll();
  });
  $('[data-clear-scenario]').addEventListener('click', () => { clearScenario(t.id); renderAll(); selectTask(t.id); });
  $('[data-draft-activity]').addEventListener('click', () => draftNoticeFromTask(t));
  $('[data-copy-activity]').addEventListener('click', async () => navigator.clipboard?.writeText(activityBrief(t)));
}
function activityBrief(t) { return `${t.trade} / ${t.location}\n${t.title}\nWindow: ${t.start_label || t.start} – ${t.finish_label || t.finish}\nStatus: ${statusText(t.status)} · ${t.percent_complete ?? 0}%\nAsk: ${t.ask || ''}`; }
function draftNoticeFromTask(t) {
  $('[data-notice-to]').value = t.trade;
  $('[data-notice-work]').value = `${t.title} (${t.location})`;
  $('[data-notice-due]').value = 'end of next business day';
  $('[data-notice-context]').value = `${t.title} is scheduled ${t.start_label || t.start} to ${t.finish_label || t.finish}. Current local read: ${statusText(t.status)} at ${t.percent_complete ?? 0}% complete. ${t.ask || ''}`;
  generateNotice();
  location.hash = 'correspondence';
}
function generateNotice() {
  const to = $('[data-notice-to]').value.trim() || 'Trade Contractor';
  const work = $('[data-notice-work]').value.trim() || 'identified schedule activity';
  const due = $('[data-notice-due]').value.trim() || 'end of next business day';
  const context = $('[data-notice-context]').value.trim() || 'Current schedule review indicates this activity needs confirmation or recovery action.';
  const draft = `Subject: Schedule Confirmation / Recovery Plan Required — ${work}\n\n${to},\n\nCAST Build is reviewing the active Alüm schedule window. ${context}\n\nPlease provide by ${due}:\n1. Current percent complete by area/location.\n2. Crew count and manpower plan.\n3. Material/equipment status.\n4. Inspection or access needs.\n5. Any blocker that prevents the scheduled finish.\n6. If dates cannot be met, a date-certain recovery plan.\n\nThis is a planning and coordination request only. No change in contract time, cost, acceleration, or change-order rights is accepted by this correspondence.`;
  $('[data-notice-draft]').value = draft;
  return draft;
}
function defaultUpdates() { return [{ createdAt: new Date().toISOString(), trade: 'Electrical / SDGE', location: 'Corridors', percent: 70, contractor: 'Electrical contractor', note: 'Example: waiting on inspection release.', raw: 'Electrical feeders at corridors are 70 percent complete; waiting on inspection release.' }]; }
function readUpdate(row) { if (/blocked|delay|behind|late|cannot|waiting|rfi|submittal|material|inspection/i.test(row.note || row.raw || '')) return 'Blocked / needs superintendent follow-up.'; if (Number(row.percent) >= 80) return 'Near completion; verify punch/inspection handoff.'; return 'Progress captured; watch against lookahead commitments.'; }
function renderFieldUpdates() {
  const rows = readStore(UPDATE_KEY, defaultUpdates());
  $('[data-field-update-rows]').innerHTML = rows.map((r, i) => `<tr><td>${esc(new Date(r.createdAt).toLocaleString())}</td><td><strong>${esc(r.trade || 'Trade')}</strong><br>${esc(r.location || 'Location')} · ${esc(r.contractor || 'No contractor')}</td><td>${esc(r.percent !== '' ? `${r.percent}%` : 'Needs parse')}</td><td>${esc(readUpdate(r))}</td><td><button class="tinybtn" data-draft-update="${i}">Draft</button> <button class="tinybtn" data-delete-update="${i}">Remove</button></td></tr>`).join('');
  $$('[data-delete-update]').forEach((b) => b.addEventListener('click', () => { writeStore(UPDATE_KEY, rows.filter((_, i) => i !== Number(b.dataset.deleteUpdate))); renderFieldUpdates(); renderRecovery(); }));
  $$('[data-draft-update]').forEach((b) => b.addEventListener('click', () => { const r = rows[Number(b.dataset.draftUpdate)]; $('[data-notice-to]').value = r.contractor || r.trade; $('[data-notice-work]').value = `${r.trade} ${r.location}`.trim(); $('[data-notice-context]').value = `Field update: ${r.raw || r.note}. ${r.note || ''}`; generateNotice(); }));
}
function addFieldUpdate() {
  const raw = $('[data-field-update-text]').value.trim();
  const row = { createdAt: new Date().toISOString(), raw, trade: $('[data-update-trade]').value.trim() || tradeFrom(raw), location: $('[data-update-location]').value.trim() || locationFrom(raw), percent: $('[data-update-percent]').value.trim() || pctFrom(raw), contractor: $('[data-update-contractor]').value.trim(), note: $('[data-update-blocker]').value.trim() || raw };
  if (!raw && !row.trade && !row.location) return;
  const rows = readStore(UPDATE_KEY, defaultUpdates()); rows.unshift(row); writeStore(UPDATE_KEY, rows.slice(0, 80));
  ['[data-field-update-text]', '[data-update-trade]', '[data-update-location]', '[data-update-percent]', '[data-update-contractor]', '[data-update-blocker]'].forEach((sel) => { $(sel).value = ''; });
  renderFieldUpdates(); renderRecovery();
}
function renderLookaheadGantt() {
  const el = $('[data-lookahead-gantt]');
  if (!el) return;
  const start = parseDate(schedule?.as_of) || new Date();
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 13);
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
  set('[data-lookahead-range]', `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
  const rows = allTasks()
    .filter((t) => {
      const s = parseDate(t.start); const f = parseDate(t.finish);
      return s && f && f >= start && s <= end;
    })
    .sort((a, b) => String(a.start).localeCompare(String(b.start)) || String(a.trade).localeCompare(String(b.trade)))
    .slice(0, 12);
  if (!rows.length) {
    el.innerHTML = '<div class="lookahead-gantt__empty">No work packages overlap the next two weeks.</div>';
    return;
  }
  const calendar = `<div class="lookahead-gantt__calendar"><div class="lookahead-gantt__day">Work package</div>${days.map((d) => `<div class="lookahead-gantt__day">${esc(d.toLocaleDateString('en-US', { weekday: 'short' }))}<br>${esc(d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }))}</div>`).join('')}</div>`;
  const body = rows.map((t) => {
    const s = parseDate(t.start); const f = parseDate(t.finish);
    const barStart = Math.max(0, Math.round((s - start) / 86400000));
    const barEnd = Math.min(13, Math.round((f - start) / 86400000));
    const span = Math.max(1, barEnd - barStart + 1);
    const cells = days.map((_, i) => {
      if (i === barStart) return `<div class="lookahead-gantt__bar lookahead-gantt__bar--${esc(t.status)}" style="grid-column:span ${span}" title="${esc(t.title)} · ${esc(statusText(t.status))} · ${esc(t.start_label || t.start)}–${esc(t.finish_label || t.finish)}">${span >= 3 ? esc(statusText(t.status)) : ''}</div>`;
      if (i > barStart && i <= barEnd) return '';
      return '<div class="lookahead-gantt__cell"></div>';
    }).join('');
    return `<div class="lookahead-gantt__row"><div class="lookahead-gantt__label"><span class="lookahead-gantt__task">${esc(t.title)}</span><span class="lookahead-gantt__meta">${esc(t.trade)} · ${esc(t.location)} · ${esc(t.start_label || t.start)}–${esc(t.finish_label || t.finish)}</span></div>${cells}</div>`;
  }).join('');
  el.innerHTML = calendar + body;
}
function renderLookahead() {
  const tasks = allTasks();
  const lanes = [
    ['active_now', 'Active Now'], ['starts_soon', 'Starts Soon'], ['verify_complete', 'Verify Complete'], ['upcoming', 'Upcoming']
  ];
  $('[data-lookahead-board]').innerHTML = lanes.map(([status, label]) => `<div class="lane"><h3>${esc(label)}</h3>${tasks.filter((t) => t.status === status).slice(0, 8).map((t) => `<div class="lane-card"><strong>${esc(t.title)}</strong><span>${esc(t.trade)} · ${esc(t.location)}</span><br><small>${esc(t.start_label || t.start)} – ${esc(t.finish_label || t.finish)}</small></div>`).join('') || '<div class="lane-card">No tasks in this lane.</div>'}</div>`).join('');
}

function renderHuddle() {
  const rows = allTasks().filter((t) => ['active_now', 'verify_complete', 'starts_soon'].includes(t.status)).slice(0, 12);
  const body = $('[data-huddle-rows]');
  if (!body) return;
  body.innerHTML = rows.map((t) => `<tr><td><strong>${esc(t.trade)}</strong><br>${esc(t.location)}</td><td>${esc(t.title)} · ${esc(t.start_label || t.start)}–${esc(t.finish_label || t.finish)}</td><td>${esc(t.ask || 'Confirm manpower, blockers, and recovery path.')}</td></tr>`).join('') || '<tr><td colspan="3">No huddle items available.</td></tr>';
}
async function renderConstraints() {
  try {
    const [rfi, sub, source] = await Promise.all([
      loadJson('/safe-data/projects/golden-hill/rfi-summary.json'),
      loadJson('/safe-data/projects/golden-hill/submittal-summary.json'),
      loadJson('/safe-data/projects/golden-hill/schedule/schedule-source-index.json')
    ]);
    set('[data-source-index-status]', source.source_status || 'indexed');
    const rows = [];
    (rfi.openItems || rfi.recentItems || []).filter((x) => /open|draft/i.test(x.Status || '')).slice(0, 12).forEach((x) => rows.push({ name: `RFI ${x.Number || '—'} · ${x.Subject || ''}`, source: 'RFI', owner: x['Ball In Court'] || x['RFI Manager'] || 'Unassigned', risk: String(x.Aging || '').includes('Overdue') ? 'Critical' : 'Review', step: String(x.Aging || '').includes('Overdue') ? 'Escalate response date and field workaround.' : 'Confirm due date and responsible reviewer.' }));
    (sub.sampleItems || []).filter((x) => /open|draft|revise/i.test(x.Status || '')).slice(0, 12).forEach((x) => rows.push({ name: `Submittal ${x['Submittal Number'] || '—'} · ${x.Title || ''}`, source: 'Submittal', owner: x['Responsible Contractor'] || x['Ball In Court'] || 'Unassigned', risk: /revise/i.test(x.Status || '') ? 'Warning' : 'Review', step: /revise/i.test(x.Status || '') ? 'Confirm resubmittal target.' : 'Complete routing and reviewer target.' }));
    set('[data-constraint-count]', `${rows.length} shown`);
    const body = $('[data-constraint-rows]');
    if (body) body.innerHTML = rows.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.source)}</td><td>${esc(x.owner)}</td><td><span class="pill ${x.risk === 'Critical' ? 'open' : x.risk === 'Warning' ? 'draft' : ''}">${esc(x.risk)}</span></td><td class="nextstep">${esc(x.step)}</td></tr>`).join('') || '<tr><td colspan="5">No RFI/submittal constraints found.</td></tr>';
  } catch (error) {
    set('[data-constraint-count]', 'metadata unavailable');
    const body = $('[data-constraint-rows]');
    if (body) body.innerHTML = `<tr><td colspan="5">Constraint metadata unavailable: ${esc(error.message)}</td></tr>`;
  }
}

function renderRecovery() {
  const recovery = (schedule?.recovery_watch || []).slice(0, 18).map(taskWithScenario);
  set('[data-recovery-count]', `${recovery.length} watch items`);
  $('[data-recovery-rows]').innerHTML = recovery.map((t) => `<tr><td><strong>${esc(t.title)}</strong><br>${esc(t.trade)} · ${esc(t.location)}</td><td>${esc(statusText(t.status))} · ${esc(t.finish_label || t.finish)}</td><td><button class="tinybtn" data-recovery-task="${esc(t.id)}">Draft recovery</button></td></tr>`).join('') || '<tr><td colspan="3">No recovery items found.</td></tr>';
  $$('[data-recovery-task]').forEach((b) => b.addEventListener('click', () => draftNoticeFromTask(allTasks().find((t) => String(t.id) === String(b.dataset.recoveryTask)))));
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SpeechRecognition;
}

function renderDirectives() {
  const directives = schedule?.sub_directives || [];
  $('[data-sub-directive-cards]').innerHTML = directives.slice(0, 12).map((x) => `<a href="#correspondence"><strong>${esc(x.trade)} · ${esc(x.location)}</strong><span>${esc(x.window)} — ${esc(x.message)}</span></a>`).join('') || '<a><strong>No directives</strong><span>No subcontractor directives are available.</span></a>';
}
function scheduleCsv() {
  const header = ['WBS', 'Trade', 'Location', 'Task', 'Start', 'Finish', 'Status', 'Percent', 'Ask'];
  return [header, ...filteredTasks().map((t) => [t.wbs, t.trade, t.location, t.title, t.start, t.finish, statusText(t.status), t.percent_complete, t.ask])].map((cols) => cols.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
}
async function copyHuddleBoard() {
  const text = allTasks().filter((t) => ['active_now', 'verify_complete', 'starts_soon'].includes(t.status)).slice(0, 15).map((t, i) => `${i + 1}. ${activityBrief(t)}`).join('\n\n');
  await navigator.clipboard?.writeText(text);
}
function exportScheduleCsv() { const blob = new Blob([scheduleCsv()], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'cast-build-alum-schedule-current-view.csv'; a.click(); URL.revokeObjectURL(url); }
function renderSummary() {
  const tasks = allTasks(); const summary = schedule?.summary || {};
  set('[data-total-work-packages]', tasks.length); set('[data-active-count]', tasks.filter((t) => t.status === 'active_now').length); set('[data-starts-soon-count]', tasks.filter((t) => t.status === 'starts_soon').length); set('[data-verify-complete-count]', tasks.filter((t) => t.status === 'verify_complete').length); set('[data-scenario-count]', Object.keys(scenarios()).length); set('[data-imported-tasks]', summary.total_imported_tasks || '—'); set('[data-critical-count]', summary.critical_path_items || tasks.filter((t) => t.critical).length); set('[data-source-basis]', schedule?.source_basis || 'Sanitized schedule metadata'); set('[data-source-index-status]', schedule?.source_status || 'loaded'); set('[data-current-read]', (schedule?.current_read || []).join(' '));
}
function renderAll() { renderSummary(); renderLookaheadGantt(); renderList(); renderDrawer(); renderLookahead(); renderHuddle(); renderRecovery(); renderDirectives(); }
function bind() {
  ['[data-search]', '[data-status-filter]', '[data-trade-filter]', '[data-phase-filter]', '[data-sort]'].forEach((sel) => $$(sel).forEach((el) => el.addEventListener('input', renderAll)));
  $$('[data-view-preset]').forEach((b) => b.addEventListener('click', () => { $('[data-status-filter]').value = b.dataset.viewPreset; renderAll(); }));
  $$('[data-export-schedule]').forEach((b) => b.addEventListener('click', exportScheduleCsv));
  $$('[data-copy-huddle]').forEach((b) => b.addEventListener('click', copyHuddleBoard));
  $$('[data-add-field-update]').forEach((b) => b.addEventListener('click', addFieldUpdate));
  $('[data-generate-notice]').addEventListener('click', generateNotice);
  $('[data-copy-notice]').addEventListener('click', async () => { await navigator.clipboard?.writeText($('[data-notice-draft]').value || generateNotice()); set('[data-copy-status]', 'Draft copied. Sending remains approval-gated.'); });
  $('[data-copy-directives]').addEventListener('click', async () => { const text = (schedule?.sub_directives || []).map((x) => `[${x.trade} / ${x.location}] ${x.message}`).join('\n\n'); await navigator.clipboard?.writeText(text); set('[data-directive-copy-status]', 'Subcontractor directives copied. Verify recipients before sending.'); });
}
(async function init() {
  schedule = await loadJson('/safe-data/projects/golden-hill/schedule/superintendent-schedule.json');
  populateFilters(); bind(); renderFieldUpdates(); renderConstraints(); selectedId = allTasks()[0]?.id; renderAll();
})().catch((error) => {
  document.body.insertAdjacentHTML('afterbegin', `<div class="wide-note"><strong>Schedule metadata unavailable:</strong> ${esc(error.message)}</div>`);
});
