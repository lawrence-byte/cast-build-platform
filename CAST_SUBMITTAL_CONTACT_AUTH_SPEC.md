# CAST Submittal Contact + Authentication Spec

## Authentication options

MVP:

- Email magic link
- Google OAuth if already available
- Microsoft OAuth if already available

Future:

- Password based login
- SAML SSO

## Table: AccessInvitations

Fields: id, project_id, entity_type, entity_id, email, invited_by_user_id, invitation_type, access_role, token_hash, expires_at, accepted_at, status, created_at, updated_at.

Invitation types: Submittal Distribution, Project Team Invite, Reviewer Invite, Submitter Invite, Read Only Invite.

Statuses: Pending, Accepted, Expired, Revoked.

Roles: Project Viewer, Submittal Viewer, Submittal Submitter, Submittal Reviewer, Submittal Manager, Project Engineer, Admin.

## Table: Contacts

Fields: id, project_id, user_id, email, name, first_name, last_name, company_id, company_name, phone, title, source, last_seen_at, created_at, updated_at.

Sources: User Login, Email Distribution, Manual Entry, Imported CSV, OAuth Profile, Project Invite.

## Table: UserProfiles

Fields: id, user_id, primary_email, name, first_name, last_name, avatar_url, phone, title, company_id, company_name, oauth_provider, oauth_subject, last_login_at, created_at, updated_at.

## Rules

- No Submittal Detail Page can be accessed without authentication.
- Public email links route to a secure access page.
- After login, redirect to the originally requested submittal.
- If the user lacks permission, show access denied and allow request access.
- If recipient email matches a distribution record, grant appropriate project submittal access unless private submittal approval is required.
- Use email as the primary matching key.
- Do not create duplicate contacts for the same project/email.
- Do not overwrite manually verified company data without confirmation.
- Infer company from domain only as unverified.
