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
