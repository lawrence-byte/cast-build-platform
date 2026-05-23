'use strict';
const { getActor, getState, json, readBody, createTakeoffWorkbookExport, createAnnotatedPdfExport, buildComparisonJob, createBatchOperation, listBatchOperations, createDrawingSetVersion, slipSheetRevision, listDrawingSetVersions, createFieldPackage, syncFieldPackageDeltas, listFieldPackages } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      if (url.searchParams.get('type') === 'drawing-sets') {
        const rows = listDrawingSetVersions(state, { projectId: url.searchParams.get('projectId'), setId: url.searchParams.get('setId') });
        return json(res, 200, { ok: true, versionCount: rows.versions.length, revisionCount: rows.revisions.length, ...rows });
      }
      if (url.searchParams.get('type') === 'batch-operation' || url.searchParams.get('type') === 'batch-operations') {
        const rows = listBatchOperations(state, { projectId: url.searchParams.get('projectId'), sheetId: url.searchParams.get('sheetId'), operation: url.searchParams.get('operation') });
        return json(res, 200, { ok: true, batchCount: rows.length, batchOperations: rows });
      }
      if (url.searchParams.get('type') === 'field-package' || url.searchParams.get('type') === 'field-packages' || url.searchParams.get('type') === 'field-sync') {
        const rows = listFieldPackages(state, { projectId: url.searchParams.get('projectId'), deviceId: url.searchParams.get('deviceId'), packageId: url.searchParams.get('packageId') });
        return json(res, 200, { ok: true, packageCount: rows.packages.length, syncEventCount: rows.syncEvents.length, ...rows });
      }
      return json(res, 200, { ok: true, exportJobs: state.exportJobs, comparisonJobs: state.comparisonJobs, batchOperations: state.batchOperations || [], fieldPackages: state.fieldPackages || [], fieldSyncEvents: state.fieldSyncEvents || [] });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const type = body.type || 'takeoff-workbook';
    const result = type === 'drawing-set-version' ? createDrawingSetVersion(state, body, actor) : type === 'slip-sheet' ? slipSheetRevision(state, body, actor) : type === 'batch-operation' ? createBatchOperation(state, body, actor) : type === 'field-package' ? createFieldPackage(state, body, actor) : type === 'field-sync' ? syncFieldPackageDeltas(state, body, actor) : type === 'annotated-pdf' ? createAnnotatedPdfExport(state, body, actor) : type === 'comparison' ? buildComparisonJob(state, body, actor) : createTakeoffWorkbookExport(state, body, actor);
    return json(res, result.ok ? (result.status || 202) : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
