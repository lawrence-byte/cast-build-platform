# CAST RFI Workflows

## Create draft

Project Engineer/Subcontractor enters subject and question, optionally adds references, attachments, assignees, and distribution. Status remains Draft. No due date required.

## Create/open RFI

Open RFI requires number, subject, question, at least one assignee, and due date. System assigns ball in court to assignees and creates notifications.

## Response flow

Assignee submits a response. RFI Manager reviews responses and marks one official. Other submitted responses become superseded when appropriate. System notifies creator, assignees, and distribution.

## Completion flow

Authorized user closes RFI. Open RFIs become Closed; Draft RFIs become Closed Draft. Ordinary edits to question/official response are locked. Reopen restores Draft/Open. Revise marks previous RFI Closed Revised and creates new revision with same root number and incremented revision.

## Export/report flow

Users filter log/report views and export CSV. PDF export is scaffolded for future backend/browser rendering.

## Authenticated RFI access workflow

All system RFI detail pages require authentication. Public email links route through a secure access page. After magic-link/OAuth login, the user is redirected to the requested RFI. If the user lacks permission, show access denied and allow request access. Distribution-recipient email matches may auto-grant RFI Viewer/Responder/Manager unless the RFI is private.

## Issued/responded RFI email distribution workflow

Issued RFI distribution requires an issued package/system link unless an authorized override reason is recorded. Responded RFI distribution requires a responded package/system link unless an authorized override reason is recorded. Each send creates distribution history, recipient rows, access invitations, and audit events.

## Assignability workflow

RFI assignment uses `CAST_ASSIGNABILITY_SPEC.md`.

When creating or updating an RFI, the picker should show registered users, project contacts, company placeholders, and distribution-only contacts with assignability status. Assigning an unregistered contact creates an invitation. Assigning a responder creates or requests the least required RFI access role. Ball in Court is derived from active `EntityAssignments`, not from free-text fields.

## Current RFI Log workflow

The RFI Log page defaults to the current active RFI Register for the active project. It returns all current revisions the user can view, including Open, Closed, Returned, Responded, Revised, and Void records. Closed/revised/responded RFIs are not hidden unless the user intentionally applies a filter. A Show All Revisions toggle exposes prior revisions.

If a new RFI is created without an explicit register, the system assigns it to the current active RFI Log for the project and audits `RFI assigned to current log`.

## RFI link workflow

Issued and Responded RFI package links are stored as `ExternalLinks` records. The RFI stores `issued_rfi_link_id` and `responded_rfi_link_id` as the controlled primary links. Additional drawing/reference/backup/response links may be attached without changing the primary links.

## RFI distribution workflow

Issued and responded RFI distributions create `RFIDistributions`, `RFIDistributionRecipients`, access invitations, audit events, and last-distributed timestamps. Distribution emails include a secure authenticated system record link plus the relevant Dropbox/external package link.
