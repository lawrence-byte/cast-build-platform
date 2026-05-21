const assert = require('assert');
const CPC = require('../public/projects/cast-project-controls-data.js');

const state = CPC.buildSeedState();
CPC.ensureDrawingIntelligenceState(state);
const actor = state.users[0];

assert.ok(state.drawingReviewSessions.length >= 1, 'seed includes drawing review sessions');
assert.ok(state.drawingMarkups.length >= 3, 'seed includes drawing markups');
assert.ok(state.estimateQuantities.length >= 3, 'seed includes AI estimate quantity intake rows');
assert.ok(state.estimateFindings.some((finding) => finding.finding_type === 'Scope Gap'), 'seed includes scope gap findings');

const created = CPC.createDrawingMarkup(state, {
  drawing_id: state.drawings[1].id,
  tool: 'Cloud + Callout',
  subject: 'Test constructability note',
  body: 'Test markup body',
  assignee_user_id: state.users[2].id,
}, actor);
assert.equal(created.ok, true, 'createDrawingMarkup succeeds');
assert.equal(state.auditLog.at(-1).entity_type, 'DrawingMarkup', 'drawing markup is audited');
assert.ok(state.notifications.some((note) => note.entity_id === created.markup.id), 'assigned markup creates notification');

const comment = CPC.createDrawingComment(state, {
  drawing_id: state.drawings[1].id,
  markup_id: created.markup.id,
  body: 'Threaded reply test',
}, actor);
assert.equal(comment.ok, true, 'createDrawingComment succeeds');

const resolved = CPC.updateDrawingIssueStatus(state, created.markup.id, 'Resolved', actor);
assert.equal(resolved.ok, true, 'updateDrawingIssueStatus succeeds');
assert.equal(resolved.markup.status, 'Resolved', 'markup status updated');

const quantity = state.estimateQuantities.find((row) => row.verification_status === 'Needs Review');
const verified = CPC.verifyEstimateQuantity(state, quantity.id, actor, { quantity: quantity.quantity + 1, status: 'Verified', notes: 'unit-test verified' });
assert.equal(verified.ok, true, 'verifyEstimateQuantity succeeds');
assert.equal(verified.quantity.verification_status, 'Verified', 'quantity is verified');
assert.equal(verified.quantity.reviewed_by_user_id, actor.id, 'reviewer recorded');

const metrics = CPC.drawingIntelligenceMetrics(state);
assert.ok(metrics.openMarkups >= 1, 'metrics include open markup count');
assert.ok(metrics.verifiedQuantities >= 2, 'metrics include verified quantities');
assert.ok(metrics.proformaDeltaAmount > 0, 'metrics include pro forma delta');

const measured = CPC.createDrawingMarkup(state, {
  drawing_id: state.drawings[2].id,
  tool: 'Line Measurement',
  subject: 'Unit test measured length',
  body: 'Measured from calibrated CAST CAD sheet scale',
  measurement_value: 42.5,
  measurement_unit: 'LF',
  scale_label: '20 FT',
}, actor);
assert.equal(measured.ok, true, 'createDrawingMarkup stores measured takeoff markup');
assert.equal(measured.markup.measurement_value, 42.5, 'measurement value persists on markup');
assert.equal(measured.markup.measurement_unit, 'LF', 'measurement unit persists on markup');

const csv = CPC.exportDrawingReviewCsv(state);
assert.ok(csv.includes('drawing_number,subject,tool,status,priority,trade,cost_code,measurement_value,measurement_unit,scale_label,body'), 'CSV includes drawing review and takeoff headers');
assert.ok(csv.includes('Test constructability note'), 'CSV includes created markup');
assert.ok(csv.includes('42.5'), 'CSV includes measured takeoff value');

console.log('CAST CAD unit tests passed.');
