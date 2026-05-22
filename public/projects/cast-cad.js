const CPC = window.CastProjectControls;
const CURRENT_DRAWING_INDEX_URL = '/safe-data/projects/golden-hill/procore-information/procore-data-tie-index.json';
const DRAWING_STATE_KEY = `${CPC.STORAGE_KEY || 'cast-project-controls-v1'}:cad-current-set-linked`;
const SCALES_KEY = `${CPC.STORAGE_KEY || 'cast-project-controls-v1'}:cad-sheet-scales`;
const VIEWER_PREFS_KEY = `${CPC.STORAGE_KEY || 'cast-project-controls-v1'}:cad-viewer-preferences`;

let state = CPC.ensureDrawingIntelligenceState(CPC.loadState());
let selectedDrawingId = state.drawings[0]?.id || '';
let activeTool = 'Pin';
let uploadedPdfUrl = '';
let uploadedPdfName = '';
let streamedPdfUrl = '';
let streamedPdfName = '';
let drawingStreamState = { drawingId: '', status: 'idle', message: '' };
let currentSetMeta = { status: 'loading', count: 0, disciplines: [] };
let sheetFilter = '';
let drawingScales = loadDrawingScales();
let viewerPreferences = loadViewerPreferences();
let calibration = null;

const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const byId = (rows, id) => rows.find((row) => row.id === id);
const actor = () => state.users[0];

function save() { CPC.saveState(state); }
function selectedDrawing() { return byId(state.drawings, selectedDrawingId) || state.drawings[0]; }
function hasUploadedPdf() { return Boolean(uploadedPdfUrl); }
function defaultViewerPreferences() { return { layout: 'single-page', zoomMode: 'fit-width', showThumbnails: true, showBookmarks: false, showPageLabels: true, splitView: false, sideBySide: false, keyboardShortcuts: true, searchPanelOpen: false }; }
function normalizeViewerPreferences(input = {}) {
  const base = defaultViewerPreferences();
  const layout = ['single-page','continuous','split-view','side-by-side'].includes(input.layout) ? input.layout : base.layout;
  return {
    ...base,
    ...input,
    layout,
    zoomMode: ['fit-width','fit-page','actual-size'].includes(input.zoomMode) ? input.zoomMode : base.zoomMode,
    splitView: input.splitView !== undefined ? Boolean(input.splitView) : layout === 'split-view',
    sideBySide: input.sideBySide !== undefined ? Boolean(input.sideBySide) : layout === 'side-by-side',
  };
}
function loadViewerPreferences() { try { return normalizeViewerPreferences(JSON.parse(localStorage.getItem(VIEWER_PREFS_KEY) || '{}')); } catch { return defaultViewerPreferences(); } }
function saveViewerPreferencesLocal() { try { localStorage.setItem(VIEWER_PREFS_KEY, JSON.stringify(viewerPreferences)); } catch {} }
function loadDrawingScales() { try { return JSON.parse(localStorage.getItem(SCALES_KEY) || '{}'); } catch { return {}; } }
function saveDrawingScales() { try { localStorage.setItem(SCALES_KEY, JSON.stringify(drawingScales)); } catch {} }
function currentScale() { return drawingScales[selectedDrawingId] || null; }

function clearUploadedPdf() {
  if (uploadedPdfUrl) URL.revokeObjectURL(uploadedPdfUrl);
  uploadedPdfUrl = '';
  uploadedPdfName = '';
  const input = document.querySelector('[data-pdf-input]');
  if (input) input.value = '';
}
function clearStreamedPdf() {
  if (streamedPdfUrl) URL.revokeObjectURL(streamedPdfUrl);
  streamedPdfUrl = '';
  streamedPdfName = '';
}
function activePdfUrl() { return uploadedPdfUrl || streamedPdfUrl; }
function activePdfName() { return uploadedPdfName || streamedPdfName; }

function slugId(input, fallback) {
  return `alum_${String(input || fallback || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80)}`;
}
function drawingNumberFromName(name) {
  const base = String(name || '').replace(/\.pdf$/i, '');
  const match = base.match(/^([A-Z]+[_-]?\d+(?:\.\d+)?)/i);
  return match ? match[1].replace('_', '-') : base.slice(0, 32);
}
function titleFromName(name) {
  return String(name || '').replace(/\.pdf$/i, '').replace(/^[A-Z]+[_-]?\d+(?:\.\d+)?[-_]?/i, '').replace(/[-_]+/g, ' ').replace(/\bRev\.?\s*\d+\b/i, '').trim() || 'Drawing sheet';
}
function revisionFromName(name) {
  return String(name || '').match(/Rev\.?\s*(\d+)/i)?.[1] || '0';
}
function disciplineFromPath(path) {
  return String(path || '').split('/')[1] || 'Current Drawings';
}
function currentDrawingFiles(index) {
  return (index.files || [])
    .filter((file) => file.topFolder === 'Current Drawings' && file.extension === 'pdf')
    .filter((file) => /\//.test(file.path || ''))
    .sort((a, b) => String(a.path).localeCompare(String(b.path), undefined, { numeric: true }));
}
function convertFileToDrawing(file, i) {
  const discipline = disciplineFromPath(file.path);
  const drawingNumber = drawingNumberFromName(file.name);
  return {
    id: slugId(file.path, `sheet_${i}`),
    project_id: 'alum',
    drawing_number: drawingNumber,
    drawing_title: titleFromName(file.name),
    discipline,
    current_revision: revisionFromName(file.name),
    drawing_date: String(file.modifiedAt || '').slice(0, 10),
    received_date: String(file.modifiedAt || '').slice(0, 10),
    set_name: 'Alüm Current Drawings',
    area: discipline,
    status: 'Current',
    file_url: '',
    source_path: file.path,
    source_name: file.name,
    source_size_label: file.sizeLabel || '',
    source_boundary: 'private-current-drawing-set',
    created_at: String(file.modifiedAt || new Date().toISOString()).slice(0, 10),
    updated_at: String(file.modifiedAt || new Date().toISOString()).slice(0, 10),
  };
}
function linkCurrentDrawingSet(index, { force = false } = {}) {
  const files = currentDrawingFiles(index);
  if (!files.length) return { ok: false, count: 0 };
  const drawings = files.map(convertFileToDrawing);
  const existingById = new Map((state.drawings || []).map((drawing) => [drawing.id, drawing]));
  const merged = drawings.map((drawing) => ({ ...(existingById.get(drawing.id) || {}), ...drawing }));
  const nonAlum = force ? (state.drawings || []).filter((drawing) => !String(drawing.id).startsWith('alum_')) : [];
  state.drawings = force ? [...merged, ...nonAlum] : [...merged, ...state.drawings.filter((drawing) => !String(drawing.id).startsWith('alum_'))];
  state.drawingSets = [
    ...(state.drawingSets || []).filter((set) => set.id !== 'alum-current-drawings'),
    { id: 'alum-current-drawings', project_id: 'alum', name: 'Alüm Current Drawings', sheet_count: drawings.length, source_index: CURRENT_DRAWING_INDEX_URL },
  ];
  selectedDrawingId = state.drawings.find((drawing) => String(drawing.id).startsWith('alum_'))?.id || selectedDrawingId;
  currentSetMeta = {
    status: 'loaded',
    count: drawings.length,
    disciplines: [...new Set(drawings.map((drawing) => drawing.discipline))].sort(),
  };
  try { localStorage.setItem(DRAWING_STATE_KEY, 'true'); } catch {}
  save();
  return { ok: true, count: drawings.length };
}
async function loadCurrentDrawingSet({ force = false, toast = false } = {}) {
  try {
    const response = await fetch(CURRENT_DRAWING_INDEX_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    const result = linkCurrentDrawingSet(index, { force });
    if (!result.ok) throw new Error('No current drawing PDFs found in metadata index.');
    if (toast) window.CASTShell?.toast?.(`Linked ${result.count} current drawing sheets.`, { kind: 'success' });
  } catch (error) {
    currentSetMeta = { status: 'error', count: 0, disciplines: [] };
    console.warn('Could not link current drawing set', error);
    if (toast) window.CASTShell?.toast?.('Could not load current drawing set metadata.', { kind: 'error' });
  }
  render();
  loadSelectedDrawingPdf({ toast: false });
}

function renderMetrics() {
  const metrics = CPC.drawingIntelligenceMetrics(state);
  Object.entries(metrics).forEach(([key, value]) => {
    const el = document.querySelector(`[data-metric="${key}"]`);
    if (!el) return;
    el.textContent = key === 'proformaDeltaAmount' ? money(value) : value;
  });
}
function renderArchitectureScaffold() {
  const snapshot = CPC.castCadArchitectureSnapshot?.() || { modules: [], agents: [], featureFlags: [] };
  const modules = document.querySelector('[data-cad-modules]');
  if (modules) {
    const navOrder = ['Projects','Drawing Sets','Documents','Review Sessions','Markups','Takeoffs','Comparisons','RFIs','Submittals','Field Photos','Punch','Reports','AI Review','Admin'];
    modules.innerHTML = navOrder.map((label) => {
      const normalized = label.toLowerCase().replace(/[^a-z]/g, '');
      const match = snapshot.modules.find((module) => normalized.includes(module.label.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8)) || module.label.toLowerCase().includes(label.toLowerCase().split(' ')[0]));
      const status = match?.status || (['Projects','Documents','RFIs','Submittals','Markups','Takeoffs','Drawing Sets'].includes(label) ? 'mvp-active' : 'flagged-roadmap');
      return `<span class="badge ${status === 'mvp-active' ? 'ok' : ''}" title="${esc(status)}">${esc(label)}</span>`;
    }).join('');
  }
  const agents = document.querySelector('[data-ai-agents]');
  if (agents) {
    agents.innerHTML = snapshot.agents.slice(0, 10).map((agent) => `<div class="tool-card"><em>${esc(agent.enabled ? 'Enabled' : 'Feature flag')}</em><strong>${esc(agent.name)}</strong><span>${esc(agent.guardrail)} · cite source sheet/page/OCR/markup/document before user approval.</span></div>`).join('');
  }
}
function renderCurrentSetSummary() {
  const summary = document.querySelector('[data-current-set-summary]');
  if (!summary) return;
  if (currentSetMeta.status === 'loaded') {
    summary.textContent = `${currentSetMeta.count.toLocaleString()} current PDF sheets linked from metadata · ${currentSetMeta.disciplines.slice(0, 7).join(', ')}${currentSetMeta.disciplines.length > 7 ? '…' : ''}`;
  } else if (currentSetMeta.status === 'error') {
    summary.textContent = 'Metadata link failed; sample seed drawings remain available.';
  } else {
    summary.textContent = 'Loading current drawing set metadata…';
  }
}

const MARKUP_TOOLS = [
  { tool: 'Pin', label: 'Pin', icon: '<path d="M12 3a4 4 0 0 1 4 4c0 3-4 8-4 8S8 10 8 7a4 4 0 0 1 4-4Z"/><circle cx="12" cy="7" r="1.3"/><path d="M12 15v6"/>' },
  { tool: 'Cloud + Callout', label: 'Cloud', icon: '<path d="M7.5 16.5h8.8a3.2 3.2 0 0 0 .6-6.3 4.8 4.8 0 0 0-9.1-1.6A4 4 0 0 0 7.5 16.5Z"/><path d="M14 16.5l4 4"/>' },
  { tool: 'Text Box', label: 'Text', icon: '<rect x="5" y="5" width="14" height="14" rx="1.5"/><path d="M8 9h8M12 9v7"/>' },
  { tool: 'Highlight', label: 'Highlight', icon: '<path d="M6 16l7.5-7.5 2 2L8 18H6v-2Z"/><path d="M14 8l1.5-1.5 2 2L16 10"/><path d="M5 20h14"/>' },
  { tool: 'Arrow', label: 'Arrow', icon: '<path d="M5 19L19 5"/><path d="M11 5h8v8"/>' },
  { tool: 'Line Measurement', label: 'Length', icon: '<path d="M5 17L19 7"/><path d="M6 13l3 4M15 7l3 4"/><path d="M7 21h10"/>' },
  { tool: 'Area Measurement', label: 'Area', icon: '<rect x="5" y="6" width="14" height="12" rx="1.5"/><path d="M8 15h8M8 12h8M8 9h8"/>' },
  { tool: 'Count', label: 'Count', icon: '<circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="8" r="2.5"/><circle cx="8" cy="16" r="2.5"/><path d="M15 16h4M17 14v4"/>' },
  { tool: 'Overlay Compare', label: 'Overlay', icon: '<rect x="5" y="7" width="10" height="10" rx="1.5"/><rect x="9" y="5" width="10" height="10" rx="1.5"/><path d="M9 17l10-10"/>' },
];
function renderMarkupToolbar() {
  const bar = document.querySelector('[data-markup-toolbar]');
  if (!bar) return;
  bar.innerHTML = MARKUP_TOOLS.map((item) => `<button class="tool icon-tool ${item.tool === activeTool ? 'active' : ''}" type="button" data-tool="${esc(item.tool)}" aria-label="${esc(item.label)} markup tool" title="${esc(item.label)}"><svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg><span class="tool-label">${esc(item.label)}</span></button>`).join('');
}
function renderDrawingSheet(drawing) {
  const plan = document.querySelector('[data-drawing-sheet]');
  if (!plan || !drawing) return;
  const streamText = drawingStreamState.drawingId === drawing.id ? drawingStreamState.message : '';
  plan.innerHTML = `
    <div class="drawing-sheet-meta">
      <span>${esc(drawing.discipline || 'Drawing')}</span>
      <strong>${esc(drawing.drawing_number || drawing.source_name || 'Sheet')}</strong>
      <small>${esc(drawing.source_name || drawing.drawing_title || 'Selected drawing')}</small>
      ${streamText ? `<em>${esc(streamText)}</em>` : ''}
    </div>
    <div class="drawing-sheet-grid" aria-hidden="true">
      <span></span><span></span><span></span><span></span><span></span><span></span>
    </div>`;
}
function renderSheets() {
  const query = sheetFilter.trim().toLowerCase();
  const filtered = query ? state.drawings.filter((drawing) => `${drawing.drawing_number} ${drawing.drawing_title} ${drawing.discipline} ${drawing.source_name || ''} ${drawing.source_path || ''}`.toLowerCase().includes(query)) : state.drawings;
  const rows = filtered.slice(0, 100);
  const countEl = document.querySelector('[data-sheet-count]');
  if (countEl) countEl.textContent = `${rows.length.toLocaleString()} of ${filtered.length.toLocaleString()} shown${query ? ' · filtered' : ''}`;
  const filterEl = document.querySelector('[data-sheet-filter]');
  if (filterEl && filterEl.value !== sheetFilter) filterEl.value = sheetFilter;
  const list = document.querySelector('[data-sheet-list]');
  if (!list) return;
  if (!rows.length) { list.innerHTML = '<p class="cad-muted">No sheets match the current filter.</p>'; return; }
  list.innerHTML = rows.map((drawing) => {
    const markups = state.drawingMarkups.filter((m) => m.drawing_id === drawing.id).length;
    const quantities = state.estimateQuantities.filter((q) => q.drawing_id === drawing.id).length;
    const linked = drawing.source_boundary ? ' · linked current set' : '';
    return `<button class="sheet-btn ${drawing.id === selectedDrawingId ? 'active' : ''}" type="button" data-sheet="${esc(drawing.id)}" aria-pressed="${drawing.id === selectedDrawingId ? 'true' : 'false'}">
      <strong>${esc(drawing.drawing_number)} · ${esc(drawing.drawing_title)}</strong>
      <span class="muted">${esc(drawing.discipline)} · Rev ${esc(drawing.current_revision)} · ${markups} markups · ${quantities} quantities${linked}</span>
    </button>`;
  }).join('');
}
function renderScaleStatus() {
  const el = document.querySelector('[data-scale-status]');
  if (!el) return;
  const scale = currentScale();
  if (calibration?.drawingId === selectedDrawingId) {
    el.textContent = calibration.first ? 'Click second calibration point on the drawing.' : 'Click first calibration point on the drawing.';
  } else if (scale) {
    el.textContent = `Scale set: ${scale.knownLength} ${scale.unit} = ${scale.percentDistance.toFixed(2)}% screen distance.`;
  } else {
    el.textContent = 'Scale not calibrated for this sheet.';
  }
}
function renderViewerPreferences() {
  const layout = document.querySelector('[data-viewer-layout]');
  const zoom = document.querySelector('[data-viewer-zoom]');
  if (layout) layout.value = viewerPreferences.layout;
  if (zoom) zoom.value = viewerPreferences.zoomMode;
  ['showThumbnails','showBookmarks','showPageLabels','keyboardShortcuts','searchPanelOpen'].forEach((key) => {
    const el = document.querySelector(`[data-viewer-pref="${key}"]`);
    if (el) el.checked = Boolean(viewerPreferences[key]);
  });
  const status = document.querySelector('[data-viewer-pref-status]');
  if (status) status.textContent = `${viewerPreferences.layout.replace(/-/g, ' ')} · ${viewerPreferences.zoomMode.replace(/-/g, ' ')} · thumbnails ${viewerPreferences.showThumbnails ? 'on' : 'off'} · shortcuts ${viewerPreferences.keyboardShortcuts ? 'on' : 'off'}`;
  const viewer = document.querySelector('[data-viewer]');
  if (viewer) {
    viewer.dataset.layout = viewerPreferences.layout;
    viewer.dataset.zoomMode = viewerPreferences.zoomMode;
    viewer.dataset.pageLabels = String(Boolean(viewerPreferences.showPageLabels));
    viewer.dataset.streamStatus = drawingStreamState.status || 'idle';
  }
}
function viewerPreferencePayload() {
  return {
    layout: document.querySelector('[data-viewer-layout]')?.value || viewerPreferences.layout,
    zoomMode: document.querySelector('[data-viewer-zoom]')?.value || viewerPreferences.zoomMode,
    showThumbnails: Boolean(document.querySelector('[data-viewer-pref="showThumbnails"]')?.checked),
    showBookmarks: Boolean(document.querySelector('[data-viewer-pref="showBookmarks"]')?.checked),
    showPageLabels: Boolean(document.querySelector('[data-viewer-pref="showPageLabels"]')?.checked),
    keyboardShortcuts: Boolean(document.querySelector('[data-viewer-pref="keyboardShortcuts"]')?.checked),
    searchPanelOpen: Boolean(document.querySelector('[data-viewer-pref="searchPanelOpen"]')?.checked),
  };
}
async function persistViewerPreferences({ toast = false } = {}) {
  viewerPreferences = normalizeViewerPreferences(viewerPreferencePayload());
  saveViewerPreferencesLocal();
  renderViewerPreferences();
  try {
    const response = await fetch('/api/cast-cad-markups', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ action: 'preferences', projectId: selectedDrawing()?.project_id || 'alum', preferences: viewerPreferences }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `HTTP ${response.status}`);
    if (toast) window.CASTShell?.toast?.('Viewer preferences saved for this CAST CAD user.', { kind: 'success' });
  } catch (error) {
    console.warn('Could not persist CAST CAD viewer preferences to API', error);
    if (toast) window.CASTShell?.toast?.('Viewer preferences saved locally; backend preferences API is unavailable.', { kind: 'info' });
  }
}
async function loadServerViewerPreferences() {
  try {
    const response = await fetch('/api/cast-cad-markups?action=preferences&projectId=alum', { headers: { accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json();
    if (response.ok && payload?.ok && payload.preferences) {
      viewerPreferences = normalizeViewerPreferences(payload.preferences);
      saveViewerPreferencesLocal();
      renderViewerPreferences();
    }
  } catch (error) { console.warn('Could not load CAST CAD server viewer preferences', error); }
}
function renderPdfStage() {
  const viewer = document.querySelector('[data-viewer]');
  const stage = document.querySelector('[data-pdf-stage]');
  const frame = document.querySelector('[data-pdf-frame]');
  const status = document.querySelector('[data-pdf-status]');
  const drawing = selectedDrawing();
  const pdfUrl = activePdfUrl();
  const usingPdf = Boolean(pdfUrl);
  viewer?.classList.toggle('has-pdf', usingPdf);
  if (stage) stage.hidden = !usingPdf;
  if (frame) frame.data = usingPdf ? pdfUrl : '';
  if (status) {
    if (usingPdf) status.textContent = `Viewing ${activePdfName()} · click the overlay to place CAST markups.`;
    else if (drawingStreamState.drawingId === drawing?.id && drawingStreamState.message) status.textContent = drawingStreamState.message;
    else if (drawing?.source_boundary) status.textContent = `Linked: ${drawing.source_name || drawing.drawing_number} · loading authenticated PDF stream…`;
    else status.textContent = 'No PDF stream · using sample plan overlay';
  }
  renderDrawingSheet(drawing);
  renderScaleStatus();
}
function markupLabel(markup) {
  if (markup.measurement_value) return `${Number(markup.measurement_value).toLocaleString()} ${markup.measurement_unit || ''}`.trim();
  if (markup.tool === 'Count') return '1';
  if (markup.tool === 'Area Measurement') return '□';
  if (markup.tool === 'Line Measurement') return '—';
  return '!';
}
function renderViewer() {
  const drawing = selectedDrawing();
  if (!drawing) return;
  document.querySelector('[data-viewer-title]').textContent = `${drawing.drawing_number} · ${drawing.drawing_title} · Rev ${drawing.current_revision}`;
  document.querySelectorAll('.markup').forEach((el) => el.remove());
  renderPdfStage();
  renderCurrentSetSummary();
  renderViewerPreferences();
  const viewer = document.querySelector('[data-viewer]');
  const annotationLayer = document.querySelector('[data-annotation-layer]');
  const targetLayer = activePdfUrl() && annotationLayer ? annotationLayer : viewer;
  state.drawingMarkups.filter((m) => m.drawing_id === drawing.id).forEach((markup) => {
    const el = document.createElement('button');
    el.className = `markup ${markup.markup_type || 'pin'}`;
    el.style.left = `${markup.x}%`;
    el.style.top = `${markup.y}%`;
    if (markup.width) el.style.width = `${markup.width}%`;
    if (markup.height) el.style.height = `${markup.height}%`;
    const style = markup.style || {};
    if (style.stroke) el.style.borderColor = style.stroke;
    if (style.fill) el.style.background = style.fill;
    if (style.opacity) el.style.opacity = String(style.opacity);
    if (style.line_width) el.style.borderWidth = `${style.line_width}px`;
    if (style.font_size) el.style.fontSize = `${style.font_size}px`;
    el.title = `${markup.subject}${markup.layer ? ` · layer ${markup.layer}` : ''}${markup.group_id ? ` · group ${markup.group_id}` : ''}`;
    el.dataset.markup = markup.id;
    if (markup.layer) el.dataset.layer = markup.layer;
    if (markup.group_id) el.dataset.group = markup.group_id;
    el.textContent = markupLabel(markup);
    targetLayer.appendChild(el);
  });
}
function renderMarkups() {
  const drawing = selectedDrawing();
  const rows = state.drawingMarkups.filter((m) => m.drawing_id === drawing?.id);
  document.querySelector('[data-markup-list]').innerHTML = rows.length ? rows.map((m) => {
    const assignee = byId(state.users, m.assignee_user_id);
    const measurement = m.measurement_value ? `<p class="muted"><strong>Takeoff:</strong> ${Number(m.measurement_value).toLocaleString()} ${esc(m.measurement_unit || '')} · scale ${esc(m.scale_label || 'sheet scale')}</p>` : '';
    return `<article class="comment-card" data-card="${esc(m.id)}">
      <div class="actions"><span class="badge ${m.status === 'Open' ? 'open' : ''}">${esc(m.status)}</span><span class="badge ${m.priority === 'High' || m.priority === 'Urgent' ? 'high' : ''}">${esc(m.priority)}</span></div>
      <h3>${esc(m.subject || m.tool)}</h3>
      <p class="muted">${esc(m.body)}</p>
      ${measurement}
      <p class="muted"><strong>${esc(m.tool)}</strong> · ${esc(m.trade || 'Unassigned trade')} · ${esc(m.cost_code || 'No cost code')} · Layer ${esc(m.layer || 'Default')}${m.group_id ? ` · Group ${esc(m.group_id)}` : ''} · Assigned to ${esc(assignee?.name || 'Unassigned')}</p>
      <div class="actions">
        <button class="cb-btn small cb-btn--ghost" data-resolve="${esc(m.id)}">Resolve</button>
        <button class="cb-btn small cb-btn--ghost" data-rfi="${esc(m.id)}">Convert to RFI</button>
      </div>
    </article>`;
  }).join('') : '<p class="muted">No markups on this sheet yet. Click Add Markup or click the drawing overlay to place a comment, measurement, count, cloud, or takeoff item.</p>';
}
function renderQuantities() {
  document.querySelector('[data-quantity-rows]').innerHTML = state.estimateQuantities.map((q) => {
    const statusClass = q.verification_status === 'Verified' ? 'ok' : 'open';
    const measured = q.measured_quantity !== undefined && q.measured_quantity !== q.quantity ? `<br><span class="muted">Measured ${Number(q.measured_quantity).toLocaleString()} ${esc(q.unit)} · ${esc(q.notes)}</span>` : `<br><span class="muted">${esc(q.trade)} · ${esc(q.notes)}</span>`;
    return `<tr>
      <td><strong>${esc(q.source_sheet)}</strong></td>
      <td>${esc(q.item)}<br><span class="muted">${esc(q.assembly_label || q.trade || 'Unmapped assembly')} · ${esc(q.trade)}</span>${measured}</td>
      <td>${Number(q.quantity).toLocaleString(undefined, { maximumFractionDigits: Number(q.precision ?? 2) })} ${esc(q.unit)}</td>
      <td>${esc(q.cost_code)}</td>
      <td>${esc(q.formula || q.ai_tool || 'quantity')}</td>
      <td>${q.unit_cost !== undefined ? money(q.unit_cost) : '<span class="muted">—</span>'}</td>
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
  renderArchitectureScaffold();
  renderMarkupToolbar();
  renderSheets();
  renderViewer();
  renderMarkups();
  renderQuantities();
  renderFindings();
}
function measurementFor(tool, x, y) {
  const scale = currentScale();
  if (!['Line Measurement', 'Area Measurement', 'Count'].includes(tool)) return {};
  if (tool === 'Count') return { measurement_value: 1, measurement_unit: 'EA', scale_label: 'count item' };
  if (!scale) return { measurement_value: 0, measurement_unit: tool === 'Area Measurement' ? 'SF' : 'LF', scale_label: 'scale required' };
  const dx = Math.abs(x - 50) || 12;
  const dy = Math.abs(y - 50) || 8;
  const unitsPerPercent = scale.knownLength / scale.percentDistance;
  if (tool === 'Line Measurement') return { measurement_value: Number((Math.hypot(dx, dy) * unitsPerPercent).toFixed(2)), measurement_unit: scale.unit === 'IN' ? 'IN' : 'LF', scale_label: `${scale.knownLength} ${scale.unit}` };
  return { measurement_value: Number((dx * unitsPerPercent * dy * unitsPerPercent).toFixed(2)), measurement_unit: scale.unit === 'IN' ? 'SQ IN' : 'SF', scale_label: `${scale.knownLength} ${scale.unit}` };
}
function markupDefaults(drawing, x, y) {
  const toolMap = { 'Pin': 'pin', 'Cloud + Callout': 'cloud', 'Text Box': 'pin', 'Highlight': 'cloud', 'Arrow': 'pin', 'Line Measurement': 'measurement', 'Area Measurement': 'measurement', 'Count': 'pin', 'Overlay Compare': 'cloud' };
  const label = activeTool === 'Area Measurement' ? 'Measured area takeoff' : activeTool === 'Line Measurement' ? 'Measured length takeoff' : activeTool === 'Count' ? 'Count takeoff item' : activeTool === 'Overlay Compare' ? 'Review revision overlay delta' : 'New drawing comment';
  const measurement = measurementFor(activeTool, x, y);
  return {
    project_id: drawing.project_id,
    drawing_id: drawing.id,
    revision_id: `dwgrev_${drawing.id}_${drawing.current_revision}`,
    markup_type: toolMap[activeTool] || 'pin',
    tool: activeTool,
    subject: label,
    body: `${activeTool} added in CAST CAD. Route to estimator/PM before budget, RFI, or PDF write-back.`,
    x, y,
    width: activeTool.includes('Measurement') || activeTool === 'Highlight' ? 18 : 0,
    height: activeTool === 'Area Measurement' || activeTool === 'Highlight' ? 12 : 0,
    priority: activeTool === 'Overlay Compare' ? 'High' : 'Normal',
    trade: ['Electrical', 'Plumbing', 'Mechanical'].find((trade) => drawing.discipline?.includes(trade)) || (drawing.discipline === 'Electrical' ? 'Electrical' : drawing.discipline === 'Plumbing' ? 'Plumbing' : drawing.discipline === 'Mechanical' ? 'Mechanical' : 'Coordination'),
    cost_code: drawing.discipline === 'Electrical' ? '26-0500' : drawing.discipline === 'Plumbing' ? '22-0500' : drawing.discipline === 'Mechanical' ? '23-0500' : '01-3100',
    assignee_user_id: state.users[2]?.id,
    source: uploadedPdfUrl ? 'CAST PDF Overlay' : drawing.source_boundary ? 'CAST Current Drawing Set Overlay' : 'CAST Drawing Review',
    ...measurement,
  };
}
function takeoffInputs() {
  return {
    assemblyKey: document.querySelector('[data-takeoff-assembly]')?.value || 'coordination',
    caption: document.querySelector('[data-takeoff-caption]')?.value.trim() || '',
    precision: Number(document.querySelector('[data-takeoff-precision]')?.value ?? 2),
    formula: document.querySelector('[data-takeoff-formula]')?.value.trim() || '',
    unitCost: document.querySelector('[data-takeoff-unit-cost]')?.value === '' ? null : Number(document.querySelector('[data-takeoff-unit-cost]')?.value),
  };
}
function rgbaFromHex(hex, opacity = 0.16) {
  const clean = String(hex || '#f97316').replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  if (Number.isNaN(n)) return `rgba(249,115,22,${opacity})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
}
function markupStyleInputs() {
  const stroke = document.querySelector('[data-markup-stroke]')?.value || '#f97316';
  const fill = document.querySelector('[data-markup-fill]')?.value || stroke;
  const opacity = Math.max(0.1, Math.min(1, Number(document.querySelector('[data-markup-opacity]')?.value || 1)));
  return {
    layer: document.querySelector('[data-markup-layer]')?.value.trim() || 'Default',
    group_id: document.querySelector('[data-markup-group]')?.value.trim() || '',
    style: {
      stroke,
      fill: rgbaFromHex(fill, Math.min(opacity, 0.24)),
      opacity,
      line_width: Math.max(1, Number(document.querySelector('[data-markup-line-width]')?.value || 2)),
      font_size: Math.max(8, Number(document.querySelector('[data-markup-font-size]')?.value || 12)),
    },
  };
}
function createMarkupAt(x, y) {
  const drawing = selectedDrawing();
  if (!drawing) return;
  const takeoff = takeoffInputs();
  const defaults = { ...markupDefaults(drawing, x, y), ...markupStyleInputs() };
  if (takeoff.caption && ['Line Measurement', 'Area Measurement', 'Count'].includes(activeTool)) defaults.subject = takeoff.caption;
  const result = CPC.createDrawingMarkup(state, defaults, actor());
  if (result.ok) {
    CPC.createDrawingComment(state, { drawing_id: drawing.id, markup_id: result.markup.id, body: result.markup.body }, actor());
    if (result.markup.measurement_value || result.markup.tool === 'Count') {
      state.estimateQuantities.unshift(CPC.buildCastCadTakeoffRow(state, { drawing, markup: result.markup, ...takeoff }));
    }
    save();
    window.CASTShell?.toast?.('Drawing markup added to review queue.', { kind: 'success' });
    render();
  }
}
function addMarkup() { createMarkupAt(22 + Math.floor(Math.random() * 54), 24 + Math.floor(Math.random() * 46)); }
function percentPoint(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(2, Math.min(98, ((event.clientY - rect.top) / rect.height) * 100)),
  };
}
function handleCalibrationClick(point) {
  if (!calibration || calibration.drawingId !== selectedDrawingId) return false;
  if (!calibration.first) {
    calibration.first = point;
    renderScaleStatus();
    return true;
  }
  const knownLength = Number(document.querySelector('[data-scale-known]')?.value || 0);
  const unit = document.querySelector('[data-scale-unit]')?.value || 'FT';
  const percentDistance = Math.hypot(point.x - calibration.first.x, point.y - calibration.first.y);
  if (knownLength > 0 && percentDistance > 0) {
    drawingScales[selectedDrawingId] = { knownLength, unit, percentDistance, calibratedAt: new Date().toISOString() };
    saveDrawingScales();
    window.CASTShell?.toast?.('Sheet scale calibrated. Length, area, and count takeoffs are now enabled for this sheet.', { kind: 'success' });
  }
  calibration = null;
  render();
  return true;
}
function addMarkupFromOverlay(event) {
  const interactive = event.target.closest('[data-annotation-layer], [data-viewer]');
  if (!interactive) return;
  if (event.target.closest('[data-markup]')) return;
  const point = percentPoint(event);
  if (handleCalibrationClick(point)) return;
  createMarkupAt(Number(point.x.toFixed(1)), Number(point.y.toFixed(1)));
}

function selectedDrawingPdfEndpoint(mode = 'view') {
  const drawing = selectedDrawing();
  if (!drawing?.source_path) return '';
  const params = new URLSearchParams({ sheetId: drawing.source_path, mode });
  return `/api/cast-cad-pdf-stream?${params.toString()}`;
}
async function fetchSelectedPdfContract() {
  const endpoint = selectedDrawingPdfEndpoint('edit');
  if (!endpoint) return null;
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : { ok: response.ok, error: await response.text() };
}
function openSelectedPdf() {
  const endpoint = selectedDrawingPdfEndpoint('view');
  if (!endpoint) { window.CASTShell?.toast?.('Select a linked drawing sheet first.', { kind: 'error' }); return; }
  window.open(endpoint, '_blank', 'noopener,noreferrer');
}
async function openSelectedEditLink() {
  const drawing = selectedDrawing();
  if (!drawing?.source_path) { window.CASTShell?.toast?.('Select a linked drawing sheet first.', { kind: 'error' }); return; }
  try {
    const payload = await fetchSelectedPdfContract();
    const editUrl = payload?.contract?.editUrl || payload?.editUrl || '';
    if (editUrl) { window.open(editUrl, '_blank', 'noopener,noreferrer'); return; }
    window.CASTShell?.toast?.('Editable server drawing link is not configured yet for this sheet.', { kind: 'error' });
  } catch (error) {
    console.warn('Could not open editable drawing link', error);
    window.CASTShell?.toast?.('Could not request the editable server drawing link.', { kind: 'error' });
  }
}
async function loadSelectedDrawingPdf({ toast = false } = {}) {
  const drawing = selectedDrawing();
  if (!drawing || !drawing.source_path || hasUploadedPdf()) return;
  const requestId = drawing.id;
  clearStreamedPdf();
  drawingStreamState = { drawingId: requestId, status: 'loading', message: `Loading ${drawing.source_name || drawing.drawing_number}…` };
  renderPdfStage();
  try {
    const endpoint = selectedDrawingPdfEndpoint('view');
    const response = await fetch(endpoint, { headers: { Accept: 'application/pdf, application/json' }, cache: 'no-store' });
    if (selectedDrawingId !== requestId) return;
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/pdf')) {
      const blob = await response.blob();
      streamedPdfUrl = URL.createObjectURL(blob);
      streamedPdfName = drawing.source_name || drawing.drawing_number || 'drawing.pdf';
      drawingStreamState = { drawingId: requestId, status: 'loaded', message: `Viewing ${streamedPdfName}.` };
      renderViewer();
      return;
    }
    const payload = contentType.includes('application/json') ? await response.json() : { error: await response.text() };
    const rawMessage = payload?.error || (response.ok ? 'PDF stream returned a contract but no PDF file yet.' : `PDF stream failed with HTTP ${response.status}.`);
    const providerMessage = /provider is not configured|refusing to expose private drawing files/i.test(rawMessage)
      ? 'Server PDF provider is not connected yet. Markups and takeoff edits remain available on the guarded sheet placeholder.'
      : rawMessage;
    drawingStreamState = { drawingId: requestId, status: response.ok ? 'contract-only' : 'provider-required', message: `${drawing.source_name || drawing.drawing_number} is selected. ${providerMessage}` };
    if (toast && !response.ok) window.CASTShell?.toast?.('The selected sheet is linked, but the authenticated PDF provider is not connected yet.', { kind: 'error' });
  } catch (error) {
    if (selectedDrawingId !== requestId) return;
    drawingStreamState = { drawingId: requestId, status: 'error', message: `${drawing.source_name || drawing.drawing_number} is selected, but the PDF stream could not be reached.` };
    console.warn('Could not load CAST CAD PDF stream', error);
    if (toast) window.CASTShell?.toast?.('Could not reach the PDF stream for this drawing.', { kind: 'error' });
  }
  renderViewer();
}
function handlePdfUpload(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    window.CASTShell?.toast?.('Please upload a PDF drawing file.', { kind: 'error' });
    return;
  }
  clearUploadedPdf();
  clearStreamedPdf();
  drawingStreamState = { drawingId: selectedDrawingId, status: 'local-upload', message: '' };
  uploadedPdfUrl = URL.createObjectURL(file);
  uploadedPdfName = file.name;
  window.CASTShell?.toast?.('PDF loaded locally. Markups remain CAST structured data.', { kind: 'success' });
  renderViewer();
}
function verifyQuantity(id) {
  const result = CPC.verifyEstimateQuantity(state, id, actor(), { status: 'Verified', notes: 'Verified in CAST estimate log; ready for controlled export.' });
  if (result.ok) { save(); window.CASTShell?.toast?.('Quantity verified and locked in CAST estimate log.', { kind: 'success' }); render(); }
}
function resolveMarkup(id) { const result = CPC.updateDrawingIssueStatus(state, id, 'Resolved', actor()); if (result.ok) { save(); render(); } }
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
      quantity: m.measurement_value || '',
      unit: m.measurement_unit || '',
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
      { key: 'quantity', header: 'Quantity' },
      { key: 'unit', header: 'Unit' },
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
  if (sheet) { selectedDrawingId = sheet.dataset.sheet; calibration = null; clearStreamedPdf(); drawingStreamState = { drawingId: selectedDrawingId, status: 'idle', message: '' }; render(); loadSelectedDrawingPdf({ toast: true }); return; }
  const tool = event.target.closest('[data-tool]');
  if (tool) { activeTool = tool.dataset.tool; document.querySelectorAll('[data-tool]').forEach((el) => el.classList.toggle('active', el === tool)); return; }
  if (event.target.closest('[data-add-markup]')) addMarkup();
  if (event.target.closest('[data-load-current-set]')) { loadCurrentDrawingSet({ force: true, toast: true }); return; }
  if (event.target.closest('[data-calibrate-scale]')) { calibration = { drawingId: selectedDrawingId, first: null }; renderScaleStatus(); window.CASTShell?.toast?.('Click two points on the sheet that match the known length.', { kind: 'info' }); return; }
  if (event.target.closest('[data-clear-pdf]')) { clearUploadedPdf(); clearStreamedPdf(); drawingStreamState = { drawingId: selectedDrawingId, status: 'idle', message: '' }; renderViewer(); loadSelectedDrawingPdf({ toast: true }); return; }
  if (event.target.closest('[data-open-server-pdf]')) { openSelectedPdf(); return; }
  if (event.target.closest('[data-open-edit-link]')) { openSelectedEditLink(); return; }
  if (event.target.closest('[data-save-viewer-preferences]')) { persistViewerPreferences({ toast: true }); return; }
  const verify = event.target.closest('[data-verify-qty]'); if (verify) verifyQuantity(verify.dataset.verifyQty);
  const resolve = event.target.closest('[data-resolve]'); if (resolve) resolveMarkup(resolve.dataset.resolve);
  const rfi = event.target.closest('[data-rfi]'); if (rfi) window.CASTShell?.toast?.('RFI conversion queued as draft-only; no external write-back enabled.', { kind: 'info' });
  if (event.target.closest('[data-export]')) exportCsv();
  if (event.target.closest('[data-reset]')) { clearUploadedPdf(); clearStreamedPdf(); drawingStreamState = { drawingId: '', status: 'idle', message: '' }; calibration = null; state = CPC.ensureDrawingIntelligenceState(CPC.resetState()); selectedDrawingId = state.drawings[0]?.id || ''; loadCurrentDrawingSet({ force: true, toast: false }); }
});

document.addEventListener('input', (event) => {
  const filter = event.target.closest('[data-sheet-filter]');
  if (filter) { sheetFilter = filter.value; renderSheets(); }
});

document.addEventListener('change', (event) => {
  const input = event.target.closest('[data-pdf-input]');
  if (input) handlePdfUpload(input.files?.[0]);
  if (event.target.closest('[data-viewer-layout], [data-viewer-zoom], [data-viewer-pref]')) persistViewerPreferences({ toast: false });
});
document.querySelector('[data-annotation-layer]')?.addEventListener('click', addMarkupFromOverlay);
document.querySelector('[data-viewer]')?.addEventListener('click', addMarkupFromOverlay);
window.addEventListener('beforeunload', () => { clearUploadedPdf(); clearStreamedPdf(); });

render();
loadServerViewerPreferences();
loadCurrentDrawingSet({ force: false, toast: false });
