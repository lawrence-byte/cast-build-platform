# CAST Submittal Access Control Spec

## Table: ProjectAccess

Fields: id, project_id, user_id, contact_id, role, status, granted_by_user_id, granted_at, last_accessed_at, created_at, updated_at.

Statuses: Invited, Active, Suspended, Removed.

## Grant rules

- Invited email login creates or updates ProjectAccess.
- Distributed submittal recipient login grants Submittal Viewer unless a higher role exists.
- Submitter grants Submittal Submitter.
- Reviewer grants Submittal Reviewer.
- Submittal Manager grants Submittal Manager.
- Admins can upgrade, suspend, remove, or revoke access.
- System must never downgrade an existing higher role automatically.

## Private submittals

Private submittals require explicit permission. Distribution-match auto grants must pause for approval if the submittal is private.

## Audit requirements

Audit access grants, revocations, distribution actions, link changes, login-based contact creation, and private-submittal access decisions.
