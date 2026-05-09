# CAST Submittal Server Reconciliation Report

## Current repo status

No live server database connection was found in this repo. Reconciliation could not be executed against actual server records from this static scaffold.

## Local source inspected

`public/safe-data/projects/golden-hill/submittal-summary.json`

| Metric | Count |
|---|---:|
| Exported/log-style submittals | 525 |
| Folder document records | 799 |
| Sample exported/log rows | 250 |
| Folder-derived rows | 799 |

## Server source inspected

| Source | Result |
|---|---|
| Server API route | Not present in repo |
| Supabase/client config | Not present in repo |
| Migration/schema folder | Not present in repo |
| API placeholder | `public/api-placeholder.json` only |

## Reconciliation summary

| Category | Count / Status |
|---|---|
| Total server submittals | Blocked — no server connection in repo |
| Total local submittals | 525 log rows / 799 folder records |
| Matched records | Not run |
| Unmatched server records | Not run |
| Unmatched local records | Not run |
| Duplicates found | Not run |
| Conflicts found | Not run |
| Records updated | 0 server records |
| Records requiring manual review | All until server export/API is connected |

## Required next reconciliation run

Run `reconcileSubmittalsWithServer(project_id)` once the real server API/database is available. The report must be regenerated from live server data and include matched/unmatched IDs, confidence, conflict fields, and recommended action.
