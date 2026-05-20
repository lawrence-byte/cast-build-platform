const CPC = window.CastProjectControls;
let state = CPC.ensureDrawingIntelligenceState(CPC.loadState());
let selectedDrawingId = state.drawings[0]?.id || '';
let activeTool = 'Pin';

const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const byId = (rows, id) => rows.find((row) => row.id === id);
const actor = () => state.users[0];

function save() {
  CPC.saveState(state);
}

function selectedDrawing() {
  return byId(state.drawings, selectedDrawingId) || state.drawings[0];
}

function renderMetrics() {
  const metrics = CPC.drawingIntelligenceMetrics(state);
  Object.entries(metrics).forEach(([key, value]) => {
    const el = document.querySelector(`[data-metric="${key}"]`);
    if (!el) return;
    el.textContent = key === 'proformaDeltaAmount' ? money(value) : value;
  });
}

function renderSheets() {
  const rows = state.drawings.slice(0, 16);
  document.querySelector('[data-sheet-count]').textContent = `${state.drawings.length} sheets`;
  document.querySelector('[data-sheet-list]').innerHTML = rows.map((drawing) => {
    const markups = state.drawingMarkups.filter((m) => m.drawing_id === drawing.id).length;
    const quantities = state.estimateQuantities.filter((q) => q.drawing_id === drawing.id).length;
    return `<button class="sheet-btn ${drawing.id === selectedDrawingId ? 'active' : ''}" data-sheet="${esc(drawing.id)}">
      <strong>${esc(drawing.drawing_number)} · ${esc(drawing.drawing_title)}</strong>
      <span class="muted">${esc(drawing.discipline)} · Rev ${esc(drawing.current_revision)} · ${markups} markups · ${quantities} AI quantities</span>
    </button>`;
  }).join('');
}

function renderViewer() {
  const drawing = selectedDrawing();
  if (!drawing) return;
  document.querySelector('[data-viewer-title]').textContent = `${drawing.drawing_number} · ${drawing.drawing_title} · Rev ${drawing.current_revision}`;
  document.querySelectorAll('.markup').forEach((el) => el.remove());
  const viewer = document.querySelector('[data-viewer]');
  state.drawingMarkups.filter((m) => m.drawing_id === drawing.id).forEach((markup) => {
    const el = document.createElement('button');
    el.className = `markup ${markup.markup_type || 'pin'}`;
    el.style.left = `${markup.x}%`;
    el.style.top = `${markup.y}%`;
    if (markup.width) el.style.width = `${markup.width}%`;
    if (markup.height) el.style.height = `${markup.height}%`;
    el.title = markup.subject;
    el.dataset.markup = markup.id;
    el.textContent = markup.tool === 'Area Measurement' ? '□' : '!';
    viewer.appendChild(el);
  });
}

function renderMarkups() {
  const drawing = selectedDrawing();
  const rows = state.drawingMarkups.filter((m) => m.drawing_id === drawing?.id);
  document.querySelector('[data-markup-list]').innerHTML = rows.length ? rows.map((m) => {
    const assignee = byId(state.users, m.assignee_user_id);
    return `<article class="comment-card" data-card="${esc(m.id)}">
      <div class="actions"><span class="badge ${m.status === 'Open' ? 'open' : ''}">${esc(m.status)}</span><span class="badge ${m.priority === 'High' || m.priority === 'Urgent' ? 'high' : ''}">${esc(m.priority)}</span></div>
      <h3>${esc(m.subject || m.tool)}</h3>
      <p class="muted">${esc(m.body)}</p>
      <p class="muted"><strong>${esc(m.tool)}</strong> · ${esc(m.trade || 'Unassigned trade')} · ${esc(m.cost_code || 'No cost code')} · Assigned to ${esc(assignee?.name || 'Unassigned')}</p>
      <div class="actions">
        <button class="cb-btn small cb-btn--ghost" data-resolve="${esc(m.id)}">Resolve</button>
        <button class="cb-btn small cb-btn--ghost" data-rfi="${esc(m.id)}">Convert to RFI</button>
      </div>
    </article>`;
  }).join('') : '<p class="muted">No markups on this sheet yet. Click Add Markup to place a comment pin using the selected tool.</p>';
}

function renderQuantities() {
  document.querySelector('[data-quantity-rows]').innerHTML = state.estimateQuantities.map((q) => {
    const statusClass = q.verification_status === 'Verified' ? 'ok' : 'open';
    return `<tr>
      <td><strong>${esc(q.source_sheet)}</strong></td>
      <td>${esc(q.item)}<br><span class="muted">${esc(q.trade)} · ${esc(q.notes)}</span></td>
      <td>${Number(q.quantity).toLocaleString()} ${esc(q.unit)}</td>
      <td>${esc(q.cost_code)}</td>
      <td>${esc(q.ai_tool)}</td>
      <td>${esc(q.confidence)}%</td>
      <td><span class="badge ${statusClass}">${esc(q.verification_status)}</span></td>
      <td>${money(q.proforma_delta_amount)}</td>
      <td>${q.verification_status === 'Verified' ? '<span class="muted">Locked</span>' : `<button class="cb-btn small" data-verify-qty="${esc(q.id)}">Verify</button>`}</td>
    </tr>`;
  }).join('');
}

function renderFindings() {
  document.querySelector('[data-finding-list]').innerHTML = state.estimateFindings.map((f) => `<article class="risk">
    <div class="actions"><span class="badge ${f.severity === 'High' ? 'high' : 'open'}">${esc(f.severity)}</span><span class="badge">${esc(f.finding_type)}</span><span class="badge">${esc(f.status)}</span></div>
    <h3>${esc(f.title)}</h3>
    <p class="muted">${esc(f.body)}</p>
    <p><strong>Suggested action:</strong> ${esc(f.suggested_action)}</p>
  </article>`).join('');
}

function render() {
  CPC.ensureDrawingIntelligenceState(state);
  renderMetrics();
  renderSheets();
  renderViewer();
  renderMarkups();
  renderQuantities();
  renderFindings();
}

function addMarkup() {
  const drawing = selectedDrawing();
  if (!drawing) return;
  const toolMap = { 'Pin': 'pin', 'Cloud + Callout': 'cloud', 'Area Measurement': 'measurement', 'Count': 'pin', 'Overlay Compare': 'cloud' };
  const label = activeTool === 'Area Measurement' ? 'Verify measured quantity' : activeTool === 'Overlay Compare' ? 'Review revision overlay delta' : 'New drawing comment';
  const result = CPC.createDrawingMarkup(state, {
    project_id: drawing.project_id,
    drawing_id: drawing.id,
    revision_id: `dwgrev_${drawing.id}_${drawing.current_revision}`,
    markup_type: toolMap[activeTool] || 'pin',
    tool: activeTool,
    subject: label,
    body: `${activeTool} added in CAST Drawing Intelligence. Route to estimator/PM before budget or RFI write-back.`,
    x: 22 + Math.floor(Math.random() * 54),
    y: 24 + Math.floor(Math.random() * 46),
    priority: activeTool === 'Overlay Compare' ? 'High' : 'Normal',
    trade: drawing.discipline === 'E' ? 'Electrical' : drawing.discipline === 'P' ? 'Plumbing' : drawing.discipline === 'M' ? 'Mechanical' : 'Coordination',
    cost_code: drawing.discipline === 'E' ? '26-0500' : drawing.discipline === 'P' ? '22-0500' : drawing.discipline === 'M' ? '23-0500' : '01-3100',
    assignee_user_id: state.users[2]?.id,
    source: 'CAST Drawing Review'
  }, actor());
  if (result.ok) {
    CPC.createDrawingComment(state, { drawing_id: drawing.id, markup_id: result.markup.id, body: result.markup.body }, actor());
    save();
    window.CASTShell?.toast?.('Drawing markup added to review queue.', { kind: 'success' });
    render();
  }
}

function verifyQuantity(id) {
  const result = CPC.verifyEstimateQuantity(state, id, actor(), { status: 'Verified', notes: 'Verified in CAST estimate log; ready for controlled export.' });
  if (result.ok) {
    save();
    window.CASTShell?.toast?.('AI quantity verified and locked in CAST estimate log.', { kind: 'success' });
    render();
  }
}

function resolveMarkup(id) {
  const result = CPC.updateDrawingIssueStatus(state, id, 'Resolved', actor());
  if (result.ok) {
    save();
    render();
  }
}

function exportCsv() {
  const rows = state.drawingMarkups.map((m) => {
    const drawing = byId(state.drawings, m.drawing_id);
    const assignee = byId(state.users, m.assignee_user_id);
    return {
      drawing_number: drawing?.drawing_number || m.drawing_id,
      drawing_title: drawing?.drawing_title || '',
      subject: m.subject,
      tool: m.tool,
      status: m.status,
      priority: m.priority,
      trade: m.trade,
      cost_code: m.cost_code,
      assignee: assignee?.name || '',
      body: m.body,
    };
  });
  if (window.CastXlsxExport) {
    window.CastXlsxExport.downloadXlsx('cast-drawing-review-markups.xlsx', 'Drawing Review', [
      { key: 'drawing_number', header: 'Drawing Number' },
      { key: 'drawing_title', header: 'Drawing Title', width: 30 },
      { key: 'subject', header: 'Subject', width: 34 },
      { key: 'tool', header: 'Tool' },
      { key: 'status', header: 'Status' },
      { key: 'priority', header: 'Priority' },
      { key: 'trade', header: 'Trade' },
      { key: 'cost_code', header: 'Cost Code' },
      { key: 'assignee', header: 'Assignee', width: 24 },
      { key: 'body', header: 'Notes', width: 50 },
    ], rows);
    return;
  }
  const csv = CPC.exportDrawingReviewCsv(state);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cast-drawing-review-markups.csv';
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('click', (event) => {
  const sheet = event.target.closest('[data-sheet]');
  if (sheet) {
    selectedDrawingId = sheet.dataset.sheet;
    render();
    return;
  }
  const tool = event.target.closest('[data-tool]');
  if (tool) {
    activeTool = tool.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach((el) => el.classList.toggle('active', el === tool));
    return;
  }
  if (event.target.closest('[data-add-markup]')) addMarkup();
  const verify = event.target.closest('[data-verify-qty]');
  if (verify) verifyQuantity(verify.dataset.verifyQty);
  const resolve = event.target.closest('[data-resolve]');
  if (resolve) resolveMarkup(resolve.dataset.resolve);
  const rfi = event.target.closest('[data-rfi]');
  if (rfi) window.CASTShell?.toast?.('RFI conversion queued as draft-only; no external write-back enabled.', { kind: 'info' });
  if (event.target.closest('[data-export]')) exportCsv();
  if (event.target.closest('[data-reset]')) {
    state = CPC.ensureDrawingIntelligenceState(CPC.resetState());
    selectedDrawingId = state.drawings[0]?.id || '';
    render();
  }
});

render();
