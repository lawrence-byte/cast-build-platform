# CAST Submittal Workflows

## Draft / required / submit

Draft requires title only. Required placeholder requires title, type, spec section, responsible contractor, submitter, manager, and final due date. Submit for review also requires attachment metadata and at least one approver/workflow step.

## Sequential review

Only current step owns ball in court. When all required participants respond, the next step starts and receives ball in court. Due dates are calculated when each step starts. Completion routes to Submittal Manager.

## Parallel review

All participants in a parallel step receive ball in court at the same time. Step completes when all required participants respond or an authorized override occurs. Overrides are audit logged.

## Official response

Owner Admin, CAST Admin, Project Manager, or Submittal Manager can mark official responses: Approved, Approved as Noted, Revise and Resubmit, Rejected, No Exceptions Taken, or Make Corrections Noted. This updates status, actual return date, notifications, and audit log.

## Return / close / revise

Returned or Revise and Resubmit sends ball in court back to submitter/responsible contractor. Close requires official response unless closed as void/draft or overridden. Revision closes/supersedes the previous revision and starts a new revision under the same number.

## Server reconciliation workflow

1. Fetch server submittals for the active project and active current register.
2. Fetch local submittal rows, folder metadata rows, comments, attachments, links, workflow history, and distribution history.
3. Match by `server_submittal_id` first.
4. Match remaining rows by `project_id + submittal_number + revision_number`.
5. Use title/spec/package/company/date matching only to recommend manual matches.
6. Assign missing `register_id` to the current active Submittal Register.
7. Set `current_revision_flag` while preserving revision history.
8. Mark duplicates and conflicts for admin review.
9. Preserve local comments, attachments, Dropbox links, distribution history, and AI summaries.
10. Write audit events and generate `CAST_SUBMITTAL_SERVER_RECONCILIATION_REPORT.md`.

## Email distribution workflow

Issued and returned distributions create immutable distribution records, recipient rows, access invitations, audit entries, and last-distributed timestamps. Emails include a secure authenticated system record link plus the relevant controlled external package link.

## Login/contact workflow

When an email recipient opens a secure submittal link, unauthenticated users are routed through magic-link/OAuth login. On successful login, the system matches by email, creates or updates `UserProfiles`, creates or updates the project `Contacts` row, grants `ProjectAccess` without downgrading existing roles, and redirects to the original submittal.

## Reconciliation review workflow

Admins review server/local conflicts in the Submittal Reconciliation Review screen. Available actions: Merge, Keep Server, Keep Local Draft, Flag for Review, Archive Duplicate. No duplicate is deleted automatically.

## Assignability workflow

Submittal assignment uses `CAST_ASSIGNABILITY_SPEC.md`.

Submittal Manager, Submitter, Reviewer, Approver, Ball in Court, Responsible Contractor, and Package Manager should all be selected through the shared assignability picker. Workflow-step participants become `EntityAssignments`; BIC is derived from active workflow-step/record assignments. Assigning an unregistered contact creates an invitation and the least required access role unless private-record approval is required.
