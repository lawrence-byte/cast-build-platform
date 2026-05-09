# CAST Drawing Tracker Spec

## Drawing fields

project_id, drawing_number, drawing_title, discipline, current_revision, drawing_date, received_date, set_name, area, status, file_url, created_at, updated_at.

## Revision fields

drawing_id, revision_number, revision_date, revision_description, file_url, uploaded_by, uploaded_at, superseded_flag.

## MVP requirements

- Drawing log page with number, title, discipline, current revision, drawing date, set, area, status, linked RFIs, linked submittals, last updated.
- Link drawings to RFIs.
- Maintain revision history.
- Highlight current revision.
- Flag superseded revisions.
- Prepare data shape for future markup support.
