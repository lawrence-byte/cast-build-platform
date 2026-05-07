# CAST Build Platform Map

CAST Build website: https://www.cast-bld.com/

## Goal

Create a CAST-controlled construction management platform for Procore / CAST BUILD A.O-style project controls only. CAST Build should stay focused on budgets, commitments, change orders, schedule risk, draws, field controls, documents, and construction-cost forecasting; CAST Development underwriting and acquisition feasibility belong outside this repo. Current structure:

- `public/index.html` — public/site-adjacent landing layer
- `public/admin.html` — internal command center prototype
- `public/projects.html` — project portfolio
- `public/procore.html` — CAST BUILD A.O integration plan
- `public/construction-cost-forecasting.html` — construction-only budget, commitments, change-order, draw, schedule-risk, and EAC scenario workbench
- `public/projects/golden-hill-procore.html` — legacy Golden Hill slug for the Alüm project-management replica overview
- `public/projects/alum-rfis.html` — dedicated Alüm RFI module (metadata-only queue, impacts, responsibility)
- `public/projects/alum-submittals.html` — dedicated Alüm submittal module (metadata-only queue, spec sections, type/status mix)
- `public/projects/alum-change-events.html` — dedicated Alüm change-events module (metadata-only CE buckets and budget-revision tie-out)
- `public/projects/alum-daily-log.html` — Alüm daily-log placeholder until approved field-log metadata exists
- `public/pricing-models.html` — construction cost forecasting sandbox for budget/EAC/draw scenarios only; not a development underwriting model
- `public/projects/overlook-workspace.html` — sample construction-controls shell for future project intake, with no raw/private files
- `src/adapters/procore.ts` — future CAST BUILD A.O/Membrane adapter boundary
- `docs/` — platform documentation and security notes
- `tests/` — static safety checks

## CAST BUILD A.O posture

Read-first. Do not authenticate, write, delete, or modify CAST BUILD A.O data until Lawrence explicitly approves the connection and action scope.

Initial learning scope from memory: Alüm (formerly Golden Hill Apartments) only.

CAST Build is construction-only. Keep acquisition underwriting, rent/NOI projections, entitlement, leasing, and development economics in CAST Development workflows, not this platform.

## Production blockers

- Real authentication and role-based access control
- Tenant/project isolation
- Backend API boundary
- Audit logging
- Secret storage outside git
- CAST BUILD A.O/Membrane connection review
- Security review before deployment
