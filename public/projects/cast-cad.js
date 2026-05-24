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
let drawingScales = loadDrawingScales();
let viewerPreferences = loadViewerPreferences();
let calibration = null;
let selectedMarkupIds = new Set();
let fieldPackageState = { packageId: '', deviceId: 'ipad-field-01', sheetIds: [], status: 'idle', message: 'Field mode package not created.' };
let fieldServiceWorkerState = { status: 'pending', message: 'Offline shell cache not registered yet; private PDFs/API payloads are never cached.' };
let markupPersistenceState = { status: 'idle', message: 'Server markup persistence not checked yet.', syncedAt: '' };
let comparisonCenterState = { status: 'idle', message: 'Select a baseline/revised sheet and create a provider-gated delta job.', jobs: [] };
let exportCenterState = { status: 'idle', message: 'Backend export jobs not requested yet. Takeoff workbook can run from stored measurements; annotated PDF requires CAST_CAD_PDF_EXPORT_WORKER.', jobs: [] };
let rfiLinkState = { status: 'idle', message: 'RFI links are draft-only until the backend snapshot contract confirms the markup.' };
let documentMetadataState = { status: 'idle', documentCount: 0, importedCount: 0, providerRequired: true, message: 'Document metadata registry not checked yet. Durable writes require CAST_CAD_DOCUMENT_METADATA_ADAPTER.' };
let toolLibraryState = { status: 'idle', items: [], placements: [], selectedItemId: '', message: 'Tool Library not loaded yet. Items require human review before budget/export authority.' };
let aiReviewState = { status: 'idle', findings: [], selectedFindingId: '', message: 'AI Review findings not loaded yet. AI Detected findings require cited sources and human verification before conversion.' };
let reviewRoomState = { status: 'idle', rooms: [], message: 'Review Rooms not loaded yet. Invites are audited backend records; no external email/realtime invite is fabricated.' };
let governanceState = { status: 'idle', roles: [], members: [], permissions: null, auditLog: [], message: 'Governance not loaded yet. Production auth/session identity is required when CAST_CAD_REQUIRE_AUTH=true.' };
let viewportMappingState = { status: 'idle', mapping: null, message: 'PDF coordinate mapping not saved yet. Renderer integration still required for true PDF page events.' };

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
  loadServerMarkupsForSelectedDrawing();
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
function renderDocumentMetadataStatus() {
  const status = document.querySelector('[data-document-metadata-status]');
  const summary = document.querySelector('[data-document-metadata-summary]');
  const adapter = documentMetadataState.providerRequired ? 'CAST_CAD_DOCUMENT_METADATA_ADAPTER required for durable/authoritative persistence' : 'durable metadata adapter configured';
  const message = `${documentMetadataState.message} · ${adapter}`;
  if (status) status.textContent = message;
  if (summary) summary.textContent = documentMetadataState.documentCount
    ? `${documentMetadataState.documentCount.toLocaleString()} document record(s) in the audited registry; imported ${documentMetadataState.importedCount.toLocaleString()} this session. ${adapter}.`
    : message;
}
function documentMetadataImportPayload(index) {
  const files = currentDrawingFiles(index).map((file) => ({
    name: file.name,
    fileName: file.name,
    path: file.path,
    sourcePath: file.path,
    extension: file.extension || 'pdf',
    drawingNumber: drawingNumberFromName(file.name),
    drawingTitle: titleFromName(file.name),
    discipline: disciplineFromPath(file.path),
    revisionLabel: revisionFromName(file.name),
    revisionDate: String(file.modifiedAt || '').slice(0, 10),
    pageCount: 1,
    contentHash: file.contentHash || file.sha256 || '',
  }));
  return { action: 'document-metadata', operation: 'import-index', projectId: 'alum', setId: 'alum-current-drawings', status: 'indexed', files };
}
async function importCurrentSetDocumentMetadata({ toast = false } = {}) {
  documentMetadataState = { ...documentMetadataState, status: 'importing', message: 'Importing current drawing index into the audited document metadata contract…' };
  renderDocumentMetadataStatus();
  try {
    const indexResponse = await fetch(CURRENT_DRAWING_INDEX_URL, { cache: 'no-store' });
    if (!indexResponse.ok) throw new Error(`index HTTP ${indexResponse.status}`);
    const index = await indexResponse.json();
    const payload = documentMetadataImportPayload(index);
    if (!payload.files.length) throw new Error('No current PDF drawing files found for metadata import.');
    const response = await fetch('/api/cast-cad-markups', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || result?.summary?.rejected || []).join(' ') || `HTTP ${response.status}`);
    const providerRequired = Boolean(result.summary?.providerRequired ?? true);
    documentMetadataState = { status: 'indexed', documentCount: result.summary?.importedCount || payload.files.length, importedCount: result.summary?.importedCount || payload.files.length, providerRequired, message: `Indexed ${result.summary?.importedCount || payload.files.length} current drawing metadata record(s) through the backend contract.` };
    if (toast) window.CASTShell?.toast?.('Current drawing metadata indexed through the CAST CAD backend contract.', { kind: 'success' });
    await loadDocumentMetadataRegistry();
  } catch (error) {
    console.warn('CAST CAD document metadata import unavailable', error);
    documentMetadataState = { ...documentMetadataState, status: 'blocked', message: `Document metadata import blocked: ${error.message}. No authoritative/durable registry state was fabricated.` };
    if (toast) window.CASTShell?.toast?.('Document metadata import blocked; no authoritative registry was fabricated.', { kind: 'error' });
    renderDocumentMetadataStatus();
  }
}
async function loadDocumentMetadataRegistry() {
  try {
    const params = new URLSearchParams({ action: 'document-metadata', projectId: 'alum', setId: 'alum-current-drawings' });
    const response = await fetch(`/api/cast-cad-markups?${params.toString()}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || `HTTP ${response.status}`);
    documentMetadataState = { ...documentMetadataState, status: 'loaded', documentCount: result.documentCount || 0, providerRequired: Boolean(result.contract?.durableAdapterRequired), message: `${result.documentCount || 0} drawing document metadata record(s) loaded from the backend registry contract.` };
  } catch (error) {
    console.warn('Could not load CAST CAD document metadata registry', error);
    documentMetadataState = { ...documentMetadataState, status: 'unavailable', message: 'Document metadata registry API unavailable; source index remains local read-only metadata only.' };
  }
  renderDocumentMetadataStatus();
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
  const rows = state.drawings.slice(0, 80);
  const countEl = document.querySelector('[data-sheet-count]');
  if (countEl) countEl.textContent = `${state.drawings.length.toLocaleString()} sheets`;
  const list = document.querySelector('[data-sheet-list]');
  if (!list) return;
  list.innerHTML = rows.map((drawing) => {
    const markups = state.drawingMarkups.filter((m) => m.drawing_id === drawing.id).length;
    const quantities = state.estimateQuantities.filter((q) => q.drawing_id === drawing.id).length;
    const linked = drawing.source_boundary ? ' · linked current set' : '';
    return `<button class="sheet-btn ${drawing.id === selectedDrawingId ? 'active' : ''}" data-sheet="${esc(drawing.id)}">
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
  }
}
function renderViewportMappingStatus() {
  const status = document.querySelector('[data-viewport-mapping-status]');
  if (status) status.textContent = viewportMappingState.message;
}
function viewportMappingPayload(samplePoint = { x: 50, y: 50 }) {
  const drawing = selectedDrawing();
  return {
    action: 'viewport-mapping',
    projectId: drawing?.project_id || 'alum',
    sheetId: selectedDrawingId,
    pageNumber: Number(document.querySelector('[data-pdf-page-number]')?.value || 1),
    pageWidth: Number(document.querySelector('[data-pdf-page-width]')?.value || 612),
    pageHeight: Number(document.querySelector('[data-pdf-page-height]')?.value || 792),
    viewportWidth: Number(document.querySelector('[data-pdf-viewport-width]')?.value || document.querySelector('[data-viewer]')?.clientWidth || 612),
    viewportHeight: Number(document.querySelector('[data-pdf-viewport-height]')?.value || document.querySelector('[data-viewer]')?.clientHeight || 792),
    rotation: Number(document.querySelector('[data-pdf-rotation]')?.value || 0),
    renderer: activePdfUrl() ? 'browser-pdf-object-contract' : 'mock-plan-contract',
    source: 'cast-cad-workbench-viewport-controls',
    samplePoint,
    calibration: currentScale(),
  };
}
function localPdfCoordinate(point = { x: 50, y: 50 }) {
  const mapping = viewportMappingState.mapping || viewportMappingPayload().mapping || viewportMappingPayload();
  const x = (Math.max(0, Math.min(100, Number(point.x || 0))) / 100) * Number(mapping.pageWidth || 612);
  const y = Number(mapping.pageHeight || 792) - ((Math.max(0, Math.min(100, Number(point.y || 0))) / 100) * Number(mapping.pageHeight || 792));
  return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
}
async function saveViewportMappingForSelectedSheet({ toast = false, samplePoint = { x: 50, y: 50 } } = {}) {
  const payload = viewportMappingPayload(samplePoint);
  if (!payload.sheetId) { window.CASTShell?.toast?.('Select a sheet before saving PDF coordinate mapping.', { kind: 'error' }); return; }
  try {
    const response = await fetch('/api/cast-cad-markups', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    viewportMappingState = { status: 'saved', mapping: result.mapping, message: `PDF coordinate mapping saved for page ${result.mapping?.pageNumber || payload.pageNumber}; 50%/50% maps to PDF ${result.samplePoint?.x}, ${result.samplePoint?.y}. Renderer worker still required for native page events.` };
    if (toast) window.CASTShell?.toast?.('PDF coordinate mapping saved through backend contract.', { kind: 'success' });
  } catch (error) {
    console.warn('Could not persist CAST CAD viewport mapping', error);
    const local = localPdfCoordinate(samplePoint);
    viewportMappingState = { status: 'local-only', mapping: payload, message: `Coordinate mapping saved locally only; backend contract unavailable (${error.message}). Sample PDF point ${local.x}, ${local.y}; no renderer integration was fabricated.` };
    if (toast) window.CASTShell?.toast?.('Coordinate mapping contract unavailable; local preview only.', { kind: 'info' });
  }
  renderViewportMappingStatus();
}
async function loadViewportMappingForSelectedSheet() {
  try {
    const params = new URLSearchParams({ action: 'viewport-mapping', projectId: selectedDrawing()?.project_id || 'alum', sheetId: selectedDrawingId, pageNumber: '1' });
    const response = await fetch(`/api/cast-cad-markups?${params.toString()}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || `HTTP ${response.status}`);
    const mapping = result.mappings?.[0] || null;
    viewportMappingState = mapping ? { status: 'loaded', mapping, message: `Loaded PDF coordinate mapping for page ${mapping.pageNumber}; normalized top-left overlay points convert to PDF bottom-left coordinates.` } : { ...viewportMappingState, status: 'empty', message: 'No saved PDF coordinate mapping for this sheet yet; save page box/viewport dimensions before renderer integration.' };
  } catch (error) {
    console.warn('Could not load CAST CAD viewport mapping', error);
    viewportMappingState = { ...viewportMappingState, status: 'unavailable', message: 'Viewport mapping API unavailable; coordinate conversion remains local preview only.' };
  }
  renderViewportMappingStatus();
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
    if (usingPdf) status.textContent = `Viewing ${activePdfName()} · click the overlay to place CAST markups`;
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
  visibleMarkups().forEach((markup) => {
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
  const rows = visibleMarkups();
  selectedMarkupIds = new Set([...selectedMarkupIds].filter((id) => rows.some((m) => m.id === id)));
  document.querySelector('[data-markup-list]').innerHTML = rows.length ? rows.map((m) => {
    const assignee = byId(state.users, m.assignee_user_id);
    const measurement = m.measurement_value ? `<p class="muted"><strong>Takeoff:</strong> ${Number(m.measurement_value).toLocaleString()} ${esc(m.measurement_unit || '')} · scale ${esc(m.scale_label || 'sheet scale')}</p>` : '';
    const checked = selectedMarkupIds.has(m.id) ? 'checked' : '';
    return `<article class="comment-card" data-card="${esc(m.id)}">
      <div class="actions"><span class="badge ${m.status === 'Open' ? 'open' : ''}">${esc(m.status)}</span><span class="badge ${m.priority === 'High' || m.priority === 'Urgent' ? 'high' : ''}">${esc(m.priority)}</span></div>
      <label class="cad-muted"><input type="checkbox" data-batch-markup="${esc(m.id)}" ${checked} autocomplete="off"> Select for batch operation</label>
      <h3>${esc(m.subject || m.tool)}</h3>
      <p class="muted">${esc(m.body)}</p>
      ${measurement}
      <p class="muted"><strong>${esc(m.tool)}</strong> · ${esc(m.trade || 'Unassigned trade')} · ${esc(m.cost_code || 'No cost code')} · Layer ${esc(m.layer || 'Default')}${m.group_id ? ` · Group ${esc(m.group_id)}` : ''} · Assigned to ${esc(assignee?.name || 'Unassigned')}</p>
      <div class="actions">
        <button class="cb-btn small cb-btn--ghost" data-resolve="${esc(m.id)}">Resolve</button>
        <button class="cb-btn small cb-btn--ghost" data-rfi="${esc(m.id)}">Convert to RFI</button>
        <button class="cb-btn small cb-btn--ghost" data-delete-markup="${esc(m.id)}">Delete</button>
      </div>
    </article>`;
  }).join('') : '<p class="muted">No markups on this sheet yet. Click Add Markup or click the drawing overlay to place a comment, measurement, count, cloud, or takeoff item.</p>';
  renderBatchStatus(rows);
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
function renderComparisonCenter() {
  const base = document.querySelector('[data-compare-base]');
  const revised = document.querySelector('[data-compare-revised]');
  const status = document.querySelector('[data-comparison-status]');
  const jobs = document.querySelector('[data-comparison-jobs]');
  const options = state.drawings.slice(0, 200).map((drawing) => `<option value="${esc(drawing.id)}">${esc(drawing.drawing_number || drawing.source_name || drawing.id)} · ${esc(drawing.drawing_title || drawing.source_name || '')}</option>`).join('');
  const optionCount = String(state.drawings.length);
  if (base && base.dataset.optionCount !== optionCount) { const value = base.value; base.innerHTML = `<option value="">Baseline sheet/revision</option>${options}`; base.dataset.optionCount = optionCount; base.value = value; }
  if (revised && revised.dataset.optionCount !== optionCount) { const value = revised.value || selectedDrawingId; revised.innerHTML = `<option value="">Revised sheet/revision</option>${options}`; revised.dataset.optionCount = optionCount; revised.value = value; }
  if (status) status.textContent = comparisonCenterState.message;
  if (jobs) {
    jobs.innerHTML = comparisonCenterState.jobs.length ? comparisonCenterState.jobs.slice(-3).reverse().map((job) => `<div class="tool-card"><em>${esc(job.status || 'queued')}</em><strong>${esc(job.baseSheetId)} → ${esc(job.revisedSheetId)}</strong><span>${job.providerRequired ? 'Worker required: CAST_CAD_COMPARISON_WORKER. No private overlay/delta artifact is fabricated.' : 'Queued for the configured private comparison worker.'}</span></div>`).join('') : '<p class="cad-muted">No comparison jobs requested in this session.</p>';
  }
}
function renderExportCenter() {
  const status = document.querySelector('[data-export-job-status]');
  const jobs = document.querySelector('[data-export-jobs]');
  if (status) status.textContent = exportCenterState.message;
  if (jobs) {
    jobs.innerHTML = exportCenterState.jobs.length ? exportCenterState.jobs.slice(-4).reverse().map((job) => {
      const label = job.type === 'annotated-pdf' ? 'Annotated PDF' : 'Takeoff workbook';
      const details = job.providerRequired ? 'Worker required: CAST_CAD_PDF_EXPORT_WORKER. No flattened/private PDF artifact is fabricated.' : `${job.rowCount ?? job.markupCount ?? 0} row/markup record(s) captured by the audited export contract.`;
      return `<div class="tool-card"><em>${esc(job.status || 'queued')}</em><strong>${esc(label)} · ${esc(job.sheetId || 'all sheets')}</strong><span>${esc(details)}</span></div>`;
    }).join('') : '<p class="cad-muted">No backend export jobs requested in this session.</p>';
  }
}
function renderToolLibrary() {
  const status = document.querySelector('[data-tool-library-status]');
  const list = document.querySelector('[data-tool-library-items]');
  if (status) status.textContent = toolLibraryState.message;
  if (!list) return;
  if (!toolLibraryState.items.length) {
    list.innerHTML = '<p class="cad-muted">No Tool Library items loaded yet. Create a seed item or refresh the audited backend contract.</p>';
    return;
  }
  list.innerHTML = toolLibraryState.items.slice(0, 8).map((item) => {
    const selected = item.id === toolLibraryState.selectedItemId ? 'checked' : '';
    const cost = item.unitCost === null || item.unitCost === undefined ? 'unit cost unset' : `${money(item.unitCost)} / ${esc(item.unit || 'EA')}`;
    return `<label class="tool-card" data-tool-library-card="${esc(item.id)}"><em>${esc(item.toolType || 'tool')} · ${esc(item.status || 'active')}</em><strong><input type="radio" name="cast-tool-library-item" data-tool-library-item="${esc(item.id)}" ${selected} autocomplete="off"> ${esc(item.name)}</strong><span>${esc(item.trade || 'Coordination')} · ${esc(item.category || 'General')} · ${esc(item.costCode || 'No cost code')} · ${esc(item.assemblyCode || 'No assembly')} · ${cost}. Human review required: ${item.requiresHumanReview === false ? 'no (blocked)' : 'yes'}.</span></label>`;
  }).join('');
}
function renderAiReviewFindings() {
  const status = document.querySelector('[data-ai-review-status]');
  const list = document.querySelector('[data-ai-review-findings]');
  if (status) status.textContent = aiReviewState.message;
  if (!list) return;
  if (!aiReviewState.findings.length) {
    list.innerHTML = '<p class="cad-muted">No AI Review findings loaded yet. Create a cited contract finding or refresh the backend list.</p>';
    return;
  }
  list.innerHTML = aiReviewState.findings.slice(0, 8).map((finding) => {
    const selected = finding.id === aiReviewState.selectedFindingId ? 'checked' : '';
    const verified = finding.humanVerified ? 'Human Verified' : (finding.status || 'AI Detected');
    const citationCount = finding.sourceCitations?.length || 0;
    return `<label class="tool-card" data-ai-finding-card="${esc(finding.id)}"><em>${esc(verified)} · ${esc(finding.severity || 'Medium')} · ${citationCount} cited source(s)</em><strong><input type="radio" name="cast-ai-finding" data-ai-finding="${esc(finding.id)}" ${selected} autocomplete="off"> ${esc(finding.title || 'AI Review finding')}</strong><span>${esc(finding.body || '')} ${finding.providerRequired ? 'Worker required: CAST_CAD_AI_REVIEW_WORKER. ' : ''}Human review approval is required before verification or markup conversion.</span></label>`;
  }).join('');
}
function renderReviewRooms() {
  const status = document.querySelector('[data-review-room-status]');
  const list = document.querySelector('[data-review-rooms]');
  if (status) status.textContent = reviewRoomState.message;
  if (!list) return;
  if (!reviewRoomState.rooms.length) {
    list.innerHTML = '<p class="cad-muted">No Review Rooms loaded yet. Create an audited room for the selected sheet; external email/realtime transport remains provider-dependent.</p>';
    return;
  }
  list.innerHTML = reviewRoomState.rooms.slice(-4).reverse().map((room) => {
    const participantCount = room.participants?.length || 0;
    const sheetCount = room.sheetIds?.length || 0;
    const markupCount = room.markupIds?.length || 0;
    return `<div class="tool-card"><em>${esc(room.status || 'Active')} · ${participantCount} invited participant(s)</em><strong>${esc(room.name || 'CAST CAD Review Room')}</strong><span>${sheetCount} sheet(s) · ${markupCount} markup(s) scoped. Backend audit record ${esc(room.id || '')}; external email/realtime provider still required for delivered invites.</span></div>`;
  }).join('');
}
function renderGovernance() {
  const status = document.querySelector('[data-governance-status]');
  const members = document.querySelector('[data-governance-members]');
  const permissions = document.querySelector('[data-governance-permissions]');
  const audit = document.querySelector('[data-governance-audit]');
  if (status) status.textContent = governanceState.message;
  if (members) {
    members.innerHTML = governanceState.members.length ? governanceState.members.slice(0, 6).map((member) => `<div class="tool-card"><em>${esc(member.status || 'active')} · ${esc(member.role || 'Read Only Viewer')}</em><strong>${esc(member.name || member.email || member.userId || 'CAST CAD member')}</strong><span>${esc((member.permissions || []).join(', '))}. Role changes are backend-audited and fail closed when CAST_CAD_REQUIRE_AUTH=true without a session identity.</span></div>`).join('') : '<p class="cad-muted">No project members loaded yet. Assign a reviewed role or refresh governance.</p>';
  }
  if (permissions) {
    const effective = governanceState.permissions;
    const matrix = governanceState.roles || [];
    permissions.innerHTML = effective ? `<div class="tool-card"><em>${esc(effective.source || 'actor-header-role')}</em><strong>${esc(effective.role || 'Unknown role')}</strong><span>${esc((effective.permissions || []).join(', '))}</span></div>` : matrix.slice(0, 5).map((row) => `<div class="tool-card"><em>${esc(row.role)}</em><strong>${esc(row.permissions.length)} permission(s)</strong><span>${esc(row.permissions.join(', '))}</span></div>`).join('') || '<p class="cad-muted">Permission matrix not loaded yet.</p>';
  }
  if (audit) {
    audit.innerHTML = governanceState.auditLog.length ? governanceState.auditLog.slice(-5).reverse().map((entry) => `<div class="tool-card"><em>${esc(entry.entityType || 'audit')} · ${esc(entry.actorRole || '')}</em><strong>${esc(entry.action || 'CAST CAD audit event')}</strong><span>${esc(entry.entityId || '')} · ${esc(entry.createdAt || '')}</span></div>`).join('') : '<p class="cad-muted">No governance audit entries loaded yet.</p>';
  }
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
  renderComparisonCenter();
  renderExportCenter();
  renderToolLibrary();
  renderAiReviewFindings();
  renderReviewRooms();
  renderGovernance();
  renderFieldModeStatus();
  renderMarkupPersistenceStatus();
  renderDocumentMetadataStatus();
  renderViewportMappingStatus();
}
function reviewRoomPayload() {
  const drawing = selectedDrawing();
  const rawParticipants = document.querySelector('[data-review-room-participants]')?.value || '';
  const participants = rawParticipants.split(/[;,]/).map((email) => email.trim()).filter(Boolean).map((email) => ({ email, role: 'Reviewer', name: email.split('@')[0] || 'Reviewer' }));
  const includeMarkups = Boolean(document.querySelector('[data-review-room-include-markups]')?.checked);
  return {
    projectId: drawing?.project_id || 'alum',
    name: document.querySelector('[data-review-room-name]')?.value.trim() || `Review ${drawing?.drawing_number || selectedDrawingId}`,
    sheetIds: [selectedDrawingId].filter(Boolean),
    markupIds: includeMarkups ? visibleMarkups().map((row) => row.id) : [],
    participants,
    inviteDelivery: 'audit-record-only',
    externalInviteProviderRequired: true,
  };
}
async function loadReviewRooms({ toast = false } = {}) {
  try {
    const response = await fetch('/api/cast-cad-review-room', { headers: { accept: 'application/json' }, cache: 'no-store' });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || `HTTP ${response.status}`);
    const projectId = selectedDrawing()?.project_id || 'alum';
    const rooms = (result.reviewRooms || []).filter((room) => !room.projectId || room.projectId === projectId);
    reviewRoomState = { status: 'loaded', rooms, message: `${rooms.length} Review Room(s) loaded from /api/cast-cad-review-room. Invites are audited participant records; external email/realtime delivery remains provider-dependent.` };
    if (toast) window.CASTShell?.toast?.('Review Rooms refreshed from backend contract.', { kind: 'success' });
  } catch (error) {
    console.warn('CAST CAD Review Room API unavailable', error);
    reviewRoomState = { ...reviewRoomState, status: 'unavailable', message: 'Review Room API unavailable; no local collaboration room or external invite was fabricated.' };
    if (toast) window.CASTShell?.toast?.('Review Room API unavailable; no invite was fabricated.', { kind: 'error' });
  }
  renderReviewRooms();
}
async function createReviewRoomForSelectedScope() {
  const payload = reviewRoomPayload();
  if (!payload.sheetIds.length) { window.CASTShell?.toast?.('Select a sheet before creating a Review Room.', { kind: 'error' }); return; }
  if (!payload.participants.length) { window.CASTShell?.toast?.('Add at least one participant email for the Review Room audit record.', { kind: 'error' }); return; }
  try {
    const response = await fetch('/api/cast-cad-review-room', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    const room = result.room || {};
    reviewRoomState = { status: 'created', rooms: [...reviewRoomState.rooms, room], message: `Review Room ${room.id || ''} created as an audited backend record for ${payload.sheetIds.length} sheet(s) and ${payload.markupIds.length} markup(s). No external email/realtime invite was fabricated.` };
    window.CASTShell?.toast?.('Review Room created through audited backend contract.', { kind: 'success' });
  } catch (error) {
    console.warn('Could not create CAST CAD Review Room', error);
    reviewRoomState = { ...reviewRoomState, status: 'blocked', message: `Review Room creation blocked: ${error.message}. No local collaboration room or external invite was fabricated.` };
    window.CASTShell?.toast?.('Review Room creation blocked; no invite was fabricated.', { kind: 'error' });
  }
  renderReviewRooms();
}
function governanceMemberPayload() {
  return {
    action: 'admin',
    projectId: selectedDrawing()?.project_id || 'alum',
    name: document.querySelector('[data-governance-member-name]')?.value.trim() || 'CAST CAD Reviewer',
    email: document.querySelector('[data-governance-member-email]')?.value.trim() || 'reviewer@example.com',
    role: document.querySelector('[data-governance-role]')?.value || 'Project Engineer',
    status: document.querySelector('[data-governance-member-status]')?.value || 'active',
    source: 'cast-cad-workbench-governance-bridge',
  };
}
async function loadGovernanceStatus({ toast = false } = {}) {
  try {
    const projectId = selectedDrawing()?.project_id || 'alum';
    const [adminResponse, memberResponse, permissionResponse, auditResponse] = await Promise.all([
      fetch('/api/cast-cad-markups?action=admin', { headers: { accept: 'application/json' }, cache: 'no-store' }),
      fetch(`/api/cast-cad-markups?action=members&projectId=${encodeURIComponent(projectId)}`, { headers: { accept: 'application/json' }, cache: 'no-store' }),
      fetch(`/api/cast-cad-markups?action=effective-permissions&projectId=${encodeURIComponent(projectId)}`, { headers: { accept: 'application/json' }, cache: 'no-store' }),
      fetch('/api/cast-cad-markups?action=audit-log&entityType=CAST_CAD_PROJECT_MEMBER', { headers: { accept: 'application/json' }, cache: 'no-store' }),
    ]);
    const [admin, member, permission, audit] = await Promise.all([adminResponse.json().catch(() => null), memberResponse.json().catch(() => null), permissionResponse.json().catch(() => null), auditResponse.json().catch(() => null)]);
    if (!adminResponse.ok || admin?.ok === false) throw new Error(admin?.error || `admin HTTP ${adminResponse.status}`);
    if (!memberResponse.ok || member?.ok === false) throw new Error(member?.error || `members HTTP ${memberResponse.status}`);
    if (!permissionResponse.ok || permission?.ok === false) throw new Error(permission?.error || `permissions HTTP ${permissionResponse.status}`);
    if (!auditResponse.ok || audit?.ok === false) throw new Error(audit?.error || `audit HTTP ${auditResponse.status}`);
    governanceState = {
      status: 'loaded',
      roles: admin.roles || member.permissionMatrix || [],
      members: member.members || [],
      permissions: permission,
      auditLog: audit.auditLog || [],
      message: `${member.memberCount || 0} project member role(s) loaded. Effective role: ${permission.role || 'unknown'}. Auth fail-closed gate: ${admin.authRequiredWhenEnabled || 'CAST_CAD_REQUIRE_AUTH=true'}.`,
    };
    if (toast) window.CASTShell?.toast?.('CAST CAD governance refreshed from backend contract.', { kind: 'success' });
  } catch (error) {
    console.warn('CAST CAD governance API unavailable', error);
    governanceState = { ...governanceState, status: 'blocked', message: `Governance blocked: ${error.message}. No local role, permission, or audit authority was fabricated; configure backend auth/session when CAST_CAD_REQUIRE_AUTH=true.` };
    if (toast) window.CASTShell?.toast?.('Governance unavailable; no local role authority was fabricated.', { kind: 'error' });
  }
  renderGovernance();
}
async function assignGovernanceMemberRole() {
  const payload = governanceMemberPayload();
  if (!payload.email && !payload.userId) { window.CASTShell?.toast?.('Email or user ID is required before assigning a CAST CAD role.', { kind: 'error' }); return; }
  try {
    const response = await fetch('/api/cast-cad-markups', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    governanceState = { ...governanceState, members: [...governanceState.members.filter((row) => row.email !== result.member?.email), result.member].filter(Boolean), roles: result.permissionMatrix || governanceState.roles, message: `Assigned ${result.member?.role || payload.role} to ${result.member?.email || payload.email} through backend audit. Effective permissions are server-resolved; local role authority was not fabricated.` };
    window.CASTShell?.toast?.('CAST CAD project member role assigned through backend audit.', { kind: 'success' });
    await loadGovernanceStatus();
  } catch (error) {
    console.warn('Could not assign CAST CAD governance role', error);
    governanceState = { ...governanceState, status: 'blocked', message: `Role assignment blocked: ${error.message}. Required when strict auth is enabled: CAST_CAD_REQUIRE_AUTH=false for dev or authenticated session headers from the production auth provider.` };
    window.CASTShell?.toast?.('Role assignment blocked; no local permission was fabricated.', { kind: 'error' });
    renderGovernance();
  }
}
function aiReviewFindingPayload() {
  const drawing = selectedDrawing();
  const firstMarkup = visibleMarkups()[0];
  const sourcePointer = firstMarkup?.id || drawing?.source_path || drawing?.id || selectedDrawingId;
  const title = document.querySelector('[data-ai-review-title]')?.value.trim() || `Possible coordination issue on ${drawing?.drawing_number || selectedDrawingId}`;
  return {
    type: 'ai-finding',
    projectId: drawing?.project_id || 'alum',
    sheetId: selectedDrawingId,
    pageNumber: 1,
    title,
    body: document.querySelector('[data-ai-review-body]')?.value.trim() || 'AI Review contract finding for human estimator/PM verification before any action.',
    severity: document.querySelector('[data-ai-review-severity]')?.value || 'Medium',
    confidence: Number(document.querySelector('[data-ai-review-confidence]')?.value || 72),
    provider: 'provider-independent-contract',
    sourceCitations: [{ kind: firstMarkup ? 'markup' : 'sheet', sheetId: selectedDrawingId, pageNumber: 1, pointer: sourcePointer, excerpt: `${drawing?.drawing_number || selectedDrawingId} · ${drawing?.drawing_title || drawing?.source_name || 'Selected drawing'}${firstMarkup ? ` · markup ${firstMarkup.subject || firstMarkup.tool}` : ''}` }],
    suggestedAction: 'Human reviewer must verify source sheet/page/markup evidence before conversion.',
  };
}
async function loadAiReviewFindings({ toast = false } = {}) {
  try {
    const params = new URLSearchParams({ action: 'ai-findings', projectId: selectedDrawing()?.project_id || 'alum', sheetId: selectedDrawingId });
    const response = await fetch(`/api/cast-cad-search?${params.toString()}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || `HTTP ${response.status}`);
    const findings = result.findings || [];
    aiReviewState = { status: 'loaded', findings, selectedFindingId: aiReviewState.selectedFindingId && findings.some((row) => row.id === aiReviewState.selectedFindingId) ? aiReviewState.selectedFindingId : (findings[0]?.id || ''), message: `${result.findingCount || findings.length} AI Review finding(s) loaded from /api/cast-cad-search?action=ai-findings. Label required: ${result.contract?.labelRequired || 'AI Detected'}; human verification required before conversion.` };
    if (toast) window.CASTShell?.toast?.('AI Review findings refreshed from backend contract.', { kind: 'success' });
  } catch (error) {
    console.warn('CAST CAD AI Review API unavailable', error);
    aiReviewState = { ...aiReviewState, status: 'unavailable', message: 'AI Review API unavailable; no local AI finding or converted markup was fabricated.' };
    if (toast) window.CASTShell?.toast?.('AI Review API unavailable; no AI finding was fabricated.', { kind: 'error' });
  }
  renderAiReviewFindings();
}
async function createAiReviewFinding() {
  const payload = aiReviewFindingPayload();
  if (!payload.sheetId || !payload.sourceCitations.length) { window.CASTShell?.toast?.('AI Review findings require a selected sheet and source citation.', { kind: 'error' }); return; }
  try {
    const response = await fetch('/api/cast-cad-search', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    aiReviewState = { ...aiReviewState, selectedFindingId: result.finding?.id || aiReviewState.selectedFindingId, message: `AI Detected finding ${result.finding?.id || ''} recorded with source citation(s); human verification remains required.` };
    window.CASTShell?.toast?.('AI Detected finding recorded through the audited backend contract.', { kind: 'success' });
    await loadAiReviewFindings();
  } catch (error) {
    console.warn('Could not create CAST CAD AI Review finding', error);
    aiReviewState = { ...aiReviewState, status: 'blocked', message: `AI Review finding blocked: ${error.message}. No uncited/local AI finding was fabricated.` };
    window.CASTShell?.toast?.('AI Review finding blocked; no uncited finding was fabricated.', { kind: 'error' });
    renderAiReviewFindings();
  }
}
async function reviewSelectedAiFinding() {
  const findingId = aiReviewState.selectedFindingId;
  if (!findingId) { window.CASTShell?.toast?.('Select an AI Review finding before human review.', { kind: 'error' }); return; }
  const humanReviewApproved = Boolean(document.querySelector('[data-ai-human-review]')?.checked);
  if (!humanReviewApproved) {
    aiReviewState = { ...aiReviewState, status: 'blocked', message: 'AI finding verification/conversion blocked: human review approval is required. No local markup was fabricated.' };
    window.CASTShell?.toast?.('Human review approval is required before verifying AI findings.', { kind: 'error' });
    renderAiReviewFindings();
    return;
  }
  try {
    const response = await fetch('/api/cast-cad-search', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ type: 'review-ai-finding', findingId, decision: 'convert-to-markup', humanReviewApproved: true, createMarkup: true, markupStatus: 'Needs Review' }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    if (result.markup) mergeServerMarkup(result.markup);
    save();
    aiReviewState = { ...aiReviewState, message: `AI finding ${findingId} human verified${result.markup ? ' and converted to a Needs Review markup' : ''}; AI label/source citations preserved.` };
    window.CASTShell?.toast?.('AI finding human verified through backend audit.', { kind: 'success' });
    await loadAiReviewFindings();
    render();
  } catch (error) {
    console.warn('Could not review CAST CAD AI finding', error);
    aiReviewState = { ...aiReviewState, status: 'blocked', message: `AI finding review blocked: ${error.message}. No human-verified markup was fabricated.` };
    window.CASTShell?.toast?.('AI finding review blocked; no markup was fabricated.', { kind: 'error' });
    renderAiReviewFindings();
  }
}
function toolLibrarySeedPayload() {
  const seed = document.querySelector('[data-tool-library-seed]')?.value || 'fec';
  const seeds = {
    fec: { name: 'Fire extinguisher cabinet', category: 'Life Safety', trade: 'Fire Protection', costCode: '10-4400', assemblyCode: 'FEC-001', toolType: 'count', unit: 'EA', unitCost: 850, formula: 'quantity * unitCost', defaultLayer: 'Life Safety', style: { stroke: '#dc2626', fill: 'rgba(220,38,38,.16)', opacity: 1, lineWidth: 2, fontSize: 12 } },
    door: { name: 'Door/frame count', category: 'Openings', trade: 'Doors Frames Hardware', costCode: '08-1113', assemblyCode: 'DOOR-STD', toolType: 'count', unit: 'EA', unitCost: 2200, formula: 'quantity * unitCost', defaultLayer: 'Openings', style: { stroke: '#2563eb', fill: 'rgba(37,99,235,.16)', opacity: 1, lineWidth: 2, fontSize: 12 } },
    wall: { name: 'Drywall partition length', category: 'Interiors', trade: 'Drywall', costCode: '09-2116', assemblyCode: 'GWB-PARTITION', toolType: 'length', unit: 'LF', unitCost: 74, formula: 'length * unitCost', defaultLayer: 'Partitions', style: { stroke: '#f97316', fill: 'rgba(249,115,22,.16)', opacity: 1, lineWidth: 3, fontSize: 12 } },
    waterproofing: { name: 'Waterproofing area', category: 'Envelope', trade: 'Waterproofing', costCode: '07-1300', assemblyCode: 'WP-AREA', toolType: 'area', unit: 'SF', unitCost: 18, formula: 'area * unitCost', defaultLayer: 'Envelope', style: { stroke: '#0f766e', fill: 'rgba(15,118,110,.16)', opacity: 1, lineWidth: 2, fontSize: 12 } },
  };
  return { action: 'tool-library', projectId: 'alum', requiresHumanReview: true, ...(seeds[seed] || seeds.fec) };
}
async function loadToolLibraryItems({ toast = false } = {}) {
  try {
    const response = await fetch('/api/cast-cad-markups?action=tool-library&projectId=alum&status=active', { headers: { accept: 'application/json' }, cache: 'no-store' });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || `HTTP ${response.status}`);
    const items = result.items || [];
    toolLibraryState = { status: 'loaded', items, placements: result.placements || [], selectedItemId: toolLibraryState.selectedItemId && items.some((item) => item.id === toolLibraryState.selectedItemId) ? toolLibraryState.selectedItemId : (items[0]?.id || ''), message: `${result.itemCount || items.length} Tool Library item(s) loaded from the audited backend contract; placements remain review-gated.` };
    if (toast) window.CASTShell?.toast?.('CAST Tool Library refreshed from backend contract.', { kind: 'success' });
  } catch (error) {
    console.warn('CAST CAD Tool Library API unavailable', error);
    toolLibraryState = { ...toolLibraryState, status: 'unavailable', message: 'Tool Library API unavailable; no local authoritative library or budget item was fabricated.' };
    if (toast) window.CASTShell?.toast?.('Tool Library API unavailable; no authoritative library was fabricated.', { kind: 'error' });
  }
  renderToolLibrary();
}
async function createToolLibrarySeedItem() {
  try {
    const response = await fetch('/api/cast-cad-markups', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(toolLibrarySeedPayload()) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    toolLibraryState = { ...toolLibraryState, selectedItemId: result.item?.id || toolLibraryState.selectedItemId, message: `Tool Library item ${result.item?.name || ''} created through backend audit; human review gate remains on.` };
    window.CASTShell?.toast?.('CAST Tool Library item created through audited backend contract.', { kind: 'success' });
    await loadToolLibraryItems();
  } catch (error) {
    console.warn('Could not create CAST CAD Tool Library item', error);
    toolLibraryState = { ...toolLibraryState, status: 'blocked', message: `Tool Library create blocked: ${error.message}. No local authoritative item was fabricated.` };
    window.CASTShell?.toast?.('Tool Library item create blocked; no local authoritative item was fabricated.', { kind: 'error' });
    renderToolLibrary();
  }
}
async function placeSelectedToolLibraryItem() {
  const itemId = toolLibraryState.selectedItemId;
  if (!itemId) { window.CASTShell?.toast?.('Select or create a Tool Library item before placement.', { kind: 'error' }); return; }
  const quantity = Number(document.querySelector('[data-tool-library-quantity]')?.value || 1);
  try {
    const response = await fetch('/api/cast-cad-markups', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ action: 'tool-library', operation: 'place-tool', itemId, projectId: selectedDrawing()?.project_id || 'alum', sheetId: selectedDrawingId, quantity, x: 48, y: 42 }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    if (result.markup) mergeServerMarkup(result.markup);
    save();
    toolLibraryState = { ...toolLibraryState, placements: [...toolLibraryState.placements, result.placement].filter(Boolean), message: `Placed ${result.item?.name || 'Tool Library item'} as a Needs Review markup/takeoff row; budgetAuthoritative=${Boolean(result.placement?.budgetAuthoritative)}.` };
    window.CASTShell?.toast?.('Tool Library placement created as a review-gated markup.', { kind: 'success' });
    render();
  } catch (error) {
    console.warn('Could not place CAST CAD Tool Library item', error);
    toolLibraryState = { ...toolLibraryState, status: 'blocked', message: `Tool Library placement blocked: ${error.message}. No local markup or budget quantity was fabricated.` };
    window.CASTShell?.toast?.('Tool Library placement blocked; no local markup was fabricated.', { kind: 'error' });
    renderToolLibrary();
  }
}
function markupServerPayload(markup) {
  return {
    id: markup.id,
    projectId: markup.project_id || selectedDrawing()?.project_id || 'alum',
    sheetId: markup.drawing_id,
    pageNumber: 1,
    tool: markup.tool,
    markupType: markup.markup_type || 'pin',
    subject: markup.subject || markup.tool || 'CAST CAD markup',
    body: markup.body || '',
    status: markup.status || 'Open',
    priority: markup.priority || 'Normal',
    trade: markup.trade || '',
    costCode: markup.cost_code || '',
    assigneeUserId: markup.assignee_user_id || '',
    geometry: markup.geometry || { type: markup.markup_type === 'measurement' ? 'line' : 'point', points: [{ x: Number(markup.x || 0), y: Number(markup.y || 0) }], width: Number(markup.width || 0), height: Number(markup.height || 0) },
    measurement: markup.measurement_value ? { value: Number(markup.measurement_value), unit: markup.measurement_unit || '', scaleLabel: markup.scale_label || '', humanReviewRequired: markup.verification_status !== 'Verified' } : null,
    layer: markup.layer || 'Default',
    groupId: markup.group_id || '',
    style: markup.style || {},
    sourceSnapshot: { ...(markup.source_snapshot || {}), localMarkupId: markup.id, source: markup.source || 'CAST CAD workbench' },
  };
}
function mergeServerMarkup(serverMarkup) {
  if (serverMarkup?.deletedAt || serverMarkup?.status === 'Deleted') return false;
  if (!serverMarkup?.id || state.drawingMarkups.some((row) => row.id === serverMarkup.id)) return false;
  const point = serverMarkup.geometry?.points?.[0] || { x: 50, y: 50 };
  state.drawingMarkups.push({
    id: serverMarkup.id,
    project_id: serverMarkup.projectId || 'alum',
    drawing_id: serverMarkup.sheetId,
    revision_id: `server_${serverMarkup.sheetId}`,
    markup_type: serverMarkup.markupType || 'pin',
    tool: serverMarkup.tool || 'Pin',
    subject: serverMarkup.subject || 'Server markup',
    body: serverMarkup.body || '',
    x: Number(point.x ?? 50),
    y: Number(point.y ?? 50),
    width: Number(serverMarkup.geometry?.width || 0),
    height: Number(serverMarkup.geometry?.height || 0),
    status: serverMarkup.status || 'Open',
    priority: serverMarkup.priority || 'Normal',
    trade: serverMarkup.trade || '',
    cost_code: serverMarkup.costCode || '',
    assignee_user_id: serverMarkup.assigneeUserId || '',
    measurement_value: serverMarkup.measurement?.value || '',
    measurement_unit: serverMarkup.measurement?.unit || '',
    scale_label: serverMarkup.measurement?.scaleLabel || '',
    layer: serverMarkup.layer || 'Default',
    group_id: serverMarkup.groupId || '',
    style: serverMarkup.style || {},
    source: 'CAST CAD server markup contract',
    source_snapshot: serverMarkup.sourceSnapshot || {},
    created_at: serverMarkup.createdAt || new Date().toISOString(),
    updated_at: serverMarkup.updatedAt || new Date().toISOString(),
  });
  return true;
}
function renderMarkupPersistenceStatus() {
  const status = document.querySelector('[data-markup-persistence-status]');
  if (status) status.textContent = markupPersistenceState.message;
  const rfiStatus = document.querySelector('[data-rfi-link-status]');
  if (rfiStatus) rfiStatus.textContent = rfiLinkState.message;
}
async function syncMarkupToServer(markup, { toast = false } = {}) {
  try {
    const response = await fetch('/api/cast-cad-markups', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(markupServerPayload(markup)) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    markup.source_snapshot = { ...(markup.source_snapshot || {}), serverMarkupId: result.markup?.id || markup.id, serverSyncedAt: new Date().toISOString() };
    markupPersistenceState = { status: 'synced', syncedAt: new Date().toISOString(), message: `Markup ${markup.subject || markup.tool} saved to audited backend contract.` };
    save();
    if (toast) window.CASTShell?.toast?.('Markup saved to CAST CAD backend contract.', { kind: 'success' });
  } catch (error) {
    console.warn('Could not persist CAST CAD markup to server contract', error);
    markupPersistenceState = { status: 'local-only', syncedAt: '', message: 'Markup saved locally; backend markup persistence API is unavailable, so reload persistence is not guaranteed.' };
    if (toast) window.CASTShell?.toast?.('Markup saved locally; backend markup persistence API is unavailable.', { kind: 'info' });
  }
  renderMarkupPersistenceStatus();
}
async function ensureMarkupSyncedForWorkflow(markup) {
  if (!markup) throw new Error('Markup not found.');
  if (!markup.source_snapshot?.serverSyncedAt) await syncMarkupToServer(markup, { toast: false });
  if (!markup.source_snapshot?.serverMarkupId) throw new Error('Backend markup persistence is required before workflow links can be created.');
  return markup.source_snapshot.serverMarkupId;
}
function serverMarkupIdFor(markup) {
  return markup?.source_snapshot?.serverMarkupId || markup?.sourceSnapshot?.serverMarkupId || '';
}
async function loadServerMarkupsForSelectedDrawing() {
  const drawing = selectedDrawing();
  if (!drawing?.id) return;
  try {
    const params = new URLSearchParams({ projectId: drawing.project_id || 'alum', sheetId: drawing.id });
    const response = await fetch(`/api/cast-cad-markups?${params.toString()}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || `HTTP ${response.status}`);
    const merged = (result.markups || []).reduce((count, row) => count + (mergeServerMarkup(row) ? 1 : 0), 0);
    if (merged) { save(); render(); }
    markupPersistenceState = { status: 'loaded', syncedAt: new Date().toISOString(), message: `${result.count || 0} server markup(s) checked for selected sheet; ${merged} merged locally.` };
  } catch (error) {
    console.warn('Could not load CAST CAD server markups', error);
    markupPersistenceState = { status: 'local-only', syncedAt: '', message: 'Server markup persistence API unavailable; using local session markups only.' };
  }
  renderMarkupPersistenceStatus();
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
    syncMarkupToServer(result.markup, { toast: false });
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
    const message = payload?.error || (response.ok ? 'PDF stream is not returning a PDF yet.' : `PDF stream failed with HTTP ${response.status}.`);
    drawingStreamState = { drawingId: requestId, status: response.ok ? 'contract-only' : 'provider-required', message: `${drawing.source_name || drawing.drawing_number} is selected. ${message}` };
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
async function deleteMarkupWithBackend(id) {
  const markup = state.drawingMarkups.find((row) => row.id === id);
  if (!markup) { window.CASTShell?.toast?.('Markup not found for delete.', { kind: 'error' }); return; }
  try {
    const response = await fetch('/api/cast-cad-markups', { method: 'DELETE', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ id: serverMarkupIdFor(markup) || markup.id, reason: 'Deleted from CAST CAD workbench' }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    state.drawingMarkups = state.drawingMarkups.filter((row) => row.id !== id && row.id !== result.markupId);
    selectedMarkupIds.delete(id);
    markupPersistenceState = { status: 'deleted', syncedAt: new Date().toISOString(), message: 'Markup soft-deleted through audited backend contract; retained in audit history and excluded from default lists.' };
    save();
    window.CASTShell?.toast?.('Markup deleted through CAST CAD backend audit.', { kind: 'success' });
    render();
  } catch (error) {
    console.warn('CAST CAD markup delete API unavailable', error);
    markupPersistenceState = { status: 'blocked', syncedAt: '', message: `Delete blocked: ${error.message}. No local-only deletion was fabricated because backend audit is required.` };
    window.CASTShell?.toast?.('Markup delete blocked; backend audit is required.', { kind: 'error' });
    renderMarkupPersistenceStatus();
  }
}
async function convertMarkupToRfiDraft(id) {
  const markup = state.drawingMarkups.find((row) => row.id === id);
  if (!markup) { window.CASTShell?.toast?.('Markup not found for RFI conversion.', { kind: 'error' }); return; }
  rfiLinkState = { status: 'pending', message: `Creating audited draft RFI snapshot for ${markup.subject || markup.tool}…` };
  renderMarkupPersistenceStatus();
  try {
    const serverMarkupId = await ensureMarkupSyncedForWorkflow(markup);
    const response = await fetch('/api/cast-cad-rfi-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ markupId: serverMarkupId, localMarkupId: markup.id, draftOnly: true }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    markup.source_snapshot = { ...(markup.source_snapshot || {}), rfiLinkId: result.rfiLink?.id || '', rfiLinkStatus: result.rfiLink?.linkStatus || 'draft', rfiLinkedAt: new Date().toISOString(), draftOnly: true };
    save();
    rfiLinkState = { status: 'draft-linked', message: `Draft RFI snapshot ${result.rfiLink?.id || ''} created from ${markup.subject || markup.tool}; no external RFI write-back was attempted.` };
    window.CASTShell?.toast?.('Draft RFI snapshot created through the audited backend contract.', { kind: 'success' });
  } catch (error) {
    console.warn('CAST CAD RFI link API unavailable or markup not synced', error);
    rfiLinkState = { status: 'blocked', message: `RFI conversion blocked: ${error.message}. No local-only or external RFI was fabricated.` };
    window.CASTShell?.toast?.('RFI conversion blocked until backend markup/RFI snapshot APIs are available.', { kind: 'error' });
  }
  render();
}
function visibleMarkups() {
  const drawing = selectedDrawing();
  return state.drawingMarkups.filter((m) => m.drawing_id === drawing?.id && m.status !== 'Deleted' && !m.deleted_at && !m.deletedAt);
}
function renderBatchStatus(rows = visibleMarkups()) {
  const status = document.querySelector('[data-batch-status]');
  if (status) status.textContent = `${selectedMarkupIds.size} of ${rows.length} visible markups selected. Sensitive stamp/resolved/verified changes require human review approval.`;
  const selectVisible = document.querySelector('[data-batch-select-visible]');
  if (selectVisible) selectVisible.checked = rows.length > 0 && rows.every((m) => selectedMarkupIds.has(m.id));
}
function batchPayload() {
  const operation = document.querySelector('[data-batch-operation]')?.value || 'flag-for-review';
  const value = document.querySelector('[data-batch-value]')?.value.trim() || '';
  const patch = {};
  const stamp = {};
  if (operation === 'set-layer') patch.layer = value || 'Batch Review';
  if (operation === 'assign-markups') patch.assigneeUserId = value || actor()?.id || '';
  if (operation === 'update-markup-status') patch.status = value || 'Needs Review';
  if (operation === 'flag-for-review') patch.priority = value || 'High';
  if (operation === 'place-stamp') stamp.label = value || 'CAST reviewed';
  return {
    type: 'batch-operation',
    operation,
    projectId: selectedDrawing()?.project_id || 'alum',
    sheetId: selectedDrawingId,
    markupIds: [...selectedMarkupIds],
    patch,
    stamp,
    humanReviewApproved: Boolean(document.querySelector('[data-batch-human-review]')?.checked),
  };
}
function applyLocalBatch(payload) {
  state.drawingMarkups.forEach((markup) => {
    if (!payload.markupIds.includes(markup.id)) return;
    if (payload.operation === 'set-layer') markup.layer = payload.patch.layer;
    if (payload.operation === 'assign-markups') markup.assignee_user_id = payload.patch.assigneeUserId;
    if (payload.operation === 'update-markup-status') markup.status = payload.patch.status;
    if (payload.operation === 'flag-for-review') { markup.status = 'Needs Review'; markup.priority = payload.patch.priority || 'High'; }
    if (payload.operation === 'place-stamp') { markup.status = payload.patch.status || markup.status; markup.source_snapshot = { ...(markup.source_snapshot || {}), batchStamp: { label: payload.stamp.label, humanReviewApproved: true, appliedAt: new Date().toISOString() } }; }
    markup.updated_at = new Date().toISOString();
  });
}
async function applyBatchOperation() {
  if (!selectedMarkupIds.size) { window.CASTShell?.toast?.('Select at least one markup before applying a batch operation.', { kind: 'error' }); return; }
  const payload = batchPayload();
  const sensitive = payload.operation === 'place-stamp' || ['Verified', 'Resolved'].includes(payload.patch.status);
  if (sensitive && !payload.humanReviewApproved) { window.CASTShell?.toast?.('Human review approval is required before batch stamping, resolving, or verifying markups.', { kind: 'error' }); return; }
  try {
    const response = await fetch('/api/cast-cad-exports', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    applyLocalBatch(payload);
    save();
    selectedMarkupIds.clear();
    window.CASTShell?.toast?.(`Batch operation applied to ${payload.markupIds.length} markup(s).`, { kind: 'success' });
    render();
  } catch (error) {
    console.warn('CAST CAD batch operation API unavailable; applying local reviewed state only when safe.', error);
    if (sensitive) { window.CASTShell?.toast?.('Backend batch audit is unavailable; sensitive batch changes were not applied.', { kind: 'error' }); return; }
    applyLocalBatch(payload);
    save();
    selectedMarkupIds.clear();
    window.CASTShell?.toast?.('Batch operation saved locally; backend audit API is unavailable.', { kind: 'info' });
    render();
  }
}
function comparisonPayload() {
  const drawing = selectedDrawing();
  return {
    type: 'comparison',
    projectId: drawing?.project_id || 'alum',
    baseSheetId: document.querySelector('[data-compare-base]')?.value || '',
    revisedSheetId: document.querySelector('[data-compare-revised]')?.value || selectedDrawingId,
  };
}
async function createComparisonJob() {
  const payload = comparisonPayload();
  if (!payload.baseSheetId || !payload.revisedSheetId || payload.baseSheetId === payload.revisedSheetId) {
    comparisonCenterState = { ...comparisonCenterState, status: 'blocked', message: 'Choose two different baseline/revised sheets before creating a comparison job.' };
    renderComparisonCenter();
    window.CASTShell?.toast?.('Choose two different sheets/revisions before comparing.', { kind: 'error' });
    return;
  }
  try {
    const response = await fetch('/api/cast-cad-exports', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    const job = result.job || {};
    comparisonCenterState = { status: job.status || 'queued', jobs: [...comparisonCenterState.jobs, job], message: job.providerRequired ? 'Comparison job recorded; CAST_CAD_COMPARISON_WORKER is required before private overlay/delta artifacts can be generated.' : 'Comparison job queued for the configured private worker.' };
    window.CASTShell?.toast?.(comparisonCenterState.message, { kind: job.providerRequired ? 'info' : 'success' });
  } catch (error) {
    console.warn('CAST CAD comparison API unavailable', error);
    comparisonCenterState = { ...comparisonCenterState, status: 'error', message: 'Comparison API unavailable; no local delta is fabricated because private drawing comparison must run in the audited backend worker.' };
    window.CASTShell?.toast?.('Comparison API unavailable; no private delta artifact was fabricated.', { kind: 'error' });
  }
  renderComparisonCenter();
}
function renderFieldModeStatus() {
  const status = document.querySelector('[data-field-status]');
  const selected = selectedDrawing();
  const packageText = fieldPackageState.packageId ? `Package ${fieldPackageState.packageId} · ${fieldPackageState.sheetIds.length || 1} sheet(s)` : 'Field mode package not created';
  if (status) status.textContent = `${packageText}. ${fieldPackageState.message || `Selected sheet ${selected?.drawing_number || selectedDrawingId}; verification/resolution sync requires human review.`}`;
  const swStatus = document.querySelector('[data-field-service-worker-status]');
  if (swStatus) swStatus.textContent = fieldServiceWorkerState.message;
}

async function registerCastCadFieldServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    fieldServiceWorkerState = { status: 'unsupported', message: 'Offline shell cache unsupported in this browser; field packages still fail closed through the backend sync contract.' };
    renderFieldModeStatus();
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('/cast-cad-field-sw.js', { scope: '/' });
    fieldServiceWorkerState = { status: 'registered', message: 'Offline shell cache registered for CAST CAD app assets only; /api, safe-data, data, sheetId streams, and PDFs remain network-only/no-store.' };
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'CAST_CAD_FIELD_CACHE_READY') {
        fieldServiceWorkerState = { status: 'ready', message: `Offline shell cache refreshed (${event.data.cache}); private drawing/API payloads cached: ${event.data.privateAssetsCached ? 'yes' : 'no'}.` };
        renderFieldModeStatus();
      }
    });
    const worker = registration.active || registration.waiting || registration.installing;
    worker?.postMessage?.({ type: 'CAST_CAD_FIELD_CACHE_REFRESH' });
  } catch (error) {
    console.warn('CAST CAD field service worker registration failed', error);
    fieldServiceWorkerState = { status: 'error', message: 'Offline shell cache registration failed; private field sync remains backend-audited and fail-closed.' };
  }
  renderFieldModeStatus();
}
function fieldModePayload() {
  const drawing = selectedDrawing();
  return {
    type: 'field-package',
    projectId: drawing?.project_id || 'alum',
    sheetIds: [selectedDrawingId].filter(Boolean),
    deviceId: document.querySelector('[data-field-device]')?.value.trim() || fieldPackageState.deviceId || 'ipad-field-01',
    expiresInHours: Number(document.querySelector('[data-field-expiry]')?.value || 24),
  };
}
async function createFieldPackageForSelectedSheet() {
  const payload = fieldModePayload();
  if (!payload.sheetIds.length) { window.CASTShell?.toast?.('Select a sheet before creating a field package.', { kind: 'error' }); return; }
  try {
    const response = await fetch('/api/cast-cad-exports', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    const fieldPackage = result.fieldPackage || result.package || {};
    fieldPackageState = { packageId: fieldPackage.id || '', deviceId: payload.deviceId, sheetIds: payload.sheetIds, status: 'ready', message: `Private no-store package ready with ${fieldPackage.markupCount ?? visibleMarkups().length} markup(s); sync endpoint remains /api/cast-cad-exports type=field-sync.` };
    window.CASTShell?.toast?.('CAST CAD field package created for tablet/offline review.', { kind: 'success' });
  } catch (error) {
    console.warn('CAST CAD field package API unavailable; using local package preview only.', error);
    fieldPackageState = { packageId: `local-field-package-${Date.now()}`, deviceId: payload.deviceId, sheetIds: payload.sheetIds, status: 'local-only', message: 'Local field package preview only; backend package/audit API is unavailable.' };
    window.CASTShell?.toast?.('Field package preview saved locally; backend package API is unavailable.', { kind: 'info' });
  }
  renderFieldModeStatus();
}
function fieldSyncPayload({ verify = false } = {}) {
  const markups = visibleMarkups();
  const target = markups[0];
  const humanReviewApproved = Boolean(document.querySelector('[data-field-human-review]')?.checked);
  return {
    type: 'field-sync',
    projectId: selectedDrawing()?.project_id || 'alum',
    packageId: fieldPackageState.packageId,
    deviceId: document.querySelector('[data-field-device]')?.value.trim() || fieldPackageState.deviceId || 'ipad-field-01',
    humanReviewApproved,
    deltas: target ? [{ operation: verify ? 'update-markup' : 'comment', markupId: target.id, patch: verify ? { status: 'Verified' } : undefined, comment: verify ? undefined : { body: 'Offline field note synced from CAST CAD tablet mode.' } }] : [{ operation: 'create-markup', markup: { sheetId: selectedDrawingId, tool: 'Pin', subject: 'Offline field note', body: 'Created from CAST CAD tablet field mode.' } }],
  };
}
function applyLocalFieldSync(payload) {
  payload.deltas.forEach((delta) => {
    if (delta.operation === 'comment') return;
    if (delta.operation === 'create-markup') {
      const drawing = selectedDrawing();
      const result = CPC.createDrawingMarkup(state, { ...markupDefaults(drawing, 28, 28), ...(delta.markup || {}), drawing_id: selectedDrawingId, project_id: drawing?.project_id || 'alum', source: 'CAST CAD offline field mode' }, actor());
      if (result.ok) CPC.createDrawingComment(state, { drawing_id: selectedDrawingId, markup_id: result.markup.id, body: result.markup.body }, actor());
      return;
    }
    if (delta.operation === 'update-markup') {
      const markup = state.drawingMarkups.find((row) => row.id === delta.markupId);
      if (markup) { Object.assign(markup, delta.patch || {}, { updated_at: new Date().toISOString(), source_snapshot: { ...(markup.source_snapshot || {}), fieldSync: { packageId: payload.packageId, deviceId: payload.deviceId, humanReviewApproved: payload.humanReviewApproved } } }); }
    }
  });
}
async function syncFieldModeDelta({ verify = false } = {}) {
  if (!fieldPackageState.packageId) { window.CASTShell?.toast?.('Create a field package before syncing offline deltas.', { kind: 'error' }); return; }
  const payload = fieldSyncPayload({ verify });
  const sensitive = payload.deltas.some((delta) => delta.operation === 'update-markup' && ['Verified','Resolved'].includes(delta.patch?.status));
  if (sensitive && !payload.humanReviewApproved) { window.CASTShell?.toast?.('Human review approval is required before offline field sync can verify or resolve markups.', { kind: 'error' }); fieldPackageState.message = 'Verification sync blocked: human review approval required.'; renderFieldModeStatus(); return; }
  try {
    const response = await fetch('/api/cast-cad-exports', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    applyLocalFieldSync(payload);
    save();
    fieldPackageState.message = `Field sync applied: ${result.event?.appliedCount ?? payload.deltas.length} delta(s) audited by backend.`;
    window.CASTShell?.toast?.('Field sync applied through the audited backend contract.', { kind: 'success' });
    render();
  } catch (error) {
    console.warn('CAST CAD field sync API unavailable; fail closed for sensitive deltas.', error);
    if (sensitive) { fieldPackageState.message = 'Backend field-sync audit unavailable; sensitive verification/resolution was not applied.'; window.CASTShell?.toast?.('Backend field-sync audit is unavailable; verification was not applied.', { kind: 'error' }); renderFieldModeStatus(); return; }
    applyLocalFieldSync(payload);
    save();
    fieldPackageState.message = 'Field note saved locally; backend field-sync audit API is unavailable.';
    window.CASTShell?.toast?.('Field note saved locally; backend field-sync audit API is unavailable.', { kind: 'info' });
    render();
  }
}
function exportJobPayload(type) {
  const drawing = selectedDrawing();
  return {
    type,
    projectId: drawing?.project_id || 'alum',
    sheetId: selectedDrawingId,
    format: type === 'takeoff-workbook' ? 'xlsx' : 'pdf',
    flatten: type === 'annotated-pdf' ? Boolean(document.querySelector('[data-export-flatten]')?.checked ?? true) : undefined,
  };
}
async function createBackendExportJob(type = 'takeoff-workbook') {
  const payload = exportJobPayload(type);
  if (!payload.sheetId) {
    exportCenterState = { ...exportCenterState, status: 'blocked', message: 'Select a drawing sheet before requesting a backend export job.' };
    renderExportCenter();
    window.CASTShell?.toast?.('Select a sheet before requesting a CAST CAD export job.', { kind: 'error' });
    return;
  }
  try {
    const response = await fetch('/api/cast-cad-exports', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) throw new Error(result?.error || (result?.errors || []).join(' ') || `HTTP ${response.status}`);
    const job = result.exportJob || result.job || {};
    const providerRequired = Boolean(job.providerRequired);
    exportCenterState = { status: job.status || 'recorded', jobs: [...exportCenterState.jobs, job], message: providerRequired ? 'Annotated PDF export job recorded; CAST_CAD_PDF_EXPORT_WORKER is required before private flattened/annotated PDF artifacts can be generated.' : `${job.type === 'annotated-pdf' ? 'Annotated PDF' : 'Takeoff workbook'} export job recorded by the audited backend contract.` };
    window.CASTShell?.toast?.(exportCenterState.message, { kind: providerRequired ? 'info' : 'success' });
  } catch (error) {
    console.warn('CAST CAD export API unavailable', error);
    exportCenterState = { ...exportCenterState, status: 'error', message: 'Backend export API unavailable; no local authoritative workbook or flattened private PDF artifact was fabricated.' };
    window.CASTShell?.toast?.('Backend export API unavailable; export artifact was not fabricated.', { kind: 'error' });
  }
  renderExportCenter();
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
  if (sheet) { selectedDrawingId = sheet.dataset.sheet; calibration = null; clearStreamedPdf(); drawingStreamState = { drawingId: selectedDrawingId, status: 'idle', message: '' }; render(); loadSelectedDrawingPdf({ toast: true }); loadServerMarkupsForSelectedDrawing(); loadViewportMappingForSelectedSheet(); return; }
  const tool = event.target.closest('[data-tool]');
  if (tool) { activeTool = tool.dataset.tool; document.querySelectorAll('[data-tool]').forEach((el) => el.classList.toggle('active', el === tool)); return; }
  if (event.target.closest('[data-add-markup]')) addMarkup();
  if (event.target.closest('[data-load-current-set]')) { loadCurrentDrawingSet({ force: true, toast: true }); return; }
  if (event.target.closest('[data-calibrate-scale]')) { calibration = { drawingId: selectedDrawingId, first: null }; renderScaleStatus(); window.CASTShell?.toast?.('Click two points on the sheet that match the known length.', { kind: 'info' }); return; }
  if (event.target.closest('[data-clear-pdf]')) { clearUploadedPdf(); clearStreamedPdf(); drawingStreamState = { drawingId: selectedDrawingId, status: 'idle', message: '' }; renderViewer(); loadSelectedDrawingPdf({ toast: true }); return; }
  if (event.target.closest('[data-open-server-pdf]')) { openSelectedPdf(); return; }
  if (event.target.closest('[data-open-edit-link]')) { openSelectedEditLink(); return; }
  if (event.target.closest('[data-save-viewer-preferences]')) { persistViewerPreferences({ toast: true }); return; }
  if (event.target.closest('[data-save-viewport-mapping]')) { saveViewportMappingForSelectedSheet({ toast: true }); return; }
  const batchMarkup = event.target.closest('[data-batch-markup]');
  if (batchMarkup) { if (batchMarkup.checked) selectedMarkupIds.add(batchMarkup.dataset.batchMarkup); else selectedMarkupIds.delete(batchMarkup.dataset.batchMarkup); renderBatchStatus(); return; }
  if (event.target.closest('[data-apply-batch]')) { applyBatchOperation(); return; }
  if (event.target.closest('[data-create-comparison]')) { createComparisonJob(); return; }
  if (event.target.closest('[data-create-field-package]')) { createFieldPackageForSelectedSheet(); return; }
  if (event.target.closest('[data-sync-field-note]')) { syncFieldModeDelta({ verify: false }); return; }
  if (event.target.closest('[data-sync-field-verify]')) { syncFieldModeDelta({ verify: true }); return; }
  if (event.target.closest('[data-create-workbook-export]')) { createBackendExportJob('takeoff-workbook'); return; }
  if (event.target.closest('[data-create-annotated-pdf-export]')) { createBackendExportJob('annotated-pdf'); return; }
  if (event.target.closest('[data-import-document-metadata]')) { importCurrentSetDocumentMetadata({ toast: true }); return; }
  if (event.target.closest('[data-refresh-document-metadata]')) { loadDocumentMetadataRegistry(); return; }
  if (event.target.closest('[data-create-tool-library-item]')) { createToolLibrarySeedItem(); return; }
  if (event.target.closest('[data-place-tool-library-item]')) { placeSelectedToolLibraryItem(); return; }
  if (event.target.closest('[data-refresh-tool-library]')) { loadToolLibraryItems({ toast: true }); return; }
  if (event.target.closest('[data-create-ai-finding]')) { createAiReviewFinding(); return; }
  if (event.target.closest('[data-review-ai-finding]')) { reviewSelectedAiFinding(); return; }
  if (event.target.closest('[data-refresh-ai-findings]')) { loadAiReviewFindings({ toast: true }); return; }
  if (event.target.closest('[data-create-review-room]')) { createReviewRoomForSelectedScope(); return; }
  if (event.target.closest('[data-refresh-review-rooms]')) { loadReviewRooms({ toast: true }); return; }
  if (event.target.closest('[data-refresh-governance]')) { loadGovernanceStatus({ toast: true }); return; }
  if (event.target.closest('[data-assign-governance-role]')) { assignGovernanceMemberRole(); return; }
  const verify = event.target.closest('[data-verify-qty]'); if (verify) verifyQuantity(verify.dataset.verifyQty);
  const resolve = event.target.closest('[data-resolve]'); if (resolve) resolveMarkup(resolve.dataset.resolve);
  const deleteMarkup = event.target.closest('[data-delete-markup]'); if (deleteMarkup) { deleteMarkupWithBackend(deleteMarkup.dataset.deleteMarkup); return; }
  const rfi = event.target.closest('[data-rfi]'); if (rfi) { convertMarkupToRfiDraft(rfi.dataset.rfi); return; }
  if (event.target.closest('[data-export]')) exportCsv();
  if (event.target.closest('[data-reset]')) { clearUploadedPdf(); clearStreamedPdf(); drawingStreamState = { drawingId: '', status: 'idle', message: '' }; calibration = null; state = CPC.ensureDrawingIntelligenceState(CPC.resetState()); selectedDrawingId = state.drawings[0]?.id || ''; loadCurrentDrawingSet({ force: true, toast: false }); }
});

document.addEventListener('change', (event) => {
  const input = event.target.closest('[data-pdf-input]');
  if (input) handlePdfUpload(input.files?.[0]);
  const selectVisible = event.target.closest('[data-batch-select-visible]');
  if (selectVisible) { visibleMarkups().forEach((m) => { if (selectVisible.checked) selectedMarkupIds.add(m.id); else selectedMarkupIds.delete(m.id); }); render(); return; }
  if (event.target.closest('[data-viewer-layout], [data-viewer-zoom], [data-viewer-pref]')) persistViewerPreferences({ toast: false });
  const toolLibraryItem = event.target.closest('[data-tool-library-item]');
  if (toolLibraryItem) { toolLibraryState.selectedItemId = toolLibraryItem.dataset.toolLibraryItem; renderToolLibrary(); return; }
  const aiFinding = event.target.closest('[data-ai-finding]');
  if (aiFinding) { aiReviewState.selectedFindingId = aiFinding.dataset.aiFinding; renderAiReviewFindings(); return; }
});
document.querySelector('[data-annotation-layer]')?.addEventListener('click', addMarkupFromOverlay);
document.querySelector('[data-viewer]')?.addEventListener('click', addMarkupFromOverlay);
window.addEventListener('beforeunload', () => { clearUploadedPdf(); clearStreamedPdf(); });

render();
registerCastCadFieldServiceWorker();
loadServerViewerPreferences();
loadCurrentDrawingSet({ force: false, toast: false });
loadServerMarkupsForSelectedDrawing();
loadViewportMappingForSelectedSheet();
loadDocumentMetadataRegistry();
loadToolLibraryItems();
loadAiReviewFindings();
loadReviewRooms();
loadGovernanceStatus();
