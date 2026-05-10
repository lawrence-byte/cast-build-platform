# CAST Server Intelligent Filing Matrix

Purpose: when a document is dropped into the CAST input upload, the platform should classify it, suggest the correct CAST Server folder, link it to the right project control record, and flag uncertain/high-risk items for human review.

## Filing logic

1. Read filename, extension, uploader context, selected project, selected module, OCR/text snippet, and any source folder hints.
2. Match against the matrix below using keywords, document numbers, spec sections, companies, cost values, dates, and record references.
3. Suggest a CAST Server route and normalized filename.
4. Link to matching RFI/submittal/commitment/change/inspection/punch/safety records when detected.
5. Require human review when confidence is low, the document implies cost/schedule/legal/safety impact, or the target record is missing.
6. File only after confirmation; keep audit history, original file, processed text, metadata, version history, and linked-record evidence.

## Matrix

| CAST Server Folder | Upload intelligence signals | Link to records | Suggested filing route | Human review trigger |
|---|---|---|---|---|
| 08. RFI's | RFI, request for information, clarification, architect/engineer response, RFI number | RFI number, subject, BIC, spec section, drawing sheet | `CAST Server / Alüm / 08. RFI's` | Missing RFI number, status conflict, change/ASI language |
| 09. SUBMITTALS | Submittal, shop drawing, product data, sample, approved as noted, revise/resubmit | Submittal number, package number, spec section, contractor | `CAST Server / Alüm / 09. SUBMITTALS / {spec section}` | Missing spec section, status conflict, procurement issue |
| 10. COMMITMENTS | Commitment, subcontract, PO, scope, executed agreement | Commitment number, company, cost code, amount | `CAST Server / Alüm / 10. COMMITMENTS / {company}` | Unsigned contract, missing company, payment/change content |
| 16. ACCOUNTING | Invoice, pay app, G702/G703, retainage, lien waiver, statement | Vendor, invoice/pay app number, commitment, amount | `CAST Server / Alüm / 16. ACCOUNTING / {accounting type}` | Duplicate invoice, unmatched vendor, missing amount, waiver mismatch |
| 18. PERMITS | Permit, inspection card, city/county approval, jurisdiction | Permit number, jurisdiction, date, discipline | `CAST Server / Alüm / 18. PERMITS / {permit type}` | Missing/expired permit, failed inspection reference |
| 19. QUALITY CONTROL | QC, deficiency, nonconformance, test report, observation, inspection report | QC item, inspection, spec, location, trade | `CAST Server / Alüm / 19. QUALITY CONTROL / {trade or spec}` | Failed tests, open deficiencies, punch/safety follow-up needed |
| 20. INSPECTIONS | Inspection, inspector, passed, failed, correction notice, reinspect | Inspection type, date, location, inspector, trade | `CAST Server / Alüm / 20. INSPECTIONS / {discipline}` | Failed/reinspect result, missing location, corrective action |
| 21. SAFETY | Safety, incident, near miss, toolbox talk, OSHA, hazard, injury | Incident, date, location, company, corrective action | `CAST Server / Alüm / 21. SAFETY / {safety type}` | Any incident/injury/OSHA language; open corrective action |
| 22. PUNCHLIST | Punch, defect, incomplete work, closeout item, correction complete | Punch item, unit/area, trade, status | `CAST Server / Alüm / 22. PUNCHLIST / {area or unit}` | Missing closeout evidence or quality/safety-critical issue |
| 23. CLOSEOUT | Closeout, warranty, O&M, manual, as-built, record drawing, attic stock | Spec section, submittal, warranty, contractor | `CAST Server / Alüm / 23. CLOSEOUT / {closeout type}` | Missing warranty/O&M category; record drawing dual-file needed |
| 24. CORRESPONDENCE | Email, letter, transmittal, notice, memo | Sender, recipient, topic, related control item | `CAST Server / Alüm / 24. CORRESPONDENCE / {party or topic}` | Cost, schedule, claim, notice, or direction language |

## Confidence thresholds

- **Auto-suggest only:** confidence below 70%; hold in intake queue.
- **Suggest + prefill:** 70–89%; user confirms folder, filename, and linked record.
- **Ready to file:** 90%+ with a matching control record and no high-risk triggers.
- **Always review:** safety incidents, legal/claim notices, contracts, payment releases, failed inspections, failed tests, or anything with cost/schedule impact.

## Current implementation hook

- Matrix module: `api/_lib/cast-server-filing-matrix.js`
- Intake classifier: `api/_lib/document-classification.js`
- CAST Server routes: `api/cast-server/open-folder.js`, `open-file.js`, `add-file.js`
- UI: `/projects/alum-folder-registers.html` now branded as **CAST Server**
