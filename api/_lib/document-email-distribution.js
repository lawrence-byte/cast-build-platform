'use strict';

const EMAIL_TEMPLATES = {
  document_filed_notice: { subject: 'Document filed: {{documentTitle}}', body: 'A document has been filed for {{projectName}}. Secure link: {{secureLink}}' },
  rfi_issued: { subject: 'RFI issued: {{recordNumber}}', body: 'RFI {{recordNumber}} has been issued. Secure link: {{secureLink}}' },
  rfi_response_received: { subject: 'RFI response received: {{recordNumber}}', body: 'A response has been received for RFI {{recordNumber}}. Secure link: {{secureLink}}' },
  submittal_issued: { subject: 'Submittal issued: {{recordNumber}}', body: 'Submittal {{recordNumber}} has been issued. Secure link: {{secureLink}}' },
  submittal_response_received: { subject: 'Submittal response received: {{recordNumber}}', body: 'A response has been received for Submittal {{recordNumber}}. Secure link: {{secureLink}}' },
  contract_uploaded_for_review: { subject: 'Contract uploaded for review: {{documentTitle}}', body: 'A contract document is ready for review. Secure link: {{secureLink}}' },
  financial_document_uploaded_for_approval: { subject: 'Financial document uploaded for approval: {{documentTitle}}', body: 'A financial document requires approval. Secure link: {{secureLink}}' },
  field_report_distributed: { subject: 'Field report distributed: {{documentTitle}}', body: 'A field report has been distributed. Secure link: {{secureLink}}' },
  drawing_update_distributed: { subject: 'Drawing update distributed: {{documentTitle}}', body: 'A drawing update has been distributed. Secure link: {{secureLink}}' },
};
function renderTemplate(templateKey, data = {}) {
  const template = EMAIL_TEMPLATES[templateKey] || EMAIL_TEMPLATES.document_filed_notice;
  const render = (value) => value.replace(/{{(\w+)}}/g, (_, key) => data[key] || '');
  return { subject: render(template.subject), body: render(template.body) };
}
function createDistributionRecord({ templateKey, documentId, linkedModule, recipients = [], manualRecipients = [], sender, data = {}, allowAttachments = false, adminAllowsAttachments = false }) {
  const rendered = renderTemplate(templateKey, data);
  return { documentId, linkedModule, templateKey, subject: rendered.subject, body: rendered.body, recipients, manualRecipients, contactDirectorySuggestions: manualRecipients.map((email) => ({ email, source: 'manual_distribution_recipient', requiresAdminApprovalBeforeOverwrite: true })), sender, date: new Date().toISOString(), deliveryStatus: 'queued', sendSecureLinksNotRawAttachments: true, attachmentsAllowed: Boolean(allowAttachments && adminAllowsAttachments), canResend: true, exportableDistributionLog: true };
}
module.exports = { EMAIL_TEMPLATES, renderTemplate, createDistributionRecord };
