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

const badTool = cad.createToolLibraryItem(state, { projectId: 'alum', name: 'Unsafe auto-budget count', toolType: 'count', requiresHumanReview: false }, owner);
assert.equal(badTool.ok, false, 'Tool Library items fail closed when human review is disabled');
assert.equal(badTool.status, 422, 'Tool Library review gate returns validation error');
const toolItem = cad.createToolLibraryItem(state, { projectId: 'alum', name: 'Fire extinguisher cabinet', category: 'Life Safety', trade: 'Fire Protection', costCode: '10-4400', assemblyCode: 'FEC-001', toolType: 'count', unit: 'EA', unitCost: 850, formula: 'count * unitCost' }, owner);
assert.equal(toolItem.ok, true, 'Tool Library item creates through production service');
assert.equal(toolItem.item.requiresHumanReview, true, 'Tool Library item is human-review gated by default');
assert.equal(cad.listToolLibraryItems(state, { projectId: 'alum', search: 'extinguisher' }).length, 1, 'Tool Library list filters by project and search');
const updatedTool = cad.updateToolLibraryItem(state, toolItem.item.id, { unitCost: 900, defaultLayer: 'Life Safety' }, owner);
assert.equal(updatedTool.ok, true, 'Tool Library item updates through production service');
assert.equal(updatedTool.item.unitCost, 900, 'Tool Library item unit cost persists');
const deniedToolAdmin = cad.createToolLibraryItem(state, { projectId: 'alum', name: 'Viewer-created item' }, readOnly);
assert.equal(deniedToolAdmin.ok, false, 'read-only users cannot administer Tool Library items');
const placedTool = cad.applyToolLibraryItemToMarkup(state, { itemId: toolItem.item.id, projectId: 'alum', sheetId: 'A-101', quantity: 3, x: 42, y: 58 }, owner);
assert.equal(placedTool.ok, true, 'Tool Library item places a markup/takeoff row contract');
assert.equal(placedTool.markup.status, 'Needs Review', 'Tool Library placement remains review-gated');
assert.equal(placedTool.markup.measurement.humanReviewRequired, true, 'Tool Library measurement is not budget-authoritative without review');
assert.equal(placedTool.placement.budgetAuthoritative, false, 'Tool Library placement explicitly blocks budget authority');
assert.ok(state.auditLog.some((row) => row.entityType === 'CAST_CAD_TOOL_LIBRARY_PLACEMENT'), 'Tool Library placement is audited');

const comparison = cad.buildComparisonJob(state, { projectId: 'alum', baseSheetId: 'A-101-r0', revisedSheetId: 'A-101-r1' }, owner);
assert.equal(comparison.ok, true, 'comparison job contract created');
assert.equal(comparison.job.status, 'provider-required', 'comparison job reports worker requirement when no worker configured');

const batchFlag = cad.createBatchOperation(state, { type: 'batch-operation', operation: 'flag-for-review', projectId: 'alum', sheetId: 'A-101', patch: { priority: 'Urgent' } }, owner);
assert.equal(batchFlag.ok, true, 'batch operation applies provider-independent markup updates');
assert.equal(batchFlag.batch.providerRequired, false, 'batch operation does not require a private provider');
assert.equal(batchFlag.batch.targetCount >= 2, true, 'batch operation targets matching markups');
assert.equal(batchFlag.markups.every((row) => row.status === 'Needs Review'), true, 'batch flag updates statuses');
assert.ok(state.auditLog.some((row) => row.entityType === 'CAST_CAD_BATCH_OPERATION'), 'batch operation has an audit record');
const blockedBatchStamp = cad.createBatchOperation(state, { operation: 'place-stamp', markupIds: [markup.markup.id], stamp: { label: 'Approved' } }, owner);
assert.equal(blockedBatchStamp.ok, false, 'batch stamp fails closed without human approval');
assert.equal(blockedBatchStamp.code, 'human-review-required', 'batch stamp exposes review approval blocker');
const approvedBatchStamp = cad.createBatchOperation(state, { operation: 'place-stamp', markupIds: [markup.markup.id], humanReviewApproved: true, stamp: { label: 'Approved for RFI draft' } }, owner);
assert.equal(approvedBatchStamp.ok, true, 'approved batch stamp applies');
assert.equal(approvedBatchStamp.markups[0].sourceSnapshot.batchStamp.humanReviewApproved, true, 'approved batch stamp stores review gate proof');
assert.equal(cad.listBatchOperations(state, { projectId: 'alum' }).length >= 2, true, 'batch operations list by project');
const deniedBatch = cad.createBatchOperation(state, { operation: 'set-layer', projectId: 'alum', sheetId: 'A-101', layer: 'Read only change' }, readOnly);
assert.equal(deniedBatch.ok, false, 'read-only users cannot run batch operations');
assert.equal(deniedBatch.status, 403, 'read-only batch denial is a 403');

const setVersion = cad.createDrawingSetVersion(state, { projectId: 'alum', setId: 'current', name: 'Alüm Current Drawings', revisionLabel: 'Permit Set', sheets: [{ sheetId: 'A-101', drawingNumber: 'A-101', drawingTitle: 'Floor Plan', path: 'Current Drawings/A/A-101.pdf', name: 'A-101.pdf', contentHash: 'hash-a' }] }, owner);
assert.equal(setVersion.ok, true, 'drawing set version creates through production service');
assert.equal(setVersion.revisions.length, 1, 'drawing set version creates sheet revisions');
assert.equal(setVersion.revisions[0].status, 'current', 'new sheet revision is current');
const blockedSlipSheet = cad.slipSheetRevision(state, { targetRevisionId: setVersion.revisions[0].id, replacementSheet: { name: 'A-101 Rev 1.pdf', contentHash: 'hash-b' } }, owner);
assert.equal(blockedSlipSheet.ok, false, 'slip-sheeting fails closed without human review approval');
assert.equal(blockedSlipSheet.status, 409, 'slip-sheeting review gate reports conflict');
assert.equal(blockedSlipSheet.code, 'human-review-required', 'slip-sheeting exposes exact review blocker');
const slipSheeted = cad.slipSheetRevision(state, { targetRevisionId: setVersion.revisions[0].id, humanReviewApproved: true, replacementSheet: { name: 'A-101 Rev 1.pdf', revisionLabel: 'ASI-001', contentHash: 'hash-b' } }, owner);
assert.equal(slipSheeted.ok, true, 'approved slip-sheet creates replacement revision');
assert.equal(slipSheeted.superseded.status, 'superseded', 'target revision is superseded');
assert.equal(slipSheeted.replacement.status, 'current', 'replacement revision becomes current');
assert.equal(slipSheeted.replacement.supersedesRevisionId, setVersion.revisions[0].id, 'replacement keeps supersedence chain');
const listedSets = cad.listDrawingSetVersions(state, { projectId: 'alum', setId: 'current' });
assert.equal(listedSets.versions.length, 1, 'drawing set list filters versions');
assert.equal(listedSets.revisions.filter((row) => row.sheetId === 'A-101').length, 2, 'drawing set list includes revision history');
assert.ok(state.auditLog.some((row) => row.entityType === 'CAST_CAD_DRAWING_REVISION'), 'slip-sheeting is audited');

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

console.log('CAST CAD production contract tests passed.');
