# Construction Schedule Intelligence

## Purpose

CAST Build should not become another system the superintendent hates using. The schedule platform should accept natural field updates, structure them, detect schedule drift, and prepare professional recovery-plan pressure on the right trade.

Example field update:

```text
Framing on level 2 at 90 percent.
Electrical rough-in level 1 blocked by RFI 14.
Drywall level 3 behind and needs recovery manpower.
```

## Core loop

1. Superintendent talks or types a natural update.
2. CAST Build extracts trade, location, percent complete, contractor, and blockers.
3. The schedule brain compares updates against lookahead commitments and known constraints.
4. Behind-plan or blocked work becomes a delinquency watch item.
5. CAST Build drafts recovery-plan correspondence.
6. A human verifies recipient/context before anything external is sent.

## Guardrails

- Draft-only correspondence until explicit approval gates and verified recipients exist.
- No automatic admission of contract time/cost changes.
- No source-system write-back without approval.
- Field updates are planning signals until verified against the approved project schedule.
- Keep this construction-only; do not mix development underwriting or owner acquisition analysis into CAST Build.

## Next build steps

- Add real speech-to-text service or mobile voice-note ingestion.
- Add schedule baseline/import model.
- Add trade/company directory and verified recipient mapping.
- Add correspondence log with approval trail.
- Add recovery-plan response parser.
- Tie constraints to RFIs, submittals, inspections, materials, and manpower commitments.


## Private source folder

The Alüm Schedule Brain is designed to index the private Dropbox schedule folder through the `ALUM_SCHEDULE_SOURCE_DIR` environment variable. The platform should publish only sanitized schedule metadata: source status, artifact counts, safe titles, update timestamps, and next actions.

Do not publish raw schedule files, private local paths, Dropbox paths, PDFs, spreadsheets, XML/XER/MPP files, or correspondence artifacts in `public/` or `dist/`.

Refresh command on a machine that can access the private folder:

```bash
ALUM_SCHEDULE_SOURCE_DIR="<private Alüm schedule folder>" npm run intake:schedule
```
