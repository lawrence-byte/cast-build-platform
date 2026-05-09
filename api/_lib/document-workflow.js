'use strict';

const STATUSES = ['Uploaded','Processing','Classified','Needs Review','Approved for Filing','Filed','Distributed','Rejected','Archived'];
const HUMAN_REVIEW_MODULES = new Set(['Financials','Contracts','Insurance','Pay Applications','Invoices','Closeout']);
function workflowDecision(classification = {}, duplicate = {}) {
  const score = Number(classification.confidenceScore || 0);
  const module = classification.module || 'Uncategorized';
  const linked = classification.suggestedRecordLinks || [];
  const sensitive = HUMAN_REVIEW_MODULES.has(module) || /lien release|legal/i.test(classification.documentType || '');
  const duplicateWarning = Boolean(duplicate.duplicateDetected || linked.some((x) => x.duplicateWarning));
  const versionWarning = duplicate.newerVersionExists ? 'Newer version exists; warn before filing.' : duplicate.olderVersionExists ? 'Older version exists; offer archive or supersede.' : '';
  let nextStatus = 'Needs Review';
  let action = 'Route to admin review.';
  if (score > 0.9 && !sensitive && !duplicateWarning) { nextStatus = 'Approved for Filing'; action = 'Ready to File'; }
  else if (score >= 0.7 && score <= 0.9 && !sensitive) { nextStatus = 'Classified'; action = 'Require user confirmation'; }
  if (sensitive) { nextStatus = 'Needs Review'; action = 'Sensitive document requires human confirmation.'; }
  if (duplicateWarning) { nextStatus = 'Needs Review'; action = 'Possible duplicate/link match; confirm before linking or versioning.'; }
  return { statuses: STATUSES, nextStatus, action, requiresHumanReview: nextStatus === 'Needs Review' || action.includes('Require'), duplicateWarning, versionWarning, linkedRecordConfirmationRequired: linked.length > 0, sensitiveDocument: sensitive };
}
function auditEvent({ documentId, userId, action, previousValue, newValue, reason, req }) {
  return { documentId, userId, action, previousValueJson: previousValue || null, newValueJson: newValue || null, reason: reason || '', ipAddress: req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '', userAgent: req?.headers?.['user-agent'] || '', createdAt: new Date().toISOString() };
}
module.exports = { STATUSES, HUMAN_REVIEW_MODULES, workflowDecision, auditEvent };
