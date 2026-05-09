const assert = require('assert');
const CPC = require('../public/projects/cast-project-controls-data.js');

function actor(state, role) { return state.users.find((u) => u.role === role) || state.users[0]; }

(function numbering() {
  const state = CPC.buildSeedState();
  const n = CPC.generateRfiNumber(state.rfis, 'broderick');
  assert.strictEqual(n, 'RFI 0020');
  const admin = actor(state, 'CAST Admin');
  const created = CPC.createRfi(state, { project_id: 'broderick', subject: 'Test open', question: 'Clarify?', assignee_user_ids: [state.users[4].id], due_date: '2099-01-01' }, admin, 'Open');
  assert.strictEqual(created.ok, true);
  assert.strictEqual(created.rfi.rfi_number, 'RFI 0020');
  const dup = CPC.createRfi(state, { project_id: 'broderick', rfi_number: 'RFI 0020', subject: 'Dup', question: 'Dup?', assignee_user_ids: [state.users[4].id], due_date: '2099-01-01' }, admin, 'Open');
  assert.strictEqual(dup.ok, false);
  assert(dup.errors.join(' ').includes('Duplicate'));
})();

(function validation() {
  const state = CPC.buildSeedState();
  const admin = actor(state, 'CAST Admin');
  const bad = CPC.createRfi(state, { project_id: 'broderick', subject: 'Missing pieces', question: '', assignee_user_ids: [], due_date: '' }, admin, 'Open');
  assert.strictEqual(bad.ok, false);
  assert(bad.errors.includes('Question is required.'));
  assert(bad.errors.includes('Due date is required for open RFIs.'));
  assert(bad.errors.includes('At least one assignee is required for open RFIs.'));
})();

(function statusTransitionsAndOfficialResponse() {
  const state = CPC.buildSeedState();
  const pm = actor(state, 'Project Manager');
  const rfi = state.rfis.find((r) => r.status === 'Open');
  const assignee = state.users.find((u) => rfi.assignee_user_ids.includes(u.id)) || pm;
  const response = CPC.submitResponse(state, rfi.id, assignee, 'Use revised detail A-501.');
  assert.strictEqual(response.ok, true);
  const official = CPC.markOfficialResponse(state, rfi.id, response.response.id, pm);
  assert.strictEqual(official.ok, true);
  assert.strictEqual(official.rfi.official_response_id, response.response.id);
  assert.strictEqual(official.response.status, 'Official');
  const closed = CPC.closeRfi(state, rfi.id, pm);
  assert.strictEqual(closed.ok, true);
  assert.strictEqual(closed.rfi.status, 'Closed');
  const reopened = CPC.reopenRfi(state, rfi.id, pm);
  assert.strictEqual(reopened.ok, true);
  assert.strictEqual(reopened.rfi.status, 'Open');
  const revised = CPC.reviseRfi(state, rfi.id, pm, { status: 'Draft' });
  assert.strictEqual(revised.ok, true);
  assert.strictEqual(revised.previous.status, 'Closed Revised');
  assert.strictEqual(revised.rfi.rfi_number, rfi.rfi_number);
  assert.strictEqual(revised.rfi.revision_number, rfi.revision_number + 1);
})();

(function permissionsAndPrivateVisibility() {
  const state = CPC.buildSeedState();
  const viewer = actor(state, 'Read Only Viewer');
  const privateRfi = state.rfis.find((r) => r.private_flag);
  assert(privateRfi);
  assert.strictEqual(CPC.canViewRfi(viewer, privateRfi), false);
  assert.strictEqual(CPC.canPerform(viewer, 'close', privateRfi), false);
  assert.strictEqual(CPC.canPerform(actor(state, 'Owner Admin'), 'delete', privateRfi), true);
})();

(function metricsAndExport() {
  const state = CPC.buildSeedState();
  const metrics = CPC.dashboardMetrics(state);
  assert.strictEqual(metrics.total, 20);
  assert(metrics.open > 0);
  const csv = CPC.exportRfiCsv(state);
  assert(csv.includes('rfi_number,revision_number,subject'));
  assert(csv.includes('RFI 0001'));
})();

console.log('RFI tracker unit tests passed.');
