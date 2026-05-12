# CAST BUILD A.O Read-First Workflow Model

This model turns CAST BUILD A.O exports and authorized read-only views into CAST Build platform coverage without enabling live write-back.

## Guardrails

- Source of truth remains CAST BUILD A.O or the approved Alüm export folder.
- CAST Build may index exports, normalize metadata, and create local planning/review scenarios.
- No authentication changes, live API mutations, external sends, billing changes, approvals, or source-file edits are enabled here.
- Any future write-back must start as a draft packet with human approval, audit fields, and rollback instructions.

## Workflow coverage matrix

| Workflow | Read sources | CAST Build normalized records | Review actions allowed now | Future gated write-back |
| --- | --- | --- | --- | --- |
| RFIs | RFI log/export, linked drawings/specs, responsible company | `rfi`, `rfiQuestion`, `officialResponse`, `rfiRevision`, `rfiAttachment` | Search, aging, status rollups, draft question/response summaries | Create draft RFI or response only after explicit approval |
| Submittals | Submittal log/export, packages, spec sections, review steps | `submittal`, `submittalPackage`, `reviewStep`, `submittalResponse` | Review aging, package completeness, missing spec linkage, draft reviewer nudges | Create draft package/revision only after explicit approval |
| Drawings/specifications | Drawing log, current drawing set, spec index | `drawing`, `drawingRevision`, `specSection`, `documentReference` | Current-set checks, superseded-sheet warnings, linked item context | None until document-control write policy exists |
| Budget/forecast | Budget detail export, forecast export, accounting tie-out | `budgetCode`, `commitment`, `changeExposure`, `forecastPeriod`, `invoiceTie` | Variance review, scenario planning, owner-report rollups | No budget mutation; future draft change narrative only |
| Change events/orders | Change event exports, PCO/CO registers, budget-change screenshots | `changeEvent`, `potentialChangeOrder`, `changeOrder`, `costImpact` | Exposure queue, missing backup checks, approval-status rollups | Draft change summary only after explicit approval |
| Daily logs/field | Daily logs, observations, inspections, punch, photos | `dailyLog`, `fieldObservation`, `inspection`, `punchItem`, `fieldMedia` | Field report rollups, unresolved issue lists, photo/context packets | Draft follow-up only; no external send |
| Meetings/actions | Meeting minutes, agenda items, open action exports | `meeting`, `agendaItem`, `decision`, `actionItem` | Meeting prep packets, due-action summaries, decision log | Draft agenda/minutes only after explicit approval |
| Closeout | Closeout register, warranty/O&M/training docs | `closeoutItem`, `warranty`, `omManual`, `trainingRecord` | Completeness checks, owner-turnover packet status | None until closeout acceptance policy exists |

## Minimum normalized fields

Every imported workflow record should carry:

- `projectId`
- `sourceSystem`
- `sourceRecordId` or stable export row key
- `sourceExportedAt`
- `sourceViewName`
- `recordType`
- `status`
- `responsibleCompany`
- `responsiblePerson`
- `dueDate`
- `lastActivityAt`
- `linkedRecords`
- `sourceWritebackEnabled: false`
- `reviewOnly: true`

## Audit checkpoints

1. Import counts reconcile to the export/register count before a page claims coverage.
2. Public pages show normalized summaries only, not private source paths or raw files.
3. Draft automation must label itself as draft, require human approval, and avoid external send/write-back.
4. Workflows with cost, schedule, or contract impact must include source timestamp and confidence notes.
5. Build/static tests should protect the read-first wording and workflow coverage signals.
