'use strict';
// Hermetic fixtures only: no private drawing bytes, providers, or external writes.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cad = require('../api/_lib/cast-cad-production');
const handler = require('../api/cast-cad-search');
const owner = { id: 'review-test-owner', role: 'Owner Admin', authenticated: true };
const viewer = { id: 'review-test-viewer', role: 'Read Only Viewer', authenticated: true };
const envNames = ['CAST_CAD_REQUIRE_AUTH', 'CAST_CAD_ALLOW_DEV_ACTOR', 'CAST_CAD_DOCUMENT_METADATA_ADAPTER', 'CAST_CAD_DATABASE_URL'];
const oldEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
envNames.forEach((name) => { delete process.env[name]; });
process.env.CAST_CAD_REQUIRE_AUTH = 'true';
const state = cad.resetState();
const scope = { projectId: 'review-fixture', sourceSheetId: 'A-101' };

function seedRun() {
  const result = cad.createDrawingAutoLinks(state, scope, owner);
  assert.equal(result.ok, true);
  assert.equal(result.candidates.length, 2);
  return result.autoLinkRun;
}
for (const sheetId of ['A-201', 'A-301']) {
  assert.equal(cad.upsertDrawingDocumentMetadata(state, { projectId: scope.projectId, sheetId, drawingNumber: sheetId, sourcePath: `fixture/${sheetId}.pdf` }, owner).ok, true);
}
assert.equal(cad.indexOcrPage(state, { projectId: scope.projectId, sheetId: scope.sourceSheetId, pageNumber: 2, text: 'Fixture references: SEE A-201 and A-301.', confidence: 95 }, owner).ok, true);
const run = seedRun();
const reviewInput = { ...scope, runId: run.id, candidateId: run.candidates[1].id, decision: 'Approved', humanReviewApproved: true, expectedReviewVersion: 0, reviewNotes: 'Fixture source and target checked.' };

function refused(input, code, actor = owner) {
  const before = JSON.stringify(state);
  const result = cad.reviewDrawingAutoLinkCandidate(state, input, actor);
  assert.equal(result.ok, false);
  assert.equal(result.code, code);
  assert.equal(JSON.stringify(state), before, 'refused review cannot mutate candidates or audit history');
}
refused(reviewInput, 'auth-required', { ...owner, authenticated: false });
const viewerBefore = JSON.stringify(state);
assert.equal(cad.reviewDrawingAutoLinkCandidate(state, reviewInput, viewer).status, 403);
assert.equal(JSON.stringify(state), viewerBefore);
for (const field of ['projectId', 'sourceSheetId', 'runId']) refused({ ...reviewInput, [field]: '' }, 'auto-link-scope-required');
for (const field of ['projectId', 'sourceSheetId', 'runId']) refused({ ...reviewInput, [field]: 'wrong-scope' }, 'auto-link-run-not-found');
refused({ ...reviewInput, candidateId: '' }, 'auto-link-candidate-required');
refused({ ...reviewInput, candidateId: 'missing' }, 'auto-link-candidate-not-found');
const otherRun = seedRun();
refused({ ...reviewInput, candidateId: otherRun.candidates[0].id }, 'auto-link-candidate-not-found');
state.drawingAutoLinkRuns.push(run);
refused(reviewInput, 'auto-link-run-ambiguous');
state.drawingAutoLinkRuns.pop();
for (const decision of [undefined, '', 'approve', 'Published']) refused({ ...reviewInput, decision }, 'invalid-auto-link-review-decision');
for (const humanReviewApproved of [undefined, false, 'false', 'true', 1]) refused({ ...reviewInput, humanReviewApproved }, 'human-review-required');
for (const expectedReviewVersion of [undefined, -1, '0', 0.5]) refused({ ...reviewInput, expectedReviewVersion }, 'review-version-required');
const sourceCitation = run.candidates[1].sourceCitation;
run.candidates[1].sourceCitation = null;
refused(reviewInput, 'source-citation-required');
run.candidates[1].sourceCitation = sourceCitation;

const approved = cad.reviewDrawingAutoLinkCandidate(state, reviewInput, owner);
assert.equal(approved.ok, true);
assert.equal(approved.candidate.id, run.candidates[1].id, 'review the selected candidate, not the first');
assert.equal(run.candidates[0].status, 'Needs Review');
assert.equal(approved.candidate.reviewedByUserId, owner.id);
assert.equal(approved.candidate.reviewVersion, 1);
assert.equal(approved.persistence, 'memory-only');
assert.equal(approved.candidate.durablePublished, false);
assert.equal(run.status, 'needs-review');
refused(reviewInput, 'stale-auto-link-review');
const publishInput = { ...scope, runId: run.id, humanReviewApproved: true };
assert.equal(cad.publishDrawingAutoLinkRun(state, publishInput, owner).code, 'candidate-review-required');
assert.equal(cad.publishDrawingAutoLinkRun(state, { ...publishInput, humanReviewApproved: 'true' }, owner).code, 'human-review-required');
assert.equal(cad.publishDrawingAutoLinkRun(state, publishInput, viewer).status, 403);
const rejected = cad.reviewDrawingAutoLinkCandidate(state, { ...reviewInput, candidateId: run.candidates[0].id, decision: 'Rejected' }, owner);
assert.equal(rejected.autoLinkRun.approvedCandidateCount, 1);
assert.equal(rejected.autoLinkRun.rejectedCandidateCount, 1);
assert.equal(rejected.autoLinkRun.reviewedCandidateCount, 2);
assert.equal(rejected.autoLinkRun.status, 'reviewed-pending-publish');
const providerBlocked = cad.publishDrawingAutoLinkRun(state, publishInput, owner);
assert.equal(providerBlocked.status, 503);
assert.equal(providerBlocked.code, 'provider-required');
assert.deepEqual(providerBlocked.approvedCandidateIds, [reviewInput.candidateId], 'rejections are never publishable');
assert.deepEqual(providerBlocked.requiredEnvVars, ['CAST_CAD_DOCUMENT_METADATA_ADAPTER or CAST_CAD_DATABASE_URL']);
for (const envName of ['CAST_CAD_DOCUMENT_METADATA_ADAPTER', 'CAST_CAD_DATABASE_URL']) {
  process.env[envName] = 'fixture-configuration-not-a-real-adapter';
  const blocked = cad.publishDrawingAutoLinkRun(state, publishInput, owner);
  assert.equal(blocked.code, 'adapter-integration-required', 'nonempty env cannot fabricate provider success');
  assert.equal(blocked.durablePublished, false);
  assert.equal(blocked.outputPointer, '');
  assert.equal(blocked.publicExposure, false);
  delete process.env[envName];
}
const runCount = state.drawingAutoLinkRuns.length;
for (const flag of ['publish', 'publishLinks', 'publish_links', 'authoritative']) {
  assert.equal(cad.createDrawingAutoLinks(state, { ...publishInput, [flag]: true }, owner).code, 'provider-required');
}
assert.equal(state.drawingAutoLinkRuns.length, runCount, 'legacy publish flags cannot generate new candidates');
assert.equal(cad.reviewDrawingAutoLinkCandidate(state, { ...reviewInput, expectedReviewVersion: 1, decision: 'Rejected' }, owner).ok, true);
assert.equal(run.status, 'reviewed-rejected');
assert.equal(cad.publishDrawingAutoLinkRun(state, publishInput, owner).code, 'no-approved-candidates');
const creationAudit = state.auditLog.find((entry) => entry.entityId === run.id && entry.entityType === 'CAST_CAD_DRAWING_AUTOLINK_RUN');
assert.equal(creationAudit.newValue.candidates[1].status, 'Needs Review', 'creation audit is an immutable snapshot');
const firstDecisionAudit = state.auditLog.find((entry) => entry.entityId === reviewInput.candidateId);
assert.equal(firstDecisionAudit.previousValue.status, 'Needs Review');
assert.equal(firstDecisionAudit.newValue.decision, 'Approved', 'later rejection cannot rewrite earlier approval history');
assert.equal(approved.candidate.decision, 'Approved', 'returned decision is a snapshot, not live state');

async function main() {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const actorHeaders = { 'x-cast-user-id': owner.id, 'x-cast-role': owner.role };
  async function post(body, headers = actorHeaders) {
    const response = await fetch(`${base}/api/cast-cad-search`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.headers.get('cache-control'), 'private, max-age=0, no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    return { response, result };
  }
  try {
    const apiRun = seedRun();
    const input = { ...reviewInput, runId: apiRun.id, candidateId: apiRun.candidates[0].id, action: 'review-auto-link-candidate' };
    assert.equal((await post(input, {})).response.status, 401);
    assert.equal((await post(input, { ...actorHeaders, 'x-cast-role': viewer.role })).response.status, 403);
    const saved = await post(input);
    assert.equal(saved.response.status, 200);
    assert.equal(saved.result.candidate.decision, 'Approved');
    assert.equal((await post(input)).response.status, 409);
    const readback = await fetch(`${base}/api/cast-cad-search?action=auto-links&${new URLSearchParams(scope)}`, { headers: actorHeaders });
    assert.equal(readback.status, 200);
    const listed = await readback.json();
    assert.equal(listed.autoLinkRuns.find((row) => row.id === apiRun.id).candidates[0].decision, 'Approved');
    const missing = await post({ ...input, runId: 'absent' });
    assert.equal(missing.response.status, 404);
    assert.equal(missing.result.candidate, undefined, 'scope failures do not expose another candidate');

    // Execute the actual workbench functions with a minimal DOM and this real local API.
    const source = fs.readFileSync(path.join(__dirname, '../public/projects/cast-cad.js'), 'utf8');
    const renderer = source.slice(source.indexOf('function renderAutoLinkCandidates()'), source.indexOf('function renderReviewRooms()'));
    const actions = source.slice(source.indexOf('let autoLinkRequestId = 0;'), source.indexOf('function toolLibrarySeedPayload()'));
    assert.ok(actions.includes('reviewAutoLinkCandidate'));
    assert.ok(source.includes('reviewAutoLinkCandidate(autoLinkReview)'));
    const status = {};
    const list = {};
    const publishCheck = { checked: true };
    const toasts = [];
    const requests = [];
    const localFetch = async (url, options = {}) => {
      if (options.body) requests.push(JSON.parse(options.body));
      return fetch(`${base}${url}`, { ...options, headers: { ...options.headers, ...actorHeaders } });
    };
    const context = vm.createContext({
      autoLinkState: { runs: [], candidates: [], message: '' }, selectedDrawingId: scope.sourceSheetId,
      selectedDrawing: () => ({ project_id: scope.projectId }), URLSearchParams,
      document: { querySelector: (selector) => ({ '[data-auto-link-status]': status, '[data-auto-link-candidates]': list, '[data-auto-link-review]': publishCheck })[selector] },
      window: { CASTShell: { toast: (text, options) => toasts.push({ text, ...options }) } }, fetch: localFetch,
    });
    vm.runInContext(`${source.split('\n').find((line) => line.startsWith('const esc ='))}\n${renderer}\n${actions}`, context);
    await context.loadAutoLinkRuns();
    assert.equal(context.autoLinkState.runs.at(-1).id, apiRun.id);
    function buttonFor(candidateId, decision, confirmed = true) {
      const button = { dataset: { reviewAutoLinkCandidate: decision }, disabled: false };
      const card = { dataset: { runId: apiRun.id, candidateId }, querySelector: (selector) => selector === '[data-auto-link-confirm]' ? { checked: confirmed } : { value: 'Fixture review notes <script>not HTML</script>' }, querySelectorAll: () => [button] };
      button.closest = () => card;
      return button;
    }
    const secondId = apiRun.candidates[1].id;
    const requestCount = requests.length;
    await context.reviewAutoLinkCandidate(buttonFor(secondId, 'Rejected', false));
    assert.equal(requests.length, requestCount, 'unconfirmed UI review never posts');
    await context.reviewAutoLinkCandidate(buttonFor(secondId, 'Rejected'));
    assert.equal(requests.at(-1).candidateId, secondId);
    assert.equal(requests.at(-1).decision, 'Rejected');
    assert.equal(context.autoLinkState.candidates[1].decision, 'Rejected');
    assert.ok(list.innerHTML.includes('&lt;script&gt;not HTML&lt;/script&gt;'));
    assert.ok(!list.innerHTML.includes('<script>'));
    assert.ok(list.innerHTML.includes('Approve candidate') && list.innerHTML.includes('Reject candidate'));
    const actualUiState = context.autoLinkState;
    context.autoLinkState = { ...actualUiState, candidates: Array.from({ length: 9 }, (_, index) => ({ ...actualUiState.candidates[0], id: `fixture-candidate-${index}` })) };
    context.renderAutoLinkCandidates();
    assert.equal((list.innerHTML.match(/data-auto-link-card/g) || []).length, 9, 'all candidates are reviewable, not only the first eight');
    context.autoLinkState = actualUiState;
    await context.createAutoLinkCandidates({ publish: true });
    assert.equal(requests.at(-1).action, 'publish-auto-link-run');
    assert.equal(requests.at(-1).runId, apiRun.id);
    assert.equal(context.autoLinkState.status, 'blocked');
    assert.ok(context.autoLinkState.message.includes('CAST_CAD_DOCUMENT_METADATA_ADAPTER'));
    assert.equal(apiRun.candidates[1].decision, 'Rejected');
    const beforeCandidates = JSON.stringify(context.autoLinkState.candidates);
    context.fetch = async () => { throw new Error('fixture network outage'); };
    await context.reviewAutoLinkCandidate(buttonFor(secondId, 'Approved'));
    assert.equal(JSON.stringify(context.autoLinkState.candidates), beforeCandidates, 'network failure cannot fabricate local approval');
    context.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await context.reviewAutoLinkCandidate(buttonFor(secondId, 'Approved'));
    assert.equal(context.autoLinkState.status, 'blocked');
    assert.equal(JSON.stringify(context.autoLinkState.candidates), beforeCandidates, 'malformed success cannot fabricate local approval');
    let resolveFetch;
    context.fetch = () => new Promise((resolve) => { resolveFetch = resolve; });
    const staleLoad = context.loadAutoLinkRuns();
    context.selectedDrawingId = 'A-999';
    context.autoLinkState = { runs: [], candidates: [], message: 'New sheet, no candidates' };
    resolveFetch({ ok: true, status: 200, json: async () => listed });
    await staleLoad;
    assert.equal(context.autoLinkState.message, 'New sheet, no candidates', 'late old-sheet load cannot replace new-sheet state');
    const staleReviewInput = { ...input, runId: 'expired-runtime-run' };
    assert.equal((await post(staleReviewInput)).result.code, 'auto-link-run-not-found');
    console.log('CAST CAD Auto Link review tests passed: scoped decisions, immutable audit, review/publish gates, HTTP readback, and workbench behavior.');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  for (const [name, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
