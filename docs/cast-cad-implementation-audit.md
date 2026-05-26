# CAST CAD Implementation Audit

## Audit result

CAST CAD is implemented as a Phase 1–3 static-platform MVP plus production API contracts for the remaining enterprise modules. The repo now has the route, viewer/markup/takeoff foundation, architecture, schema target, feature flags, backend contracts, fail-closed private-file gates, workflow endpoints, and tests that make provider-dependent infrastructure explicit and guarded.

## 2026-05 production-completion update

Implemented backend contracts and tests for the remaining non-static elements that can be completed without external provider credentials:

- Authenticated raw PDF stream/proxy / authenticated private PDF stream contract: `/api/cast-cad-pdf-stream`.
- Provider-independent audited PDF stream lease contract for every private drawing stream request, including no-store/no-public-url guarantees, strict-auth fail-closed behavior when `CAST_CAD_REQUIRE_AUTH=true`, provider-required status, and exact private PDF provider env choices on `/api/cast-cad-pdf-stream`.
- Persistent markup create/list/update/CSV contract: `/api/cast-cad-markups`.
- Takeoff workbook, annotated PDF export, and comparison job contracts: `/api/cast-cad-exports`.
- RFI-from-markup snapshot workflow: `/api/cast-cad-rfi-link`.
- Provider-independent markup-to-workflow snapshot contract for RFI/submittal/change-event/issue/observation drafts with opt-in external-provider attempts that fail closed unless `CAST_CAD_WORKFLOW_PROVIDER`, `PROCORE_CLIENT_ID`, or `CAST_SERVER_WORKFLOW_API_URL` is configured: `/api/cast-cad-rfi-link`.
- OCR/symbol search index contract: `/api/cast-cad-search`.
- Review-room/collaboration invite contract: `/api/cast-cad-review-room`.
- Provider-independent takeoff refinement controls for editable measurement captions, precision, assembly mapping, formula columns, unit-cost mapping, and human-review-gated quantity rows.
- Provider-independent vector markup layer/group/style controls for stroke, fill, opacity, line width, and font size, persisted in local MVP data and server markup contracts.
- Provider-independent threaded markup comment/mention contract plus markup audit-history read contract on `/api/cast-cad-markups`.
- Provider-independent persisted viewer-preferences contract and workbench controls for layout, zoom mode, thumbnails, bookmarks, page labels, keyboard shortcuts, split view, side-by-side view, and search panel state: `/api/cast-cad-markups?action=preferences`.
- Provider-independent PDF viewport coordinate mapping contract and workbench controls for page box, viewport dimensions, rotation, normalized-overlay-to-PDF point conversion, scale calibration linkage, and audited backend persistence: `/api/cast-cad-markups?action=viewport-mapping`.
- Provider-independent drawing set versioning and slip-sheeting contract with audited supersedence chains and fail-closed human-review approval gates: `/api/cast-cad-exports` with `type=drawing-set-version`, `type=slip-sheet`, or `GET type=drawing-sets`.
- Provider-independent CAST Tool Library contract for admin-managed count/length/area/symbol/stamp items, assembly/cost metadata, audited updates, and review-gated placement as markup/takeoff rows: `/api/cast-cad-markups?action=tool-library`.
- Provider-independent CAST CAD batch operation contract for scoped status/assignee/layer/review/stamp updates, audited per target markup with fail-closed human-review gates for stamped/resolved/verified mutations: `/api/cast-cad-exports` with `type=batch-operation`.
- Provider-independent CAST CAD bulk-selection workbench controls for selecting visible markups and applying scoped status, assignee, layer, review-priority, and stamp operations against the batch API; sensitive stamp/resolved/verified changes remain human-review gated and fail closed if backend audit is unavailable.
- Provider-independent mobile/tablet offline field package and sync contract for private no-store sheet/markup packages, audited device deltas, and fail-closed human-review gates before offline sync can verify/resolve markups: `/api/cast-cad-exports` with `type=field-package` or `type=field-sync`.
- Provider-independent mobile/tablet field mode workbench controls for creating selected-sheet field packages, syncing offline notes, and fail-closed verification/resolution sync when backend audit or human-review approval is unavailable.
- Provider-independent CAST CAD field service worker for tablet/offline shell readiness that caches only public application shell assets and explicitly bypasses `/api`, `/safe-data`, `/data`, `sheetId` streams, and PDFs so private drawing/package data remains no-store/network-only.
- Provider-independent admin/governance contract for CAST CAD project member role assignments, effective permission resolution, permission matrix discovery, authenticated-session fail-closed mode, and audit-log reads: `/api/cast-cad-markups?action=admin|members|effective-permissions|audit-log`.
- Provider-independent AI Review finding contract for source-cited `AI Detected` findings, fail-closed human-review verification, audit history, and optional human-verified conversion into markups: `/api/cast-cad-search?action=ai-findings` plus POST `type=ai-finding|review-ai-finding`.
- Provider-independent frontend markup persistence bridge that posts newly created workbench markups to `/api/cast-cad-markups`, reloads server markups for the selected sheet, merges them into the overlay, and exposes local-only/server-synced status without claiming provider-backed database durability.
- Provider-independent frontend RFI-from-markup workflow bridge that first confirms backend markup persistence, then creates an audited draft RFI snapshot through `/api/cast-cad-rfi-link`, exposes workflow status, and fails closed without fabricating local-only/external RFIs when backend contracts are unavailable.
- Provider-independent drawing document metadata registry contract for private PDF sheet metadata, drawing-index import, audited updates, no-store stream linkage, and fail-closed durable/authoritative persistence gates requiring `CAST_CAD_DOCUMENT_METADATA_ADAPTER`: `/api/cast-cad-markups?action=document-metadata`.
- Provider-independent frontend drawing document metadata registry bridge that imports the current drawing index into `/api/cast-cad-markups?action=document-metadata`, refreshes registry counts, surfaces `CAST_CAD_DOCUMENT_METADATA_ADAPTER` as the durable/authoritative persistence blocker, and fails closed without fabricating durable registry state when the backend contract is unavailable.
- Provider-independent comparison-center workbench controls that create audited `/api/cast-cad-exports` `type=comparison` jobs, validate baseline/revised sheet scope, and fail closed with the exact `CAST_CAD_COMPARISON_WORKER` requirement instead of fabricating private overlay/delta artifacts.
- Provider-independent frontend export job bridge that creates audited takeoff workbook and annotated-PDF jobs through `/api/cast-cad-exports`, surfaces job status in the CAST CAD workbench, and fails closed with the exact `CAST_CAD_PDF_EXPORT_WORKER` requirement instead of fabricating flattened/private PDF artifacts.
- Provider-independent frontend CAST Tool Library bridge that loads/admin-seeds reusable count/length/area tools through `/api/cast-cad-markups?action=tool-library`, places selected tools as audited Needs Review markups/takeoff rows, and fails closed without fabricating local authoritative library, markup, or budget quantity state.
- Provider-independent frontend AI Review bridge that loads source-cited `AI Detected` findings from `/api/cast-cad-search?action=ai-findings`, creates cited review findings, verifies/converts selected findings only through the human-review-gated backend audit contract, and fails closed without fabricating uncited findings or human-verified markups.
- Provider-independent frontend OCR/symbol search bridge that queries `/api/cast-cad-search`, can create explicitly reviewed source-index samples through the audited search contract, surfaces `CAST_CAD_OCR_WORKER` as the production extraction blocker, and fails closed without fabricating private OCR text/artifacts.
- Provider-independent frontend Review Room bridge that creates selected-sheet/visible-markup review rooms through `/api/cast-cad-review-room`, lists audited participant invite records, and fails closed without fabricating local collaboration rooms or external email/realtime invite delivery.
- Provider-independent frontend admin/governance bridge that loads role matrices, project members, effective permissions, and member audit logs from `/api/cast-cad-markups?action=admin|members|effective-permissions|audit-log`, assigns project member roles only through backend audit, and fails closed without fabricating local permission authority when strict auth/session identity is required.
- Provider-independent audited markup soft-delete contract on `/api/cast-cad-markups` using `DELETE`, default list/export filtering that excludes deleted markups, explicit `includeDeleted=true` audit discovery, hard-delete human-review gates, and frontend delete controls that fail closed rather than fabricating unaudited local deletion.
- Provider-independent frontend drawing set version/slip-sheet bridge that publishes the current drawing index through `/api/cast-cad-exports` `type=drawing-set-version`, loads audited version/revision history, slip-sheets selected revisions only through the human-review-gated backend contract, and fails closed without fabricating local current/superseded authority.
- Provider-independent frontend threaded markup comment/audit bridge that selects persisted markups, loads `/api/cast-cad-markups?action=comments|audit`, posts audited mention-aware comments, and fails closed without fabricating local-only comment history or audit authority.
- Provider-independent private markup attachment/evidence manifest contract and frontend bridge on `/api/cast-cad-markups?action=attachments`, with audited metadata, no-store/no-public-URL guarantees, approved content-type validation, and fail-closed durable byte gates requiring `CAST_CAD_ATTACHMENT_STORAGE_ADAPTER`.
- Provider-independent frontend audited markup-edit bridge that resolves/updates selected markups only through backend `PATCH /api/cast-cad-markups`, refreshes local state from the server response, and fails closed without fabricating unaudited local-only edit authority.
- Provider-independent fail-closed takeoff workbook/XLSX export job contract that captures audited measurement rows but refuses to fabricate private workbook artifacts or output pointers until `CAST_CAD_TAKEOFF_WORKBOOK_WORKER` or `CAST_CAD_XLSX_EXPORT_WORKER` is configured, with frontend status messaging for the exact worker requirement.
- Provider-independent Review Room invite delivery contract and frontend bridge that creates audited private invite-delivery events, updates room participant delivery status, forbids public join links, and fails closed with `CAST_CAD_REVIEW_ROOM_TRANSPORT`, `CAST_CAD_EMAIL_PROVIDER`, or `CAST_CAD_REALTIME_PROVIDER` until email/realtime transport is configured: `/api/cast-cad-review-room?action=invite-events` plus POST `action=invite-delivery`.
- Provider-independent markup comment @mention notification delivery contract that records audited private delivery events, forbids public links/exposure, includes events in per-markup audit history, and fails closed with `CAST_CAD_COMMENT_NOTIFICATION_TRANSPORT`, `CAST_CAD_EMAIL_PROVIDER`, or `CAST_CAD_REALTIME_PROVIDER` until email/realtime transport is configured: `/api/cast-cad-markups?action=mention-events` plus POST `action=mention-delivery`.
- Provider-independent PDF annotation import/unflatten job contract and frontend bridge that accepts only private source pointers/stream lease IDs, rejects public URLs, audits import attempts, keeps imported markups human-review gated, and fails closed with `CAST_CAD_PDF_ANNOTATION_IMPORT_WORKER` or `CAST_CAD_PDF_EXPORT_WORKER` until a private PDF annotation worker is configured: `/api/cast-cad-exports` with `type=pdf-annotation-import`.
- Provider-independent cost catalog/cost database contract and frontend bridge for reviewed unit-cost and assembly rows, audited imports/updates, no budget-authoritative claims, and fail-closed durable/private cost database gates requiring `CAST_CAD_COST_CATALOG_ADAPTER` or `CAST_CAD_COST_DATABASE_ADAPTER`: `/api/cast-cad-markups?action=cost-catalog`.
- Provider-independent CAD/model ingestion job contract and frontend bridge for private IFC/DWG/DXF/RVT/etc. source pointers, no public URLs, private no-store viewer artifacts, and human-review-gated linked quantities; fails closed with `CAST_CAD_MODEL_INGESTION_WORKER`, `CAST_CAD_IFC_CONVERSION_WORKER`, or `CAST_CAD_CAD_CONVERSION_WORKER` until a private model conversion worker is configured: `/api/cast-cad-exports` with `type=model-ingestion`.
- Provider-independent model-derived quantity link contract and frontend bridge for source-cited model element quantities, optional review-gated takeoff markup creation, private/no-public-artifact guarantees, and fail-closed human-review gates before verified/resolved/budget-authoritative use: `/api/cast-cad-exports` with `type=model-quantity-link`.
- Provider-independent 300-sheet drawing upload package manifest contract and frontend bridge for private PDF upload leases/source pointers, no-store/no-public-URL guarantees, audited package records, and fail-closed current-set publishing gates requiring human review plus `CAST_CAD_DRAWING_UPLOAD_STORAGE_ADAPTER`, `CAST_CAD_DOCUMENT_STORAGE_ADAPTER`, `CAST_SERVER_DOCUMENT_API_URL`, or `DROPBOX_ACCESS_TOKEN` and `CAST_CAD_DOCUMENT_METADATA_ADAPTER`: `/api/cast-cad-exports` with `type=drawing-upload-package`.
- Provider-independent drawing transmittal/release contract and frontend bridge for audited selected-sheet release records, recipient manifests, private/no-public-link delivery guarantees, issue-for-construction human-review gates, and fail-closed delivery transport requirements via `CAST_CAD_TRANSMITTAL_TRANSPORT`, `CAST_CAD_EMAIL_PROVIDER`, or `CAST_SERVER_WORKFLOW_API_URL`: `/api/cast-cad-exports` with `type=drawing-transmittal`.
- Provider-independent saved markup filter/report view contract and frontend bridge with status/priority/trade/layer/search/needs-review filters, private-report/no-public-exposure guarantees, audited saved view creation, rerunnable stored filters, and explicit durable storage blockers requiring `CAST_CAD_MARKUP_DATABASE_ADAPTER` or `CAST_CAD_DATABASE_URL`: `/api/cast-cad-markups?action=saved-markup-views` plus POST `action=saved-markup-view`.
- Provider-independent drawing Auto Link candidate contract and frontend bridge that creates source-cited private sheet-link candidates from audited OCR/index text and drawing metadata, keeps candidates human-review gated, forbids public URLs, and fails closed for durable/published links until `CAST_CAD_DOCUMENT_METADATA_ADAPTER` or `CAST_CAD_DATABASE_URL` is configured: `/api/cast-cad-search?action=auto-links` plus POST `action=auto-links`.
- Provider-independent drawing Auto Link candidate review contract and frontend bridge that records explicit human Approved/Rejected decisions against source-cited candidates, audits each decision, leaves approved candidates pending durable private publish, and fails closed without fabricating local sheet-link authority until `CAST_CAD_DOCUMENT_METADATA_ADAPTER` or `CAST_CAD_DATABASE_URL` is configured: `/api/cast-cad-search` POST `action=review-auto-link-candidate`.
- Provider-independent PDF renderer session contract and frontend bridge for private stream-lease-backed multipage rendering, thumbnails, page labels, bookmarks, text search, and native viewport matrix extraction; public PDF URLs are rejected and renderer artifacts fail closed with `CAST_CAD_PDF_RENDERER_WORKER`, `CAST_CAD_PDFJS_WORKER_URL`, or `CAST_CAD_PDF_SDK_PROVIDER` until a private PDF renderer worker/SDK is configured: `/api/cast-cad-exports` with `type=pdf-renderer-session`.
- Shared production service layer: `api/_lib/cast-cad-production.js`.
- Regression coverage: `tests/cast-cad-production-contract-tests.js`.

Provider-dependent jobs now fail closed with explicit `provider-required` / `503` states instead of pretending private infrastructure is configured. To make the provider-dependent pieces fully operational, production still needs the private runtime credentials/workers listed below.

## Phase 1: Foundation

- Status: Implemented as static MVP scaffold.
- Evidence:
  - `/projects/cast-cad.html` route exists.
  - Current drawing metadata loads from `/safe-data/projects/golden-hill/procore-information/procore-data-tie-index.json`.
  - Local browser-session PDF upload/override is supported.
  - Browser-native PDF preview exists as the interim viewer.
  - Drawing set/sheet index metadata is available from the current drawing index.
  - Basic route/navigation discoverability is guarded by tests.
- Remaining production work:
  - Connect production provider credentials for the authenticated raw PDF stream/proxy (`CAST_CAD_PDF_STREAM_BASE`, `DROPBOX_ACCESS_TOKEN`, or `CAST_SERVER_DOCUMENT_API_URL`). The fail-closed API and audited stream lease contracts are implemented.
  - Connect true PDF.js/commercial SDK multi-page drawing renderer worker with lazy rendering, thumbnails, page labels, bookmarks, search, split view, side-by-side view, keyboard shortcuts, and persisted preferences. Provider-independent preference UI/API, PDF viewport coordinate mapping contracts, and fail-closed private PDF renderer session contracts are implemented; renderer engine/worker remains provider/integration-dependent.
  - Connect database adapter for document metadata persistence. The provider-independent drawing document metadata registry/import/audit contract and frontend import/status bridge are implemented and fail closed for durable or authoritative writes without `CAST_CAD_DOCUMENT_METADATA_ADAPTER`.
  - Wire backend auth/session identity into the CAST CAD permission layer. Permission decisions are implemented in the service contract.

## Phase 2: Markups

- Status: Implemented as static MVP scaffold.
- Evidence:
  - CAST markups can be created from the viewer overlay.
  - Supported MVP markup/takeoff tools include pin/comment, cloud/callout, text, rectangle, line measurement, area measurement, count, highlight/arrow/scaffolded toolbar actions, and stamp scope.
  - Markups List/export includes sheet, subject, tool, status, priority, trade, cost code, measurement value, measurement unit, scale label, and body.
  - Status/comment/quantity verification flows exist in the shared data layer.
- Remaining production work:
  - Frontend vector editing UI now posts created workbench markups to the implemented server markup contract, reloads server markups for the selected sheet, displays backend/local-only persistence status, and bridges threaded mention-aware comments plus per-markup audit history through the backend contract. Remaining provider-dependent durability work is connecting the production database adapter. Layer/group/style controls are implemented provider-independently in the static workbench and service contract.
  - Connect PDF annotation export/flatten workers to the implemented annotated-PDF export job contract. Frontend export controls now create audited backend export jobs and fail closed with `CAST_CAD_PDF_EXPORT_WORKER` when the private write-back worker is not configured. PDF annotation import/unflatten has a provider-independent audited job contract and frontend bridge that rejects public URLs; production import parsing still needs `CAST_CAD_PDF_ANNOTATION_IMPORT_WORKER` or `CAST_CAD_PDF_EXPORT_WORKER`.

## Phase 3: Measurements

- Status: Implemented as tested geometry helpers plus MVP UI workflow.
- Evidence:
  - `calibrateCastCadScale` calibrates a scale from a known distance and two normalized page points.
  - `measureCastCadGeometry` supports calibrated length, area, and count outputs.
  - Unit tests cover length, area, count, scale metadata, feature flags, module registry, AI registry, and schema planning.
  - Takeoff rows remain draft/needs-review until human verified.
- Remaining production work:
  - Provider-independent PDF viewport coordinate mapping, page box/rotation persistence, and normalized overlay-to-PDF point conversion are implemented in the backend/workbench contract. Remaining work is to connect the selected PDF renderer's native page events and viewport matrices to that contract.
  - Completed provider-independent frontend precision controls, editable measurement captions, assembly takeoffs, formula columns, seed cost-code/unit-cost mapping, and audited cost catalog contract/frontend bridge on top of the workbook export contract. Remaining work is to connect the production cost database adapter once provider/storage decisions are available (`CAST_CAD_COST_CATALOG_ADAPTER` or `CAST_CAD_COST_DATABASE_ADAPTER`).

## Enterprise modules scaffolded behind flags

- CAST Tool Library
- Drawing set versions and slip-sheeting (provider-independent API/service contract implemented; storage/provider adapter remains)
- Comparison Center
- OCR, visual search, symbol detection, and Auto Link
- RFIs/submittals/change-event links (provider-independent markup workflow snapshot contract implemented; external provider write-back remains provider-gated)
- Review Rooms and Project Rooms
- CAST CAD AI Review agents
- Batch tools (provider-independent batch operation API/service contract and static workbench bulk-selection workflow implemented for scoped status/assignee/layer/review/stamp updates; production storage adapter remains)
- Mobile/tablet field mode (provider-independent offline package/sync API/service contract, static workbench controls, and public-shell-only service worker implemented; production storage adapter and private provider-backed package storage remain)
- Admin, roles, permissions, governance, and audit logs (provider-independent API/service contract implemented; production auth/session provider and database adapter remain)
- Integrations: Dropbox, Google Drive, SharePoint, Procore-style workflows, Yardi, and future Autodesk/Revit/AutoCAD/IFC/DWG/Speckle connectors
- 3D model ingestion and preview strategy via IFC/xeokit/IFC.js/Three.js in later phases (provider-independent private ingestion job contract and workbench bridge now implemented; conversion/viewer workers remain provider/integration-dependent).

## Acceptance criteria status

- 300-sheet upload/navigation: metadata-backed sheet navigation implemented; authenticated raw PDF stream contract implemented; provider-independent audited drawing upload package manifests are implemented and fail closed for durable private bytes/current-set authority until private storage/document metadata providers are configured.
- Drawing transmittal/release: provider-independent audited transmittal records and frontend controls are implemented with no public sheet links; delivery remains blocked until a private transmittal/email/workflow transport is configured.
- Create/edit/save/reload/filter/export/delete markups: server contract implemented with audit, CSV, advanced filter dimensions, private saved markup filter/report views, audited soft-delete, default deleted-row filtering, and fail-closed hard-delete review gates; production database adapter remains to be connected.
- Attach private field/photo/PDF evidence to markups/comments: audited provider-independent manifest contract and frontend bridge implemented; durable private byte storage remains blocked until `CAST_CAD_ATTACHMENT_STORAGE_ADAPTER` is configured.
- Comment @mention notification delivery: audited provider-independent delivery event contract implemented; email/realtime dispatch remains blocked until `CAST_CAD_COMMENT_NOTIFICATION_TRANSPORT`, `CAST_CAD_EMAIL_PROVIDER`, or `CAST_CAD_REALTIME_PROVIDER` is configured.
- Calibrated length/area/count: implemented and tested at helper/MVP level.
- Excel takeoff report: workbook export job contract implemented; XLSX worker/provider remains to be connected for generated binary files.
- CAST Tool Library: provider-independent API/service contract implemented; frontend workbench bridge now loads/admin-seeds reviewed tools and places selected tools as audited Needs Review markups/takeoff rows; production database/catalog adapter remains.
- Drawing set versions and slip-sheeting: API/service contract and frontend bridge implemented with human-review-gated supersedence/audit history; production database adapter remains to be connected.
- Drawing comparison report: provider-independent API/service contract and static comparison-center job controls are implemented with explicit `CAST_CAD_COMPARISON_WORKER` fail-closed status; comparison worker remains to be connected.
- OCR/search/Auto Link: search/index contract implemented; frontend OCR/symbol bridge now queries the audited backend index, can create explicitly reviewed source-index samples for workflow testing, and surfaces `CAST_CAD_OCR_WORKER` as the production extraction blocker. Auto Link candidate generation is implemented as a private, source-cited, human-review-gated contract from OCR/index text and drawing metadata; durable/published navigable links remain blocked until `CAST_CAD_DOCUMENT_METADATA_ADAPTER` or `CAST_CAD_DATABASE_URL` is configured. OCR/Auto Link extraction workers remain to be connected.
- RFI from markup with snapshot: server workflow implemented as draft RFI link + geometry snapshot; frontend now calls the audited workflow contract and fails closed when backend markup/RFI contracts are unavailable.
- Submittal/change-event/issue/observation links from markup: provider-independent workflow snapshots now create audited draft records through `/api/cast-cad-rfi-link`; external Procore/CAST workflow write-back fails closed until `CAST_CAD_WORKFLOW_PROVIDER`, `PROCORE_CLIENT_ID`, or `CAST_SERVER_WORKFLOW_API_URL` is configured.
- Review session invite: review-room invite contract implemented; frontend bridge creates/lists audited room participant records and audited invite-delivery events. Real-time transport/email invite provider remains blocked until `CAST_CAD_REVIEW_ROOM_TRANSPORT`, `CAST_CAD_EMAIL_PROVIDER`, or `CAST_CAD_REALTIME_PROVIDER` is configured.
- Annotated PDF export: export job contract implemented; PDF write-back/flatten worker remains.
- PDF annotation import/unflatten: audited job contract and frontend bridge implemented; private annotation parsing worker remains blocked on `CAST_CAD_PDF_ANNOTATION_IMPORT_WORKER` or `CAST_CAD_PDF_EXPORT_WORKER`.
- Markups List report: implemented at CSV/export scaffold level.
- Permissioned/audit logged actions: provider-independent role matrix, project member role assignment, effective permission lookup, strict-auth fail-closed mode, and audit-log read contract are implemented; production auth/session integration and database persistence remain.
- AI findings labeled AI detected and human verified: provider-independent source-cited AI Review finding contract implemented with fail-closed human verification and optional human-approved markup conversion; frontend workbench controls now load/create/review cited findings through the audited backend contract without fabricating uncited findings or human-verified markups. Production AI review workers remain disabled until provider/worker configuration is supplied.
- CAD/model ingestion and preview: provider-independent private ingestion job contract and workbench bridge implemented for IFC/DWG/DXF/RVT/RFA/SKP/OBJ/GLB/GLTF source pointers, no public URLs, no-store private artifacts, and human-review-gated linked quantities; production conversion/viewer artifacts remain blocked until `CAST_CAD_MODEL_INGESTION_WORKER`, `CAST_CAD_IFC_CONVERSION_WORKER`, or `CAST_CAD_CAD_CONVERSION_WORKER` is configured. Source-cited model quantity links can now create audited, review-gated takeoff markups via `/api/cast-cad-exports` `type=model-quantity-link` without fabricating public model artifacts or budget-authoritative quantities.
- No Bluebeam proprietary UI/names/icons/trade dress copied: current CAST CAD UI uses CAST naming and generic construction workflow language.

## Latest validation commands

```bash
npm test
npm run build
npm run check:public-artifacts
npm run check:third-party-scripts
node --check public/projects/*.js
node --check api/*.js api/_lib/*.js
```

## Latest audit run

- Audited at: `2026-05-26T12:18:24Z` for the CAST CAD drawing Auto Link candidate review contract slice.
- Branch audited: `cast-cad-auto-link-review`.
- Local validation result: passing.
- Live CAST CAD route: `https://app.cast-bld.com/projects/cast-cad.html` returned `200` and includes CAST CAD, Production backend gates, and `/api/cast-cad-markups` signals.
- Live CAST CAD script: `https://app.cast-bld.com/projects/cast-cad.js` returned `200`.
- Live markup API: `https://app.cast-bld.com/api/cast-cad-markups` returned `200` with an empty markups list in the clean runtime state.
- Live PDF stream API: `https://app.cast-bld.com/api/cast-cad-pdf-stream?sheetId=Current%20Drawings/A/A-101.pdf` returned intentional fail-closed `503` because the authenticated PDF provider is not configured. The response includes `publicExposure: false`, `requiresAuth: true`, and private no-store stream contract metadata.

## Deployment status

Production deploys `app.cast-bld.com` from `main`. After each CAST CAD merge, verify:

- `https://app.cast-bld.com/projects/cast-cad.html` includes CAST CAD navigation, production backend gates, and current module signals.
- `https://app.cast-bld.com/api/cast-cad-markups` returns JSON successfully.
- `https://app.cast-bld.com/api/cast-cad-pdf-stream?...` fails closed until private PDF provider credentials/workers are configured.
