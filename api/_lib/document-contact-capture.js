'use strict';

function captureUploaderContact({ user = {}, projectId, documentId, classification = {} }) {
  return {
    name: user.name || user.fullName || 'Unknown User',
    email: user.email || '',
    company: user.company || '',
    role: user.role || '',
    project: projectId,
    dateFirstSeen: user.dateFirstSeen || new Date().toISOString(),
    dateLastSeen: new Date().toISOString(),
    uploadCountIncrement: 1,
    relatedDocuments: documentId ? [documentId] : [],
    relatedRFIs: (classification.suggestedRecordLinks || []).filter((x) => x.module === 'RFIs').map((x) => x.label),
    relatedSubmittals: (classification.suggestedRecordLinks || []).filter((x) => x.module === 'Submittals').map((x) => x.label),
    relatedContracts: (classification.suggestedRecordLinks || []).filter((x) => x.module === 'Contracts').map((x) => x.label),
    source: 'document_intake_upload',
    requiresAdminApprovalBeforeOverwrite: true,
  };
}
function extractContactSuggestions(input = {}) {
  const text = [input.fileName, input.textSnippet].filter(Boolean).join('\n');
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || [])];
  return emails.map((email) => ({ email, name: '', company: '', phone: '', role: '', trade: '', source: 'document_extraction', action: 'suggest_add_or_update', requiresAdminApprovalBeforeOverwrite: true }));
}
module.exports = { captureUploaderContact, extractContactSuggestions };
