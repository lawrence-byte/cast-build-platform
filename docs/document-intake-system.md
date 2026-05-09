# CAST Document Intake System

The CAST Document Intake system is the global document-control desk for the platform. A circular CAST logo button appears in the top-right project/admin header for users with document upload permission. The button opens **CAST Document Intake**, where users can drag/drop multiple files, review classification, confirm or override filing recommendations, and queue/submit the file for server filing.

## Current implementation status

This repo is still a static/read-first platform scaffold. The intake UI, classification, review queue, storage-plan API, OCR hook, matching hook, audit/version schema, Dropbox/contact/email fields, and tests are implemented as infrastructure scaffolds. Actual binary storage, persistent database writes, OCR provider calls, and email sending remain blocked until environment/configuration is connected.

## Flow

1. User clicks the global CAST logo button.
2. User drops/selects files.
3. Client classifies files from filename, MIME type, and construction-control keywords.
4. System suggests project, module, document type, folder, and linked records.
5. User confirms or overrides the recommendation.
6. Client posts the confirmed intake metadata to `/api/document-intake`.
7. API validates auth, module, extension, folder, file size, and confirmation.
8. If storage/database are not configured, API fails closed and the client retains the item in a local review queue.
9. Admin uses the review queue in `/admin.html#document-intake-review` to approve, reject, reclassify, move folder, link existing record, or request a new record.

## Classification modules

Documents, Contracts, Financials, Field, Drawings, RFIs, Submittals, Change Orders, Pay Applications, Invoices, Insurance, Permits, Meeting Minutes, Closeout, Uncategorized.

## Environment variables

```env
DOCUMENT_STORAGE_ROOT=
DOCUMENT_PUBLIC_LINK_BASE=
EMAIL_PROVIDER=
EMAIL_FROM_ADDRESS=
OCR_PROVIDER=
OCR_API_KEY=
DROPBOX_ENABLED=
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
CLASSIFICATION_PROVIDER=
CLASSIFICATION_MODEL=
MAX_UPLOAD_SIZE_MB=
DOCUMENT_DATABASE_URL=
```

Legacy aliases currently checked by the API: `CAST_DOCUMENT_STORAGE_ROOT`, `CAST_DOCUMENT_BUCKET`, `CAST_DOCUMENT_DATABASE_URL`.

## Storage abstraction

`api/_lib/document-storage.js` builds project/module/document-type/year object keys and exposes storage config. The shape is intentionally provider-neutral so it can later back S3, Dropbox, Google Drive, SharePoint, Box, or local disk.

## OCR and text extraction

`api/_lib/document-ocr.js` defines the OCR/text extraction interface. Until `OCR_PROVIDER` and credentials are configured, it returns a safe fallback and classification uses metadata plus filename only.

## Matching and duplicate warnings

`api/_lib/document-matching.js` detects likely existing RFIs, Submittals, Drawings, and Contracts from file names/text snippets. The admin queue shows warnings and linked-record suggestions before creating new records, avoiding duplicate RFI/Submittal creation when existing numbers match.

## Admin review queue

The review queue displays file name, uploaded by, project, suggested module/type, confidence, suggested folder, Dropbox link, linked record suggestions, status, upload date, and action buttons for approve/reject/reclassify/move/link/create. It also includes admin-only debug output for classification reasoning.
