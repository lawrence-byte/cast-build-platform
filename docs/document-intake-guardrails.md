# Document Intake Guardrails

## Purpose

This file defines the boundary for CAST Build document intake. It exists so Jamas only processes files Lawrence intentionally places in a dedicated project intake folder.

## Allowed intake root

**Status:** approved shared Dropbox folder link for CAST Automation Storage.

```text
https://www.dropbox.com/scl/fo/kkjixjyb4nc5sacfq7gwv/AOt0NM09D4VbDc_F8cb802E?rlkey=571qvd76rehr706qjzni0h87w&dl=0
```

If Lawrence later provides a local Dropbox sync path, it must explicitly map to this same shared folder before use.

## Rules

1. Only list, read, parse, OCR, index, summarize, or import documents inside the approved intake root.
2. Do not browse other Dropbox folders.
3. Do not use recursive search starting from `~/Dropbox`, `~/Library/CloudStorage`, home directory, Desktop, or Documents to find project files.
4. If a file is referenced outside the approved intake root, ask Lawrence before accessing it.
5. Do not move, delete, rename, upload, share, or modify source documents without explicit approval.
6. Copy imported/processed artifacts into the CAST Build platform under the relevant project folder, preserving source filenames where practical.
7. Treat Dropbox documents as private CAST Build / project information.
8. Do not commit secrets, credentials, private tokens, or unrelated personal/company files.

## Current approved contents

Lawrence confirmed the approved Dropbox folder contains the Alüm drawings, RFIs, and submittals. The shared folder was downloaded as:

```text
data/integrations/dropbox-cast-automation-storage/downloads/CAST Build Management Platform.zip
```

Local read-only extraction path:

```text
data/projects/golden-hill/dropbox-intake/extracted/Alüm
```

Manifest files:

```text
data/projects/golden-hill/dropbox-intake/manifests/dropbox-intake-manifest.json
data/projects/golden-hill/dropbox-intake/manifests/dropbox-intake-summary.md
```

Observed contents:

- RFI source files: `RFIs/rfi_list.csv`, `RFIs/rfi_list.pdf`
- Submittal source files: `Submittals/submittal_logs.xlsx`, `Submittals/submittal_logs.pdf`
- Drawing source register: `Current Drawings/Drawing Log.csv`
- Drawing PDFs: 459 files across discipline folders
- Drawing log rows: 458 authoritative rows

The one-file difference is expected for now: the Dropbox folder includes one root-level drawing PDF in `Current Drawings/` outside the discipline subfolders. Keep `Drawing Log.csv` authoritative for register rows until manually reconciled.

## Current approved projects

- Alüm — formerly Golden Hill Apartments — approved only inside the CAST Automation Storage shared Dropbox folder above.
- Claude Projects — Lawrence reported this folder has been added inside CAST Automation Storage; approved only inside the same shared Dropbox boundary. Re-download/re-index before relying on contents.
- Overlook — not yet approved for Dropbox intake; create a separate folder/link and add it here before processing.

## Implementation note

This is an assistant workflow boundary, not a Dropbox permission boundary. For stronger isolation, the Dropbox folder should contain only files Lawrence wants Jamas to access.
