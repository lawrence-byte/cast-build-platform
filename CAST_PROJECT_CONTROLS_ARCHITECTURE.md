# CAST Project Controls Platform Architecture

## Current application audit

- **Repository:** `cast-build-platform`
- **Runtime:** static web application served from `public/`, built to `dist/` by `scripts/build-static.js`.
- **Framework:** no SPA framework currently configured. Pages are plain HTML, CSS, and vanilla JavaScript.
- **Package mode:** Node/CommonJS (`package.json` has `"type": "commonjs"`).
- **Database:** no configured database in this repo. Existing production pages use static JSON metadata and browser-local state where needed.
- **Authentication:** no real auth provider in this repo. Existing controls are read-first/static and rely on future integration guardrails.
- **Routing:** file-based static routes under `public/`; project routes live under `public/projects/*.html`.
- **Deployment:** Vercel static deployment. `npm run build` copies `public/` to `dist/` and excludes/scrubs raw/private artifacts.
- **Styling:** CAST shared CSS in `public/cast-build.css`, `public/cast-build-components.css`, plus project-specific CSS.
- **Navigation:** Alüm pages use shared project navigation in `public/projects/alum-project-nav.js`.

## MVP implementation architecture

Because no backend/auth/database exists yet, the RFI MVP is implemented as a **client-side project-controls module** with:

1. Seed data and domain services in `public/projects/cast-project-controls-data.js`.
2. RFI dashboard/log/detail/create UI in `public/projects/cast-rfi-tracker.html` and `.js`.
3. Drawing log scaffold in `public/projects/cast-drawing-log.html` and `.js`.
4. Document register scaffold in `public/projects/cast-document-register.html` and `.js`.
5. Browser `localStorage` persistence for MVP actions.
6. Pure functions exported through CommonJS for unit tests.

## Future backend plan

The current service boundary should map cleanly to a future backend:

- Replace `loadState()` / `saveState()` with API calls.
- Move validation, permissions, numbering, status transitions, audit log, and notification creation server-side.
- Use Postgres tables matching `CAST_RFI_DATA_DICTIONARY.md`.
- Add real auth/tenant isolation before production project records.
- Store attachments in controlled object storage with project-aware permissions.

## Guardrails

- No Procore UI, proprietary code, branding, or protected design copied.
- Uses public construction-management workflow conventions only.
- Current module is MVP/local-data until real auth/database are added.
- AI suggestions are non-official and cannot change records without user action.

## Submittal module extension

The Submittal Tracking MVP extends the same static/local CAST Project Controls architecture as RFI Tracking. Submittal domain functions live in `public/projects/cast-submittal-controls-data.js` and intentionally share the same `localStorage` state with the RFI, drawing, document, user, company, spec, location, audit, and notification structures. This keeps the current MVP cohesive while preserving a future backend seam.

Submittal pages:

- `public/projects/cast-submittal-tracker.html` / `.js` — dashboard, log, create form, detail/actions, reports.
- Future backend tables should map to `CAST_SUBMITTAL_DATA_DICTIONARY.md`.
