# CAST CAD Implementation Audit

## Audit result

CAST CAD is implemented as a Phase 1–3 static-platform MVP plus an enterprise scaffold. The complete Bluebeam-comparable product list is not fully built yet; the repo now has the route, viewer/markup/takeoff foundation, architecture, schema target, feature flags, and tests that make the remaining modules explicit and guarded.

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
  - Authenticated raw PDF stream/proxy.
  - True PDF.js/commercial SDK multi-page drawing renderer with lazy rendering, thumbnails, page labels, bookmarks, search, split view, side-by-side view, keyboard shortcuts, and persisted preferences.
  - Backend document metadata persistence.
  - Backend-enforced permissions.

## Phase 2: Markups

- Status: Implemented as static MVP scaffold.
- Evidence:
  - CAST markups can be created from the viewer overlay.
  - Supported MVP markup/takeoff tools include pin/comment, cloud/callout, text, rectangle, line measurement, area measurement, count, highlight/arrow/scaffolded toolbar actions, and stamp scope.
  - Markups List/export includes sheet, subject, tool, status, priority, trade, cost code, measurement value, measurement unit, scale label, and body.
  - Status/comment/quantity verification flows exist in the shared data layer.
- Remaining production work:
  - Full vector editing, grouping, layer assignment, opacity/fill/stroke/font controls, import/export PDF annotations, flattening, unflattening from CAST database, threaded mentions, and backend audit history.

## Phase 3: Measurements

- Status: Implemented as tested geometry helpers plus MVP UI workflow.
- Evidence:
  - `calibrateCastCadScale` calibrates a scale from a known distance and two normalized page points.
  - `measureCastCadGeometry` supports calibrated length, area, and count outputs.
  - Unit tests cover length, area, count, scale metadata, feature flags, module registry, AI registry, and schema planning.
  - Takeoff rows remain draft/needs-review until human verified.
- Remaining production work:
  - True PDF coordinate mapping, multiple viewports/scales on one sheet, precision controls, measurement captions rendered as first-class editable labels, assembly takeoffs, formula columns, cost database mapping, and XLSX export jobs.

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

- 300-sheet upload/navigation: scaffolded, not production-complete.
- Create/edit/save/reload/filter/export markups: partially implemented in static MVP; backend persistence and advanced editing remain.
- Calibrated length/area/count: implemented and tested at helper/MVP level.
- Excel takeoff report: CSV/Excel-compatible export scaffold exists; production XLSX export job remains.
- CAST Tool Library: scaffolded behind feature flag.
- Drawing comparison report: scaffolded behind feature flag.
- OCR/search: scaffolded behind feature flag.
- RFI from markup with snapshot: scaffolded; backend workflow remains.
- Review session invite: scaffolded; real-time collaboration remains.
- Annotated PDF export: scaffolded; backend PDF export job remains.
- Markups List report: implemented at CSV/export scaffold level.
- Permissioned/audit logged actions: schema and static audit concepts exist; backend enforcement remains.
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
