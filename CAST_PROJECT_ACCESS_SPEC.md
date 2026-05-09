# CAST Project Access Spec

## Goal

All project-control records that expose project parties, attachments, responses, distributions, comments, audit history, or external system links require authenticated access and explicit project authorization.

Public pages may show sanitized aggregate/read-first metadata only. Record-level RFI and Submittal access must be authentication-required.

## Authentication options

MVP:

- Email magic link
- Google OAuth if already available
- Microsoft OAuth if already available

Future:

- Password based login
- SAML SSO

## Core models

### UserProfiles

Authenticated user identity and profile.

| Field | Type | Notes |
|---|---|---|
| id | string | Internal user profile id |
| user_id | string | Auth provider/internal user id |
| primary_email | string | Login email |
| name | string | User-facing name |
| first_name | string | Optional parsed first name |
| last_name | string | Optional parsed last name |
| avatar_url | string | OAuth avatar when available |
| phone | string | Optional |
| title | string | Optional |
| company_id | string | Nullable company link |
| company_name | string | OAuth/domain/manual company value |
| oauth_provider | string | Google, Microsoft, magic-link, etc. |
| oauth_subject | string | Provider subject id |
| last_login_at | datetime | Last successful login |
| created_at | datetime | Audit timestamp |
| updated_at | datetime | Audit timestamp |

### Contacts

Project directory/contact records. A contact may or may not have an authenticated user profile.

| Field | Type | Notes |
|---|---|---|
| id | string | Contact id |
| project_id | string | Project foreign key |
| user_id | string | Nullable authenticated user link |
| email | string | Required for invitation/distribution |
| name | string | Display name |
| first_name | string | Optional |
| last_name | string | Optional |
| company_id | string | Nullable company link |
| company_name | string | Company display name |
| phone | string | Optional |
| title | string | Optional |
| source | enum | User Login, Email Distribution, Manual Entry, Imported CSV, OAuth Profile, Project Invite |
| last_seen_at | datetime | Last seen in project context |
| created_at | datetime | Audit timestamp |
| updated_at | datetime | Audit timestamp |

### ProjectAccess

Explicit project access grants for authenticated users and linked contacts.

| Field | Type | Notes |
|---|---|---|
| id | string | Access grant id |
| project_id | string | Project foreign key |
| user_id | string | Authenticated user |
| contact_id | string | Optional contact link |
| role | enum | Project Viewer, RFI Viewer, RFI Responder, RFI Manager, Submittal Viewer, Submittal Submitter, Submittal Reviewer, Submittal Manager, Project Engineer, Admin |
| status | enum | Invited, Active, Suspended, Removed |
| granted_by_user_id | string | User id |
| granted_at | datetime | Grant timestamp |
| last_accessed_at | datetime | Optional |
| created_at | datetime | Audit timestamp |
| updated_at | datetime | Audit timestamp |

### AccessInvitations

Invitations for contacts/external collaborators.

| Field | Type | Notes |
|---|---|---|
| id | string | Invitation id |
| project_id | string | Project foreign key |
| entity_type | enum | RFI, Submittal, Project, Document, Drawing |
| entity_id | string | Nullable entity id |
| email | string | Invite email |
| invited_by_user_id | string | User id |
| invitation_type | enum | RFI Distribution, Submittal Distribution, Project Team Invite, Reviewer Invite, Submitter Invite, Read Only Invite |
| access_role | enum | Access role to grant on acceptance/login |
| token_hash | string | Never store raw token |
| expires_at | datetime | Required |
| accepted_at | datetime | Optional |
| status | enum | Pending, Accepted, Expired, Revoked |
| created_at | datetime | Audit timestamp |
| updated_at | datetime | Audit timestamp |

### ExternalLinks

Controlled external links for Dropbox/Drive/SharePoint/etc. These are package/reference links, not a substitute for authenticated system record access.

| Field | Type | Notes |
|---|---|---|
| id | string | Link id |
| project_id | string | Project foreign key |
| entity_type | enum | RFI, Submittal, Drawing, Document, Meeting Minute, Transmittal, Change Event, Closeout Item |
| entity_id | string | Record id |
| link_type | enum | Entity-specific controlled link type |
| provider | enum | Dropbox, Google Drive, SharePoint, Box, OneDrive, Other |
| url | string | External URL |
| display_name | string | Human label |
| description | text | Optional |
| file_name | string | Optional |
| file_extension | string | Optional |
| folder_path | string | Optional provider-relative path |
| created_by_user_id | string | Creator |
| created_at | datetime | Audit timestamp |
| updated_at | datetime | Audit timestamp |
| last_verified_at | datetime | Optional |
| verified_status | enum | Not Checked, Valid, Invalid, Permission Issue, Expired, Unknown |
| access_level | enum | Public Link, Restricted Link, Internal Only, Requires Authentication, Unknown |
| notes | text | Optional |

## Access rules

1. Record detail access requires an authenticated user profile, active ProjectAccess for the project, and role/record visibility permission.
2. Public email links route to a secure access page and redirect after login.
3. Private records additionally require direct permission or explicit admin approval.
4. Distribution-recipient email matches may auto-grant the least required role unless the record is private.
5. The system must never automatically downgrade an existing higher role.
6. Contacts are matched by project + normalized email.
7. Do not overwrite manually verified company data without confirmation.
8. Invitation tokens must be hashed at rest and expire.
9. External Dropbox/package links may be stored and emailed, but the system RFI/Submittal record itself remains authentication-required.

## Required audit events

- access.invitation.created
- access.invitation.accepted
- access.invitation.revoked
- access.granted
- access.revoked
- access.denied
- external_link.created
- external_link.changed
- external_link.verified
- external_link.revoked
- record.viewed
- record.exported
- recipient.invited
- recipient.logged_in
- contact.auto_created
- contact.auto_updated
- distribution.created
- distribution.sent
- distribution.failed
- distribution.resent

## Assignability relationship

RFIs and Submittals use the shared assignability model in `CAST_ASSIGNABILITY_SPEC.md`.

ProjectAccess answers whether a user may access the project. Assignability answers whether a user/contact/company can be selected for a specific RFI/Submittal responsibility. Assignments may create the least required ProjectAccess and AccessInvitation, but must not downgrade existing access and must pause for approval on private records.
