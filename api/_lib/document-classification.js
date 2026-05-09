'use strict';

const { buildStructuredFolder, moduleFolder, safeSegment } = require('./document-storage');
const { matchLinkedRecords } = require('./document-matching');
const MODULES = ['Documents','Contracts','Financials','Field','Drawings','RFIs','Submittals','Change Orders','Pay Applications','Invoices','Insurance','Permits','Meeting Minutes','Closeout','Uncategorized'];
const RULES = [
  ['RFIs', /\brfi\b|request for information|clarification|rfi response/i, 'RFI / response'],
  ['Submittals', /submittal|shop drawing|product data|sample|revise and resubmit|approved as noted/i, 'Submittal package / response'],
  ['Drawings', /drawing|plan set|sheet\s*[a-z]?\d|architectural|structural|mep|markup|sketch|\.dwg$/i, 'Drawing / markup'],
  ['Contracts', /contract|agreement|proposal|scope of work|sov|commitment|purchase order|subcontract/i, 'Agreement / contract'],
  ['Financials', /budget|forecast|cost|schedule of values|financial/i, 'Financial backup'],
  ['Pay Applications', /pay app|payment application|application for payment|g702|g703|retainage/i, 'Pay application'],
  ['Invoices', /invoice|bill|statement|remittance/i, 'Invoice'],
  ['Insurance', /insurance|coi|certificate of insurance|additional insured|policy/i, 'Insurance certificate'],
  ['Permits', /permit|inspection card|city approval|county approval/i, 'Permit / jurisdictional approval'],
  ['Meeting Minutes', /meeting minutes|oac|agenda|minutes|meeting packet/i, 'Meeting minutes'],
  ['Field', /daily report|daily log|field report|inspection|observation|incident|safety|photo|punch/i, 'Field report / photo'],
  ['Change Orders', /change order|cco|pco|change event|budget change|ASI|SSI|COR/i, 'Change control'],
  ['Closeout', /closeout|warranty|o&m|operation and maintenance|as-built|record drawing|lien release|manual/i, 'Closeout document'],
];
const EXT_MODULES = { pdf:'Documents', doc:'Documents', docx:'Documents', xls:'Financials', xlsx:'Financials', csv:'Financials', jpg:'Field', jpeg:'Field', png:'Field', heic:'Field', dwg:'Drawings', dxf:'Drawings', eml:'Documents', msg:'Documents' };
function ext(name='') { const p=String(name).split('.'); return p.length>1 ? p.pop().toLowerCase() : ''; }
function extractMetadata(input = {}) {
  const text = [input.fileName, input.textSnippet, input.folderContext].filter(Boolean).join('\n');
  const emails = [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || []))];
  const dates = [...new Set((text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/ig) || []))];
  const costValues = [...new Set((text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/g) || []))];
  const signatures = /signed|signature|executed|approved by/i.test(text);
  const title = input.documentTitle || String(input.fileName || '').replace(/\.[^.]+$/, '');
  const header = input.documentHeader || '';
  const footer = input.documentFooter || '';
  const keywords = [...new Set(MODULES.filter((m) => new RegExp(m.replace(/s$/, ''), 'i').test(text)))];
  return { fileExtension: ext(input.fileName), folderContext: input.folderContext || '', textExtracted: Boolean(input.textSnippet), ocrUsed: Boolean(input.ocrUsed), dates, documentTitle: title, documentHeader: header, documentFooter: footer, signaturesDetected: signatures, emailAddresses: emails, costValues, keywords, vendorNames: input.vendorNames || [], projectDirectoryContacts: input.projectDirectoryContacts || [] };
}
function classifyDocument(input={}) {
  const hay = [input.fileName, input.mimeType, input.textSnippet, input.folderContext, input.existingProjectRecords, input.existingRfiNumbers, input.existingSubmittalNumbers, input.existingContractNumbers, input.existingChangeOrderNumbers, input.existingVendorNames, input.existingProjectDirectoryContacts].filter(Boolean).join(' ');
  let module = EXT_MODULES[ext(input.fileName)] || 'Uncategorized';
  let documentType = module === 'Uncategorized' ? 'Uncategorized' : `${module} document`;
  let confidenceScore = module === 'Uncategorized' ? 0.25 : 0.42;
  let reasoningSummary = `Extension ${ext(input.fileName) || 'unknown'} and available metadata suggest ${module}.`;
  for (const [m, re, type] of RULES) {
    if (re.test(hay)) { module=m; documentType=type; confidenceScore=0.86; reasoningSummary=`Matched ${type} language in filename, folder context, or extracted text.`; break; }
  }
  if (/signed|executed/i.test(hay) && /agreement|contract|proposal/i.test(hay)) { module='Contracts'; documentType='Executed agreement'; confidenceScore=0.9; reasoningSummary='Detected signed/executed agreement language.'; }
  const projectId = input.projectId || 'golden-hill';
  const projectName = input.projectName || (projectId === 'golden-hill' ? 'Alüm' : projectId);
  const projectSlug = input.projectSlug || safeSegment(projectId);
  const suggestedRecordLinks = matchLinkedRecords(input);
  const extractedMetadata = extractMetadata({ ...input, ocrUsed: input.ocrUsed });
  const suggestedFolderPath = buildStructuredFolder({ projectSlug, projectId, module });
  const requiresHumanReview = confidenceScore < 0.92 || suggestedRecordLinks.some((x) => x.duplicateWarning);
  return { projectId, projectName, module, documentType, confidenceScore, suggestedFolderPath, suggestedRecordLinks, extractedMetadata, requiresHumanReview, reasoningSummary, provider: process.env.CLASSIFICATION_PROVIDER || 'rules', model: process.env.CLASSIFICATION_MODEL || 'rules-v1', moduleFolder: moduleFolder(module) };
}
module.exports = { MODULES, classifyDocument, extractMetadata, ext };
