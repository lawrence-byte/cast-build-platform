# CAST RFI Contact + Authentication Spec

RFI record access uses `AccessInvitations`, `Contacts`, `UserProfiles`, and `ProjectAccess`. Email magic link is the MVP login path. Google/Microsoft OAuth should be used if already available. Recipients logging in from distribution links are matched by email, contacts are auto-created or updated, and ProjectAccess is granted without downgrading existing roles.
