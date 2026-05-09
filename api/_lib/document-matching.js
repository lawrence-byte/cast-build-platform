'use strict';
function extractFinancialMetadata(hay) {
  return {
    dollarAmounts: [...new Set(hay.match(/\$\s?\d[\d,]*(?:\.\d{2})?/g) || [])],
    invoiceNumbers: [...new Set([...hay.matchAll(/\b(?:invoice|inv)[-_\s#:]*(\w[\w-]*)/ig)].map((m) => m[1]))],
    payApplicationNumbers: [...new Set([...hay.matchAll(/\b(?:pay application|pay app|application for payment)[-_\s#:]*(\w[\w-]*)/ig)].map((m) => m[1]))],
    changeOrderReferences: [...new Set([...hay.matchAll(/\b(?:CO|PCO|CCO|Change Order|Change Event)[-_\s#:]*(\w[\w-]*)/ig)].map((m) => m[1]))],
    costCodes: [...new Set([...hay.matchAll(/\b\d{2}-\d{2,3}(?:-\d{2,3})?\b/g)].map((m) => m[0]))],
    retainageMentioned: /retainage|retention/i.test(hay),
    currentPaymentDueMentioned: /current payment due|amount due|payment due/i.test(hay),
    priorPaymentsMentioned: /prior payment|previous payment|paid to date/i.test(hay),
  };
}
function extractFieldMetadata(hay) {
  return {
    weatherMentioned: /weather|rain|wind|sunny|cloudy|temperature/i.test(hay),
    manpowerMentioned: /manpower|crew|workers|headcount/i.test(hay),
    locations: [...new Set([...hay.matchAll(/\b(?:area|unit|floor|level|location)[:\s-]+([A-Za-z0-9 .-]+)/ig)].map((m) => m[1].trim().slice(0, 80)))],
    trades: [...new Set((hay.match(/concrete|framing|drywall|electrical|plumbing|mechanical|waterproofing|roofing|sitework/ig) || []).map((x) => x.toLowerCase()))],
    issueCategories: [...new Set((hay.match(/safety|quality|delay|delivery|inspection|punch|observation|site instruction/ig) || []).map((x) => x.toLowerCase()))],
  };
}
function extractDrawingMetadata(hay) {
  const sheet = hay.match(/\b([A-Z]{1,3}[-.]?\d{1,4}(?:\.\d+)?)\b/);
  const rev = hay.match(/\b(?:rev(?:ision)?)[-_\s#:]*(\w+)/i);
  const addendum = hay.match(/\b(?:addendum|addenda)[-_\s#:]*(\w+)/i);
  return {
    sheetNumber: sheet?.[1] || '',
    revisionNumber: rev?.[1] || '',
    addendumNumber: addendum?.[1] || '',
    discipline: /structural/i.test(hay) ? 'Structural' : /architectural/i.test(hay) ? 'Architectural' : /mechanical|mep/i.test(hay) ? 'MEP' : /electrical/i.test(hay) ? 'Electrical' : /plumbing/i.test(hay) ? 'Plumbing' : '',
    designTeamAuthorMentioned: /architect|engineer|consultant|design team/i.test(hay),
  };
}
function matchLinkedRecords(input = {}) {
  const hay = [input.fileName, input.textSnippet, input.existingRfiNumbers, input.existingSubmittalNumbers, input.existingContractNumbers, input.existingChangeOrderNumbers].filter(Boolean).join(' ');
  const matches = [];
  const push = (row) => { if (!matches.some((m) => m.module === row.module && m.recordNumber === row.recordNumber && m.linkType === row.linkType)) matches.push(row); };
  for (const re of [/\bRFI(?:\s*Number)?[-_\s#:]*(\d{1,4})\b/ig, /Request for Information[-_\s#:]*(\d{1,4})/ig]) { let m; while ((m = re.exec(hay))) push({ module: 'RFIs', label: `RFI ${m[1]}`, recordNumber: m[1], confidence: 0.92, duplicateWarning: true, linkType: /response|answer|architect response|engineer response/i.test(hay) ? 'responded_rfi_link' : 'issued_rfi_link', supportedFields: ['issuedRfiLink','respondedRfiLink','attachments','dropboxLinks','serverFileLinks','emailDistributionHistory'] }); }
  if (/\bRFI\b|Request for Information|Question|Response|Answer|Architect Response|Engineer Response/i.test(hay) && !matches.some((m) => m.module === 'RFIs')) push({ module: 'RFIs', label: 'Create new RFI record suggested', recordNumber: '', confidence: 0.62, duplicateWarning: false, linkType: 'create_new_rfi_candidate' });
  for (const re of [/\bSUB(?:MITTAL)?(?:\s*Number)?[-_\s#:]*(\d{1,4})\b/ig, /Submittal[-_\s#:]*(\d{1,4})/ig]) { let m; while ((m = re.exec(hay))) push({ module: 'Submittals', label: `Submittal ${m[1]}`, recordNumber: m[1], confidence: 0.9, duplicateWarning: true, linkType: /reviewed|revise and resubmit|approved|approved as noted|architect review/i.test(hay) ? 'responded_submittal_link' : 'issued_submittal_link', supportedFields: ['issuedSubmittalLink','respondedSubmittalLink','relatedDrawingLinks','productDataLinks','dropboxLinks','serverFileLinks','reviewComments','emailDistributionHistory'] }); }
  if (/Submittal|Shop Drawing|Product Data|Sample|Specification Section|Architect Review|Reviewed|Revise and Resubmit|Approved|Approved as Noted/i.test(hay) && !matches.some((m) => m.module === 'Submittals')) push({ module: 'Submittals', label: 'Create new Submittal record suggested', recordNumber: '', confidence: 0.62, duplicateWarning: false, linkType: 'create_new_submittal_candidate' });
  const drawingMeta = extractDrawingMetadata(hay);
  if (drawingMeta.sheetNumber || /drawing|plan sheet|addenda|addendum|sketch|ASI|bulletin|revision|specification|drawing log/i.test(hay)) push({ module: 'Drawings', label: drawingMeta.sheetNumber ? `Drawing ${drawingMeta.sheetNumber}` : 'Drawing register candidate', recordNumber: drawingMeta.sheetNumber, confidence: drawingMeta.sheetNumber ? 0.74 : 0.62, duplicateWarning: Boolean(drawingMeta.sheetNumber), linkType: 'drawing_register_link', extractionTargets: ['sheetNumber','sheetTitle','discipline','issueDate','revisionNumber','addendumNumber','designTeamAuthor'], extracted: drawingMeta, referencedBy: ['RFIs','Submittals','Change Orders','Field Reports','Contracts'] });
  const contract = hay.match(/\b(?:contract|commitment|po|proposal|purchase order|subcontract|agreement)[-_\s#:]*([A-Z0-9-]{3,})\b/i);
  if (contract || /owner contract|subcontract agreement|consultant agreement|scope of work|exhibit|amendment|signed contract|insurance exhibit/i.test(hay)) push({ module: 'Contracts', label: contract ? `Contract/Commitment ${contract[1]}` : 'Contract document candidate', recordNumber: contract?.[1] || '', confidence: contract ? 0.78 : 0.66, duplicateWarning: Boolean(contract), linkType: 'contract_document', extractionTargets: ['parties','dates','contractAmount','project','scopeTitle','companyName','insuranceRequirements','retainage','paymentTerms','signatureStatus','vendor','costCode','budgetLineItem'] });
  const financialPattern = /invoice|pay application|pay app|change order|lien release|budget|cost report|forecast|schedule of values|backup|receipt|payment approval|current payment due|prior payments|retainage/i;
  if (financialPattern.test(hay)) push({ module: /invoice/i.test(hay) ? 'Invoices' : /pay app|pay application/i.test(hay) ? 'Pay Applications' : /change order/i.test(hay) ? 'Change Orders' : 'Financials', label: 'Financial document candidate', recordNumber: extractFinancialMetadata(hay).invoiceNumbers[0] || extractFinancialMetadata(hay).payApplicationNumbers[0] || extractFinancialMetadata(hay).changeOrderReferences[0] || '', confidence: 0.78, duplicateWarning: false, linkType: 'financial_document_link', extractionTargets: ['dollarAmounts','invoiceNumbers','payApplicationNumbers','vendorNames','costCodes','dates','retainage','currentPaymentDue','priorPayments','changeOrderReferences'], extracted: extractFinancialMetadata(hay), linkedTargets: ['Contracts','Commitments','Change Orders','Budgets','Cost Codes'] });
  if (/daily report|field photo|inspection report|safety report|punch list|observation|log|delivery ticket|weather record|manpower report|site instruction/i.test(hay)) push({ module: 'Field', label: 'Field document candidate', recordNumber: '', confidence: 0.76, duplicateWarning: false, linkType: 'field_document_link', extractionTargets: ['date','author','location','trade','weather','manpower','issueCategory','relatedDrawings'], extracted: extractFieldMetadata(hay), linkedTargets: ['Project Areas','Units','Floors','Trades','Schedule Activities'] });
  const change = hay.match(/\b(?:CO|PCO|CCO|Change Order|Change Event)[-_\s#:]*(\d{1,5})\b/i);
  if (change) push({ module: 'Change Orders', label: `Change Order ${change[1]}`, recordNumber: change[1], confidence: 0.82, duplicateWarning: true, linkType: 'change_order_document' });
  return matches;
}
module.exports = { matchLinkedRecords, extractFinancialMetadata, extractFieldMetadata, extractDrawingMetadata };
