# CAST Build Platform Map

CAST Build website: https://www.cast-bld.com/

## Goal

Create a CAST-controlled construction management platform similar in structure to the Broderick Application Platform:

- `public/index.html` — public/site-adjacent landing layer
- `public/admin.html` — internal command center prototype
- `public/projects.html` — project portfolio
- `public/procore.html` — CAST BUILD A.O integration plan
- `src/adapters/procore.ts` — future CAST BUILD A.O/Membrane adapter boundary
- `docs/` — platform documentation and security notes
- `tests/` — static safety checks

## CAST BUILD A.O posture

Read-first. Do not authenticate, write, delete, or modify CAST BUILD A.O data until Lawrence explicitly approves the connection and action scope.

Initial learning scope from memory: Alüm (formerly Golden Hill Apartments) only.

## Production blockers

- Real authentication and role-based access control
- Tenant/project isolation
- Backend API boundary
- Audit logging
- Secret storage outside git
- CAST BUILD A.O/Membrane connection review
- Security review before deployment
