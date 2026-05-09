# CAST RFI External Links Spec

## Purpose

Store Dropbox and other external URLs as controlled RFI records instead of loose free-text fields. Dropbox links can remain external package links, but the CAST system RFI record itself requires authentication.

## Table: ExternalLinks

| Field | Notes |
|---|---|
| id | Primary key |
| project_id | Project foreign key |
| entity_type | RFI, Submittal, Drawing, Document, Meeting Minute, Transmittal, Change Event |
| entity_id | Entity record id |
| link_type | Controlled link type |
| provider | Dropbox, Google Drive, SharePoint, Box, OneDrive, Other |
| url | External URL |
| display_name | Human label |
| description | Optional description |
| file_name | File name if known |
| file_extension | Extension if known |
| folder_path | Safe provider-relative path if known |
| created_by_user_id | Creator |
| created_at | Created timestamp |
| updated_at | Updated timestamp |
| last_verified_at | Last verification timestamp |
| verified_status | Not Checked, Valid, Invalid, Permission Issue, Expired, Unknown |
| access_level | Public Link, Restricted Link, Internal Only, Requires Authentication, Unknown |
| notes | Admin notes |

## RFI link types

- Issued RFI
- Responded RFI
- Drawing Reference
- Specification Reference
- Backup
- Attachment Folder
- Consultant Response
- Architect Response
- Owner Direction
- Field Photo
- Other

## Primary controlled links

Each RFI references:

- `issued_rfi_link_id`
- `responded_rfi_link_id`

Both values point to `ExternalLinks.id`.

## RFI Detail section: RFI External Links

Show:

- Issued RFI Link
- Responded RFI Link
- Drawing Reference Links
- Backup Links
- Other Links

Each link shows:

- display name
- provider
- link type
- URL
- created by
- created date
- verified status
- access level
- notes

Actions:

- Add Link
- Edit Link
- Remove Link
- Verify Link
- Set as Issued RFI Link
- Set as Responded RFI Link
- Copy Link
- Open Link

## Validation

- Issued RFI Link must be present before distributing an issued RFI unless an authorized override reason is recorded.
- Responded RFI Link must be present before distributing a response unless an authorized override reason is recorded.
- All overrides are written to AuditLog.
- External link validity does not imply permission to view the authenticated RFI system record.
