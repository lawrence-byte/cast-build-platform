# CAST Build Deployment Readiness

## Current status

The static CAST Build prototype is ready locally and can be deployed as a Vercel preview once Lawrence confirms the privacy posture.

## Local URLs

- Global document tools: `http://localhost:4173/document-tools`
- Alüm document intelligence: `http://localhost:4173/projects/alum-document-intelligence`
- Alüm documents: `http://localhost:4173/projects/golden-hill-documents`
- Alüm data room: `http://localhost:4173/projects/alum-data-room`

## Vercel state checked

- Vercel CLI installed: `52.0.0`
- Authenticated user: `lawrence-2809`
- Available/current team: `cast-community`
- Project is not yet linked to a Vercel project in `.vercel/`
- Repo has no git remote configured yet

## Privacy blocker before external deployment

`public/` currently contains private project/source artifacts, including:

- `public/data/projects/golden-hill/source-logs/current_drawings.pdf`
- `public/data/projects/golden-hill/source-logs/submittal_logs.xlsx`
- `public/data/projects/golden-hill/source-logs/rfi_list.csv`
- budget revision CSVs and project metadata

A Vercel preview URL is publicly reachable by anyone with the link unless access protection is configured. Do not deploy externally until one of these is true:

1. Vercel project access protection / SSO / password protection is enabled, or
2. private source files are removed from `public/` and replaced with metadata-only summaries, or
3. Lawrence explicitly approves a link-access preview despite the exposure risk.

## Recommended deployment path

1. Keep local preview for now.
2. Add auth/access protection or strip source files from public bundle.
3. Link project to Vercel team `cast-community`.
4. Deploy a preview, not production.
5. Only promote to production after auth and tenant/data boundaries are implemented.
