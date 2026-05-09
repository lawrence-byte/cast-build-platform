# CAST Submittal Log Fix Notes

## Diagnosis

The current CAST Build repo is a static/read-first project-controls scaffold. There is no live backend API, migration directory, Supabase client, server route, or authenticated data-fetching layer in this repo. The Submittal Log at `public/projects/alum-submittals.html` is populated by `public/projects/alum-submittals.js`, which fetches only `/safe-data/projects/golden-hill/submittal-summary.json`.

## Exact cause

Submittals are not guaranteed to match the active server-based submittal register because the UI is reading a generated summary file, not a server register query. The summary contains both exported/log-style records and folder-document metadata:

- `total`: 525 exported/log-style submittals
- `folderDocumentCount`: 799 folder documents indexed
- `sampleItems`: 250 exported/log sample rows
- `folderItems`: 799 folder-derived rows

The current UI prefers `folderItems` when present, so it can show folder documents instead of the active server/source-of-truth register. It also does not model `project_id`, `register_id`, `server_submittal_id`, current revision flags, distribution state, or controlled external links.

## Affected files

- `public/projects/alum-submittals.html`
- `public/projects/alum-submittals.js`
- `public/safe-data/projects/golden-hill/submittal-summary.json`
- `CAST_SUBMITTAL_DATA_DICTIONARY.md`
- `CAST_SUBMITTAL_WORKFLOWS.md`

## Server records found

No server connection or server records were found in this static repo. The only API artifact is `public/api-placeholder.json`.

## Local records found

Local summarized records were found in `submittal-summary.json`:

- 525 exported/log-style submittals
- 799 folder-document records
- Status buckets include Draft, Open, Closed, Void, Revise & Resubmit, Approved/No Exceptions, Approved with Comments/Exceptions Noted, and For Record Only

## Reconciliation logic

The planned server reconciliation flow is:

1. Treat server submittals/registers as source of truth.
2. Match local rows by `server_submittal_id` first.
3. Match remaining records by `project_id + submittal_number + revision_number`.
4. Use fuzzy secondary matching only for manual review: title, spec section, package, responsible company, created/received date.
5. Attach matches to the current active register.
6. Mark unmatched local rows `Local Draft` or `Pending Sync`.
7. Mark conflicting rows `Conflict`.
8. Mark duplicate rows `Duplicate` and route to admin review.
9. Never delete or silently overwrite local comments, attachments, links, AI summaries, workflow history, or distribution history.

## Final fix target

The final production fix requires a backend query equivalent to:

```sql
select *
from submittals
where project_id = :active_project_id
  and register_id = :current_active_register_id
  and (:show_all_revisions or current_revision_flag = true)
  and user_can_view_submittal(:current_user_id, id)
order by submittal_number, revision_number desc;
```

Until a real server/auth layer exists in this repo, the implemented frontend can only expose the required columns/status badges as a read-first scaffold and document the backend contracts.
