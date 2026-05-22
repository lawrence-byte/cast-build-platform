'use strict';
const assert = require('assert');
const cad = require('../api/_lib/cast-cad-production');

const state = cad.resetState();
const owner = { id: 'u1', role: 'Owner Admin', name: 'Owner' };
const readOnly = { id: 'u2', role: 'Read Only Viewer', name: 'Viewer' };

assert.equal(cad.canCastCad('Owner Admin', 'delete_markup'), true, 'owner admin can delete markups');
assert.equal(cad.canCastCad('Read Only Viewer', 'create_markup'), false, 'read only cannot create markups');

const blockedPdf = cad.buildPdfStreamContract({ sheet: { path: 'Current Drawings/A/A-101.pdf', name: 'A-101.pdf', extension: 'pdf' }, actor: readOnly });
assert.equal(blockedPdf.ok, false, 'PDF stream fails closed without provider configuration');
assert.equal(blockedPdf.status, 503, 'PDF stream reports provider-required status');
assert.equal(blockedPdf.contract.publicExposure, false, 'PDF stream contract forbids public exposure');
assert.equal(blockedPdf.contract.requiresAuth, true, 'PDF stream contract requires auth');

const markup = cad.createMarkup(state, { projectId: 'alum', sheetId: 'A-101', tool: 'Area Measurement', subject: 'Test area', layer: 'ASI-002', group_id: 'grp-envelope', style: { stroke: '#2563eb', fill: 'rgba(37,99,235,.2)', opacity: 0.75, lineWidth: 4, fontSize: 14 }, measurement: { value: 245.5, unit: 'SF' }, geometry: { type: 'polygon', points: [{x:1,y:1},{x:5,y:1},{x:5,y:5}] } }, owner);
assert.equal(markup.ok, true, 'markup creates through production service');
assert.equal(markup.markup.layer, 'ASI-002', 'markup create stores layer');
assert.equal(markup.markup.groupId, 'grp-envelope', 'markup create stores group');
assert.equal(markup.markup.style.opacity, 0.75, 'markup create stores opacity');
assert.ok(state.auditLog.some((row) => row.entityId === markup.markup.id), 'markup creation is audited');

const denied = cad.createMarkup(state, { projectId: 'alum', sheetId: 'A-101', tool: 'Pin', subject: 'Blocked' }, readOnly);
assert.equal(denied.ok, false, 'read-only markup creation is denied');
assert.equal(denied.status, 403, 'read-only denial is a 403 contract');

const updated = cad.updateMarkup(state, markup.markup.id, { status: 'Resolved', layer: 'ASI-001', cost_code: '09-2116', assignee_user_id: 'u4' }, owner);
assert.equal(updated.ok, true, 'markup updates through production service');
assert.equal(updated.markup.status, 'Resolved', 'markup status persists');
assert.equal(updated.markup.layer, 'ASI-001', 'markup layer persists');
assert.equal(updated.markup.costCode, '09-2116', 'markup update accepts snake_case cost code from API payloads');
assert.equal(updated.markup.assigneeUserId, 'u4', 'markup update accepts snake_case assignee from API payloads');

const comment = cad.createMarkupComment(state, markup.markup.id, { body: 'Please confirm with @architect@example.com and @pm-team.' }, owner);
assert.equal(comment.ok, true, 'threaded markup comment creates through production service');
assert.deepEqual(comment.comment.mentions, ['architect@example.com', 'pm-team'], 'comment contract extracts email and handle mentions');
const reply = cad.createMarkupComment(state, markup.markup.id, { parentId: comment.comment.id, body: 'Confirmed in review room.' }, owner);
assert.equal(reply.ok, true, 'threaded markup replies enforce parent linkage');
const badReply = cad.createMarkupComment(state, markup.markup.id, { parentId: 'other-thread', body: 'bad parent' }, owner);
assert.equal(badReply.ok, false, 'threaded markup replies reject parents outside the same markup');
assert.equal(cad.listMarkupComments(state, markup.markup.id).length, 2, 'markup comments list by markup');
assert.ok(cad.listMarkupAudit(state, markup.markup.id).some((row) => row.entityType === 'CAST_CAD_MARKUP_COMMENT'), 'markup audit history includes thread comments');

const workbook = cad.createTakeoffWorkbookExport(state, { projectId: 'alum', sheetId: 'A-101' }, owner);
assert.equal(workbook.ok, true, 'takeoff workbook export job created');
assert.equal(workbook.exportJob.status, 'ready', 'takeoff workbook can be generated from stored measurements');
assert.equal(workbook.exportJob.rows.length, 1, 'takeoff workbook includes measured markup');

const pdfExport = cad.createAnnotatedPdfExport(state, { projectId: 'alum', sheetId: 'A-101' }, owner);
assert.equal(pdfExport.ok, true, 'annotated PDF export contract created');
assert.equal(pdfExport.exportJob.status, 'provider-required', 'annotated PDF export fails open as worker-required job, not fake success');

const rfi = cad.createRfiFromMarkup(state, markup.markup.id, owner);
assert.equal(rfi.ok, true, 'RFI link created from markup');
assert.equal(rfi.rfiLink.snapshotPointer.sheetId, 'A-101', 'RFI snapshot captures sheet context');

const ocr = cad.indexOcrPage(state, { projectId: 'alum', sheetId: 'A-101', text: 'Door tag D101 requires fire rating review', symbols: ['D101','FIRE'], confidence: 88 }, owner);
assert.equal(ocr.ok, true, 'OCR page indexed');
assert.equal(cad.searchOcr(state, { projectId: 'alum', query: 'fire rating' }).length, 1, 'OCR search finds indexed text');

const room = cad.createReviewRoom(state, { projectId: 'alum', name: 'Permit review', sheetIds: ['A-101'], participants: [{ userId: 'u3', role: 'Architect' }] }, owner);
assert.equal(room.ok, true, 'review room created');
assert.equal(room.room.participants[0].status, 'Invited', 'review room participants are invited');

const comparison = cad.buildComparisonJob(state, { projectId: 'alum', baseSheetId: 'A-101-r0', revisedSheetId: 'A-101-r1' }, owner);
assert.equal(comparison.ok, true, 'comparison job contract created');
assert.equal(comparison.job.status, 'provider-required', 'comparison job reports worker requirement when no worker configured');

const defaultPrefs = cad.getViewerPreferences(state, owner, 'alum');
assert.equal(defaultPrefs.ok, true, 'viewer preferences can be read by authenticated viewers');
assert.equal(defaultPrefs.source, 'default', 'viewer preferences return defaults before save');
assert.equal(defaultPrefs.preferences.showPageLabels, true, 'viewer preferences default page labels on');
const savedPrefs = cad.saveViewerPreferences(state, owner, { projectId: 'alum', preferences: { layout: 'side-by-side', zoomMode: 'fit-page', showThumbnails: false, showBookmarks: true, keyboardShortcuts: false } });
assert.equal(savedPrefs.ok, true, 'viewer preferences save through production service');
assert.equal(savedPrefs.preferences.preferences.layout, 'side-by-side', 'viewer layout preference persists');
assert.equal(savedPrefs.preferences.preferences.sideBySide, true, 'side-by-side preference derives rendering mode');
assert.equal(savedPrefs.preferences.preferences.showThumbnails, false, 'viewer thumbnail preference persists');
assert.ok(state.auditLog.some((row) => row.entityType === 'CAST_CAD_VIEWER_PREFERENCES'), 'viewer preference saves are audited');
const loadedPrefs = cad.getViewerPreferences(state, owner, 'alum');
assert.equal(loadedPrefs.source, 'stored', 'viewer preferences read stored project/user record');
assert.equal(loadedPrefs.preferences.showBookmarks, true, 'viewer preferences reload stored bookmarks setting');

const baseSet = cad.createDrawingSetRevision(state, { projectId: 'alum', name: 'Permit Set', revision: 'ASI-001', sheets: [
  { drawingNumber: 'A-101', title: 'Level 1 Plan', revision: '0', sourcePath: 'Current Drawings/A/A-101.pdf' },
  { drawingNumber: 'A-102', title: 'Level 2 Plan', revision: '0', sourcePath: 'Current Drawings/A/A-102.pdf' },
] }, owner);
assert.equal(baseSet.ok, true, 'drawing set revision can be indexed');
assert.equal(baseSet.revision.sheetCount, 2, 'drawing set revision stores normalized sheets');
const nextSet = cad.createDrawingSetRevision(state, { projectId: 'alum', name: 'ASI 002 Set', revision: 'ASI-002', sheets: [
  { drawingNumber: 'A-101', title: 'Level 1 Plan', revision: '1', sourcePath: 'Current Drawings/A/A-101-r1.pdf' },
  { drawingNumber: 'A-103', title: 'Roof Plan', revision: '0', sourcePath: 'Current Drawings/A/A-103.pdf' },
] }, owner);
const listedSets = cad.listDrawingSetRevisions(state, { projectId: 'alum' });
assert.equal(listedSets.length, 2, 'drawing set revisions list by project');
const slipSheet = cad.createSlipSheetJob(state, { projectId: 'alum', previousSetId: baseSet.revision.id, newSetId: nextSet.revision.id }, owner);
assert.equal(slipSheet.ok, true, 'slip-sheet diff job creates');
assert.equal(slipSheet.job.status, 'provider-required', 'slip-sheet job fails closed until worker is configured');
assert.equal(slipSheet.job.diff.added.length, 1, 'slip-sheet diff identifies added sheets');
assert.equal(slipSheet.job.diff.removed.length, 1, 'slip-sheet diff identifies removed sheets');
assert.equal(slipSheet.job.diff.revised.length, 1, 'slip-sheet diff identifies revised sheets');
assert.equal(slipSheet.job.relinkContract.requiresHumanApproval, true, 'slip-sheet relink requires human review');
const deniedSet = cad.createDrawingSetRevision(state, { projectId: 'alum', name: 'Blocked' }, readOnly);
assert.equal(deniedSet.status, 403, 'read-only users cannot index drawing set revisions');

console.log('CAST CAD production contract tests passed.');
