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

## 2026-05-09 — Excel export standard pass

- Added `public/cast-xlsx-export.js`, a lightweight browser XLSX writer for user-facing spreadsheet downloads without adding a runtime CDN dependency.
- Converted RFI, Submittal, Drawing Log, Document Register, Alüm Schedule, and Schedule Dashboard export actions from CSV downloads to `.xlsx` Excel downloads.
- Updated export labels and report copy from CSV to Excel/Excel-ready.
- Added the shared XLSX export script to each converted page before its page-specific script.
- Updated static audit expectations so the platform checks for Excel export labels on the converted surfaces.

Validation:
- `npm test`
- `npm run build`
- `git diff --check`

Open risks:
- Historical/source filenames can still reference `.csv` in safe metadata because they describe imported/source artifacts, not user-facing spreadsheet export behavior.


## 2026-05-09 — Unified Documents RFI portal

- Moved RFIs out of the separate top-level navigation group and into the unified Documents section.
- Updated the persistent Alüm rail so `RFIs` points to `/projects/alum-rfis.html` under Documents, and removed the live navigation path to the standalone RFI Tracking page.
- Added Create RFI intake directly to `alum-rfis.html`; drafts save locally in the Documents RFI portal and appear in the action queue as local, not-issued draft records until backend/auth/write-back is connected.
- Retired `cast-rfi-tracker.html` as a standalone page and redirected it to `/projects/alum-rfis.html#create-rfi` so old links land in the correct portal.
- Updated the Documents hub with direct Create RFI / Open RFIs actions.
- Updated tests to enforce the unified Documents RFI portal behavior.

Validation:
- `node --check public/projects/alum-rfis.js`
- `node --check public/projects/alum-project-nav.js`
- `npm test`

Open risks:
- Create RFI is local draft intake only. Real issuing, distribution, private-record access grants, and CAST BUILD A.O/server write-back still require backend/auth integration.

## 2026-05-09 — Unified Documents Submittal portal

- Reintegrated Create Submittal, submit-for-review, responses, official response, return, closeout, revision, comments, reports, and Excel export controls directly into `/projects/alum-submittals.html`.
- The Alüm Documents Submittals portal now uses the submittal workflow scaffold script and local state instead of remaining a read-only summary table.
- Retired `cast-submittal-tracker.html` as a standalone workflow page and redirected it to `/projects/alum-submittals.html#create-submittal`.
- Updated tests so the unified Documents Submittals portal, not the retired standalone tracker, owns workflow/create behavior.

Validation:
- `node --check public/projects/alum-submittals.js`
- `node --check public/projects/cast-submittal-tracker.js`
- `npm test`
- `npm run build`
- `git diff --check`

Open risks:
- Submittal create/issue/return/revise/close actions are local workflow scaffolds until backend/auth/write-back is connected. Production issuing/distribution remains approval-gated.
