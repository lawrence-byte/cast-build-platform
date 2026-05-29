'use strict';
const { getActor, getState, json, readBody, requireAuthenticatedActor, createTakeoffWorkbookExport, createAnnotatedPdfExport, createPdfAnnotationImportJob, createPdfRendererSession, listPdfRendererSessions, pdfRendererContract, createPrivateUploadLease, listPrivateUploadLeases, privateUploadLeaseContract, buildComparisonJob, createModelIngestionJob, listModelIngestionJobs, createModelQuantityLink, listModelQuantityLinks, createBatchOperation, listBatchOperations, createDrawingUploadPackage, listDrawingUploadPackages, createDrawingTransmittal, listDrawingTransmittals, createDrawingApprovalPackage, reviewDrawingApprovalPackage, listDrawingApprovalPackages, drawingApprovalContract, runDrawingIndexQa, listDrawingIndexQaReports, drawingIndexQaContract, createDrawingIssuePackage, listDrawingIssuePackages, drawingIssuePackageContract, createDrawingBulletin, listDrawingBulletins, drawingBulletinContract, createDrawingAsBuiltPackage, listDrawingAsBuiltPackages, drawingAsBuiltPackageContract, createDrawingReleaseAcknowledgement, listDrawingReleaseAcknowledgements, drawingReleaseAcknowledgementContract, createDrawingRevisionReconciliation, listDrawingRevisionReconciliationReports, drawingRevisionReconciliationContract, createDrawingCloseoutPunchList, listDrawingCloseoutPunchLists, drawingCloseoutPunchListContract, createDrawingTurnoverPackage, listDrawingTurnoverPackages, drawingTurnoverPackageContract, createDrawingWarrantyClaim, listDrawingWarrantyClaims, drawingWarrantyClaimContract, createDrawingWarrantyRemediationPlan, listDrawingWarrantyRemediationPlans, drawingWarrantyRemediationContract, createFacilityAssetRegister, listFacilityAssetRegisters, facilityAssetRegisterContract, createFacilityMaintenancePlan, listFacilityMaintenancePlans, facilityMaintenancePlanContract, createFacilityInspectionReport, listFacilityInspectionReports, facilityInspectionReportContract, createFacilityConditionAssessment, listFacilityConditionAssessments, facilityConditionAssessmentContract, createFacilityCapitalRenewalPlan, listFacilityCapitalRenewalPlans, facilityCapitalRenewalPlanContract, createFacilityWorkOrderHandoff, listFacilityWorkOrderHandoffs, facilityWorkOrderHandoffContract, createDrawingSetVersion, slipSheetRevision, listDrawingSetVersions, createFieldPackage, syncFieldPackageDeltas, listFieldPackages, fieldPackageContract } = require('./_lib/cast-cad-production');

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
      if (url.searchParams.get('type') === 'drawing-issue-package' || url.searchParams.get('type') === 'drawing-issue-packages' || url.searchParams.get('type') === 'drawing-release') {
        const rows = listDrawingIssuePackages(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status'), issueFor: url.searchParams.get('issueFor') });
        return json(res, 200, { ok: true, issuePackageCount: rows.length, drawingIssuePackages: rows, contract: drawingIssuePackageContract() });
      }
      if (url.searchParams.get('type') === 'drawing-bulletin' || url.searchParams.get('type') === 'drawing-bulletins' || url.searchParams.get('type') === 'drawing-addendum') {
        const rows = listDrawingBulletins(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status'), sheetId: url.searchParams.get('sheetId') });
        return json(res, 200, { ok: true, bulletinCount: rows.length, drawingBulletins: rows, contract: drawingBulletinContract() });
      }
      if (url.searchParams.get('type') === 'drawing-as-built-package' || url.searchParams.get('type') === 'drawing-as-built-packages' || url.searchParams.get('type') === 'as-built-package' || url.searchParams.get('type') === 'as-built') {
        const rows = listDrawingAsBuiltPackages(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status'), sheetId: url.searchParams.get('sheetId') });
        return json(res, 200, { ok: true, asBuiltPackageCount: rows.length, drawingAsBuiltPackages: rows, contract: drawingAsBuiltPackageContract() });
      }
      if (url.searchParams.get('type') === 'drawing-release-acknowledgement' || url.searchParams.get('type') === 'drawing-release-acknowledgements' || url.searchParams.get('type') === 'release-acknowledgement') {
        const rows = listDrawingReleaseAcknowledgements(state, { projectId: url.searchParams.get('projectId'), releaseType: url.searchParams.get('releaseType'), releaseId: url.searchParams.get('releaseId'), recipientEmail: url.searchParams.get('recipientEmail'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, acknowledgementCount: rows.length, drawingReleaseAcknowledgements: rows, contract: drawingReleaseAcknowledgementContract() });
      }
      if (url.searchParams.get('type') === 'drawing-revision-reconciliation' || url.searchParams.get('type') === 'drawing-revision-reconciliations' || url.searchParams.get('type') === 'revision-reconciliation') {
        const rows = listDrawingRevisionReconciliationReports(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, reconciliationReportCount: rows.length, drawingRevisionReconciliationReports: rows, contract: drawingRevisionReconciliationContract() });
      }
      if (url.searchParams.get('type') === 'drawing-closeout-punch-list' || url.searchParams.get('type') === 'drawing-closeout-punch-lists' || url.searchParams.get('type') === 'closeout-punch-list') {
        const rows = listDrawingCloseoutPunchLists(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status'), sheetId: url.searchParams.get('sheetId') });
        return json(res, 200, { ok: true, punchListCount: rows.length, drawingCloseoutPunchLists: rows, contract: drawingCloseoutPunchListContract() });
      }
      if (url.searchParams.get('type') === 'drawing-turnover-package' || url.searchParams.get('type') === 'drawing-turnover-packages' || url.searchParams.get('type') === 'owner-turnover-package' || url.searchParams.get('type') === 'turnover-package') {
        const rows = listDrawingTurnoverPackages(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, turnoverPackageCount: rows.length, drawingTurnoverPackages: rows, contract: drawingTurnoverPackageContract() });
      }
      if (url.searchParams.get('type') === 'drawing-warranty-claim' || url.searchParams.get('type') === 'drawing-warranty-claims' || url.searchParams.get('type') === 'warranty-claim') {
        const rows = listDrawingWarrantyClaims(state, { projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status'), turnoverPackageId: url.searchParams.get('turnoverPackageId'), markupId: url.searchParams.get('markupId') });
        return json(res, 200, { ok: true, warrantyClaimCount: rows.length, drawingWarrantyClaims: rows, contract: drawingWarrantyClaimContract() });
      }
      if (url.searchParams.get('type') === 'drawing-warranty-remediation-plan' || url.searchParams.get('type') === 'drawing-warranty-remediation-plans' || url.searchParams.get('type') === 'warranty-remediation') {
        const rows = listDrawingWarrantyRemediationPlans(state, { projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status'), warrantyClaimId: url.searchParams.get('warrantyClaimId'), markupId: url.searchParams.get('markupId') });
        return json(res, 200, { ok: true, remediationPlanCount: rows.length, drawingWarrantyRemediationPlans: rows, contract: drawingWarrantyRemediationContract() });
      }
      if (url.searchParams.get('type') === 'facility-asset-register' || url.searchParams.get('type') === 'facility-asset-registers' || url.searchParams.get('type') === 'asset-register') {
        const rows = listFacilityAssetRegisters(state, { projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status'), turnoverPackageId: url.searchParams.get('turnoverPackageId'), assetTag: url.searchParams.get('assetTag') });
        return json(res, 200, { ok: true, assetRegisterCount: rows.length, facilityAssetRegisters: rows, contract: facilityAssetRegisterContract() });
      }
      if (url.searchParams.get('type') === 'facility-maintenance-plan' || url.searchParams.get('type') === 'facility-maintenance-plans' || url.searchParams.get('type') === 'asset-maintenance') {
        const rows = listFacilityMaintenancePlans(state, { projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status'), facilityAssetRegisterId: url.searchParams.get('facilityAssetRegisterId'), assetTag: url.searchParams.get('assetTag') });
        return json(res, 200, { ok: true, maintenancePlanCount: rows.length, facilityMaintenancePlans: rows, contract: facilityMaintenancePlanContract() });
      }
      if (url.searchParams.get('type') === 'facility-inspection-report' || url.searchParams.get('type') === 'facility-inspection-reports' || url.searchParams.get('type') === 'asset-inspection') {
        const rows = listFacilityInspectionReports(state, { projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status'), facilityMaintenancePlanId: url.searchParams.get('facilityMaintenancePlanId'), facilityAssetRegisterId: url.searchParams.get('facilityAssetRegisterId'), assetTag: url.searchParams.get('assetTag') });
        return json(res, 200, { ok: true, inspectionReportCount: rows.length, facilityInspectionReports: rows, contract: facilityInspectionReportContract() });
      }
      if (url.searchParams.get('type') === 'facility-condition-assessment' || url.searchParams.get('type') === 'facility-condition-assessments' || url.searchParams.get('type') === 'asset-condition') {
        const rows = listFacilityConditionAssessments(state, { projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status'), facilityInspectionReportId: url.searchParams.get('facilityInspectionReportId'), facilityAssetRegisterId: url.searchParams.get('facilityAssetRegisterId'), assetTag: url.searchParams.get('assetTag') });
        return json(res, 200, { ok: true, conditionAssessmentCount: rows.length, facilityConditionAssessments: rows, contract: facilityConditionAssessmentContract() });
      }
      if (url.searchParams.get('type') === 'facility-capital-renewal-plan' || url.searchParams.get('type') === 'facility-capital-renewal-plans' || url.searchParams.get('type') === 'capital-renewal') {
        const rows = listFacilityCapitalRenewalPlans(state, { projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status'), facilityConditionAssessmentId: url.searchParams.get('facilityConditionAssessmentId'), facilityAssetRegisterId: url.searchParams.get('facilityAssetRegisterId'), assetTag: url.searchParams.get('assetTag') });
        return json(res, 200, { ok: true, capitalRenewalPlanCount: rows.length, facilityCapitalRenewalPlans: rows, contract: facilityCapitalRenewalPlanContract() });
      }
      if (url.searchParams.get('type') === 'facility-work-order-handoff' || url.searchParams.get('type') === 'facility-work-order-handoffs' || url.searchParams.get('type') === 'work-order-handoff') {
        const rows = listFacilityWorkOrderHandoffs(state, { projectId: url.searchParams.get('projectId'), status: url.searchParams.get('status'), facilityMaintenancePlanId: url.searchParams.get('facilityMaintenancePlanId'), facilityCapitalRenewalPlanId: url.searchParams.get('facilityCapitalRenewalPlanId'), assetTag: url.searchParams.get('assetTag') });
        return json(res, 200, { ok: true, workOrderHandoffCount: rows.length, facilityWorkOrderHandoffs: rows, contract: facilityWorkOrderHandoffContract() });
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
        return json(res, 200, { ok: true, packageCount: rows.packages.length, syncEventCount: rows.syncEvents.length, contract: fieldPackageContract(), ...rows });
      }
      if (url.searchParams.get('type') === 'pdf-renderer-session' || url.searchParams.get('type') === 'pdf-renderer-sessions' || url.searchParams.get('type') === 'pdf-renderer') {
        const rows = listPdfRendererSessions(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, rendererSessionCount: rows.length, pdfRendererSessions: rows, contract: pdfRendererContract() });
      }
      if (url.searchParams.get('type') === 'private-upload-lease' || url.searchParams.get('type') === 'private-upload-leases' || url.searchParams.get('type') === 'upload-lease') {
        const rows = listPrivateUploadLeases(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), purpose: url.searchParams.get('purpose'), status: url.searchParams.get('status') });
        return json(res, 200, { ok: true, leaseCount: rows.length, privateUploadLeases: rows, contract: privateUploadLeaseContract() });
      }
      return json(res, 200, { ok: true, exportJobs: state.exportJobs, comparisonJobs: state.comparisonJobs, modelIngestionJobs: state.modelIngestionJobs || [], modelQuantityLinks: state.modelQuantityLinks || [], pdfRendererSessions: state.pdfRendererSessions || [], privateUploadLeases: state.privateUploadLeases || [], drawingUploadPackages: state.drawingUploadPackages || [], drawingTransmittals: state.drawingTransmittals || [], drawingApprovalPackages: state.drawingApprovalPackages || [], drawingIndexQaReports: state.drawingIndexQaReports || [], drawingIssuePackages: state.drawingIssuePackages || [], drawingBulletins: state.drawingBulletins || [], drawingAsBuiltPackages: state.drawingAsBuiltPackages || [], drawingReleaseAcknowledgements: state.drawingReleaseAcknowledgements || [], drawingRevisionReconciliationReports: state.drawingRevisionReconciliationReports || [], drawingCloseoutPunchLists: state.drawingCloseoutPunchLists || [], drawingTurnoverPackages: state.drawingTurnoverPackages || [], drawingWarrantyClaims: state.drawingWarrantyClaims || [], drawingWarrantyRemediationPlans: state.drawingWarrantyRemediationPlans || [], facilityAssetRegisters: state.facilityAssetRegisters || [], facilityMaintenancePlans: state.facilityMaintenancePlans || [], facilityInspectionReports: state.facilityInspectionReports || [], facilityConditionAssessments: state.facilityConditionAssessments || [], facilityCapitalRenewalPlans: state.facilityCapitalRenewalPlans || [], facilityWorkOrderHandoffs: state.facilityWorkOrderHandoffs || [], batchOperations: state.batchOperations || [], fieldPackages: state.fieldPackages || [], fieldSyncEvents: state.fieldSyncEvents || [] });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const type = body.type || 'takeoff-workbook';
    const result = type === 'private-upload-lease' || type === 'upload-lease' ? createPrivateUploadLease(state, body, actor) : type === 'drawing-upload-package' || type === 'drawing-upload' ? createDrawingUploadPackage(state, body, actor) : type === 'drawing-transmittal' || type === 'transmittal' ? createDrawingTransmittal(state, body, actor) : type === 'drawing-issue-package' || type === 'drawing-release' ? createDrawingIssuePackage(state, body, actor) : type === 'drawing-bulletin' || type === 'drawing-addendum' ? createDrawingBulletin(state, body, actor) : type === 'drawing-as-built-package' || type === 'as-built-package' || type === 'as-built' ? createDrawingAsBuiltPackage(state, body, actor) : type === 'drawing-release-acknowledgement' || type === 'release-acknowledgement' || type === 'release-ack' ? createDrawingReleaseAcknowledgement(state, body, actor) : type === 'drawing-revision-reconciliation' || type === 'revision-reconciliation' ? createDrawingRevisionReconciliation(state, body, actor) : type === 'drawing-closeout-punch-list' || type === 'closeout-punch-list' ? createDrawingCloseoutPunchList(state, body, actor) : type === 'drawing-turnover-package' || type === 'owner-turnover-package' || type === 'turnover-package' ? createDrawingTurnoverPackage(state, body, actor) : type === 'drawing-warranty-claim' || type === 'warranty-claim' ? createDrawingWarrantyClaim(state, body, actor) : type === 'drawing-warranty-remediation-plan' || type === 'warranty-remediation' ? createDrawingWarrantyRemediationPlan(state, body, actor) : type === 'facility-asset-register' || type === 'asset-register' ? createFacilityAssetRegister(state, body, actor) : type === 'facility-maintenance-plan' || type === 'asset-maintenance' ? createFacilityMaintenancePlan(state, body, actor) : type === 'facility-inspection-report' || type === 'asset-inspection' ? createFacilityInspectionReport(state, body, actor) : type === 'facility-condition-assessment' || type === 'asset-condition' ? createFacilityConditionAssessment(state, body, actor) : type === 'facility-capital-renewal-plan' || type === 'capital-renewal' ? createFacilityCapitalRenewalPlan(state, body, actor) : type === 'facility-work-order-handoff' || type === 'work-order-handoff' ? createFacilityWorkOrderHandoff(state, body, actor) : type === 'drawing-approval-review' || type === 'drawing-approval-decision' ? reviewDrawingApprovalPackage(state, body, actor) : type === 'drawing-approval-package' || type === 'drawing-approval' ? createDrawingApprovalPackage(state, body, actor) : type === 'drawing-index-qa' || type === 'drawing-index-quality' ? runDrawingIndexQa(state, body, actor) : type === 'drawing-set-version' ? createDrawingSetVersion(state, body, actor) : type === 'slip-sheet' ? slipSheetRevision(state, body, actor) : type === 'batch-operation' ? createBatchOperation(state, body, actor) : type === 'model-ingestion' || type === 'cad-model' ? createModelIngestionJob(state, body, actor) : type === 'model-quantity-link' || type === 'model-quantity' ? createModelQuantityLink(state, body, actor) : type === 'field-package' ? createFieldPackage(state, body, actor) : type === 'field-sync' ? syncFieldPackageDeltas(state, body, actor) : type === 'pdf-renderer-session' || type === 'pdf-renderer' ? createPdfRendererSession(state, body, actor) : type === 'pdf-annotation-import' || type === 'annotation-import' ? createPdfAnnotationImportJob(state, body, actor) : type === 'comparison' ? buildComparisonJob(state, body, actor) : (type === 'annotated-pdf' || type === 'pdf-export') ? createAnnotatedPdfExport(state, body, actor) : createTakeoffWorkbookExport(state, body, actor);
    return json(res, result.ok ? (result.status || 202) : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
