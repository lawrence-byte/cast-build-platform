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

## 2026-05-09 — Global CAST Document Intake infrastructure

- Added global CAST logo document-intake action using Lawrence's supplied circular CAST logo as `/assets/cast-upload-logo.png` with transparent PNG output.
- Added `public/cast-document-intake.js` and `public/cast-document-intake.css` for the global upload/intelligent filing panel.
- Integrated the global intake button into the shared Alüm navigation shell and Admin header.
- Added fail-closed API contract route `/api/document-intake` plus review route scaffold `/api/document-intake-review`.
- Added provider-neutral storage path logic, classification service, OCR fallback hook, linked-record matching, and server validation.
- Added admin review queue in `admin.html` with file name, uploaded by, project, suggested module/type, confidence, folder/Dropbox link, linked records, status, date, approve/reject/reclassify/move/link/create actions, filters, seed records, and admin debug output.
- Added proposed database schema at `database/document-intake-schema.sql` for intake items, versions, and audit logs.
- Added `docs/document-intake-system.md` describing the flow, env vars, storage abstraction, OCR fallback, matching logic, and review queue.

Validation targets:
- Static/source tests enforce the global intake UI, API contract, classification modules, and admin review queue signals.
- API unit tests cover GET contract, auth-required POST, fail-closed unconfigured storage, validation, and storage-plan generation.

Open configuration:
- Real binary upload/storage, persistent database records, OCR provider calls, Dropbox API links, email sending, and production auth/session integration still require environment/provider configuration.

## 2026-05-09 — Structured document classification and filing contract

- Updated document classification to return the required structured object: projectId, projectName, module, documentType, confidenceScore, suggestedFolderPath, suggestedRecordLinks, extractedMetadata, requiresHumanReview, and reasoningSummary.
- Expanded extracted metadata scaffolding for file extension, folder context, extracted text/OCR flags, dates, document title/header/footer, signatures, email addresses, cost values, keywords, vendors, and project directory contacts.
- Updated server filing path logic to the required non-flat hierarchy under `/server_storage/projects/{projectSlug}/documents/{module_folder}` with original, processed text, metadata, and version paths.
- Replaced the initial schema proposal with requested tables: `document_intake_uploads`, `document_versions`, `document_audit_log`, `document_links`, and `project_contact_directory`.
- Added role/permission contract for login-required document upload/view/edit/file/approve/distribute/share/debug access across Admin, PM, Field, Accounting, Owner, Architect/Engineer, Subcontractor, Vendor, and Read Only roles.
- Updated client intake and admin queue to use the structured classification fields and server storage folder recommendations.

## 2026-05-09 — Document intake permissions, workflow, matching, and contact capture

- Added explicit document permission rules: authorized upload only; Admin/Project Manager classification override only; sensitive financial access restricted to Accounting/Executives/Admin; contract restrictions; Field/RFI/Submittal/external visibility rules.
- Added workflow decision engine for Uploaded → Processing → Classified → Needs Review → Approved for Filing → Filed → Distributed → Rejected → Archived.
- Added confidence routing: >90% ready-to-file suggestion, 70–90% user confirmation, <70% Needs Review, sensitive/legal/financial/contract/insurance/lien release always human-confirmed.
- Added audit event scaffold for every upload/action and classification override, including actor, reason, IP, and user agent.
- Added uploader contact capture and extracted contact suggestions with admin-approval-before-overwrite behavior.
- Expanded RFI/Submittal matching for issued/responded links, duplicate warnings, supported link fields, and create-new-record suggestions.
- Expanded contract matching for agreements, purchase orders, scopes/exhibits/amendments/signed contracts and extraction targets.

## 2026-05-09 — Document links, distribution, search, and compliance contracts

- Expanded Financial matching/extraction for invoices, pay applications, change orders, lien releases, budgets, cost reports, forecasts, SOVs, backup, receipts, payment approvals, dollar amounts, invoice/pay app numbers, cost codes, retainage, current/prior payments, and change order refs.
- Expanded Field matching/extraction for daily reports, photos, inspections, safety, punch, observations, logs, delivery tickets, weather/manpower, site instructions, locations, trades, issue categories, and related drawings.
- Expanded Drawing matching/extraction for plan sheets, addenda, sketches, ASIs, bulletins, revisions, specs, drawing logs, sheet number/title, discipline, issue date, revision/addendum number, and design team author; drawings can be referenced by RFIs/Submittals/COs/Field/Contracts.
- Added Dropbox/external secure-link contract with typed links for source, issued/responded, backup, drawing, folder, notes, date added, and user added.
- Added email distribution contract/templates for documents, RFIs, Submittals, Contracts, Financials, Field reports, and Drawing updates; secure links by default, attachments admin-gated, manual recipients become contact suggestions.
- Added global search/saved-view contract across document fields, extracted text, linked records, statuses, and Dropbox links.
- Added schema support for external links, email distributions, saved views, archive/soft-delete/delete-request fields, and audit/compliance action list.

## 2026-05-09 — Alüm Schedule visual refresh

- Refreshed `/projects/alum-schedule.html` onto the newer CAST Build project shell using `cast-build.css`, `cast-build-components.css`, `project-admin-body`, `project-dashboard-wrapper--no-rail`, `project-main-content`, `project-page-header`, `project-panel`, `project-kpi-grid`, `cb-btn`, `cb-input`, `cb-select`, `cb-textarea`, and `project-table` patterns.
- Preserved existing schedule data hooks and `public/projects/alum-schedule.js` behavior while modernizing the page layout, KPI cards, action buttons, filters, lookahead Gantt panels, schedule list/detail area, huddle table, constraints table, field intake, and recovery draft sections.
- Kept the persistent Alüm navigation script as the shell navigation source and removed the hardcoded sidebar from the schedule page to avoid duplicate/legacy rail behavior.
- Added accessibility polish for labeled controls and explicit `type="button"` on non-submit actions.

Validation:
- `npm test`
- `npm run build`
- `git diff --check`
- Local browser smoke at `http://127.0.0.1:4173/projects/alum-schedule.html` with desktop screenshot QA.

Open risks:
- Schedule changes, field updates, and recovery notices remain local/draft-only until backend/auth/write-back is connected and approved.

## 2026-05-09 — CAST logo landing-page link fix

- Updated the persistent Alüm navigation shell so the top-left CAST Build logo links to the platform landing page `/` (`https://app.cast-bld.com/` in production).
- Kept the left-rail `ALÜM` project brand link pointed at the Alüm project home, preserving its existing behavior.
- Added regression coverage so the CAST logo and Alüm rail brand keep distinct destinations.

Validation:
- `node --check public/projects/alum-project-nav.js`
- `npm test`
- `npm run build`
- `git diff --check`

## 2026-05-09 — Landing page operating-platform copy

- Updated the landing page eyebrow from “Construction management operating layer” to `CONSTRUCTION MANAGEMENT OPERATING PLATFORM`.

Validation:
- `npm test`
- `npm run build`
- `git diff --check`

## 2026-05-09 — Landing page module-link consolidation

- Removed standalone landing-page cards for Schedule Intelligence, Cost Engine, Document Tools, and CAST BUILD A.O so the landing page stays focused on Project Home plus the top RFI Log action entry.
- Updated the Project Home card and Alüm module map to route schedule intelligence, cost engine, document tools, and CAST BUILD A.O workflow signals into the appropriate platform modules instead of exposing separate landing shortcuts.
- Added static audit coverage so standalone tool cards do not return to the landing page and the Alüm module map keeps the integrated tool-stack signals.

Validation:
- `npm test`
- `npm run build`
- `git diff --check`
- Local browser smoke at `/` confirming only Project Home and RFI Log cards remain.

## 2026-05-09 — Landing page Alüm project card label

- Renamed the landing page `Project Home` card to `ALÜM PROJECT`.
- Simplified the card content so the label sits vertically centered in the card while retaining the same horizontal card position and destination.
- Updated static audit coverage for the retained landing entry.

Validation:
- `npm test`
- `npm run build`
- `git diff --check`
- Local mobile browser smoke confirming `ALÜM PROJECT` is vertically centered above `RFI LOG`.

## 2026-05-09 — Landing page RFI consolidation

- Removed the standalone `RFI Log` card from the CAST Build landing page so the landing page only presents the `ALÜM PROJECT` platform entry.
- Kept RFI access consolidated inside the project portals: Alüm module map, persistent Documents rail, and Documents center actions still route to `/projects/alum-rfis.html` and `#create-rfi`.
- Added static audit coverage to prevent the landing page from reintroducing the direct RFI shortcut.

Validation:
- `npm test`
- `npm run build`
- `git diff --check`
- Local mobile browser smoke confirming only `ALÜM PROJECT` remains on the landing page.

## 2026-05-09 — Landing page Alüm building sketch

- Created a transparent PNG architectural sketch asset from Lawrence's reference image: `public/assets/brand/alum-building-linen-sketch.png`.
- Converted the sketch to warm linen-colored line art, removed street/sidewalk/background context, and kept it building-only.
- Added the sketch to the CAST Build landing page as a decorative far-right background element, cropped off-canvas so only part of the building is visible and the main CTA remains readable.
- Added static audit coverage for the landing sketch asset and right-side crop placement.

Validation:
- `npm test`
- `npm run build`
- `git diff --check`
- Local desktop and mobile browser screenshot QA; mobile placement adjusted so the sketch does not interfere with the CTA.

## 2026-05-09 — Landing sketch refinement pass

- Refined the Alüm landing building asset to feel more hand-drawn with layered linen strokes and a taller building mass while keeping the sketch centered in its canvas.
- Increased the sketch canvas height/dimensions from `921×857` to `937×1075` and removed high fetch priority because the image is decorative.
- Applied design QA recommendations: nudged the desktop placement farther right, reduced opacity, kept mobile subtle, and preserved the no-street/no-sidewalk building-only treatment.
- Strengthened static audit coverage for decorative image attributes: empty alt text, `aria-hidden`, explicit dimensions, and no high fetch priority.

Validation:
- `npm test`
- `npm run build`
- `git diff --check`
- Local desktop and mobile browser screenshot QA confirmed no content/CTA conflicts.

## 2026-05-09 — Landing sketch style-reference refinement

- Reworked the Alüm landing building sketch to better match Lawrence's architectural hand-rendering reference: denser ink facade hatching, more expressive linework, stronger overhang/balcony shadow texture, and a taller centered building-only composition.
- Preserved the transparent linen-line treatment and removed street/sidewalk/landscape context.
- Updated image dimensions to `898×1032`, kept the asset decorative (`alt=""`, `aria-hidden="true"`, async decoding), and repositioned the sketch farther right/smaller so it no longer conflicts with the landing CTA.
- Updated static audit coverage for the new crop and dimensions.

Validation:
- `npm test`
- `npm run build`
- `git diff --check`
- Desktop and mobile browser screenshot QA; final pass had no CTA/content blockers.
