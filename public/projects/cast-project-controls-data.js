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
    return { projects, users, companies, projectTeamMembers: users.map((u) => ({ id: `ptm_${u.id}`, project_id: 'broderick', user_id: u.id, company_id: u.company_id, role: u.role })), rfis, rfiRevisions: [], rfiResponses, rfiComments: [], rfiAttachments: [], rfiDistributionList: [], rfiAssignees: rfis.flatMap((r) => (r.assignee_user_ids || []).map((uid) => ({ id: `asg_${r.id}_${uid}`, rfi_id: r.id, user_id: uid }))), drawings, drawingRevisions, drawingSets: [{ id: 'set1', project_id: 'broderick', name: 'Permit Set' }, { id: 'set2', project_id: 'broderick', name: 'Construction Set' }], documents, documentRevisions, specSections, locations, auditLog: [], notifications: [], permissions: [] };
  }
  function loadState() { if (typeof localStorage === 'undefined') return buildSeedState(); const raw = localStorage.getItem(STORAGE_KEY); if (!raw) { const seed = buildSeedState(); localStorage.setItem(STORAGE_KEY, JSON.stringify(seed)); return seed; } return JSON.parse(raw); }
  function saveState(state) { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function resetState() { const seed = buildSeedState(); saveState(seed); return seed; }

  return { RFI_STATUSES, RESPONSE_STATUSES, IMPACT_STATUSES, ROLES, STORAGE_KEY, buildSeedState, loadState, saveState, resetState, generateRfiNumber, validateRfi, createRfi, submitResponse, markOfficialResponse, closeRfi, reopenRfi, reviseRfi, addComment, canViewRfi, canPerform, dashboardMetrics, filterRfis, exportRfiCsv, isOverdue, daysOpen };
});
