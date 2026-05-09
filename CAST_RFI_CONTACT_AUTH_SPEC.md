# CAST RFI Contact + Authentication Spec

## Goal

Recipients must log in before accessing system RFI records, and CAST should not manually maintain duplicate contact records when recipients authenticate.

## Authentication options

MVP:

- Email magic link
- Google OAuth if already available
- Microsoft OAuth if already available

Future:

- Password based login
- SAML SSO

## Tables

RFI access uses the shared tables in `CAST_PROJECT_ACCESS_SPEC.md`:

- AccessInvitations
- Contacts
- UserProfiles
- ProjectAccess

## Rules

1. No RFI Detail Page can be accessed without authentication.
2. Public email links route to a secure access page.
3. If the user is not logged in, prompt them to log in.
4. After login, redirect the user to the RFI they were trying to access.
5. If the user does not have permission, show access denied and allow request access.
6. If recipient email matches an RFI distribution record, automatically grant the appropriate project RFI access level unless the RFI is private and approval is required.
7. When a person logs in, automatically create or update UserProfiles.
8. OAuth login should pull available name, email, avatar, and company/domain hints.
9. When a person logs in from an email distribution link, match by normalized email.
10. If no Contact exists for that email and project, create one.
11. If a Contact exists for that email, update `last_seen_at` and `user_id`.
12. If company is unknown, infer from domain only as unverified.
13. Do not overwrite manually verified company data without user/admin confirmation.
14. Do not create duplicate contacts for the same project and email.
15. Allow admin merge if duplicates exist.

## Access roles

- Project Viewer
- RFI Viewer
- RFI Responder
- RFI Manager
- Project Engineer
- Admin

## Invitation types

- RFI Distribution
- Project Team Invite
- Reviewer Invite
- Read Only Invite

## Audit events

- Recipient invited
- Recipient logged in
- Contact auto created
- Contact auto updated
- Project access granted
- Project access revoked
- Access denied
- Private RFI approval required
