# CAST Submittal Data Dictionary

## Models

Projects, Users, Companies, ProjectTeamMembers, Submittals, SubmittalPackages, SubmittalPackageItems, SubmittalRevisions, SubmittalWorkflowTemplates, SubmittalWorkflowSteps, SubmittalWorkflowParticipants, SubmittalResponses, SubmittalComments, SubmittalAttachments, SubmittalDistributionList, SubmittalTransmittals, Drawings, DrawingRevisions, Documents, DocumentRevisions, SpecSections, Locations, RFIs, AuditLog, Notifications, Permissions.

## Submittals minimum fields

id, project_id, submittal_number, revision_number, title, description, submittal_type, status, priority, spec_section_id, spec_section_number, spec_section_title, drawing_id, drawing_number, document_id, location_id, package_id, responsible_company_id, submitter_user_id, submittal_manager_user_id, created_by_user_id, ball_in_court_user_ids, current_workflow_step_id, workflow_template_id, issue_date, received_date, sent_date, required_on_site_date, lead_time_days, planned_return_date, final_due_date, actual_return_date, date_closed, closed_by_user_id, cost_impact_status, schedule_impact_status, private_flag, official_response_id, root_submittal_id, previous_revision_id, linked_rfi_ids, distribution_user_ids, created_at, updated_at.

## Package fields

id, project_id, package_number, package_title, description, status, spec_section_id, responsible_company_id, submittal_manager_user_id, created_by_user_id, due_date, date_submitted, date_returned, date_closed, created_at, updated_at.

## Workflow step fields

id, project_id, submittal_id, workflow_template_id, step_number, step_name, review_type, due_date, original_due_date, days_allocated, status, ball_in_court_flag, started_at, completed_at, created_at, updated_at.

## Participant fields

id, workflow_step_id, user_id, company_id, role, response_status, response_id, due_date, sent_at, responded_at, created_at, updated_at.

## Server reconciliation fields

| Field | Type | Notes |
|---|---|---|
| server_submittal_id | string | Stable source-of-truth server id |
| register_id | string | Current SubmittalRegisters id |
| root_submittal_id | string | Root record for revisions |
| previous_revision_id | string | Previous revision |
| current_revision_flag | boolean | Default log shows true only unless all revisions selected |
| server_sync_status | enum | Server Source, Local Draft, Pending Sync, Synced, Conflict, Duplicate, Archived, Failed |
| server_last_synced_at | datetime | Last reconciliation timestamp |
| server_created_at | datetime | Source server created timestamp |
| server_updated_at | datetime | Source server updated timestamp |
| issued_submittal_link_id | string | ExternalLinks id for issued package |
| returned_submittal_link_id | string | ExternalLinks id for returned package |
| last_issued_distribution_at | datetime | Last issued email distribution |
| last_returned_distribution_at | datetime | Last returned email distribution |

## SubmittalRegisters

| Field | Type | Notes |
|---|---|---|
| id | string | Primary key |
| server_register_id | string | Source server register id |
| project_id | string | Project foreign key |
| register_name | string | Display name |
| register_type | enum | Current Submittal Log, Archived Submittal Log, Closeout Submittal Log, Owner Submittal Log, Internal Submittal Log |
| status | enum | Active, Archived, Closed |
| is_current | boolean | Default active log for project |
| created_by_user_id | string | Creator |
| created_at | datetime | Created timestamp |
| updated_at | datetime | Updated timestamp |

## ExternalLinks

Shared controlled-link table for RFIs, Submittals, Drawings, Documents, Meeting Minutes, Transmittals, Change Events, and Closeout Items. Submittals use `Issued Submittal` and `Returned Submittal` as primary link types, with optional additional link types for shop drawings, product data, samples, specification references, drawing references, backup, consultant/architect/owner review, closeout, and other.

## AccessInvitations / Contacts / UserProfiles / ProjectAccess

These shared access tables support secure email distribution links, login-required record access, automatic contact creation, OAuth profile capture, and project-level access grants. Email is the primary match key. Invitation tokens are stored only as hashes.

## SubmittalDistributions / SubmittalDistributionRecipients / SubmittalDistributionList

Distribution tables track issued, returned, general update, overdue reminder, closeout, and package distributions. Recipients may be registered users or project contacts. When a contact later logs in, the distribution list updates to show the linked user profile.

## Assignability additions

Submittal assignments use the shared `AssignableParties` and `EntityAssignments` models in `CAST_ASSIGNABILITY_SPEC.md`.

Legacy fields such as `submitter_user_id`, `submittal_manager_user_id`, `ball_in_court_user_ids`, `SubmittalWorkflowParticipants`, and package manager fields should be treated as derived or compatibility fields once `EntityAssignments` is available.

Submittal assignment roles:

- Submittal Manager
- Submitter
- Reviewer
- Approver
- Ball in Court
- Responsible Contractor
- Package Manager
- Distribution Only
- Watcher

Rules:

- Every active Submittal must have a Submittal Manager.
- Submitted/Under Review submittals must have at least one current Ball in Court or workflow-step assignment.
- Workflow-step participants are represented as EntityAssignments so due dates, reminders, BIC, responses, and access all use one source.
- Package-level assignments may cascade to submittal items; item-level overrides are allowed.
- Contacts without logins can be assigned, but must create AccessInvitations before secure record access.
- Private Submittals require explicit approval before assignment-created access is granted.
