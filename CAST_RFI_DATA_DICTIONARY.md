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
