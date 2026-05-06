# Alüm Log Ingestion

Source files from Lawrence, exported from CAST BUILD A.O on/around 2026-05-05:

- `rfi_list.csv`
- `rfi_list.pdf`
- `submittal_logs.pdf`
- `submittal_logs.xlsx`

## Parsed local summaries

- RFI rows parsed: 303
  - Closed: 279
  - Closed - Revised: 14
  - Closed - Draft: 3
  - Draft: 4
  - Open: 3
  - Open/Draft used for dashboard: 7
- Submittal rows parsed from XLSX: 525
  - Approved/No Exceptions: 75
  - Approved with Comments/Exceptions Noted: 70
  - Draft: 60
  - Open: 6
  - Revise & Resubmit: 43
  - Void: 247
  - Closed: 21
  - For Record Only: 3
  - Open/Draft used for dashboard: 66

## Dashboard recreation

Created CAST BUILD A.O-style overview page:

- `public/projects/golden-hill-procore.html`
- `public/projects/golden-hill-procore.css`
- `public/projects/golden-hill-procore.js`

The page intentionally uses local exported data, not live CAST BUILD A.O API access.
