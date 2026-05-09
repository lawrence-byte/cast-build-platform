const assert = require('assert');
const CPC = require('../public/projects/cast-project-controls-data.js');
const CSC = require('../public/projects/cast-submittal-controls-data.js');
function actor(state, role) { return state.users.find((u) => u.role === role) || state.users[0]; }

(function seedAndNumbering() {
  const state = CPC.buildSeedState();
  CSC.ensureSubmittalSeed(state);
  assert.strictEqual(state.submittals.length, 40);
  assert.strictEqual(state.submittalPackages.length, 8);
  assert(state.users.length >= 30);
  assert(state.companies.length >= 15);
  assert(state.specSections.length >= 20);
  assert.strictEqual(CSC.generateSubmittalNumber(state.submittals, 'broderick'), 'SUB 0040');
  assert.strictEqual(CSC.generatePackageNumber(state.submittalPackages, 'broderick'), 'PKG 0009');
})();

(function validationAndDuplicatePrevention() {
  const state = CPC.buildSeedState(); CSC.ensureSubmittalSeed(state);
  const manager = actor(state, 'Submittal Manager');
  const bad = CSC.createSubmittal(state, { project_id: 'broderick', title: 'Bad submitted item', submittal_type: 'Shop Drawing' }, manager, 'Submitted');
  assert.strictEqual(bad.ok, false);
  assert(bad.errors.includes('Spec section is required.'));
  assert(bad.errors.includes('Workflow is required before review.'));
  const spec = state.specSections[0]; const submitter = state.users[6]; const approver = state.users.find((u) => u.role === 'Architect') || state.users[4];
  const good = CSC.createSubmittal(state, { project_id: 'broderick', title: 'Valid draft placeholder', submittal_type: 'Product Data', spec_section_id: spec.id, responsible_company_id: state.companies[5].id, submitter_user_id: submitter.id, submittal_manager_user_id: manager.id, final_due_date: '2099-01-01', workflow_template_id: state.submittalWorkflowTemplates[0].id, approver_user_ids: [approver.id], attachments: [{ name: 'product-data.pdf' }] }, manager, 'Submitted');
  assert.strictEqual(good.ok, true);
  const dup = CSC.createSubmittal(state, { project_id: 'broderick', submittal_number: good.submittal.submittal_number, title: 'Duplicate', submittal_type: 'Product Data', spec_section_id: spec.id, responsible_company_id: state.companies[5].id, submitter_user_id: submitter.id, submittal_manager_user_id: manager.id, final_due_date: '2099-01-01', workflow_template_id: state.submittalWorkflowTemplates[0].id, approver_user_ids: [approver.id], attachments: [{ name: 'x.pdf' }] }, manager, 'Submitted');
  assert.strictEqual(dup.ok, false);
})();

(function workflowOfficialCloseRevise() {
  const state = CPC.buildSeedState(); CSC.ensureSubmittalSeed(state);
  const manager = actor(state, 'Submittal Manager');
  const sub = state.submittals.find((s) => s.status === 'Under Review' && s.ball_in_court_user_ids.length);
  const approver = state.users.find((u) => sub.ball_in_court_user_ids.includes(u.id));
  const response = CSC.submitSubmittalResponse(state, sub.id, approver, 'Approved as Noted', 'Reviewed with notes.');
  assert.strictEqual(response.ok, true);
  const official = CSC.markOfficialSubmittalResponse(state, sub.id, response.response.id, manager);
  assert.strictEqual(official.ok, true);
  assert.strictEqual(official.submittal.official_response_id, response.response.id);
  assert.strictEqual(official.response.is_official, true);
  const closed = CSC.closeSubmittal(state, sub.id, manager);
  assert.strictEqual(closed.ok, true);
  assert.strictEqual(closed.submittal.status, 'Closed');
  const revised = CSC.reviseSubmittal(state, sub.id, manager, { status: 'Draft' });
  assert.strictEqual(revised.ok, true);
  assert.strictEqual(revised.previous.status, 'Closed Revised');
  assert.strictEqual(revised.submittal.submittal_number, sub.submittal_number);
  assert.strictEqual(revised.submittal.revision_number, sub.revision_number + 1);
})();

(function privateVisibilityAndReports() {
  const state = CPC.buildSeedState(); CSC.ensureSubmittalSeed(state);
  const viewer = actor(state, 'Read Only Viewer');
  const privateSub = state.submittals.find((s) => s.private_flag);
  assert(privateSub);
  assert.strictEqual(CSC.canViewSubmittal(viewer, privateSub), false);
  const metrics = CSC.submittalMetrics(state);
  assert.strictEqual(metrics.total, 40);
  assert(metrics.overdue > 0);
  const csv = CSC.exportSubmittalCsv(state);
  assert(csv.includes('submittal_number,revision_number,title'));
  assert(csv.includes('SUB 0001'));
})();

(function workingDays() {
  assert.strictEqual(CSC.workingDaysFrom('2026-05-08', 1), '2026-05-11');
})();

console.log('Submittal tracker unit tests passed.');
