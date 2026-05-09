'use strict';

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
function classifyDocument(input={}) {
  const hay = [input.fileName, input.mimeType, input.textSnippet].filter(Boolean).join(' ');
  let module = EXT_MODULES[ext(input.fileName)] || 'Uncategorized';
  let documentType = module === 'Uncategorized' ? 'Uncategorized' : `${module} document`;
  let confidence = module === 'Uncategorized' ? 0.25 : 0.42;
  let reason = `Extension/type suggests ${module}.`;
  for (const [m, re, type] of RULES) {
    if (re.test(hay)) { module=m; documentType=type; confidence=0.86; reason=`Matched ${type} construction-control language.`; break; }
  }
  if (/signed|executed/i.test(hay) && /agreement|contract|proposal/i.test(hay)) { module='Contracts'; documentType='Executed agreement'; confidence=0.9; }
  return { module, documentType, confidence, reason, provider: process.env.CLASSIFICATION_PROVIDER || 'rules', model: process.env.CLASSIFICATION_MODEL || 'rules-v1' };
}
module.exports = { MODULES, classifyDocument };
