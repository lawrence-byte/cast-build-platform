# CAST RFI Workflows

## Create draft

Project Engineer/Subcontractor enters subject and question, optionally adds references, attachments, assignees, and distribution. Status remains Draft. No due date required.

## Create/open RFI

Open RFI requires number, subject, question, at least one assignee, and due date. System assigns ball in court to assignees and creates notifications.

## Response flow

Assignee submits a response. RFI Manager reviews responses and marks one official. Other submitted responses become superseded when appropriate. System notifies creator, assignees, and distribution.

## Completion flow

Authorized user closes RFI. Open RFIs become Closed; Draft RFIs become Closed Draft. Ordinary edits to question/official response are locked. Reopen restores Draft/Open. Revise marks previous RFI Closed Revised and creates new revision with same root number and incremented revision.

## Export/report flow

Users filter log/report views and export CSV. PDF export is scaffolded for future backend/browser rendering.
