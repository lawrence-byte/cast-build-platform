# CAST RFI Log Fix Notes

## Diagnosis

The current CAST Build repo is a static/read-first project-controls scaffold. There is no live backend API, migration directory, Supabase client, authenticated data-fetching layer, or server-side RFI register query in this repo.

The RFI Log page at `public/projects/alum-rfis.html` is populated by `public/projects/alum-rfis.js`, which fetches `/safe-data/projects/golden-hill/rfi-summary.json`.

## Exact cause

RFIs are not guaranteed to appear as the active current RFI Log because the page reads generated local summary metadata instead of querying a project-scoped active RFI register.

Current local metadata includes:

| Source | Count / Detail |
|---|---:|
| Exported/log-style total | 303 |
| Folder RFI PDFs indexed | 255 |
| Open RFIs | 7 |
| Draft RFIs | 4 |
| Closed RFIs | 296 |
| Recent sample rows | 8 |
| Folder-derived rows | 255 |

The prior UI defaulted to an action queue (`openItems` or folder/recent fallbacks) and displayed only a small operational subset. That means closed, revised, responded, void, issued-link, responded-link, and Dropbox/reference-link records may not appear in the main table unless the metadata happened to include them in the selected sample array.

## Checks requested

| Check | Finding |
|---|---|
| Incorrect `project_id` | Cannot verify in static repo; summary JSON has no server `project_id` relationship. |
| Missing `current_log_id` / `register_id` | Confirmed as a data-model gap. RFI register relationship is not represented in the static page data. |
| Incorrect active RFI Log filtering | Confirmed at UI level: page is an action queue, not a current-register query. |
| Only drafts/closed/seeded shown | The previous queue used `openItems` first and did not expose all current-register rows. |
| Revision hiding/root logic | `root_rfi_id`, `previous_revision_id`, and `current_revision_flag` are not modeled in the static summary. |
| Issued/responded RFIs stored separately | Not modeled in current summary; needs `issued_rfi_link_id` and `responded_rfi_link_id`. |
| Private RFI permission exclusion | Cannot enforce in static page; must be handled by authenticated backend query. |
| Frontend not refreshing after creation | No create/write flow exists in this static repo. |
| Backend returns RFIs but UI fails | No backend route exists in this repo. |
| Pagination/default filters hiding RFIs | Confirmed risk: action queue/filter UI can hide current-register RFIs. Added visible filter warning/reset behavior. |

## Fix implemented in this scaffold

Because this repo has no live server/auth layer, the immediate fix is a safe scaffold update:

1. Document the required `RFIRegisters` and RFI relationship fields.
2. Document the required authenticated current-register query.
3. Update the public RFI Log table to show a broader log-style row set instead of only open queue rows.
4. Add visible columns for Issued RFI Link, Responded RFI Link, last distribution timestamps, distribution status, recipient count, private flag, and sync/register status placeholders.
5. Add filters for issued/responded link presence, distributed/not distributed, response distributed/not distributed, and revision visibility.
6. Add `Filtered View Active` warning and reset filters button.

## Required production fix

The production RFI Log query must be implemented server-side as:

```sql
select *
from rfis
where project_id = :active_project_id
  and register_id = :current_active_rfi_register_id
  and (:show_all_revisions or current_revision_flag = true)
  and user_can_view_rfi(:current_user_id, id)
order by rfi_number, revision_number desc;
```

The returned rows must include current and closed records unless the user intentionally filters them out.

## Affected files

- `public/projects/alum-rfis.html`
- `public/projects/alum-rfis.js`
- `public/safe-data/projects/golden-hill/rfi-summary.json`
- `CAST_RFI_DATA_DICTIONARY.md`
- `CAST_RFI_WORKFLOWS.md`
- `CAST_RFI_EXTERNAL_LINKS_SPEC.md`
- `CAST_RFI_EMAIL_DISTRIBUTION_SPEC.md`
- `CAST_RFI_CONTACT_AUTH_SPEC.md`
- `CAST_RFI_ACCESS_CONTROL_SPEC.md`
- `CAST_PROJECT_ACCESS_SPEC.md`
