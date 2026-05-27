'use strict';
const { getActor, getState, json, readBody, requireAuthenticatedActor, createTakeoffWorkbookExport, createAnnotatedPdfExport, createPdfAnnotationImportJob, createPdfRendererSession, listPdfRendererSessions, pdfRendererContract, buildComparisonJob, createModelIngestionJob, listModelIngestionJobs, createModelQuantityLink, listModelQuantityLinks, createBatchOperation, listBatchOperations, createDrawingUploadPackage, listDrawingUploadPackages, createDrawingTransmittal, listDrawingTransmittals, createDrawingApprovalPackage, reviewDrawingApprovalPackage, listDrawingApprovalPackages, drawingApprovalContract, runDrawingIndexQa, listDrawingIndexQaReports, drawingIndexQaContract, createDrawingSetVersion, slipSheetRevision, listDrawingSetVersions, createFieldPackage, syncFieldPackageDeltas, listFieldPackages } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  const auth = requireAuthenticatedActor(actor);
  if (!auth.ok) return json(res, auth.status, auth);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      if (url.searchParams.get('type') === 'drawing-sets') {
        const rows = listDrawingSetVersions(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId') });
        return json(res, 200, { ok: true, versionCount: rows.versions.length, revisionCount: rows.revisions.length, ...rows });
      }
      if (url.searchParams.get('type') === 'drawing-upload-package' || url.searchParams.get('type') === 'drawing-upload-packages') {
        const rows = listDrawingUploadPackages(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, packageCount: rows.length, drawingUploadPackages: rows });
      }
      if (url.searchParams.get('type') === 'drawing-transmittal' || url.searchParams.get('type') === 'drawing-transmittals') {
        const rows = listDrawingTransmittals(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, transmittalCount: rows.length, drawingTransmittals: rows });
      }
      if (url.searchParams.get('type') === 'drawing-approval-package' || url.searchParams.get('type') === 'drawing-approval-packages' || url.searchParams.get('type') === 'drawing-approval') {
        const rows = listDrawingApprovalPackages(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status'), sheetId: url.searchParams.get('sheetId') });
        return json(res, 200, { ok: true, approvalPackageCount: rows.length, drawingApprovalPackages: rows, contract: drawingApprovalContract() });
      }
      if (url.searchParams.get('type') === 'drawing-index-qa' || url.searchParams.get('type') === 'drawing-index-qa-reports') {
        const rows = listDrawingIndexQaReports(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, reportCount: rows.length, drawingIndexQaReports: rows, contract: drawingIndexQaContract() });
      }
      if (url.searchParams.get('type') === 'batch-operation' || url.searchParams.get('type') === 'batch-operations') {
        const rows = listBatchOperations(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), operation: url.searchParams.get('operation') });
        return json(res, 200, { ok: true, batchCount: rows.length, batchOperations: rows });
      }
      if (url.searchParams.get('type') === 'model-ingestion' || url.searchParams.get('type') === 'model-ingestions' || url.searchParams.get('type') === 'cad-model') {
        const rows = listModelIngestionJobs(state, { projectId: url.searchParams.get('projectId'), extension: url.searchParams.get('extension') });
        return json(res, 200, { ok: true, jobCount: rows.length, modelIngestionJobs: rows });
      }
      if (url.searchParams.get('type') === 'model-quantity-link' || url.searchParams.get('type') === 'model-quantity-links') {
        const rows = listModelQuantityLinks(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), modelIngestionJobId: url.searchParams.get('modelIngestionJobId'), elementId: url.searchParams.get('elementId') });
        return json(res, 200, { ok: true, quantityLinkCount: rows.length, modelQuantityLinks: rows });
      }
      if (url.searchParams.get('type') === 'field-package' || url.searchParams.get('type') === 'field-packages' || url.searchParams.get('type') === 'field-sync') {
        const rows = listFieldPackages(state, { projectId: url.searchParams.get('projectId'), deviceId: url.searchParams.get('deviceId'), packageId: url.searchParams.get('packageId') });
        return json(res, 200, { ok: true, packageCount: rows.packages.length, syncEventCount: rows.syncEvents.length, ...rows });
      }
      if (url.searchParams.get('type') === 'pdf-renderer-session' || url.searchParams.get('type') === 'pdf-renderer-sessions' || url.searchParams.get('type') === 'pdf-renderer') {
        const rows = listPdfRendererSessions(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, rendererSessionCount: rows.length, pdfRendererSessions: rows, contract: pdfRendererContract() });
      }
      return json(res, 200, { ok: true, exportJobs: state.exportJobs, comparisonJobs: state.comparisonJobs, modelIngestionJobs: state.modelIngestionJobs || [], modelQuantityLinks: state.modelQuantityLinks || [], pdfRendererSessions: state.pdfRendererSessions || [], drawingUploadPackages: state.drawingUploadPackages || [], drawingTransmittals: state.drawingTransmittals || [], drawingApprovalPackages: state.drawingApprovalPackages || [], drawingIndexQaReports: state.drawingIndexQaReports || [], batchOperations: state.batchOperations || [], fieldPackages: state.fieldPackages || [], fieldSyncEvents: state.fieldSyncEvents || [] });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const type = body.type || 'takeoff-workbook';
    const result = type === 'drawing-upload-package' || type === 'drawing-upload' ? createDrawingUploadPackage(state, body, actor) : type === 'drawing-transmittal' || type === 'transmittal' ? createDrawingTransmittal(state, body, actor) : type === 'drawing-approval-review' || type === 'drawing-approval-decision' ? reviewDrawingApprovalPackage(state, body, actor) : type === 'drawing-approval-package' || type === 'drawing-approval' ? createDrawingApprovalPackage(state, body, actor) : type === 'drawing-index-qa' || type === 'drawing-index-quality' ? runDrawingIndexQa(state, body, actor) : type === 'drawing-set-version' ? createDrawingSetVersion(state, body, actor) : type === 'slip-sheet' ? slipSheetRevision(state, body, actor) : type === 'batch-operation' ? createBatchOperation(state, body, actor) : type === 'model-ingestion' || type === 'cad-model' ? createModelIngestionJob(state, body, actor) : type === 'model-quantity-link' || type === 'model-quantity' ? createModelQuantityLink(state, body, actor) : type === 'field-package' ? createFieldPackage(state, body, actor) : type === 'field-sync' ? syncFieldPackageDeltas(state, body, actor) : type === 'pdf-renderer-session' || type === 'pdf-renderer' ? createPdfRendererSession(state, body, actor) : (type === 'annotated-pdf' || type === 'pdf-export') ? createAnnotatedPdfExport(state, body, actor) : (type === 'pdf-annotation-import' || type === 'annotation-import' || type === 'pdf-import') ? createPdfAnnotationImportJob(state, body, actor) : type === 'comparison' ? buildComparisonJob(state, body, actor) : createTakeoffWorkbookExport(state, body, actor);
    return json(res, result.ok ? (result.status || 202) : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
