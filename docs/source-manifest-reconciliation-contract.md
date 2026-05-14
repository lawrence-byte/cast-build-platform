# Source Manifest + Reconciliation Contract

CAST Build imports are read-first control records. Every generated register, dashboard, and review queue must be able to explain where it came from, when it was exported, how many rows were expected, and whether it is safe to treat the normalized output as complete.

## Contract status

- `sourceWritebackEnabled: false`
- `reviewOnly: true`
- Applies to Alüm / Golden Hill read-first imports first.
- No source-system write-back, approval, external send, source-file edit, credential change, or production mutation is enabled by this contract.

## Required source manifest fields

Every import job should emit a source manifest next to the normalized output with these fields:

| Field | Purpose |
| --- | --- |
| `projectId` | Stable CAST Build project identifier, e.g. `golden-hill`. |
| `sourceSystem` | Origin system, e.g. `procore`, `dropbox`, `accounting-export`, `manual-register`. |
| `sourceViewName` | Human-readable source view/export name. |
| `sourceStableKey` | Stable source key: API id, export filename + sheet, or approved folder-relative path. |
| `sourceExportedAt` | Timestamp from the source export when available. |
| `ingestedAt` | Timestamp when CAST Build indexed the source. |
| `rowCountExpected` | Count from the export/register before normalization. |
| `rowCountNormalized` | Count of normalized records emitted. |
| `rowCountReconciled` | `true` only when expected and normalized counts are intentionally reconciled. |
| `reconciliationStatus` | `pass`, `warning`, `blocked`, or `not-applicable`. |
| `reconciliationNotes` | Short explanation of mismatches, filters, known duplicates, or excluded rows. |
| `sourceWritebackEnabled` | Always `false` unless Lawrence explicitly approves a future write-back pathway. |
| `reviewOnly` | Always `true` for current platform imports. |

## Normalized record linkage

Every normalized record should preserve the source manifest linkage:

- `projectId`
- `sourceSystem`
- `sourceManifestId`
- `sourceStableKey`
- `sourceRecordId` or stable row key
- `sourceExportedAt`
- `normalizedAt`
- `sourceWritebackEnabled: false`
- `reviewOnly: true`

## Validation helper

`api/_lib/source-manifest-contract.js` provides local validation for source manifests and normalized-record linkage. It checks required fields, timestamp/count shape, row-count reconciliation, private/local path leakage in stable keys, and the read-first guardrails (`sourceWritebackEnabled: false`, `reviewOnly: true`). Use it in import scripts before publishing any sanitized metadata or claiming workflow coverage.

## Reconciliation rules

1. A page may say a workflow is covered only after row count reconciliation is recorded.
2. A register may show partial coverage, but it must label missing, filtered, or excluded rows as review items.
3. If `rowCountReconciled` is false, the page should use cautious language such as "indexed sample", "needs review", or "partial import".
4. Raw private source paths, PDFs, spreadsheets, and local machine paths must not appear on public/static-facing pages unless already converted into approved safe metadata.
5. Cost, schedule, contract, or approval-impacting modules must carry `sourceExportedAt` or a clear missing-timestamp warning.
6. Future write-back must be a separate draft packet with human approval, audit fields, rollback notes, and explicit Lawrence authorization.

## Minimum manifest example

```json
{
  "manifestId": "golden-hill-procore-rfis-2026-05-13",
  "projectId": "golden-hill",
  "sourceSystem": "procore",
  "sourceViewName": "RFI Log Export",
  "sourceStableKey": "RFIs/rfi_list.csv",
  "sourceExportedAt": "2026-05-13T00:00:00-07:00",
  "ingestedAt": "2026-05-13T19:30:00-07:00",
  "rowCountExpected": 42,
  "rowCountNormalized": 42,
  "rowCountReconciled": true,
  "reconciliationStatus": "pass",
  "reconciliationNotes": "All exported RFI rows normalized into the review register.",
  "sourceWritebackEnabled": false,
  "reviewOnly": true
}
```
