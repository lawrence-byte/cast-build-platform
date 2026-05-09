# CAST Assignability Spec

## Purpose

Create one shared assignability model for RFIs and Submittals so CAST can reliably answer:

- Who can be assigned?
- What can they be assigned to do?
- Why are they eligible?
- Are they a registered user or only a contact/invitee?
- Can the assignment create access automatically?
- Can they receive/respond, or only be notified?

Assignability is separate from broad project access. A user/contact may have project access but not be assignable to a specific RFI/Submittal role, and a contact may be assignable as a pending invitee before they have a login.

## Core concepts

### Assignable party

An assignable party is a project participant that can be selected for a record responsibility. It may be:

- registered user
- project contact without login
- company-level placeholder
- distribution-only recipient
- role placeholder such as Architect Reviewer or Responsible Contractor PM

### Assignment target

Assignment targets:

- RFI
- Submittal
- Submittal Workflow Step
- Submittal Package
- future: Drawing Review, Document Review, Change Event, Punch Item

### Assignment intent

Assignment intent describes what the person is expected to do, not just their access level.

RFI intents:

- RFI Manager
- Ball in Court
- Responsible Contractor
- Reviewer
- Responder
- Approver
- Distribution Only
- Watcher

Submittal intents:

- Submittal Manager
- Submitter
- Reviewer
- Approver
- Ball in Court
- Responsible Contractor
- Package Manager
- Distribution Only
- Watcher

## Table: AssignableParties

A project-scoped search/index table for assignment pickers.

| Field | Type | Notes |
|---|---|---|
| id | string | Assignable party id |
| project_id | string | Project foreign key |
| user_id | string | Nullable registered user id |
| contact_id | string | Nullable project contact id |
| company_id | string | Nullable company id |
| email | string | Required for user/contact assignment where available |
| name | string | Display name |
| company_name | string | Display company |
| title | string | Job title/role |
| phone | string | Optional |
| party_type | enum | User, Contact, Company, Role Placeholder, Distribution Only |
| source | enum | Project Access, Contact, Imported CSV, Email Distribution, OAuth Profile, Manual Entry, Server Register, Workflow Template |
| assignability_status | enum | Assignable, Invite Required, Access Required, Approval Required, Suspended, Removed, Incomplete |
| default_access_role | enum | Project Viewer, RFI Viewer, RFI Responder, RFI Manager, Submittal Viewer, Submittal Submitter, Submittal Reviewer, Submittal Manager, Project Engineer, Admin |
| allowed_entity_types | string[] | RFI, Submittal, Submittal Workflow Step, Submittal Package |
| allowed_assignment_roles | string[] | Role values allowed for this party |
| requires_invitation | boolean | True when contact has no login/user link |
| requires_private_record_approval | boolean | True when assignment to private records needs admin approval |
| last_assigned_at | datetime | Optional |
| last_seen_at | datetime | Optional contact/user activity |
| created_at | datetime | Audit timestamp |
| updated_at | datetime | Audit timestamp |

## Table: EntityAssignments

Canonical assignment table for RFIs and Submittals.

| Field | Type | Notes |
|---|---|---|
| id | string | Assignment id |
| project_id | string | Project foreign key |
| entity_type | enum | RFI, Submittal, Submittal Workflow Step, Submittal Package |
| entity_id | string | Target record id |
| workflow_step_id | string | Optional submittal workflow step id |
| package_id | string | Optional submittal package id |
| assignable_party_id | string | AssignableParties id |
| user_id | string | Nullable registered user id snapshot |
| contact_id | string | Nullable contact id snapshot |
| company_id | string | Nullable company id snapshot |
| email | string | Email snapshot |
| name | string | Name snapshot |
| company_name | string | Company snapshot |
| assignment_role | enum | Entity-specific assignment role |
| assignment_status | enum | Draft, Assigned, Invite Pending, Accepted, In Progress, Responded, Completed, Declined, Removed, Reassigned, Suspended |
| ball_in_court_flag | boolean | Whether this assignment controls current BIC |
| due_date | date | Assignment-specific due date |
| assigned_by_user_id | string | User who assigned/reassigned |
| assigned_at | datetime | Assignment timestamp |
| accepted_at | datetime | Optional |
| responded_at | datetime | Optional |
| completed_at | datetime | Optional |
| removed_by_user_id | string | Optional |
| removed_at | datetime | Optional |
| reassigned_from_assignment_id | string | Optional previous assignment id |
| access_grant_id | string | Optional ProjectAccess created/used |
| invitation_id | string | Optional AccessInvitations row |
| notes | text | Optional |
| created_at | datetime | Audit timestamp |
| updated_at | datetime | Audit timestamp |

## Assignment role options

### RFI assignment roles

- RFI Manager
- Ball in Court
- Responsible Contractor
- Reviewer
- Responder
- Approver
- Distribution Only
- Watcher

### Submittal assignment roles

- Submittal Manager
- Submitter
- Reviewer
- Approver
- Ball in Court
- Responsible Contractor
- Package Manager
- Distribution Only
- Watcher

## Assignability status rules

- `Assignable`: party has enough project access and profile/contact data for this assignment.
- `Invite Required`: contact can be assigned, but the assignment must create/send an invitation before secure record access.
- `Access Required`: user/contact exists but lacks the minimum ProjectAccess role.
- `Approval Required`: assignment is allowed only after admin approval, commonly for private records.
- `Suspended`: party exists but cannot receive new assignments.
- `Removed`: party should not appear in pickers except history.
- `Incomplete`: party is missing required email/name/company data.

## RFI rules

1. Every open RFI must have one RFI Manager and at least one Ball in Court assignment.
2. Ball in Court assignments must map to a user/contact/company that can respond or route the RFI.
3. If a contact is assigned as Responder and has no login, create an AccessInvitation with `RFI Responder` unless the RFI is private.
4. Distribution-only recipients do not become Ball in Court unless explicitly upgraded.
5. Private RFIs require explicit permission before assignment grants access.
6. Reassignment preserves prior assignment history; do not overwrite or delete the old assignment.
7. Existing project roles must not be downgraded by assignment automation.

## Submittal rules

1. Every active Submittal must have a Submittal Manager.
2. Submitted/Under Review submittals must have at least one current Ball in Court or workflow-step assignment.
3. Submitter assignments use `Submittal Submitter`; reviewer assignments use `Submittal Reviewer`; manager assignments use `Submittal Manager`.
4. Workflow-step participants must be represented as EntityAssignments so BIC, due dates, reminders, and access all use the same source.
5. Package-level assignments may cascade to package items, but item-level overrides must be allowed.
6. Returned/closed submittals keep assignment history visible unless filtered out.
7. Private Submittals require explicit permission before assignment grants access.

## Assignment picker behavior

The RFI/Submittal assignment picker should show:

- name
- company
- title
- email
- user/contact/company indicator
- current access role
- assignability status
- why eligible: project team, distribution, company role, workflow template, imported CSV, prior assignment
- warning badges for invite required, access required, approval required, duplicate contact, suspended access

Picker filters:

- assignable now
- invite required
- contacts only
- registered users only
- company placeholders
- RFI eligible
- Submittal eligible
- role: manager / reviewer / responder / submitter / distribution only

## Automatic access on assignment

When a party is assigned:

1. Match by normalized email within the project.
2. Link to existing UserProfile/Contact if present.
3. If no Contact exists, create a Contact with source `Manual Entry`, `Email Distribution`, `Imported CSV`, or `Project Invite` depending on entry path.
4. If the party lacks ProjectAccess, create the least required access role for the assignment.
5. If no user login exists, create an AccessInvitation.
6. If the record is private, pause access grant and show approval required.
7. Audit all grants, invitations, assignment creation, and assignment changes.

## Duplicate handling

- Do not create duplicate Contacts for the same project + normalized email.
- If duplicate contacts exist, assignment picker should show a duplicate warning and prefer the contact linked to a UserProfile or active ProjectAccess.
- Admins can merge duplicates; assignment history should be repointed or cross-referenced without losing audit history.

## Audit events

- assignability.party.created
- assignability.party.updated
- assignability.party.suspended
- assignment.created
- assignment.accepted
- assignment.responded
- assignment.completed
- assignment.reassigned
- assignment.removed
- assignment.access_required
- assignment.invitation_created
- assignment.private_approval_required
- assignment.duplicate_contact_flagged

## Tests

- RFI assignment picker includes registered users and unregistered contacts.
- Submittal assignment picker includes registered users and unregistered contacts.
- Assigning an unregistered contact creates an invitation.
- Assigning a RFI responder grants/requests RFI Responder access.
- Assigning a Submittal reviewer grants/requests Submittal Reviewer access.
- Private RFI assignment requires approval before access grant.
- Private Submittal assignment requires approval before access grant.
- Assignment automation never downgrades existing access.
- Duplicate contacts are flagged, not silently duplicated.
- Reassignment preserves assignment history.
- Ball in Court is derived from active EntityAssignments.
