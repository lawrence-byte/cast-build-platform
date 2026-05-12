# CAST BUILD A.O Integration Plan

## Phase 1 — Discovery

- Confirm CAST BUILD A.O account/company/project access.
- Identify tools enabled for Alüm.
- List available actions/endpoints through Membrane or CAST BUILD A.O API docs.
- Build a permissions matrix: read/write/admin by object.

## Phase 2 — Read-only data model

Map:

- Projects
- Users/roles/companies/vendors
- RFIs
- Submittals/submittal packages
- Drawings/specifications/documents
- Commitments/change events/change orders
- Budget/direct costs/invoices/payment applications
- Daily logs/photos/observations/punch list
- Meeting actions, closeout items, schedule/milestones

Normalize every workflow record with `projectId`, source system, stable source row/id, source export timestamp, status, responsible company/person, due date, last activity, linked records, `sourceWritebackEnabled: false`, and `reviewOnly: true`.

Detailed workflow coverage lives in [`procore-workflow-read-model.md`](./procore-workflow-read-model.md).

## Phase 3 — CAST Build views

- Executive dashboard
- Project health summary
- Risk register
- Overdue action queue
- Budget exposure dashboard
- Schedule drift dashboard
- Meeting prep packet
- Weekly owner/GC report

## Phase 4 — Controlled automation

Only after human approval:

- Draft report generation
- Reminder drafts
- RFI/submittal summary drafts
- Document index updates
- Meeting note conversion

No direct CAST BUILD A.O write-back until explicitly approved.
