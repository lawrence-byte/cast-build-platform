'use strict';

const DROPBOX_LINK_TYPES = ['server_stored_file','dropbox_source_link','dropbox_issued_document_link','dropbox_responded_document_link','dropbox_supporting_backup_link','dropbox_drawing_link','dropbox_folder_link','external_shared_link_note'];
function validateSecureUrl(url) {
  try { const parsed = new URL(url); return ['https:'].includes(parsed.protocol); } catch { return false; }
}
function createDropboxLinkRecord({ documentId, linkedModule, linkedRecordId, linkType, url, label, notes, userId, createdAt = new Date().toISOString() }) {
  if (!DROPBOX_LINK_TYPES.includes(linkType)) throw new Error('Unsupported Dropbox/document link type.');
  if (url && !validateSecureUrl(url)) throw new Error('Only secure HTTPS document links are allowed.');
  return { documentId, linkedModule, linkedRecordId, linkType, url: url || '', label: label || linkType, externalSharedLinkNotes: notes || '', dateLinkAdded: createdAt, userWhoAddedLink: userId };
}
module.exports = { DROPBOX_LINK_TYPES, validateSecureUrl, createDropboxLinkRecord };
