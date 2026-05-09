'use strict';

const SEARCH_FIELDS = ['fileName','documentType','module','project','company','contact','dateRange','costCode','rfiNumber','submittalNumber','contractNumber','changeOrderNumber','invoiceNumber','drawingSheetNumber','extractedText','tags','status','uploadedBy','linkedRecords','dropboxLinks'];
const SAVED_VIEWS = ['Needs Review','Recently Uploaded','Filed Today','Financial Documents','Contract Documents','Field Documents','RFI Attachments','Submittal Attachments','Drawing Updates','Missing Metadata','Low Confidence Classification','Duplicates','Ready to Distribute'];
function buildSearchQuery(filters = {}) {
  return { filters, supportedFields: SEARCH_FIELDS, savedViews: SAVED_VIEWS, requiresPermissionFilter: true };
}
function matchesSavedView(row = {}, view) {
  if (view === 'Needs Review') return row.status === 'Needs Review';
  if (view === 'Financial Documents') return ['Financials','Pay Applications','Invoices'].includes(row.module);
  if (view === 'Contract Documents') return row.module === 'Contracts';
  if (view === 'Field Documents') return row.module === 'Field';
  if (view === 'RFI Attachments') return row.linkedRecords?.some?.((x) => /RFI/i.test(String(x.label || x)));
  if (view === 'Submittal Attachments') return row.linkedRecords?.some?.((x) => /Submittal/i.test(String(x.label || x)));
  if (view === 'Drawing Updates') return row.module === 'Drawings';
  if (view === 'Missing Metadata') return !row.documentType || !row.projectId;
  if (view === 'Low Confidence Classification') return Number(row.confidenceScore || 0) < 0.7;
  if (view === 'Duplicates') return Boolean(row.duplicateWarning);
  if (view === 'Ready to Distribute') return row.status === 'Filed' || row.status === 'Approved for Filing';
  return true;
}
module.exports = { SEARCH_FIELDS, SAVED_VIEWS, buildSearchQuery, matchesSavedView };
