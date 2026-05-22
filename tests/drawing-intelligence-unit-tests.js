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
  layer: 'ASI-002',
  group_id: 'grp-level-1-partitions',
  style: { stroke: '#2563eb', fill: 'rgba(37,99,235,.2)', opacity: 0.75, line_width: 4, font_size: 14 },
}, actor);
assert.equal(measured.ok, true, 'createDrawingMarkup stores measured takeoff markup');
assert.equal(measured.markup.measurement_value, 42.5, 'measurement value persists on markup');
assert.equal(measured.markup.measurement_unit, 'LF', 'measurement unit persists on markup');
assert.equal(measured.markup.layer, 'ASI-002', 'vector markup layer persists');
assert.equal(measured.markup.group_id, 'grp-level-1-partitions', 'vector markup group persists');
assert.equal(measured.markup.style.stroke, '#2563eb', 'vector markup stroke style persists');

const scale = CPC.calibrateCastCadScale({ knownLength: 20, unit: 'FT', firstPoint: { x: 10, y: 10 }, secondPoint: { x: 30, y: 10 } });
assert.equal(scale.ok, true, 'scale calibration succeeds from two page points');
assert.equal(scale.scale.unit, 'FT', 'scale unit is preserved');
assert.equal(scale.scale.units_per_percent, 1, 'scale computes units per normalized page percent');

const length = CPC.measureCastCadGeometry({ tool: 'Length', scale: scale.scale, points: [{ x: 10, y: 10 }, { x: 40, y: 10 }] });
assert.equal(length.value, 30, 'length measurement uses calibrated scale');
assert.equal(length.unit, 'LF', 'length measurement emits linear-foot unit');

const area = CPC.measureCastCadGeometry({ tool: 'Area', scale: scale.scale, points: [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 25 }, { x: 10, y: 25 }] });
assert.equal(area.value, 300, 'area measurement computes polygon area from calibrated scale');
assert.equal(area.unit, 'SF', 'area measurement emits square-foot unit');

const assemblies = CPC.castCadAssemblyLibrary();
assert.ok(assemblies.some((row) => row.key === 'drywall_partition'), 'CAST CAD exposes provider-independent assembly library');
assert.equal(CPC.castCadAssemblyFor({ cost_code: '09-2116', unit: 'LF' }).key, 'drywall_partition', 'cost-code mapping resolves assembly');
assert.equal(CPC.evaluateCastCadFormula('quantity * 1.10', 100), 110, 'takeoff formula columns evaluate controlled quantity expressions');
assert.equal(CPC.evaluateCastCadFormula('process.exit()', 100), 100, 'unsafe formulas fail closed to measured quantity');
const takeoffRow = CPC.buildCastCadTakeoffRow(state, {
  drawing: state.drawings[0],
  markup: { id: 'markup_formula', project_id: state.drawings[0].project_id, drawing_id: state.drawings[0].id, tool: 'Line Measurement', subject: 'Editable caption fallback', trade: 'Drywall', cost_code: '09-2116', measurement_value: 123.456, measurement_unit: 'LF', scale_label: '20 FT' },
  caption: 'Level 1 rated partition',
  precision: 1,
  formula: 'quantity * 1.05',
});
assert.equal(takeoffRow.item, 'Level 1 rated partition', 'editable measurement caption is used for takeoff row');
assert.equal(takeoffRow.measured_quantity, 123.5, 'precision controls round measured quantity');
assert.equal(takeoffRow.quantity, 129.7, 'formula column applies waste/assembly factor');
assert.equal(takeoffRow.unit_cost, 85, 'cost database mapping supplies unit cost');
assert.equal(takeoffRow.proforma_delta_amount, 11024.5, 'cost-code mapping computes pro forma delta');
assert.equal(takeoffRow.verification_status, 'Needs Review', 'assembly takeoff remains human-review gated');

const featureSnapshot = CPC.castCadArchitectureSnapshot();
assert.ok(featureSnapshot.featureFlags.some((flag) => flag.key === 'castCadAiReview'), 'feature flags include AI review scaffold');
assert.ok(featureSnapshot.modules.some((module) => module.key === 'comparisonCenter'), 'modules include comparison center scaffold');
assert.ok(featureSnapshot.agents.some((agent) => agent.name === 'Plan Reviewer'), 'AI agent registry includes Plan Reviewer');
assert.ok(featureSnapshot.databaseTables.includes('markups') && featureSnapshot.databaseTables.includes('measurements'), 'database table plan includes markups and measurements');

const csv = CPC.exportDrawingReviewCsv(state);
assert.ok(csv.includes('drawing_number,subject,tool,status,priority,trade,cost_code,measurement_value,measurement_unit,scale_label,body'), 'CSV includes drawing review and takeoff headers');
assert.ok(csv.includes('Test constructability note'), 'CSV includes created markup');
assert.ok(csv.includes('42.5'), 'CSV includes measured takeoff value');

console.log('CAST CAD unit tests passed.');
