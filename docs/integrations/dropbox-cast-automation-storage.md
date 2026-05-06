# Dropbox — CAST Automation Storage

Approved shared folder link:

<https://www.dropbox.com/scl/fo/kkjixjyb4nc5sacfq7gwv/AOt0NM09D4VbDc_F8cb802E?rlkey=571qvd76rehr706qjzni0h87w&dl=0>

## Scope

This folder is approved by Lawrence as the future CAST Automation Storage intake folder.

Allowed project scope:

- **Alüm** — formerly Golden Hill Apartments

## Access setup

- Dropbox skill installed: `membranedev/application-skills@dropbox`
- OpenClaw sees the `dropbox` skill.
- Membrane/Dropbox API auth is **not logged in yet**. API listing/copy/move actions require Membrane login and Dropbox connection approval.
- Shared-link web access is recorded as the current intake boundary.

## Downloaded / indexed contents

The approved shared folder resolves to a ZIP named `CAST Build Management Platform.zip` and has been downloaded into the repo intake archive.

- Local archive: `data/integrations/dropbox-cast-automation-storage/downloads/CAST Build Management Platform.zip`
- Local extraction: `data/projects/golden-hill/dropbox-intake/extracted/Alüm`
- Manifest: `data/projects/golden-hill/dropbox-intake/manifests/dropbox-intake-manifest.json`
- Summary: `data/projects/golden-hill/dropbox-intake/manifests/dropbox-intake-summary.md`

Confirmed contents:

- 303 RFI rows from `RFIs/rfi_list.csv`
- 525 submittal rows from `Submittals/submittal_logs.xlsx`
- 458 drawing-log rows from `Current Drawings/Drawing Log.csv`
- 459 drawing PDFs in the current drawings folder

Keep the CSV/XLSX logs authoritative for register counts.

## Alüm full data-room expansion

After Lawrence added the full Alüm project folder structure, the shared-folder archive was refreshed and re-indexed.

- Latest archive size: approximately 1.1 GB
- Latest extraction: `data/projects/golden-hill/dropbox-intake/extracted-20260506-050901/Alüm`
- Full data-room manifest: `data/projects/golden-hill/alum-data-room-index.json`
- Public metadata mirror: `public/data/projects/golden-hill/alum-data-room-index.json`
- Platform page: `public/projects/alum-data-room.html`
- Total indexed Alüm files: 4,674
- Numbered / mapped sections: 27

This is still a metadata/control index. Source documents remain in the approved private Dropbox/intake boundary and no Dropbox write actions are enabled.

## CAST BUILD A.O Information sync lane

Lawrence created a `CAST BUILD A.O Information` folder/workflow for pulling CAST BUILD A.O exports into the project file system. Current local platform ingestion is read-only from exported files.

Current budget export ingested:

- Raw CSV: `data/projects/golden-hill/procore-information/budget/budget_details_2.csv`
- Baseline label: Current Budget
- Archived source log: `data/projects/golden-hill/source-logs/procore-information/budget_details_2.csv`
- Summary JSON: `data/projects/golden-hill/procore-information/budget/budget-summary.json`
- Public metadata mirror: `public/data/projects/golden-hill/procore-information/budget/budget-summary.json`
- Platform page: `public/projects/alum-budget.html`

Budget export summary:

- 111 active budget rows
- Revised Budget: $37,408,095.60
- Estimated Cost at Completion: $37,481,840.48
- Projected Over/Under: -$73,744.88
- Owner Invoiced Cost to Date: $23,589,625.15

Guardrail: this is import/index only; no CAST BUILD A.O write-back, budget edits, or live API mutations are enabled.

## Budget Changes screenshot register

A CAST BUILD A.O Budget Changes screenshot was OCR'd into a structured approved budget-change register.

- JSON: `data/projects/golden-hill/procore-information/budget-changes/budget-changes-from-screenshot.json`
- CSV: `data/projects/golden-hill/procore-information/budget-changes/budget-changes-from-screenshot.csv`
- Page: `public/projects/alum-budget-changes.html`

Current register: 24 visible approved budget changes; 12 have inferred budget-code ties. All visible budget change estimates show `$0.00`, which appears consistent with internal budget reallocations/transfers. Exact source/target line amounts require a detailed CAST BUILD A.O budget-change export rather than screenshot OCR.

## Budget Forecast Export

The CAST BUILD A.O budget forecast export has been ingested as the cash-flow / cost-to-complete layer tied to the same budget codes as the current budget baseline.

- Raw CSV: `data/projects/golden-hill/procore-information/budget-forecast/budget_details_forecast.csv`
- Archived source log: `data/projects/golden-hill/source-logs/procore-information/budget_details_forecast.csv`
- Summary JSON: `data/projects/golden-hill/procore-information/budget-forecast/forecast-summary.json`
- Public metadata mirror: `public/data/projects/golden-hill/procore-information/budget-forecast/forecast-summary.json`
- Platform page: `public/projects/alum-budget-forecast.html`
- Regenerate with: `npm run intake:forecast`

Forecast covers monthly columns from May 2026 through March 2027 and remains read-only; no CAST BUILD A.O write-back is enabled.

## Budget Modification Platform

A read-first budget modification / scenario platform has been added and tied to the current CAST BUILD A.O budget export.

- Page: `public/projects/alum-budget-modifications.html`
- Baseline: `data/projects/golden-hill/procore-information/budget/budget-summary.json`
- Seed register: `data/projects/golden-hill/procore-information/budget-modifications/modifications.json`

Behavior:

- Select an existing CAST BUILD A.O budget code.
- Add proposed delta/modification amount, type, status, reference, title, and notes.
- See scenario EAC and projected over/under impact.
- Store scenario edits locally in the browser until exported/promoted.
- No CAST BUILD A.O write-back or budget mutation is enabled.

## Authoritative local CAST BUILD A.O Data Tie path

Lawrence identified the local Dropbox sync path for the CAST BUILD A.O export sync lane as:

```text
/Users/lawrencehoward/CAST Community Dropbox/CAST Automation/CAST Build Management Platform/Alüm/00_PROCORE DATA TIE
```

This maps to the Alüm `00_PROCORE DATA TIE` folder inside CAST Automation / CAST Build Management Platform. Treat it as the authoritative read-only local source for CAST BUILD A.O exports when available on the current host.

Current host note: this OpenClaw runtime is running under `/Users/broderick`; `/Users/lawrencehoward/...` is not mounted/visible here right now. A repeatable index command has been added:

```bash
npm run intake:procore-data-tie
```

If the path is mounted later, that command will index all files into:

- `data/projects/golden-hill/procore-information/procore-data-tie-index.json`
- `public/data/projects/golden-hill/procore-information/procore-data-tie-index.json`

You can also override the source path with `PROCORE_DATA_TIE_PATH=/path/to/00_PROCORE DATA TIE npm run intake:procore-data-tie`.

## Claude Projects folder

Lawrence reported on 2026-05-06 that all Claude projects were added to this same Dropbox folder. Treat this as approved only within the existing CAST Automation Storage shared-folder boundary.

Current indexing note: the latest checked downloadable ZIP still matched the previously indexed archive size and the extracted manifest currently shows only Alüm Current Drawings, RFIs, and Submittals. Re-check/re-download the shared-folder archive before indexing Claude project contents.

## Guardrails

1. Only access files reachable from the approved shared folder link, or a local sync path Lawrence explicitly confirms maps to this same folder.
2. Do not list, search, or browse other Dropbox folders.
3. Do not perform account-wide Dropbox searches.
4. Do not create/revoke links, upload, move, rename, delete, or change permissions without explicit approval.
5. Preserve source filenames when importing into the platform.
6. Store processed artifacts under the matching project folder in this repo.

## Next auth step, only if needed

If API access is needed later, use Membrane login and Dropbox connection. Do not ask Lawrence for raw Dropbox tokens.
