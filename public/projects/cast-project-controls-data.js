(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CastProjectControls = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const RFI_STATUSES = ['Draft', 'Open', 'Closed', 'Closed Draft', 'Closed Revised', 'Void'];
  const RESPONSE_STATUSES = ['Pending', 'Submitted', 'Returned', 'Official', 'Superseded'];
  const IMPACT_STATUSES = ['No', 'Yes Known', 'Yes Unknown', 'To Be Determined', 'Not Applicable'];
  const ROLES = ['Owner Admin', 'CAST Admin', 'Project Manager', 'Project Engineer', 'Architect', 'Consultant', 'General Contractor', 'Subcontractor', 'Read Only Viewer'];
  const STORAGE_KEY = 'cast-project-controls-v1';
  const CAST_CAD_FEATURE_FLAGS = [
    { key: 'castCadPdfViewer', label: 'PDF viewer and sheet index', phase: 1, enabled: true },
    { key: 'castCadMarkups', label: 'Markup engine and Markups List', phase: 2, enabled: true },
    { key: 'castCadMeasurements', label: 'Scale calibration and takeoff workbook', phase: 3, enabled: true },
    { key: 'castCadToolLibrary', label: 'CAST Tool Library', phase: 4, enabled: false },
    { key: 'castCadDrawingSets', label: 'Drawing set versions and slip-sheeting', phase: 5, enabled: false },
    { key: 'castCadComparisonCenter', label: 'Comparison and overlay center', phase: 6, enabled: false },
    { key: 'castCadOcrSearch', label: 'OCR, visual search, and auto link', phase: 7, enabled: false },
    { key: 'castCadRfiSubmittalLinks', label: 'RFI/submittal linked workflows', phase: 8, enabled: false },
    { key: 'castCadReviewRooms', label: 'Collaboration review rooms', phase: 9, enabled: false },
    { key: 'castCadAiReview', label: 'CAST CAD AI agents', phase: 10, enabled: false },
    { key: 'castCadAdvancedBatchMobile', label: 'Batch tools and mobile field mode', phase: 11, enabled: false },
  ];
  const CAST_CAD_MODULES = [
    { key: 'drawingViewer', label: 'Drawing Viewer', phase: 1, status: 'mvp-active' },
    { key: 'drawingSets', label: 'Drawing Sets', phase: 1, status: 'mvp-active' },
    { key: 'markupsList', label: 'Markups List', phase: 2, status: 'mvp-active' },
    { key: 'takeoffWorkbook', label: 'Takeoff Workbook', phase: 3, status: 'mvp-active' },
    { key: 'castToolLibrary', label: 'CAST Tool Library', phase: 4, status: 'flagged-roadmap' },
    { key: 'comparisonCenter', label: 'Comparison Center', phase: 6, status: 'flagged-roadmap' },
    { key: 'ocrVisualSearch', label: 'OCR + Visual Search', phase: 7, status: 'flagged-roadmap' },
    { key: 'reviewRooms', label: 'Review Sessions + Project Rooms', phase: 9, status: 'flagged-roadmap' },
    { key: 'aiReview', label: 'AI Review', phase: 10, status: 'flagged-roadmap' },
    { key: 'adminGovernance', label: 'Admin + Governance', phase: 1, status: 'architecture-required' },
  ];
  const CAST_CAD_AGENTS = ['Plan Reviewer', 'Compare Agent', 'Takeoff Agent', 'RFI Agent', 'Submittal Agent', 'Code Reviewer', 'Cost Risk Agent', 'Constructability Agent', 'Document Librarian', 'Lender Package Agent'].map((name, index) => ({ id: `cast_cad_agent_${index + 1}`, name, guardrail: 'AI detected until human verified', enabled: false }));
  const CAST_CAD_DATABASE_TABLES = ['projects','drawing_sets','drawing_sheets','drawing_revisions','documents','document_versions','document_pages','document_ocr','markups','markup_geometry','markup_comments','markup_status_history','markup_attachments','tool_sets','tool_items','measurements','takeoff_items','takeoff_workbooks','spaces','levels','units','comparison_jobs','comparison_results','visual_search_jobs','batch_jobs','review_sessions','session_participants','session_activity','rfi_links','submittal_links','change_event_links','exports','audit_logs','ai_findings','ai_agent_runs','user_preferences','keyboard_shortcuts','integrations','external_collaborators','permissions'];

  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const byId = (rows, rowId) => rows.find((row) => row.id === rowId);

  function pad(n) { return String(n).padStart(4, '0'); }
  function parseRfiSequence(rfiNumber) { const m = String(rfiNumber || '').match(/(\d{1,})\s*$/); return m ? Number(m[1]) : 0; }
  function generateRfiNumber(rfis, projectId, stagePrefix = '') {
    const projectRfis = rfis.filter((r) => r.project_id === projectId && !r.previous_revision_id);
    const next = Math.max(0, ...projectRfis.map((r) => parseRfiSequence(r.rfi_number))) + 1;
    return `${stagePrefix ? `${stagePrefix} ` : ''}RFI ${pad(next)}`;
  }
  function duplicateRfiNumber(rfis, projectId, rfiNumber, rootRfiId) {
    return rfis.some((r) => r.project_id === projectId && r.rfi_number === rfiNumber && (r.root_rfi_id || r.id) !== rootRfiId);
  }
  function daysBetween(a, b) { return Math.floor((new Date(b) - new Date(a)) / 86400000); }
  function isOverdue(rfi, asOf = today()) { return rfi.status === 'Open' && rfi.due_date && rfi.due_date < asOf; }
  function daysOpen(rfi, asOf = today()) { return rfi.date_closed ? daysBetween(rfi.date_created, rfi.date_closed) : Math.max(0, daysBetween(rfi.date_created, asOf)); }

  const broadRoles = new Set(['Owner Admin', 'CAST Admin', 'Project Manager']);
  function canViewRfi(user, rfi) {
    if (!rfi.private_flag) return true;
    if (!user) return false;
    if (broadRoles.has(user.role)) return true;
    return rfi.rfi_manager_user_id === user.id || rfi.created_by_user_id === user.id || (rfi.ball_in_court_user_ids || []).includes(user.id) || (rfi.distribution_user_ids || []).includes(user.id);
  }
  function canPerform(user, action, rfi) {
    if (!user) return false;
    if (['Owner Admin', 'CAST Admin'].includes(user.role)) return true;
    if (user.role === 'Read Only Viewer') return action === 'view' || action === 'export';
    if (user.role === 'Project Manager') return ['view', 'create', 'edit', 'route', 'respond', 'official', 'close', 'reopen', 'revise', 'export'].includes(action);
    if (user.role === 'Project Engineer') return ['view', 'create', 'editDraft', 'route', 'respond', 'close', 'reopen', 'revise', 'export'].includes(action) && (!rfi || rfi.created_by_user_id === user.id || (rfi.ball_in_court_user_ids || []).includes(user.id));
    if (user.role === 'Architect') return ['view', 'respond', 'export'].includes(action) || (['official', 'close', 'reopen'].includes(action) && rfi?.rfi_manager_user_id === user.id);
    if (user.role === 'Consultant') return ['view', 'export'].includes(action) || (action === 'respond' && (rfi?.ball_in_court_user_ids || []).includes(user.id));
    if (user.role === 'General Contractor') return ['view', 'create', 'respond', 'export'].includes(action) || (action === 'editDraft' && rfi?.created_by_user_id === user.id && rfi.status === 'Draft');
    if (user.role === 'Subcontractor') return ['view'].includes(action) || (action === 'createDraft') || (action === 'respond' && (rfi?.ball_in_court_user_ids || []).includes(user.id)) || (action === 'export' && rfi?.created_by_user_id === user.id);
    return false;
  }

  function audit(state, entityType, entityId, action, performedBy, previousValue, newValue, notes = '') {
    state.auditLog.push({ id: id('audit'), entity_type: entityType, entity_id: entityId, action, performed_by: performedBy, performed_at: new Date().toISOString(), previous_value: previousValue || null, new_value: newValue || null, notes });
  }
  function notify(state, userIds, type, entityId, message) {
    [...new Set(userIds.filter(Boolean))].forEach((userId) => state.notifications.push({ id: id('note'), user_id: userId, type, entity_id: entityId, message, read: false, created_at: new Date().toISOString(), channel: 'in-app' }));
  }

  function validateRfi(input, state, mode = input.status || 'Draft') {
    const errors = [];
    if (!String(input.subject || '').trim()) errors.push('Subject is required.');
    if (!String(input.question || '').trim()) errors.push('Question is required.');
    if (mode === 'Open') {
      if (!String(input.rfi_number || '').trim()) errors.push('RFI number is required for open RFIs.');
      if (!input.due_date) errors.push('Due date is required for open RFIs.');
      if (!(input.ball_in_court_user_ids || input.assignee_user_ids || []).length) errors.push('At least one assignee is required for open RFIs.');
    }
    const root = input.root_rfi_id || input.id;
    if (input.rfi_number && duplicateRfiNumber(state.rfis, input.project_id, input.rfi_number, root)) errors.push('Duplicate RFI numbers are not allowed within a project unless it is a revision.');
    return errors;
  }

  function createRfi(state, input, actor, status = 'Draft') {
    const rfiNumber = input.rfi_number || (status === 'Open' ? generateRfiNumber(state.rfis, input.project_id, input.stage_prefix) : 'Draft');
    const now = new Date().toISOString();
    const assignees = input.assignee_user_ids || input.ball_in_court_user_ids || [];
    const rfi = {
      id: id('rfi'), project_id: input.project_id, rfi_number: rfiNumber, revision_number: 0, subject: input.subject || '', question: input.question || '', status,
      priority: input.priority || 'Normal', created_by_user_id: actor.id, received_from_user_id: input.received_from_user_id || actor.id, responsible_company_id: input.responsible_company_id || '', rfi_manager_user_id: input.rfi_manager_user_id || actor.id,
      ball_in_court_user_ids: status === 'Open' ? assignees : [], assignee_user_ids: assignees, distribution_user_ids: input.distribution_user_ids || [], date_created: today(), date_initiated: status === 'Open' ? today() : '', due_date: input.due_date || '', date_closed: '', closed_by_user_id: '',
      drawing_id: input.drawing_id || '', drawing_number: input.drawing_number || '', spec_section_id: input.spec_section_id || '', location_id: input.location_id || '', linked_document_ids: input.linked_document_ids || [], cost_code: input.cost_code || '',
      cost_impact_status: input.cost_impact_status || 'To Be Determined', cost_impact_amount: Number(input.cost_impact_amount || 0), schedule_impact_status: input.schedule_impact_status || 'To Be Determined', schedule_impact_days: Number(input.schedule_impact_days || 0),
      private_flag: Boolean(input.private_flag), official_response_id: '', root_rfi_id: '', previous_revision_id: '', attachments: input.attachments || [], created_at: now, updated_at: now,
    };
    rfi.root_rfi_id = rfi.id;
    const errors = validateRfi(rfi, state, status);
    if (errors.length) return { ok: false, errors };
    state.rfis.push(rfi);
    state.rfiAssignees.push(...assignees.map((userId) => ({ id: id('rfi_asg'), rfi_id: rfi.id, user_id: userId })));
    audit(state, 'RFI', rfi.id, 'Created RFI', actor.id, null, rfi, status);
    if (status === 'Open') notify(state, assignees, 'RFI assigned', rfi.id, `${rfi.rfi_number} assigned: ${rfi.subject}`);
    return { ok: true, rfi };
  }
  function submitResponse(state, rfiId, actor, body) {
    const rfi = byId(state.rfis, rfiId);
    if (!rfi) return { ok: false, errors: ['RFI not found.'] };
    if (!canPerform(actor, 'respond', rfi)) return { ok: false, errors: ['User cannot respond to this RFI.'] };
    const response = { id: id('resp'), rfi_id: rfiId, responder_user_id: actor.id, body, status: 'Submitted', submitted_at: new Date().toISOString() };
    state.rfiResponses.push(response);
    audit(state, 'RFI', rfiId, 'Added response', actor.id, null, response);
    notify(state, [rfi.rfi_manager_user_id], 'RFI response posted', rfiId, `Response posted for ${rfi.rfi_number}`);
    return { ok: true, response };
  }
  function markOfficialResponse(state, rfiId, responseId, actor) {
    const rfi = byId(state.rfis, rfiId);
    if (!rfi) return { ok: false, errors: ['RFI not found.'] };
    if (!canPerform(actor, 'official', rfi)) return { ok: false, errors: ['User cannot mark official responses.'] };
    state.rfiResponses.filter((r) => r.rfi_id === rfiId).forEach((r) => { if (r.status === 'Official') r.status = 'Superseded'; });
    const response = byId(state.rfiResponses, responseId);
    if (!response) return { ok: false, errors: ['Response not found.'] };
    response.status = 'Official';
    rfi.official_response_id = responseId; rfi.updated_at = new Date().toISOString();
    audit(state, 'RFI', rfiId, 'Marked official response', actor.id, null, response);
    notify(state, [rfi.created_by_user_id, ...rfi.assignee_user_ids, ...rfi.distribution_user_ids], 'Official response marked', rfiId, `Official response marked for ${rfi.rfi_number}`);
    return { ok: true, rfi, response };
  }
  function closeRfi(state, rfiId, actor) {
    const rfi = byId(state.rfis, rfiId); if (!rfi) return { ok: false, errors: ['RFI not found.'] };
    if (!canPerform(actor, 'close', rfi)) return { ok: false, errors: ['User cannot close this RFI.'] };
    const previous = clone(rfi); rfi.status = rfi.status === 'Draft' ? 'Closed Draft' : 'Closed'; rfi.date_closed = today(); rfi.closed_by_user_id = actor.id; rfi.ball_in_court_user_ids = []; rfi.updated_at = new Date().toISOString();
    audit(state, 'RFI', rfiId, 'Closed RFI', actor.id, previous, rfi); notify(state, [rfi.created_by_user_id, ...rfi.assignee_user_ids, ...rfi.distribution_user_ids], 'RFI closed', rfiId, `${rfi.rfi_number} closed`);
    return { ok: true, rfi };
  }
  function reopenRfi(state, rfiId, actor) {
    const rfi = byId(state.rfis, rfiId); if (!rfi) return { ok: false, errors: ['RFI not found.'] };
    if (!canPerform(actor, 'reopen', rfi)) return { ok: false, errors: ['User cannot reopen this RFI.'] };
    const previous = clone(rfi); rfi.status = previous.status === 'Closed Draft' ? 'Draft' : 'Open'; rfi.date_closed = ''; rfi.closed_by_user_id = ''; rfi.ball_in_court_user_ids = rfi.assignee_user_ids || []; rfi.updated_at = new Date().toISOString();
    audit(state, 'RFI', rfiId, 'Reopened RFI', actor.id, previous, rfi); notify(state, [rfi.created_by_user_id, ...rfi.assignee_user_ids], 'RFI reopened', rfiId, `${rfi.rfi_number} reopened`);
    return { ok: true, rfi };
  }
  function reviseRfi(state, rfiId, actor, overrides = {}) {
    const old = byId(state.rfis, rfiId); if (!old) return { ok: false, errors: ['RFI not found.'] };
    if (!canPerform(actor, 'revise', old)) return { ok: false, errors: ['User cannot revise this RFI.'] };
    const previous = clone(old); old.status = 'Closed Revised'; old.date_closed = today(); old.closed_by_user_id = actor.id;
    const next = clone(old); next.id = id('rfi'); next.revision_number = Number(old.revision_number || 0) + 1; next.previous_revision_id = old.id; next.root_rfi_id = old.root_rfi_id || old.id; next.status = overrides.status || 'Draft'; next.subject = overrides.subject || old.subject; next.question = overrides.question || old.question; next.date_created = today(); next.date_initiated = next.status === 'Open' ? today() : ''; next.date_closed = ''; next.closed_by_user_id = ''; next.official_response_id = ''; next.created_at = new Date().toISOString(); next.updated_at = next.created_at; next.ball_in_court_user_ids = next.status === 'Open' ? (next.assignee_user_ids || []) : [];
    const errors = validateRfi(next, state, next.status); if (errors.length) return { ok: false, errors };
    state.rfis.push(next); state.rfiRevisions.push({ id: id('rev'), root_rfi_id: next.root_rfi_id, previous_revision_id: old.id, new_revision_id: next.id, revision_number: next.revision_number, created_by_user_id: actor.id, created_at: next.created_at });
    audit(state, 'RFI', old.id, 'Revised RFI', actor.id, previous, old); audit(state, 'RFI', next.id, 'Created RFI revision', actor.id, null, next);
    return { ok: true, previous: old, rfi: next };
  }
  function addComment(state, rfiId, actor, body) { const c = { id: id('comment'), rfi_id: rfiId, user_id: actor.id, body, created_at: new Date().toISOString() }; state.rfiComments.push(c); audit(state, 'RFI', rfiId, 'Added comment', actor.id, null, c); return c; }

  function ensureDrawingIntelligenceState(state) {
    state.drawingReviewSessions ||= [];
    state.drawingMarkups ||= [];
    state.drawingComments ||= [];
    state.drawingIssues ||= [];
    state.estimateQuantities ||= [];
    state.estimateFindings ||= [];
    return state;
  }
  function createDrawingMarkup(state, input, actor) {
    ensureDrawingIntelligenceState(state);
    const now = new Date().toISOString();
    const markup = {
      id: id('markup'), project_id: input.project_id || 'broderick', drawing_id: input.drawing_id, revision_id: input.revision_id || '', markup_type: input.markup_type || 'comment-pin', tool: input.tool || 'Pin', subject: input.subject || '', body: input.body || '',
      x: Number(input.x ?? 50), y: Number(input.y ?? 50), width: Number(input.width || 0), height: Number(input.height || 0), page_number: Number(input.page_number || 1), status: input.status || 'Open', priority: input.priority || 'Normal', trade: input.trade || '', cost_code: input.cost_code || '',
      measurement_value: input.measurement_value === undefined ? 0 : Number(input.measurement_value || 0), measurement_unit: input.measurement_unit || '', scale_label: input.scale_label || '',
      assignee_user_id: input.assignee_user_id || '', created_by_user_id: actor.id, created_at: now, updated_at: now, source: input.source || 'CAST Drawing Review'
    };
    state.drawingMarkups.push(markup);
    audit(state, 'DrawingMarkup', markup.id, 'Created drawing markup', actor.id, null, markup);
    if (markup.assignee_user_id) notify(state, [markup.assignee_user_id], 'Drawing markup assigned', markup.id, `${markup.subject || markup.tool} assigned`);
    return { ok: true, markup };
  }
  function createDrawingComment(state, input, actor) {
    ensureDrawingIntelligenceState(state);
    const comment = { id: id('draw_comment'), markup_id: input.markup_id || '', drawing_id: input.drawing_id, user_id: actor.id, body: input.body || '', status: input.status || 'Open', created_at: new Date().toISOString() };
    state.drawingComments.push(comment);
    audit(state, 'DrawingComment', comment.id, 'Added drawing comment', actor.id, null, comment);
    return { ok: true, comment };
  }
  function updateDrawingIssueStatus(state, markupId, status, actor) {
    ensureDrawingIntelligenceState(state);
    const markup = byId(state.drawingMarkups, markupId);
    if (!markup) return { ok: false, errors: ['Drawing markup not found.'] };
    const previous = clone(markup);
    markup.status = status;
    markup.updated_at = new Date().toISOString();
    audit(state, 'DrawingMarkup', markupId, 'Updated drawing markup status', actor.id, previous, markup);
    return { ok: true, markup };
  }
  function verifyEstimateQuantity(state, quantityId, actor, overrides = {}) {
    ensureDrawingIntelligenceState(state);
    const quantity = byId(state.estimateQuantities, quantityId);
    if (!quantity) return { ok: false, errors: ['Estimate quantity not found.'] };
    const previous = clone(quantity);
    if (overrides.quantity !== undefined) quantity.quantity = Number(overrides.quantity);
    if (overrides.cost_code) quantity.cost_code = overrides.cost_code;
    if (overrides.notes !== undefined) quantity.notes = overrides.notes;
    quantity.verification_status = overrides.status || 'Verified';
    quantity.reviewed_by_user_id = actor.id;
    quantity.reviewed_at = new Date().toISOString();
    audit(state, 'EstimateQuantity', quantityId, 'Verified estimate quantity', actor.id, previous, quantity);
    return { ok: true, quantity };
  }
  function drawingIntelligenceMetrics(state) {
    ensureDrawingIntelligenceState(state);
    const openMarkups = state.drawingMarkups.filter((m) => m.status !== 'Resolved');
    const verified = state.estimateQuantities.filter((q) => q.verification_status === 'Verified');
    const needsReview = state.estimateQuantities.filter((q) => q.verification_status === 'Needs Review');
    const highRiskFindings = state.estimateFindings.filter((f) => f.severity === 'High' && f.status !== 'Closed');
    const deltaTotal = state.estimateQuantities.reduce((sum, q) => sum + Number(q.proforma_delta_amount || 0), 0);
    return { openMarkups: openMarkups.length, resolvedMarkups: state.drawingMarkups.length - openMarkups.length, verifiedQuantities: verified.length, quantitiesNeedingReview: needsReview.length, highRiskFindings: highRiskFindings.length, proformaDeltaAmount: deltaTotal };
  }
  function exportDrawingReviewCsv(state) {
    ensureDrawingIntelligenceState(state);
    const cols = ['drawing_number','subject','tool','status','priority','trade','cost_code','measurement_value','measurement_unit','scale_label','body'];
    const rows = state.drawingMarkups.map((m) => { const drawing = byId(state.drawings, m.drawing_id); return { ...m, drawing_number: drawing?.drawing_number || m.drawing_id }; });
    return [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n');
  }
  function normalizeCastCadPoint(point) {
    return { x: Math.max(0, Math.min(100, Number(point?.x || 0))), y: Math.max(0, Math.min(100, Number(point?.y || 0))) };
  }
  function calibrateCastCadScale({ knownLength, unit = 'FT', firstPoint, secondPoint }) {
    const length = Number(knownLength || 0);
    const a = normalizeCastCadPoint(firstPoint);
    const b = normalizeCastCadPoint(secondPoint);
    const percentDistance = Number(Math.hypot(b.x - a.x, b.y - a.y).toFixed(6));
    if (!length || !percentDistance) return { ok: false, errors: ['Known length and two distinct calibration points are required.'] };
    const scale = { known_length: length, unit, percent_distance: percentDistance, units_per_percent: Number((length / percentDistance).toFixed(6)), calibrated_at: new Date().toISOString() };
    return { ok: true, scale };
  }
  function polygonArea(points) {
    if (points.length < 3) return 0;
    let sum = 0;
    points.forEach((point, i) => { const next = points[(i + 1) % points.length]; sum += point.x * next.y - next.x * point.y; });
    return Math.abs(sum) / 2;
  }
  function measureCastCadGeometry({ tool, scale, points = [], count = 1 }) {
    const normalized = points.map(normalizeCastCadPoint);
    const unitsPerPercent = Number(scale?.units_per_percent || scale?.knownLength / scale?.percentDistance || scale?.known_length / scale?.percent_distance || 0);
    const unit = String(scale?.unit || 'FT').toUpperCase();
    if (/count/i.test(tool || '')) return { value: Number(count || 1), unit: 'EA', precision: 0, source: 'CAST CAD count' };
    if (!unitsPerPercent || normalized.length < 2) return { value: 0, unit: /area/i.test(tool || '') ? 'SF' : 'LF', precision: 2, source: 'scale required' };
    if (/area|polygon|fill/i.test(tool || '')) {
      const value = polygonArea(normalized) * unitsPerPercent * unitsPerPercent;
      return { value: Number(value.toFixed(2)), unit: unit === 'IN' ? 'SQ IN' : 'SF', precision: 2, source: 'CAST CAD calibrated area' };
    }
    let lengthPercent = 0;
    for (let i = 1; i < normalized.length; i += 1) lengthPercent += Math.hypot(normalized[i].x - normalized[i - 1].x, normalized[i].y - normalized[i - 1].y);
    const value = lengthPercent * unitsPerPercent;
    return { value: Number(value.toFixed(2)), unit: unit === 'IN' ? 'IN' : 'LF', precision: 2, source: 'CAST CAD calibrated length' };
  }
  const CAST_CAD_ASSEMBLIES = [
    { key: 'coordination', label: 'Coordination / review item', trade: 'Coordination', cost_code: '01-3100', unit: 'EA', unit_cost: 0, formula: 'quantity' },
    { key: 'drywall_partition', label: 'Drywall partition wall', trade: 'Drywall', cost_code: '09-2116', unit: 'LF', unit_cost: 85, formula: 'quantity * 1.05' },
    { key: 'roof_waterproofing', label: 'Roof waterproofing membrane', trade: 'Roofing', cost_code: '07-5400', unit: 'SF', unit_cost: 18, formula: 'quantity * 1.03' },
    { key: 'door_frame', label: 'Hollow metal door/frame', trade: 'Openings', cost_code: '08-1113', unit: 'EA', unit_cost: 1600, formula: 'quantity' },
    { key: 'electrical_branch', label: 'Electrical branch rough-in', trade: 'Electrical', cost_code: '26-0500', unit: 'LF', unit_cost: 42, formula: 'quantity * 1.08' },
    { key: 'mechanical_duct', label: 'Mechanical duct run', trade: 'Mechanical', cost_code: '23-0500', unit: 'LF', unit_cost: 64, formula: 'quantity * 1.10' },
    { key: 'plumbing_pipe', label: 'Plumbing pipe rough-in', trade: 'Plumbing', cost_code: '22-0500', unit: 'LF', unit_cost: 58, formula: 'quantity * 1.10' },
  ];
  function castCadAssemblyLibrary() { return clone(CAST_CAD_ASSEMBLIES); }
  function castCadAssemblyFor(input = {}) {
    const key = String(input.assemblyKey || input.assembly_key || '').toLowerCase();
    const costCode = String(input.costCode || input.cost_code || '').toLowerCase();
    const trade = String(input.trade || '').toLowerCase();
    const unit = String(input.unit || input.measurement_unit || '').toUpperCase();
    return CAST_CAD_ASSEMBLIES.find((row) => row.key === key)
      || CAST_CAD_ASSEMBLIES.find((row) => row.cost_code.toLowerCase() === costCode)
      || CAST_CAD_ASSEMBLIES.find((row) => row.trade.toLowerCase() === trade && (!unit || row.unit === unit))
      || CAST_CAD_ASSEMBLIES[0];
  }
  function evaluateCastCadFormula(formula, quantity) {
    const expression = String(formula || 'quantity').trim();
    if (!/^[0-9+\-*/().\squantity]+$/i.test(expression)) return Number(quantity || 0);
    try {
      const result = Function('quantity', '"use strict"; return (' + expression.replace(/quantity/gi, 'quantity') + ');')(Number(quantity || 0));
      return Number.isFinite(Number(result)) ? Number(Number(result).toFixed(6)) : Number(quantity || 0);
    } catch { return Number(quantity || 0); }
  }
  function buildCastCadTakeoffRow(state, { drawing, markup, assemblyKey = '', caption = '', precision = 2, formula = '', unitCost = null } = {}) {
    ensureDrawingIntelligenceState(state);
    const measurementValue = Number(markup?.measurement_value ?? markup?.measurement?.value ?? (markup?.tool === 'Count' ? 1 : 0));
    const measurementUnit = String(markup?.measurement_unit || markup?.measurement?.unit || (markup?.tool === 'Count' ? 'EA' : '')).toUpperCase();
    const assembly = castCadAssemblyFor({ assemblyKey, cost_code: markup?.cost_code, trade: markup?.trade, unit: measurementUnit });
    const decimals = Math.max(0, Math.min(6, Number(precision ?? 2)));
    const takeoffFormula = formula || assembly.formula || 'quantity';
    const roundedQuantity = Number(measurementValue.toFixed(decimals));
    const formulaQuantity = Number(evaluateCastCadFormula(takeoffFormula, roundedQuantity).toFixed(decimals));
    const mappedUnitCost = Number(unitCost ?? assembly.unit_cost ?? 0);
    const proformaQuantity = Number(markup?.proforma_quantity || 0);
    return {
      id: `qty_${markup.id}`,
      project_id: drawing?.project_id || markup?.project_id || '',
      drawing_id: drawing?.id || markup?.drawing_id || '',
      source_sheet: drawing?.drawing_number || markup?.drawing_id || '',
      item: caption || markup?.measurement_caption || markup?.subject || assembly.label,
      trade: markup?.trade || assembly.trade,
      cost_code: markup?.cost_code || assembly.cost_code,
      assembly_key: assembly.key,
      assembly_label: assembly.label,
      quantity: formulaQuantity,
      measured_quantity: roundedQuantity,
      unit: measurementUnit || assembly.unit,
      unit_cost: mappedUnitCost,
      formula: takeoffFormula,
      precision: decimals,
      ai_tool: 'CAST CAD manual takeoff',
      confidence: markup?.scale_label === 'scale required' ? 35 : 100,
      verification_status: 'Needs Review',
      proforma_quantity: proformaQuantity,
      proforma_delta_amount: Number(((formulaQuantity - proformaQuantity) * mappedUnitCost).toFixed(2)),
      reviewed_by_user_id: '',
      reviewed_at: '',
      notes: markup?.scale_label === 'scale required' ? 'Set sheet scale before budget-authoritative use.' : `Measured from calibrated sheet scale (${markup?.scale_label || 'sheet scale'}); assembly/cost mapping requires human verification.`,
    };
  }
  function castCadArchitectureSnapshot() {
    return { featureFlags: clone(CAST_CAD_FEATURE_FLAGS), modules: clone(CAST_CAD_MODULES), agents: clone(CAST_CAD_AGENTS), databaseTables: clone(CAST_CAD_DATABASE_TABLES) };
  }
  function csvEscape(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
  function exportRfiCsv(state, rfis = state.rfis) { const cols = ['rfi_number','revision_number','subject','status','priority','due_date','date_closed','drawing_number','cost_impact_status','schedule_impact_status']; return [cols.join(','), ...rfis.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n'); }
  function dashboardMetrics(state, asOf = today()) {
    const rfis = state.rfis; const open = rfis.filter((r) => r.status === 'Open'); const closed = rfis.filter((r) => /^Closed/.test(r.status));
    const avgDays = open.length ? Math.round(open.reduce((s, r) => s + daysOpen(r, asOf), 0) / open.length) : 0;
    const bic = {}; open.forEach((r) => (r.ball_in_court_user_ids || []).forEach((uid) => { const u = byId(state.users, uid); const c = byId(state.companies, u?.company_id); const key = c?.name || 'Unassigned'; bic[key] = (bic[key] || 0) + 1; }));
    return { total: rfis.length, draft: rfis.filter((r) => r.status === 'Draft').length, open: open.length, closed: closed.length, overdue: open.filter((r) => isOverdue(r, asOf)).length, dueThisWeek: open.filter((r) => r.due_date >= asOf && r.due_date <= addDays(7)).length, avgDaysOpen: avgDays, ballInCourtByCompany: bic, costImpact: rfis.filter((r) => /^Yes/.test(r.cost_impact_status)).length, scheduleImpact: rfis.filter((r) => /^Yes/.test(r.schedule_impact_status)).length };
  }
  function filterRfis(state, filters = {}) {
    let rows = state.rfis.slice();
    if (filters.search) { const q = filters.search.toLowerCase(); rows = rows.filter((r) => `${r.rfi_number} ${r.subject} ${r.question} ${r.drawing_number}`.toLowerCase().includes(q)); }
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.overdue) rows = rows.filter((r) => isOverdue(r));
    if (filters.assignee) rows = rows.filter((r) => (r.assignee_user_ids || []).includes(filters.assignee));
    if (filters.drawing) rows = rows.filter((r) => r.drawing_id === filters.drawing || r.drawing_number === filters.drawing);
    if (filters.spec) rows = rows.filter((r) => r.spec_section_id === filters.spec);
    if (filters.location) rows = rows.filter((r) => r.location_id === filters.location);
    return rows;
  }
  function buildSeedState() {
    const companies = ['CAST Development','CAST Build','Architect Studio','MEP Consultants','Prime GC','Concrete Sub','Electrical Sub','Plumbing Sub','Drywall Sub','Owner Rep'].map((name, i) => ({ id: `co${i+1}`, name, type: i < 2 ? 'Owner/CAST' : i === 2 ? 'Architect' : i < 4 ? 'Consultant' : 'Contractor' }));
    const roles = ROLES; const users = Array.from({ length: 25 }, (_, i) => ({ id: `u${i+1}`, name: ['Lawrence Howard','Jamas Kaplan','Project Manager','Project Engineer','Lead Architect','Structural Consultant','GC PM','Superintendent','Electrical PM','Plumbing PM'][i] || `Project User ${i+1}`, email: `user${i+1}@cast-dev.example`, company_id: companies[i % companies.length].id, role: roles[Math.min(i % roles.length, roles.length - 1)] }));
    users[0].role = 'Owner Admin'; users[1].role = 'CAST Admin'; users[2].role = 'Project Manager'; users[3].role = 'Project Engineer'; users[4].role = 'Architect';
    const projects = [{ id: 'broderick', name: 'Broderick', project_number: 'CAST-BROD', address: 'San Diego, CA', status: 'Active' }];
    const specSections = ['03 30 00 Cast-in-Place Concrete','05 12 00 Structural Steel','06 10 00 Rough Carpentry','07 21 00 Thermal Insulation','08 11 13 Hollow Metal Doors','09 29 00 Gypsum Board','22 05 00 Plumbing','23 05 00 HVAC','26 05 00 Electrical','31 20 00 Earthwork'].map((label, i) => ({ id: `spec${i+1}`, project_id: 'broderick', number: label.slice(0,8), title: label.slice(9) }));
    const locations = ['Level 1 Lobby','Level 1 Garage','Level 2 Corridor','Level 3 Units','Roof','Courtyard','East Elevation','West Stair','Mechanical Room','Electrical Room'].map((name, i) => ({ id: `loc${i+1}`, project_id: 'broderick', name }));
    const drawings = Array.from({ length: 50 }, (_, i) => { const d = ['A','S','M','P','E'][i % 5]; return { id: `dwg${i+1}`, project_id: 'broderick', drawing_number: `${d}-${String(i+1).padStart(3,'0')}`, drawing_title: `${['Plan','Detail','Schedule','Section','Diagram'][i%5]} ${i+1}`, discipline: d, current_revision: i % 4, drawing_date: addDays(-90+i), received_date: addDays(-80+i), set_name: i < 25 ? 'Permit Set' : 'Construction Set', area: locations[i % locations.length].name, status: i % 9 === 0 ? 'Superseded' : 'Current', file_url: '', created_at: addDays(-100+i), updated_at: addDays(-20+i) }; });
    const drawingRevisions = drawings.flatMap((d) => Array.from({ length: Number(d.current_revision) + 1 }, (_, i) => ({ id: `dwgrev_${d.id}_${i}`, drawing_id: d.id, revision_number: i, revision_date: addDays(-80 + i * 12), revision_description: i ? `Revision ${i}` : 'Original issue', file_url: '', uploaded_by: users[i % users.length].id, uploaded_at: addDays(-80 + i * 12), superseded_flag: i !== Number(d.current_revision) })));
    const documents = Array.from({ length: 20 }, (_, i) => ({ id: `doc${i+1}`, project_id: 'broderick', document_number: `DOC-${String(i+1).padStart(3,'0')}`, title: `${['Permit','Report','Letter','ASI','Bulletin'][i%5]} ${i+1}`, document_type: ['Permit','Report','Correspondence','ASI','Bulletin'][i%5], discipline: ['General','Architectural','Structural','MEP'][i%4], status: ['Draft','Submitted','Under Review','Approved','Approved As Noted','Revise and Resubmit','Rejected','Superseded','Archived'][i%9], current_revision: i % 3, file_url: '', permission_group: i % 4 === 0 ? 'Private' : 'Project', created_by: users[i % users.length].id, created_at: addDays(-60+i), updated_at: addDays(-10+i) }));
    const documentRevisions = documents.flatMap((d) => Array.from({ length: d.current_revision + 1 }, (_, i) => ({ id: `docrev_${d.id}_${i}`, document_id: d.id, revision_number: i, revision_date: addDays(-50 + i * 10), revision_description: i ? `Revision ${i}` : 'Original', file_url: '', submitted_by: users[i % users.length].id, reviewed_by: users[(i+2) % users.length].id, review_status: d.status, review_due_date: addDays(5+i), review_completed_date: i < d.current_revision ? addDays(10+i) : '' })));
    const statuses = ['Draft','Open','Open','Closed','Closed Draft','Closed Revised','Open','Closed','Draft','Open','Open','Closed','Open','Open','Closed','Draft','Open','Open','Closed','Open'];
    const rfis = statuses.map((status, i) => { const dwg = drawings[i % drawings.length]; const due = [addDays(-5), addDays(2), addDays(5), addDays(12)][i % 4]; return { id: `rfi${i+1}`, project_id: 'broderick', rfi_number: `RFI ${pad(Math.min(i+1, 19))}`, revision_number: status === 'Closed Revised' ? 0 : (i === 19 ? 1 : 0), subject: `${['Slab edge clarification','Door hardware conflict','MEP sleeve location','Waterproofing termination','Framing dimension'][i%5]} ${i+1}`, question: `Please clarify field condition and confirm direction for item ${i+1}.`, status, priority: ['Normal','High','Urgent','Low'][i%4], created_by_user_id: users[3].id, received_from_user_id: users[(6+i)%users.length].id, responsible_company_id: companies[(4+i)%companies.length].id, rfi_manager_user_id: users[4].id, ball_in_court_user_ids: status === 'Open' ? [users[(4+i)%users.length].id] : [], assignee_user_ids: [users[(4+i)%users.length].id], distribution_user_ids: [users[0].id, users[2].id], date_created: addDays(-20+i), date_initiated: status === 'Open' ? addDays(-18+i) : '', due_date: status === 'Open' ? due : '', date_closed: /^Closed/.test(status) ? addDays(-2+i) : '', closed_by_user_id: /^Closed/.test(status) ? users[2].id : '', drawing_id: dwg.id, drawing_number: dwg.drawing_number, spec_section_id: specSections[i%specSections.length].id, location_id: locations[i%locations.length].id, linked_document_ids: [documents[i%documents.length].id], cost_code: `0${i%9+1}-000`, cost_impact_status: i%6===0?'Yes Known':i%5===0?'Yes Unknown':'No', cost_impact_amount: i%6===0?15000+i*1000:0, schedule_impact_status: i%7===0?'Yes Unknown':i%4===0?'To Be Determined':'No', schedule_impact_days: i%7===0?5:0, private_flag: i%11===0, official_response_id: '', root_rfi_id: `rfi${i+1}`, previous_revision_id: '', attachments: i%3===0?[{name:'field-photo.jpg', size:'1.2 MB'}]:[], created_at: addDays(-20+i), updated_at: addDays(-1) }; });
    rfis[19].root_rfi_id = rfis[18].id; rfis[19].previous_revision_id = rfis[18].id; rfis[19].rfi_number = rfis[18].rfi_number;
    const rfiResponses = rfis.filter((r, i) => i % 3 === 0).map((r, i) => ({ id: `resp${i+1}`, rfi_id: r.id, responder_user_id: r.assignee_user_ids[0], body: `Response for ${r.rfi_number}: proceed as noted.`, status: i % 2 === 0 ? 'Official' : 'Submitted', submitted_at: addDays(-4+i) }));
    rfiResponses.filter((r) => r.status === 'Official').forEach((resp) => { const rfi = rfis.find((r) => r.id === resp.rfi_id); if (rfi) rfi.official_response_id = resp.id; });
    const drawingReviewSessions = [{ id: 'drs1', project_id: 'broderick', name: 'Permit Set constructability review', status: 'Active', vendor_layer: 'Drawboard / CAST native viewer candidate', started_at: addDays(-5), due_date: addDays(5), reviewer_user_ids: [users[0].id, users[2].id, users[4].id] }];
    const drawingMarkups = [
      { id: 'markup1', project_id: 'broderick', drawing_id: drawings[0].id, revision_id: `dwgrev_${drawings[0].id}_${drawings[0].current_revision}`, markup_type: 'cloud', tool: 'Cloud + Callout', subject: 'Confirm lobby wall assembly', body: 'AI takeoff flags wall length variance against budget line 09-2116.', x: 22, y: 34, width: 24, height: 16, page_number: 1, status: 'Open', priority: 'High', trade: 'Drywall', cost_code: '09-2116', assignee_user_id: users[4].id, created_by_user_id: users[2].id, created_at: addDays(-3), updated_at: addDays(-1), source: 'CAST Drawing Review' },
      { id: 'markup2', project_id: 'broderick', drawing_id: drawings[6].id, revision_id: `dwgrev_${drawings[6].id}_${drawings[6].current_revision}`, markup_type: 'measurement', tool: 'Area Measurement', subject: 'Verify roof deck area', body: 'Measured roof area is above pro forma assumption; estimator review required before budget update.', x: 48, y: 26, width: 30, height: 18, page_number: 1, status: 'In Review', priority: 'Normal', trade: 'Roofing', cost_code: '07-5400', assignee_user_id: users[2].id, created_by_user_id: users[1].id, created_at: addDays(-2), updated_at: addDays(-1), source: 'AI estimating layer' },
      { id: 'markup3', project_id: 'broderick', drawing_id: drawings[12].id, revision_id: `dwgrev_${drawings[12].id}_${drawings[12].current_revision}`, markup_type: 'pin', tool: 'Issue Pin', subject: 'Door count mismatch', body: 'Door schedule count differs from plan symbols. Resolve before issuing bid package.', x: 64, y: 58, width: 0, height: 0, page_number: 1, status: 'Open', priority: 'Urgent', trade: 'Openings', cost_code: '08-1113', assignee_user_id: users[3].id, created_by_user_id: users[0].id, created_at: addDays(-1), updated_at: addDays(-1), source: 'Scope gap detector' }
    ];
    const drawingComments = drawingMarkups.map((m, i) => ({ id: `draw_comment${i+1}`, markup_id: m.id, drawing_id: m.drawing_id, user_id: users[i].id, body: m.body, status: m.status, created_at: m.created_at }));
    const estimateQuantities = [
      { id: 'qty1', project_id: 'broderick', drawing_id: drawings[0].id, source_sheet: drawings[0].drawing_number, item: 'Interior partition walls', trade: 'Drywall', cost_code: '09-2116', quantity: 1245, unit: 'LF', ai_tool: 'Kreo/Togal pilot import', confidence: 82, verification_status: 'Needs Review', proforma_quantity: 1010, proforma_delta_amount: 23500, reviewed_by_user_id: '', reviewed_at: '', notes: 'Scale and partition type require estimator verification.' },
      { id: 'qty2', project_id: 'broderick', drawing_id: drawings[6].id, source_sheet: drawings[6].drawing_number, item: 'Roof deck waterproofing', trade: 'Roofing', cost_code: '07-5400', quantity: 18400, unit: 'SF', ai_tool: 'STACK Assist / manual check', confidence: 76, verification_status: 'Needs Review', proforma_quantity: 14900, proforma_delta_amount: 42000, reviewed_by_user_id: '', reviewed_at: '', notes: 'Confirm parapet returns and excluded mechanical pad zones.' },
      { id: 'qty3', project_id: 'broderick', drawing_id: drawings[12].id, source_sheet: drawings[12].drawing_number, item: 'Hollow metal door frames', trade: 'Openings', cost_code: '08-1113', quantity: 42, unit: 'EA', ai_tool: 'Togal.AI pilot import', confidence: 91, verification_status: 'Verified', proforma_quantity: 40, proforma_delta_amount: 3200, reviewed_by_user_id: users[2].id, reviewed_at: addDays(-1), notes: 'Verified against schedule; update estimate for two added frames.' }
    ];
    const estimateFindings = [
      { id: 'find1', project_id: 'broderick', finding_type: 'Scope Gap', severity: 'High', status: 'Open', title: 'EV charger infrastructure shown without matching allowance', body: 'Electrical sheets include EV infrastructure, but current cost-code map has no corresponding allowance.', linked_drawing_ids: [drawings[4].id], suggested_action: 'Add allowance or confirm exclusion before bid release.' },
      { id: 'find2', project_id: 'broderick', finding_type: 'Budget Delta', severity: 'Medium', status: 'Open', title: 'Roof area exceeds pro forma by 23.5%', body: 'AI takeoff estimated 18,400 SF vs. 14,900 SF in current pro forma.', linked_drawing_ids: [drawings[6].id], suggested_action: 'Estimator to verify area and update budget assumption if confirmed.' },
      { id: 'find3', project_id: 'broderick', finding_type: 'Human Verification', severity: 'Low', status: 'Monitoring', title: 'AI quantities require reviewer sign-off', body: 'No AI quantity becomes budget-authoritative until a human verifies scale, assemblies, exclusions, alternates, and addenda.', linked_drawing_ids: [], suggested_action: 'Keep all imported quantities in Needs Review until verified.' }
    ];
    return { projects, users, companies, projectTeamMembers: users.map((u) => ({ id: `ptm_${u.id}`, project_id: 'broderick', user_id: u.id, company_id: u.company_id, role: u.role })), rfis, rfiRevisions: [], rfiResponses, rfiComments: [], rfiAttachments: [], rfiDistributionList: [], rfiAssignees: rfis.flatMap((r) => (r.assignee_user_ids || []).map((uid) => ({ id: `asg_${r.id}_${uid}`, rfi_id: r.id, user_id: uid }))), drawings, drawingRevisions, drawingSets: [{ id: 'set1', project_id: 'broderick', name: 'Permit Set' }, { id: 'set2', project_id: 'broderick', name: 'Construction Set' }], drawingReviewSessions, drawingMarkups, drawingComments, drawingIssues: [], estimateQuantities, estimateFindings, documents, documentRevisions, specSections, locations, auditLog: [], notifications: [], permissions: [] };
  }
  function loadState() { if (typeof localStorage === 'undefined') return buildSeedState(); const raw = localStorage.getItem(STORAGE_KEY); if (!raw) { const seed = buildSeedState(); localStorage.setItem(STORAGE_KEY, JSON.stringify(seed)); return seed; } return JSON.parse(raw); }
  function saveState(state) { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function resetState() { const seed = buildSeedState(); saveState(seed); return seed; }

  return { RFI_STATUSES, RESPONSE_STATUSES, IMPACT_STATUSES, ROLES, STORAGE_KEY, CAST_CAD_FEATURE_FLAGS, CAST_CAD_MODULES, CAST_CAD_AGENTS, CAST_CAD_DATABASE_TABLES, buildSeedState, loadState, saveState, resetState, generateRfiNumber, validateRfi, createRfi, submitResponse, markOfficialResponse, closeRfi, reopenRfi, reviseRfi, addComment, ensureDrawingIntelligenceState, createDrawingMarkup, createDrawingComment, updateDrawingIssueStatus, verifyEstimateQuantity, drawingIntelligenceMetrics, exportDrawingReviewCsv, normalizeCastCadPoint, calibrateCastCadScale, measureCastCadGeometry, castCadAssemblyLibrary, castCadAssemblyFor, evaluateCastCadFormula, buildCastCadTakeoffRow, castCadArchitectureSnapshot, canViewRfi, canPerform, dashboardMetrics, filterRfis, exportRfiCsv, isOverdue, daysOpen };
});
