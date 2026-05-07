# CAST Build Platform Guardrails

Use this checklist before merging overnight feature branches or creating any preview deployment.

## Route and link sanity

- Every public `href`/`src` should resolve to a file under `public/`, a Vercel rewrite, or an external URL.
- Prefer `.html` links inside static pages unless a clean route is explicitly covered by `vercel.json`.
- Project modules should keep their read-first/no-write posture visible near the top of the page.

## Public artifact boundary

- `public/` and `dist/` must not contain raw source artifacts: PDFs, Excel files, CSVs, ZIPs, `source-logs/`, `dropbox-intake/`, `source-artifacts/`, `raw/`, or `private/` paths.
- Browser pages may link only to sanitized JSON metadata summaries that are intended for preview use.
- Local filesystem paths, Dropbox paths, mounted-volume paths, and source export names stay out of browser-visible text.

## Brand/reference blocklist

- Use CAST Build / CAST BUILD A.O naming in this scaffold.
- Do not reintroduce CAST Capital language or legacy reference branding into public pages, docs, scripts, or tests.

## Validation gate

Run these before merging a feature branch into the integration branch:

```sh
node --check public/projects/*.js
npm test
npm run build
npm test
find public dist -type f \( -iname '*.pdf' -o -iname '*.xlsx' -o -iname '*.xls' -o -iname '*.csv' -o -iname '*.zip' \) -print
```

The first `npm test` catches source issues; the build creates `dist/`; the second `npm test` verifies the deploy bundle did not leak raw/private artifacts or source strings.

## Fast integration checklist

For main/integration merge, keep this lane first or near-first so later feature lanes inherit the guardrails:

1. Merge `overnight/qa-buildout` into the integration branch.
2. Run the validation gate above before merging each feature lane.
3. If a feature lane fails on broken routes, prefer adding the missing static page/rewrite or correcting the link; do not weaken route checks.
4. If a feature lane fails on raw/private artifacts, move raw files out of `public/` and expose only sanitized JSON metadata.
5. If a feature lane legitimately needs a public asset type that is currently blocked, add the narrowest possible exception and document why in this file.

Current expected handoff state: no external deploy yet; metadata-only local/static preview is acceptable after the full validation gate passes.
