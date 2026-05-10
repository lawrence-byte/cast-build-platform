'use strict';

const CAST_SERVER_FILING_MATRIX = [
  {
    id: 'rfis',
    label: 'RFIs',
    module: 'RFIs',
    serverFolder: "08. RFI's",
    route: "CAST Server / Alüm / 08. RFI's",
    patterns: ['rfi', 'request for information', 'clarification', 'architect response', 'engineer response'],
    recordLinks: ['RFI number', 'subject', 'ball in court', 'spec section', 'drawing sheet'],
    fileNameFormat: 'GHA - RFI #{number} {subject}.{ext}',
    reviewRule: 'Human review when no RFI number is detected, status conflicts with exported RFI log, or document looks like a change/ASI instead of an RFI.',
  },
  {
    id: 'submittals',
    label: 'Submittals',
    module: 'Submittals',
    serverFolder: '09. SUBMITTALS',
    route: 'CAST Server / Alüm / 09. SUBMITTALS / {spec section}',
    patterns: ['submittal', 'shop drawing', 'product data', 'sample', 'approved as noted', 'revise and resubmit'],
    recordLinks: ['submittal number', 'package number', 'spec section', 'responsible contractor'],
    fileNameFormat: '{spec section} - Submittal {number} - {title}.{ext}',
    reviewRule: 'Human review when spec section is missing or the OCR status conflicts with the current submittal register.',
  },
  {
    id: 'commitments',
    label: 'Commitments',
    module: 'Contracts',
    serverFolder: '10. COMMITMENTS',
    route: 'CAST Server / Alüm / 10. COMMITMENTS / {company}',
    patterns: ['commitment', 'subcontract', 'purchase order', 'po ', 'scope of work', 'agreement', 'executed contract'],
    recordLinks: ['commitment number', 'company', 'cost code', 'contract amount'],
    fileNameFormat: '{company} - Commitment {number} - {document type}.{ext}',
    reviewRule: 'Human review for unsigned contracts, missing company, insurance exhibits, or documents with payment/change language.',
  },
  {
    id: 'accounting',
    label: 'Accounting',
    module: 'Financials',
    serverFolder: '16. ACCOUNTING',
    route: 'CAST Server / Alüm / 16. ACCOUNTING / {accounting type}',
    patterns: ['invoice', 'pay application', 'g702', 'g703', 'retainage', 'lien release', 'conditional waiver', 'unconditional waiver', 'statement'],
    recordLinks: ['vendor', 'invoice number', 'pay app number', 'commitment number', 'amount'],
    fileNameFormat: '{vendor} - {accounting type} - {number or date}.{ext}',
    reviewRule: 'Human review for duplicate invoice numbers, unmatched vendor, missing amount, or lien-waiver/payment mismatch.',
  },
  {
    id: 'permits',
    label: 'Permits',
    module: 'Permits',
    serverFolder: '18. PERMITS',
    route: 'CAST Server / Alüm / 18. PERMITS / {jurisdiction or permit type}',
    patterns: ['permit', 'inspection card', 'city approval', 'county approval', 'jurisdiction', 'notice of approval'],
    recordLinks: ['permit number', 'jurisdiction', 'inspection date', 'discipline'],
    fileNameFormat: '{permit type} - {permit number} - {date}.{ext}',
    reviewRule: 'Human review when jurisdiction or permit number is missing, expired, or tied to an inspection failure.',
  },
  {
    id: 'quality',
    label: 'Quality Control',
    module: 'Field',
    serverFolder: '19. QUALITY CONTROL',
    route: 'CAST Server / Alüm / 19. QUALITY CONTROL / {trade or spec section}',
    patterns: ['quality control', 'qc', 'deficiency', 'nonconformance', 'test report', 'observation', 'inspection report'],
    recordLinks: ['QC item', 'inspection', 'spec section', 'location', 'responsible trade'],
    fileNameFormat: 'QC - {location} - {finding or test} - {date}.{ext}',
    reviewRule: 'Human review for failed tests, open deficiencies, or items that should create punch/safety follow-up.',
  },
  {
    id: 'inspections',
    label: 'Inspections',
    module: 'Field',
    serverFolder: '20. INSPECTIONS',
    route: 'CAST Server / Alüm / 20. INSPECTIONS / {discipline}',
    patterns: ['inspection', 'inspector', 'passed', 'failed', 'correction notice', 'reinspect', 'rough-in', 'framing inspection'],
    recordLinks: ['inspection type', 'date', 'location', 'inspector', 'responsible trade'],
    fileNameFormat: 'Inspection - {discipline} - {location} - {date} - {status}.{ext}',
    reviewRule: 'Human review for failed/reinspection results, missing location, or required corrective action.',
  },
  {
    id: 'safety',
    label: 'Safety',
    module: 'Field',
    serverFolder: '21. SAFETY',
    route: 'CAST Server / Alüm / 21. SAFETY / {safety type}',
    patterns: ['safety', 'incident', 'near miss', 'toolbox talk', 'osha', 'tailgate', 'hazard', 'injury'],
    recordLinks: ['incident number', 'date', 'location', 'company', 'corrective action'],
    fileNameFormat: 'Safety - {type} - {location} - {date}.{ext}',
    reviewRule: 'Always human review for incident/injury/OSHA language; create corrective action if status is open.',
  },
  {
    id: 'punchlist',
    label: 'Punchlist',
    module: 'Field',
    serverFolder: '22. PUNCHLIST',
    route: 'CAST Server / Alüm / 22. PUNCHLIST / {area or unit}',
    patterns: ['punch', 'punchlist', 'defect', 'incomplete work', 'closeout item', 'correction complete'],
    recordLinks: ['punch item', 'unit/area', 'trade', 'status'],
    fileNameFormat: 'Punch - {area} - {trade} - {status} - {date}.{ext}',
    reviewRule: 'Human review when closeout evidence is missing or a punch item appears safety/quality critical.',
  },
  {
    id: 'closeout',
    label: 'Closeout',
    module: 'Closeout',
    serverFolder: '23. CLOSEOUT',
    route: 'CAST Server / Alüm / 23. CLOSEOUT / {closeout type}',
    patterns: ['closeout', 'warranty', 'o&m', 'operation and maintenance', 'manual', 'as-built', 'record drawing', 'attic stock'],
    recordLinks: ['spec section', 'submittal', 'warranty period', 'responsible contractor'],
    fileNameFormat: '{closeout type} - {spec section or trade} - {title}.{ext}',
    reviewRule: 'Human review for missing warranty period, missing O&M category, or record drawings that belong under Drawings too.',
  },
  {
    id: 'correspondence',
    label: 'Correspondence',
    module: 'Documents',
    serverFolder: '24. CORRESPONDENCE',
    route: 'CAST Server / Alüm / 24. CORRESPONDENCE / {party or topic}',
    patterns: ['correspondence', 'email', 'letter', 'transmittal', 'notice', 'memo'],
    recordLinks: ['sender', 'recipient', 'topic', 'related RFI/submittal/change'],
    fileNameFormat: '{date} - {sender} - {topic}.{ext}',
    reviewRule: 'Human review when correspondence includes cost, schedule, claim, notice, or direction language.',
  },
];

function normalize(value) { return String(value || '').toLowerCase(); }
function matchCastServerFolder(input = {}) {
  const hay = normalize([input.fileName, input.mimeType, input.textSnippet, input.folderContext, input.documentTitle].filter(Boolean).join(' '));
  let best = null;
  let score = 0;
  for (const row of CAST_SERVER_FILING_MATRIX) {
    const hits = row.patterns.filter((pattern) => hay.includes(normalize(pattern))).length;
    if (hits > score) { best = row; score = hits; }
  }
  if (!best) return null;
  return { ...best, confidenceBoost: Math.min(0.12, score * 0.04), matchedPatternCount: score };
}

module.exports = { CAST_SERVER_FILING_MATRIX, matchCastServerFolder };
