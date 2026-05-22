# CAST CAD Implementation Audit

## Audit result

CAST CAD is implemented as a Phase 1–3 static-platform MVP plus production API contracts for the remaining enterprise modules. The repo now has the route, viewer/markup/takeoff foundation, architecture, schema target, feature flags, backend contracts, fail-closed private-file gates, workflow endpoints, and tests that make provider-dependent infrastructure explicit and guarded.

## 2026-05 production-completion update

Implemented backend contracts and tests for the remaining non-static elements that can be completed without external provider credentials:

- Authenticated raw PDF stream/proxy / authenticated private PDF stream contract: `/api/cast-cad-pdf-stream`.
- Persistent markup create/list/update/CSV contract: `/api/cast-cad-markups`.
- Takeoff workbook, annotated PDF export, and comparison job contracts: `/api/cast-cad-exports`.
- RFI-from-markup snapshot workflow: `/api/cast-cad-rfi-link`.
- OCR/symbol search index contract: `/api/cast-cad-search`.
- Review-room/collaboration invite contract: `/api/cast-cad-review-room`.
- Provider-independent takeoff refinement controls for editable measurement captions, precision, assembly mapping, formula columns, unit-cost mapping, and human-review-gated quantity rows.
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
  - Connect production provider credentials for the authenticated raw PDF stream/proxy (`CAST_CAD_PDF_STREAM_BASE`, Dropbox, or CAST Server API). The fail-closed API contract is implemented.
  - Connect true PDF.js/commercial SDK multi-page drawing renderer worker with lazy rendering, thumbnails, page labels, bookmarks, search, split view, side-by-side view, keyboard shortcuts, and persisted preferences.
  - Connect database adapter for document metadata persistence. The server markup/search/export contracts are implemented and audited.
  - Wire backend auth/session identity into the CAST CAD permission layer. Permission decisions are implemented in the service contract.

## Phase 2: Markups

- Status: Implemented as static MVP scaffold.
- Evidence:
  - CAST markups can be created from the viewer overlay.
  - Supported MVP markup/takeoff tools include pin/comment, cloud/callout, text, rectangle, line measurement, area measurement, count, highlight/arrow/scaffolded toolbar actions, and stamp scope.
  - Markups List/export includes sheet, subject, tool, status, priority, trade, cost code, measurement value, measurement unit, scale label, and body.
  - Status/comment/quantity verification flows exist in the shared data layer.
- Remaining production work:
  - Connect frontend vector editing UI to the implemented server markup contract for grouping, layer assignment, opacity/fill/stroke/font controls, threaded mentions, and backend audit history.
  - Connect PDF annotation import/export/flatten/unflatten workers to the implemented annotated-PDF export job contract.

## Phase 3: Measurements

- Status: Implemented as tested geometry helpers plus MVP UI workflow.
- Evidence:
  - `calibrateCastCadScale` calibrates a scale from a known distance and two normalized page points.
  - `measureCastCadGeometry` supports calibrated length, area, and count outputs.
  - Unit tests cover length, area, count, scale metadata, feature flags, module registry, AI registry, and schema planning.
  - Takeoff rows remain draft/needs-review until human verified.
- Remaining production work:
  - Connect true PDF coordinate mapping and multiple viewport scale persistence to the selected PDF renderer.
  - Completed provider-independent frontend precision controls, editable measurement captions, assembly takeoffs, formula columns, and seed cost-code/unit-cost mapping on top of the workbook export contract. Remaining work is to connect the production cost database adapter once provider/storage decisions are available.

## Enterprise modules scaffolded behind flags

- CAST Tool Library
- Drawing set versions and slip-sheeting
- Comparison Center
- OCR, visual search, symbol detection, and Auto Link
- RFIs/submittals/change-event links
- Review Rooms and Project Rooms
- CAST CAD AI Review agents
- Batch tools
- Mobile/tablet field mode
- Admin, roles, permissions, governance, and audit logs
- Integrations: Dropbox, Google Drive, SharePoint, Procore-style workflows, Yardi, and future Autodesk/Revit/AutoCAD/IFC/DWG/Speckle connectors
- 3D model ingestion and preview strategy via IFC/xeokit/IFC.js/Three.js in later phases

## Acceptance criteria status

- 300-sheet upload/navigation: metadata-backed sheet navigation implemented; authenticated raw PDF stream contract implemented; provider credentials still required for private file bytes.
- Create/edit/save/reload/filter/export markups: server contract implemented with audit and CSV; production database adapter remains to be connected.
- Calibrated length/area/count: implemented and tested at helper/MVP level.
- Excel takeoff report: workbook export job contract implemented; XLSX worker/provider remains to be connected for generated binary files.
- CAST Tool Library: scaffolded behind feature flag.
- Drawing comparison report: comparison job contract implemented; comparison worker remains to be connected.
- OCR/search: search/index contract implemented; OCR worker remains to be connected.
- RFI from markup with snapshot: server workflow implemented as draft RFI link + geometry snapshot.
- Review session invite: review-room invite contract implemented; real-time transport/email invite provider remains.
- Annotated PDF export: export job contract implemented; PDF write-back/flatten worker remains.
- Markups List report: implemented at CSV/export scaffold level.
- Permissioned/audit logged actions: implemented in service contract; production auth/session integration remains.
- AI findings labeled AI detected and human verified: implemented in data/schema guardrails; agents remain disabled behind flags.
- No Bluebeam proprietary UI/names/icons/trade dress copied: current CAST CAD UI uses CAST naming and generic construction workflow language.

## Latest validation commands

```bash
npm test
npm run build
npm run check:public-artifacts
npm run check:third-party-scripts
node --check public/projects/*.js
```

## Deployment requirement

For production, merge PR #4 to `main`; Vercel deploys `app.cast-bld.com` from the production branch. After deployment, verify:

- `https://app.cast-bld.com/projects/cast-cad.html`
- `https://app.cast-bld.com/projects.html` includes a CAST CAD navigation/discovery path.
