# Implementation Log

## Phase 1 — Discovery and planning

Completed:
- Inspected current repo architecture: static Vercel app, vanilla HTML/JS/CSS, no database/auth backend.
- Created documentation set for architecture, PRD, data dictionary, workflows, permissions, reporting, drawing tracker, document tracker, and AI assistant.

Files changed:
- `CAST_PROJECT_CONTROLS_ARCHITECTURE.md`
- `CAST_RFI_TRACKER_PRD.md`
- `CAST_RFI_DATA_DICTIONARY.md`
- `CAST_RFI_WORKFLOWS.md`
- `CAST_RFI_PERMISSION_MATRIX.md`
- `CAST_RFI_REPORTING_SPEC.md`
- `CAST_DRAWING_TRACKER_SPEC.md`
- `CAST_DOCUMENT_TRACKER_SPEC.md`
- `CAST_AI_RFI_ASSISTANT_SPEC.md`

Open risks:
- No production database/auth yet; MVP uses localStorage and seeded data.

Next steps:
- Implement RFI MVP UI and domain services.

## Phase 2 — RFI MVP and document scaffolds

Completed:
- Added local-data domain service for projects, users, companies, RFIs, responses, comments, attachments, distribution, drawings, documents, audit log, notifications, permissions, validation, numbering, status transitions, official response logic, CSV export, and dashboard metrics.
- Built RFI Tracking page with dashboard, searchable/filterable/sortable log, create draft/open form, detail panel, response flow, official response action, close/reopen/revise actions, comments, audit log, revision history, distribution list, AI suggestion panel, report export buttons, and seed reset.
- Built Drawing Log scaffold with linked RFIs and revision history.
- Built Document Register scaffold with workflow statuses, revision/review fields, linked RFIs, permissions, and CSV export.
- Added import CSV templates.
- Added RFI domain unit tests.

Files changed:
- `public/projects/cast-project-controls-data.js`
- `public/projects/cast-rfi-tracker.html`
- `public/projects/cast-rfi-tracker.js`
- `public/projects/cast-drawing-log.html`
- `public/projects/cast-drawing-log.js`
- `public/projects/cast-document-register.html`
- `public/projects/cast-document-register.js`
- `templates/*.csv`
- `tests/rfi-tracker-unit-tests.js`

Open risks:
- This is not production-safe for private project records until backed by real auth, server-side validation, database migrations, tenant isolation, and secured file storage.

Next steps:
- Validate static audits, unit tests, build, browser smoke, then deploy.

## Phase 3 — Submittal tracker planning

Completed:
- Inspected existing static CAST Project Controls architecture and confirmed RFI, drawing, document, role, notification, audit, reporting, and localStorage service boundaries.
- Documented the submittal MVP, data dictionary, workflows, permission matrix, reporting, package logic, AI assistant guardrails, and import templates.

Files changed:
- `CAST_SUBMITTAL_TRACKER_PRD.md`
- `CAST_SUBMITTAL_DATA_DICTIONARY.md`
- `CAST_SUBMITTAL_WORKFLOWS.md`
- `CAST_SUBMITTAL_PERMISSION_MATRIX.md`
- `CAST_SUBMITTAL_REPORTING_SPEC.md`
- `CAST_SUBMITTAL_PACKAGE_SPEC.md`
- `CAST_SUBMITTAL_AI_ASSISTANT_SPEC.md`
- `CAST_SUBMITTAL_IMPORT_TEMPLATES.md`
- `CAST_PROJECT_CONTROLS_ARCHITECTURE.md`
- `IMPLEMENTATION_LOG.md`

Open risks:
- Still static/local until real auth, database migrations, secured files, and server-side workflow enforcement are implemented.

Next steps:
- Implement Submittal MVP data service, UI, templates, and tests.

## Phase 4 — Submittal tracker MVP implementation

Completed:
- Added `cast-submittal-controls-data.js` with submittal/package/workflow seed data, numbering, package numbering, validation, permissions, sequential/parallel workflow scaffolding, working-day due dates, ball-in-court, approver responses, official response, return, close, revision, metrics, filters, CSV export, audit entries, and notification scaffolding.
- Added Submittal Tracking UI with dashboard, create draft/required/submitted form, searchable/filterable/sortable log, detail panel, workflow participants, responses, official response, attachments, linked RFIs/documents/drawings, comments, revision history, audit log, AI helper suggestions, and report exports.
- Added Submittals to Documents navigation.
- Added submittal import templates.

Files changed:
- `public/projects/cast-submittal-controls-data.js`
- `public/projects/cast-submittal-tracker.html`
- `public/projects/cast-submittal-tracker.js`
- `public/projects/alum-project-nav.js`
- `templates/submittal-*.csv`
- `templates/drawing-reference-import-template.csv`
- `templates/document-reference-import-template.csv`

Open risks:
- Attachment upload is metadata-only until secured storage exists.
- Workflow enforcement is client-side only until backend/auth is added.

## 2026-05-09 — Project directory + RFI/Submittal access/distribution specs

- Created branch `feat/project-controls-access-distribution-20260509` before modifying project controls work.
- Imported Lawrence-provided project directory CSV into `public/safe-data/projects/golden-hill/project-directory.json` with 186 contacts and 56 companies.
- Upgraded `public/projects/alum-directory.html` and `public/projects/alum-directory.js` to show searchable/filterable companies, people, category cards, CAST team, design team, and cleanup watch.
- Diagnosed Submittal Log source issue: current repo is static/read-first and `alum-submittals.js` reads local summary JSON rather than a server source-of-truth register. No backend/server schema was found in this repo.
- Added/updated RFI and Submittal documentation for controlled external links, email distribution, access invitations, login-required record access, automatic contact/profile creation, ProjectAccess, distribution recipient linking, audit events, and server reconciliation requirements.
- Added `CAST_SUBMITTAL_LOG_FIX_NOTES.md` and `CAST_SUBMITTAL_SERVER_RECONCILIATION_REPORT.md` documenting current blocker: live server reconciliation cannot run until the real server/API/database is connected to this repo.

## 2026-05-09 — RFI/Submittal assignability model

- Added `CAST_ASSIGNABILITY_SPEC.md` defining shared assignable parties, entity assignments, assignment roles, picker behavior, automatic access creation, duplicate handling, audit events, and tests.
- Updated `CAST_PROJECT_ACCESS_SPEC.md` to distinguish ProjectAccess from Assignability.
- Updated RFI/Submittal data dictionaries and workflows so RFI Manager, Submittal Manager, Submitter, Reviewer, Responder, Responsible Contractor, Ball in Court, Package Manager, Watcher, and Distribution Only roles use one assignment model.
- Documented that legacy `*_user_id`, `ball_in_court_user_ids`, assignee, and workflow participant fields should become compatibility/derived fields once `EntityAssignments` is implemented.

## 2026-05-09 — RFI current-log, links, distribution, contact-login spec pass

- Added `CAST_RFI_LOG_FIX_NOTES.md` diagnosing why the static RFI page is not a true active server/register query.
- Expanded RFI specs for `RFIRegisters`, RFI register relationship fields, issued/responded RFI controlled links, Dropbox/external link storage, issued/responded email distributions, distribution recipients, secure login-required access, automatic contact/profile updates, ProjectAccess grants, private RFI approval, and audit events.
- Updated RFI workflow documentation to require current active register defaulting, Show All Revisions, no hidden closed/revised/responded RFIs unless filtered, controlled ExternalLinks, and authenticated distribution links.

## 2026-05-09 — Project directory contact sync spine

- Re-imported Lawrence's latest Project Directory CSV (`Project_Directory---1b57babc-e08d-476c-9432-6d210d714361.csv`).
- Regenerated `project-directory.json` with 186 people and 56 companies.
- Added `project-contacts.json` as the normalized Contacts scaffold for login matching, ProjectAccess, contact management, distribution recipients, and duplicate prevention.
- Added `assignable-parties.json` as the shared RFI/Submittal assignment picker source for managers, submitters, reviewers, responders, responsible contractors, package managers, watchers, and distribution-only recipients.
- Added `CAST_PROJECT_CONTACT_SYNC_SPEC.md` to define how directory rows sync across Contacts, AssignableParties, AccessInvitations, ProjectAccess, RFIDistributionRecipients, SubmittalDistributionRecipients, and Project Contacts UI.
- Updated Directory UI to show assignable-party counts and assignment-ready contacts so the directory is visibly tied into RFI/Submittal workflows.
