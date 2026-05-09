# CAST Submittal External Links Spec

## Purpose

Store Dropbox and other external URLs as controlled project records instead of free-text fields.

## Table: ExternalLinks

| Field | Notes |
|---|---|
| id | Primary key |
| project_id | Project foreign key |
| entity_type | RFI, Submittal, Drawing, Document, Meeting Minute, Transmittal, Change Event, Closeout Item |
| entity_id | Entity record id |
| link_type | Controlled link type |
| provider | Dropbox, Google Drive, SharePoint, Box, OneDrive, Other |
| url | External URL |
| display_name | Human label |
| description | Optional description |
| file_name | File name if known |
| file_extension | Extension if known |
| folder_path | Safe relative/provider path if known |
| created_by_user_id | Creator |
| created_at | Created timestamp |
| updated_at | Updated timestamp |
| last_verified_at | Last verification timestamp |
| verified_status | Not Checked, Valid, Invalid, Permission Issue, Expired, Unknown |
| access_level | Public Link, Restricted Link, Internal Only, Requires Authentication, Unknown |
| notes | Admin notes |

## Submittal link types

Issued Submittal, Returned Submittal, Submitted Package, Reviewed Package, Shop Drawing, Product Data, Sample Photo, Specification Reference, Drawing Reference, Backup, Consultant Review, Architect Review, Owner Review, Closeout Document, Other.

## Primary controlled links

Each submittal references:

- `issued_submittal_link_id`
- `returned_submittal_link_id`

Both values point to `ExternalLinks.id`.

## Validation

- Issued distribution requires `issued_submittal_link_id` unless an authorized override reason is recorded.
- Returned distribution requires `returned_submittal_link_id` unless an authorized override reason is recorded.
- Link verification status must not be treated as permission to expose private system records.
- Dropbox links may be external, but the system submittal record still requires authenticated access.
