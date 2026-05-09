# CAST RFI Access Control Spec

## Rule

No RFI Detail Page can be accessed unauthenticated. Public email links route to a secure access page and redirect after login.

## Required access check

A user can view an RFI only when:

1. The user is authenticated.
2. The user has active ProjectAccess for the project.
3. The RFI is not private, or the user has direct/private permission.
4. The user role permits the requested action.

## Distribution-recipient grants

When a recipient logs in from a distribution link:

- Distribution-only recipient -> RFI Viewer
- Assigned responder -> RFI Responder
- RFI Manager -> RFI Manager
- Project Admin/Project Engineer retains existing higher role

The system must not downgrade existing access automatically.

## Private RFIs

Private RFIs require explicit permission. Distribution-recipient matching should pause for approval and show access denied/request access until approval is granted.

## Admin actions

Admins may:

- upgrade role
- revoke access
- suspend access
- resend invite
- merge duplicate contacts
- approve private RFI access

## Audit requirements

Audit all access grants, revocations, distribution actions, link changes, login-based contact creation, and private-RFI access decisions.

Required events include:

- RFI assigned to current log
- RFI log query fixed
- Issued RFI link added
- Issued RFI link changed
- Responded RFI link added
- Responded RFI link changed
- External link verified
- Issued RFI distributed
- Responded RFI distributed
- Recipient invited
- Recipient logged in
- Contact auto created
- Contact auto updated
- Project access granted
- Project access revoked
- Distribution failed
- Distribution resent
