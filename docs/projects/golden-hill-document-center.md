# Alüm Document Center

Created from Lawrence's CAST BUILD A.O drawing log export: `CD SET - Current Drawings`.

## Files

- `public/projects/golden-hill-documents.html` — document center UI
- `public/projects/golden-hill-documents.css` — document center styling
- `public/projects/golden-hill-documents.js` — local JSON rendering/filtering
- `data/projects/golden-hill/drawing-register.json` — parsed drawing register
- `data/projects/golden-hill/source-logs/current_drawings.pdf` — source PDF
- `data/projects/golden-hill/source-logs/current_drawings.txt` — extracted text

## Parsed drawing register

- Total current drawing sheets parsed: 457
- Disciplines tracked: General, Civil, Landscape, Architectural, Interior, Structural, Mechanical, Plumbing, Electrical, Shoring, SDGE, Survey, Fire Alarm, Telecommunications.
- Source/set categories include ASI, RFI, SSI, Construction Change, Right-of-Way, Fire Alarm, Two-Way Comms, Shoring, Utilities, SDGE, and baseline/other.

## Intended workflow

1. Import document logs from CAST BUILD A.O exports or read-only API.
2. Normalize each record by project slug, discipline, document number, revision, date, source set, and status.
3. Cross-link drawings to RFIs, submittals, ASIs/SSIs, change events, and closeout items.
4. Keep CAST BUILD A.O as source of truth until an approved write-back workflow exists.


## Full Data Room

The Alüm Dropbox intake is now indexed 100% by the numbered project controls folders. See `public/projects/alum-data-room.html` and `data/projects/golden-hill/alum-data-room-index.json`.
