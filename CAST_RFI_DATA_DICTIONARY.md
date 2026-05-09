# CAST RFI Data Dictionary

## Tables / models

- Projects
- Users
- Companies
- ProjectTeamMembers
- RFIs
- RFIRevisions
- RFIResponses
- RFIComments
- RFIAttachments
- RFIDistributionList
- RFIAssignees
- Drawings
- DrawingRevisions
- DrawingSets
- Documents
- DocumentRevisions
- SpecSections
- Locations
- AuditLog
- Notifications
- Permissions

## RFIs

| Field | Type | Notes |
|---|---|---|
| id | string | Unique id |
| project_id | string | Project foreign key |
| rfi_number | string | e.g. `RFI 0007` |
| revision_number | number | Rev 0, Rev 1, etc. |
| subject | string | Required for draft/open |
| question | text | Required |
| status | enum | Draft, Open, Closed, Closed Draft, Closed Revised, Void |
| priority | enum | Low, Normal, High, Urgent |
| created_by_user_id | string | User id |
| received_from_user_id | string | User id |
| responsible_company_id | string | Company id |
| rfi_manager_user_id | string | User id |
| ball_in_court_user_ids | string[] | Current responsible users |
| date_created | date | Created date |
| date_initiated | date | Opened/submitted date |
| due_date | date | Required for Open |
| date_closed | date | Closed date |
| closed_by_user_id | string | User id |
| drawing_id | string | Linked drawing |
| drawing_number | string | Denormalized display value |
| spec_section_id | string | Linked spec section |
| location_id | string | Linked location |
| cost_code | string | Cost code |
| cost_impact_status | enum | No, Yes Known, Yes Unknown, To Be Determined, Not Applicable |
| cost_impact_amount | number | Optional known amount |
| schedule_impact_status | enum | No, Yes Known, Yes Unknown, To Be Determined, Not Applicable |
| schedule_impact_days | number | Optional known days |
| private_flag | boolean | Visibility-limited record |
| official_response_id | string | Official response id |
| root_rfi_id | string | Root record id for revisions |
| previous_revision_id | string | Previous RFI revision id |
| linked_document_ids | string[] | Attached/link docs |
| created_at | datetime | Audit timestamp |
| updated_at | datetime | Audit timestamp |

## Status enums

- RFI statuses: Draft, Open, Closed, Closed Draft, Closed Revised, Void
- Response statuses: Pending, Submitted, Returned, Official, Superseded
- Impact statuses: No, Yes Known, Yes Unknown, To Be Determined, Not Applicable

## Access/distribution/link additions

RFIs use the shared `ExternalLinks`, `AccessInvitations`, `Contacts`, `UserProfiles`, and `ProjectAccess` tables. RFI records should support `issued_rfi_link_id`, `responded_rfi_link_id`, `last_issued_distribution_at`, and `last_response_distribution_at`.

## RFIDistributionList

Fields: id, rfi_id, user_id, contact_id, email, name, company, recipient_type, added_by_user_id, created_at, updated_at.

Distribution recipients may be registered users or contacts. When a contact later logs in, the system links the contact to the user and updates distribution display automatically.

## Audit event additions

RFI assigned to current log, RFI log query fixed, issued/responded link added/changed, external link verified, issued/responded RFI distributed, recipient invited/logged in, contact auto created/updated, project access granted/revoked, distribution failed/resent.

## Assignability additions

RFI assignments use the shared `AssignableParties` and `EntityAssignments` models in `CAST_ASSIGNABILITY_SPEC.md`.

Legacy fields such as `rfi_manager_user_id`, `ball_in_court_user_ids`, and `RFIAssignees` should be treated as derived or compatibility fields once `EntityAssignments` is available.

RFI assignment roles:

- RFI Manager
- Ball in Court
- Responsible Contractor
- Reviewer
- Responder
- Approver
- Distribution Only
- Watcher

Rules:

- Every open RFI must have one RFI Manager and at least one active Ball in Court assignment.
- Contacts without logins can be assigned, but must create AccessInvitations before secure record access.
- Private RFIs require explicit approval before assignment-created access is granted.
- Reassignment preserves history by creating a new assignment and marking the previous assignment Reassigned or Removed.

## RFIRegisters

| Field | Type | Notes |
|---|---|---|
| id | string | Primary key |
| project_id | string | Project foreign key |
| register_name | string | Display name |
| register_type | enum | Current RFI Log, Archived RFI Log, Closeout RFI Log, Owner RFI Log, Internal RFI Log |
| status | enum | Active, Archived, Closed |
| is_current | boolean | Default active log for project |
| created_by_user_id | string | Creator |
| created_at | datetime | Created timestamp |
| updated_at | datetime | Updated timestamp |

## RFI register/link/distribution fields

RFIs should include these relationship/control fields:

| Field | Type | Notes |
|---|---|---|
| register_id | string | Current RFIRegisters id |
| root_rfi_id | string | Root record for revisions |
| previous_revision_id | string | Previous revision |
| current_revision_flag | boolean | Default log shows true unless all revisions selected |
| issued_rfi_link_id | string | ExternalLinks id for issued RFI package |
| responded_rfi_link_id | string | ExternalLinks id for response package |
| last_distributed_at | datetime | Last issued distribution timestamp |
| last_response_distributed_at | datetime | Last response distribution timestamp |

Rules:

- Every RFI belongs to one project.
- Every RFI belongs to one active RFI Register.
- If no register is selected, assign the RFI to the current active RFI Log for that project.
- The RFI Log defaults to the active Current RFI Log.
- The RFI Log shows current revisions by default and allows Show All Revisions.
- The RFI Log must not hide Open, Closed, Returned, Responded, Revised, or Void RFIs unless intentionally filtered.

## RFIDistributions

Fields: id, project_id, rfi_id, distribution_type, subject, message, sent_by_user_id, sent_at, issued_rfi_link_id, responded_rfi_link_id, recipient_count, status, created_at, updated_at.

Distribution types: Issued RFI Distribution, Responded RFI Distribution, General RFI Update, Overdue Reminder, Closeout Distribution.

Status options: Draft, Queued, Sent, Failed, Partially Sent.

## RFIDistributionRecipients

Fields: id, distribution_id, rfi_id, user_id, contact_id, email, name, company, recipient_type, delivery_status, opened_at, clicked_at, last_error, created_at, updated_at.

Recipient types: To, CC, BCC, Distribution Only.

Delivery statuses: Pending, Sent, Failed, Opened, Clicked, Bounced, Unknown.
