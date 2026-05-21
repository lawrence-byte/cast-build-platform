# CAST CAD Setup and Usage

## Current MVP route

- Live/static route: `/projects/cast-cad.html`
- Source files:
  - `public/projects/cast-cad.html`
  - `public/projects/cast-cad.js`
  - `public/projects/cast-project-controls-data.js`

## Run locally

```bash
npm test
npm run build
npm run check:public-artifacts
npm run check:third-party-scripts
node --check public/projects/*.js
npm run dev
```

Then open `/projects/cast-cad.html`.

## Current drawing set

CAST CAD reads safe published metadata from:

```text
/safe-data/projects/golden-hill/procore-information/procore-data-tie-index.json
```

This provides current drawing sheet records without publishing raw private PDF files.

## Current MVP usage

1. Sign into the CAST Build platform.
2. Open **Projects → Alüm → CAST CAD**.
3. Select a linked current drawing sheet from the sheet list.
4. Optionally upload a local PDF override for browser-session preview.
5. Choose a markup or takeoff tool.
6. For measurements, enter known length and unit, click **Calibrate scale**, then click two points on the sheet.
7. Add length, area, or count takeoffs.
8. Verify quantities before treating them as budget-authoritative.
9. Export review/takeoff rows to Excel-compatible output.

## Guardrails

- Do not copy Bluebeam proprietary UI, icons, code, names, or trade dress.
- Raw private PDFs must not be placed in `public/` or `dist/`.
- AI findings and AI-derived quantities stay **AI detected / Needs Review** until human verified.
- New third-party scripts require approval in `docs/third-party-scripts.json`.

## Next backend step

Add authenticated PDF streaming for current drawing files through a server endpoint, using signed URLs or CAST server file proxying, then connect that endpoint to the CAST CAD viewer.
