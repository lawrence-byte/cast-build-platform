'use strict';
function matchLinkedRecords(input = {}) {
  const hay = [input.fileName, input.textSnippet, input.existingRfiNumbers, input.existingSubmittalNumbers, input.existingContractNumbers, input.existingChangeOrderNumbers].filter(Boolean).join(' ');
  const matches = [];
  const push = (row) => { if (!matches.some((m) => m.module === row.module && m.recordNumber === row.recordNumber && m.linkType === row.linkType)) matches.push(row); };
  for (const re of [/\bRFI(?:\s*Number)?[-_\s#:]*(\d{1,4})\b/ig, /Request for Information[-_\s#:]*(\d{1,4})/ig]) {
    let m; while ((m = re.exec(hay))) push({ module: 'RFIs', label: `RFI ${m[1]}`, recordNumber: m[1], confidence: 0.92, duplicateWarning: true, linkType: /response|answer|architect response|engineer response/i.test(hay) ? 'responded_rfi_link' : 'issued_rfi_link', supportedFields: ['issuedRfiLink','respondedRfiLink','attachments','dropboxLinks','serverFileLinks','emailDistributionHistory'] });
  }
  if (/\bRFI\b|Request for Information|Question|Response|Answer|Architect Response|Engineer Response/i.test(hay) && !matches.some((m) => m.module === 'RFIs')) push({ module: 'RFIs', label: 'Create new RFI record suggested', recordNumber: '', confidence: 0.62, duplicateWarning: false, linkType: 'create_new_rfi_candidate' });
  for (const re of [/\bSUB(?:MITTAL)?(?:\s*Number)?[-_\s#:]*(\d{1,4})\b/ig, /Submittal[-_\s#:]*(\d{1,4})/ig]) {
    let m; while ((m = re.exec(hay))) push({ module: 'Submittals', label: `Submittal ${m[1]}`, recordNumber: m[1], confidence: 0.9, duplicateWarning: true, linkType: /reviewed|revise and resubmit|approved|approved as noted|architect review/i.test(hay) ? 'responded_submittal_link' : 'issued_submittal_link', supportedFields: ['issuedSubmittalLink','respondedSubmittalLink','relatedDrawingLinks','productDataLinks','dropboxLinks','serverFileLinks','reviewComments','emailDistributionHistory'] });
  }
  if (/Submittal|Shop Drawing|Product Data|Sample|Specification Section|Architect Review|Reviewed|Revise and Resubmit|Approved|Approved as Noted/i.test(hay) && !matches.some((m) => m.module === 'Submittals')) push({ module: 'Submittals', label: 'Create new Submittal record suggested', recordNumber: '', confidence: 0.62, duplicateWarning: false, linkType: 'create_new_submittal_candidate' });
  const drawing = hay.match(/\b([A-Z]{1,3}[-.]?\d{1,4}(?:\.\d+)?)\b/);
  if (drawing) push({ module: 'Drawings', label: `Drawing ${drawing[1]}`, recordNumber: drawing[1], confidence: 0.68, duplicateWarning: false, linkType: 'drawing_reference' });
  const contract = hay.match(/\b(?:contract|commitment|po|proposal|purchase order|subcontract|agreement)[-_\s#:]*([A-Z0-9-]{3,})\b/i);
  if (contract || /owner contract|subcontract agreement|consultant agreement|scope of work|exhibit|amendment|signed contract|insurance exhibit/i.test(hay)) push({ module: 'Contracts', label: contract ? `Contract/Commitment ${contract[1]}` : 'Contract document candidate', recordNumber: contract?.[1] || '', confidence: contract ? 0.78 : 0.66, duplicateWarning: Boolean(contract), linkType: 'contract_document', extractionTargets: ['parties','dates','contractAmount','project','scopeTitle','companyName','insuranceRequirements','retainage','paymentTerms','signatureStatus','vendor','costCode','budgetLineItem'] });
  const change = hay.match(/\b(?:CO|PCO|CCO|Change Order|Change Event)[-_\s#:]*(\d{1,5})\b/i);
  if (change) push({ module: 'Change Orders', label: `Change Order ${change[1]}`, recordNumber: change[1], confidence: 0.82, duplicateWarning: true, linkType: 'change_order_document' });
  return matches;
}
module.exports = { matchLinkedRecords };
