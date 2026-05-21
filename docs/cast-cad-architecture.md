# CAST CAD Architecture Note

## Repository assessment

- Current app shape: static CAST Build platform generated from `public/` into `dist/` by `scripts/build-static.js`.
- Routing: Vercel-style static routes plus rewrites in `vercel.json`; CAST CAD lives at `/projects/cast-cad.html`.
- Auth: `public/cast-auth.js` is a temporary browser-only access gate using localStorage and a shared password hash. It is not a backend security boundary.
- Shell/design: CAST pages use `cast-build.css`, `cast-build-components.css`, `cast-build-shell.js`, and project navigation from `public/projects/alum-project-nav.js`.
- Data model today: browser/localStorage seed state in `public/projects/cast-project-controls-data.js` for RFIs, submittals, drawings, documents, markups, quantities, users, roles, audit logs, and notifications.
- Storage today: public/safe JSON metadata only. Raw PDFs, XLSX, CSV, ZIP, private, raw, and source-intake artifacts are intentionally excluded from `dist/`.
- Document APIs today: serverless-style handlers under `api/` for document intake, document workflow, storage, OCR, matching, Dropbox links, email distribution, and CAST server filing helpers.
- Current drawing set source: `/safe-data/projects/golden-hill/procore-information/procore-data-tie-index.json` publishes metadata for current drawing PDFs without exposing raw files.
- Existing CAST CAD MVP: web route, current drawing metadata link, local PDF override, browser-native PDF preview, CAST annotation overlay, markups/comments, basic measurement/takeoff rows, Excel/CSV export, static audits, and unit tests.
- Guardrails: no third-party scripts without `docs/third-party-scripts.json` approval; build excludes private files; AI quantities remain non-authoritative until human verification.

## Proposed architecture

CAST CAD should become a modular app inside the CAST platform, not a Bluebeam clone. The product architecture should separate rendering, markup state, measurements, workflow records, AI findings, and exports so CAST can swap viewer engines without losing data.

Recommended layers:

1. **Viewer layer:** PDF.js or a commercial PDF SDK for production-grade PDF rendering of multi page drawings, with lazy rendering, thumbnails, search, page labels, split view, side-by-side review, and tabs.
2. **Overlay layer:** SVG/canvas vector layer for CAST markups, measurement geometry, measurement captions, comments, collaboration cursors, and AI issue pins.
3. **Workflow layer:** normalized CAST records for markups, issues, takeoffs, RFIs, submittals, review sessions, comparison jobs, and audit logs.
4. **Storage layer:** authenticated document pointers to Dropbox/CAST server/S3-compatible storage; avoid duplicating massive files unless required.
5. **Processing layer:** workers for OCR, page labels, thumbnails, comparisons, symbol search, batch links, exports, and AI review.
6. **AI layer:** RAG over OCR, sheet index, specs, RFIs, submittals, markups, and revision history with explicit source citations and human verification.

## Build plan by phase

### Phase 1: Foundation

- Keep `/projects/cast-cad.html` as the platform route.
- Load current drawing set metadata automatically.
- Add project dashboard metrics, sheet index, page/viewer state, upload override, and authenticated-file-stream placeholder.
- Store document, drawing set, and sheet metadata.
- Prepare permissions and audit concepts in schema.

### Phase 2: Markups

- Support text, cloud/callout, rectangle, line, arrow, pen/highlight, stamp, and comment pins.
- Save markup geometry in normalized page coordinates.
- Add Markups List table, properties, status, comments, assignee, priority, cost code, audit history, and export.
- Preserve Bluebeam-comparable construction outcomes without copying proprietary UI, naming, icons, or trade dress.

### Phase 3: Measurements

- Calibrate sheet scale from known distance.
- Support length, polyline, area, perimeter, and count MVP.
- Store measurement metadata and editable measurement captions, then generate takeoff rows.
- Export takeoff workbook to Excel/XLSX.
- Keep all takeoffs in Needs Review until human-verified.

### Phase 4+: Enterprise roadmap

- CAST Tool Library, drawing set versions/slip sheets, comparison center, OCR/search, RFIs/submittals, review rooms, AI review agents, dynamic area fill, visual search, batch tools, mobile offline field mode, admin governance, SSO, and integrations.

## Database schema

The SQL migration scaffold is `db/migrations/001_cast_cad_schema.sql` and covers the requested core tables using `cast_cad_` prefixes for future backend adoption.

Primary entities:

- projects, drawing_sets, drawing_sheets, drawing_revisions
- documents, document_versions, document_pages, document_ocr
- markups, markup_geometry, markup_comments, markup_status_history, markup_attachments
- tool_sets, tool_items
- measurements, takeoff_items, takeoff_workbooks
- spaces, levels, units
- comparison_jobs, comparison_results, visual_search_jobs, batch_jobs
- review_sessions, session_participants, session_activity
- rfi_links, submittal_links, change_event_links
- exports, audit_logs, ai_findings, ai_agent_runs
- user_preferences, keyboard_shortcuts, integrations, external_collaborators, permissions

Each markup stores normalized geometry, page number, sheet ID, drawing set ID, author, timestamps, properties JSON, measurement metadata, status, linked records, audit history, original PDF coordinate mapping, and version metadata.

## API endpoints

Future backend endpoints should be versioned under `/api/cast-cad/*`:

- `GET /api/cast-cad/projects/:projectId/dashboard`
- `GET /api/cast-cad/projects/:projectId/drawing-sets`
- `POST /api/cast-cad/projects/:projectId/drawing-sets`
- `GET /api/cast-cad/drawing-sets/:setId/sheets`
- `GET /api/cast-cad/sheets/:sheetId/file-stream`
- `POST /api/cast-cad/documents/upload`
- `POST /api/cast-cad/markups`
- `PATCH /api/cast-cad/markups/:markupId`
- `POST /api/cast-cad/markups/:markupId/comments`
- `POST /api/cast-cad/markups/:markupId/rfi-draft`
- `POST /api/cast-cad/measurements`
- `POST /api/cast-cad/takeoffs/export-xlsx`
- `POST /api/cast-cad/comparisons`
- `POST /api/cast-cad/ocr-jobs`
- `POST /api/cast-cad/batch-jobs`
- `POST /api/cast-cad/ai/plan-review`
- `GET /api/cast-cad/audit-log`

Existing `api/_lib/document-*` modules should be reused where possible for storage, OCR, document workflow, Dropbox links, and permissions.

## Component tree

Static MVP components are embedded in `cast-cad.html`/`cast-cad.js`. Future React/TypeScript component tree:

- `CastCadApp`
  - `CastCadShell`
  - `ProjectCadDashboard`
  - `DrawingSetNavigator`
  - `PdfViewerCanvas`
    - `PdfRenderLayer`
    - `VectorMarkupLayer`
    - `MeasurementLayer`
    - `CommentLayer`
    - `CollaborationCursorLayer`
    - `AiIssueLayer`
  - `TopViewerToolbar`
  - `LeftDocumentPanel`
  - `RightPropertiesPanel`
  - `BottomMarkupsPanel`
  - `CastToolLibraryPanel`
  - `TakeoffWorkbook`
  - `ComparisonCenter`
  - `ReviewRoomPanel`
  - `AiReviewPanel`
  - `ExportCenter`
  - `AdminGovernancePanel`

## Background worker design

Use BullMQ or Temporal once a backend exists. Worker queues:

- `pdf.preprocess`: thumbnails, page count, page labels, bookmarks, file hash.
- `ocr.extract`: OCR text and coordinates by page.
- `drawing.index`: sheet number/title/discipline/title block extraction.
- `compare.run`: raster/vector comparison and overlay alignment.
- `visual.search`: OpenCV template matching, symbol detection, and future CV models.
- `batch.run`: batch OCR, links, stamps, slip sheets, exports, flatten/reduce.
- `export.run`: annotated PDF, clean PDF, XLSX, issue reports, lender packages.
- `ai.review`: plan review, RFI draft, submittal review, cost risk, lender exhibit.

Workers must write job records, logs, progress, failure reasons, output artifacts, and audit events.

## Integration strategy

- Dropbox: store source drawing/document pointers and permissions metadata; avoid duplicating huge files; stream files through authenticated backend only.
- Google Drive/SharePoint/OneDrive/Box/Egnyte: connector abstraction with file pointers, revision metadata, and permission sync.
- Procore-style workflows: mirror RFI/submittal/document status and links without writing externally until approved.
- Yardi: document/exhibit storage where relevant, not construction system of record.
- Gmail/Outlook/Slack/Teams: notifications and distribution lists.
- Autodesk/Revit/AutoCAD/Speckle/IFC/DWG: future BIM ingestion, 3D model preview, and model coordination.

## AI agent strategy

Agents:

1. Plan Reviewer
2. Compare Agent
3. Takeoff Agent
4. RFI Agent
5. Submittal Agent
6. Code Reviewer
7. Cost Risk Agent
8. Constructability Agent
9. Document Librarian
10. Lender Package Agent

AI guardrails:

- AI findings are always labeled AI detected until human verified.
- AI cannot issue RFIs, delete markups, overwrite human markups, or modify budgets without approval.
- AI must cite source sheet/page/OCR/markup/document and provide confidence.
- Each accept/reject/modify action is audit logged.

## Security model

- Replace browser-only auth with backend auth/SSO before private PDF streaming or external collaborator access.
- Enforce RBAC by role, company, project, folder, document type, review session, and action.
- Use expiring signed URLs for file streams; never publish raw private PDFs in `public/`.
- Preserve original file hash and chain of custody.
- Log view/download/export/share/signature/AI actions.
- Restrict guest links with expiration, watermarking, download controls, and external access logs.
- Keep third-party scripts governed by `docs/third-party-scripts.json`.

## MVP implementation

Implemented in the static platform:

- CAST CAD route and navigation.
- Current drawing set metadata link.
- Local browser-session PDF override.
- Viewer overlay for CAST structured markups.
- Scale calibration and length/area/count takeoff helpers.
- Markups/comments/status/assignee/cost-code records.
- Quantity verification guardrail.
- Excel/CSV-compatible export.
- Feature-flag/roadmap registry for enterprise modules.
- Architecture note and SQL migration scaffold.

## Test plan

Current gates:

- `npm test`
- `npm run build`
- `npm run check:public-artifacts`
- `npm run check:third-party-scripts`
- `node --check public/projects/*.js`

Coverage added/required:

- Geometry and scale calculations.
- Markup creation, audit, notification, status update, CSV export.
- Quantity verification.
- Static signals for CAST CAD route, current drawing set, Bluebeam-comparable but distinct roadmap, feature flags, architecture doc, schema scaffold, and navigation.
- Future tests: permissions, API contract, file streaming, OCR jobs, comparison jobs, export jobs, collaboration sessions, and AI guardrails.

## Known limitations

- Current production repo is a static platform, not a full Next.js/React/TypeScript app.
- Auth is a temporary browser gate and not sufficient for private PDF streaming.
- Current drawing metadata loads, but raw source PDFs remain private and are not streamed yet.
- Browser-native PDF object preview is a placeholder; production should use PDF.js or commercial SDK.
- Markup editing is MVP-level; full vector editing, grouping, flattening, importing/exporting PDF annotations, and collaboration are roadmap.
- Measurements use normalized page coordinates and MVP calculations; production needs true PDF coordinate mapping, viewports, and precision controls.

## Next phase backlog

1. Add authenticated PDF file-stream endpoint for current drawing set.
2. Add true PDF.js rendering with lazy pages, thumbnails, search, page labels, zoom/pan/rotate.
3. Persist CAST CAD documents/markups/measurements in backend database.
4. Implement vector editing, properties panel, Markups List filters/grouping/custom columns.
5. Export annotated PDF and takeoff workbook XLSX.
6. Build CAST Tool Library.
7. Add drawing set upload, sheet extraction, versioning, supersede/slip-sheet workflow.
8. Add comparison center and revision reports.
9. Add OCR/search/auto link/symbol detection/visual search workers.
10. Add RFI/submittal creation from markup with snapshots.
11. Add review rooms and presence/collaboration.
12. Add CAST CAD AI panel and agent workflows.
13. Add admin/permissions/audit UI and external collaborator controls.
14. Add mobile/tablet field mode and offline sync.
