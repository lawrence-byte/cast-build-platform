# CAST Project Contact Sync Spec

## Purpose

Use the Procore project directory as the shared contact spine for the CAST Project Controls Platform so RFIs, Submittals, distribution lists, assignability, access invitations, and project contacts all communicate through the same normalized contact data.

## Current imported source

- Source CSV: `Project_Directory---1b57babc-e08d-476c-9432-6d210d714361.csv`
- Project: Alüm / Golden Hill
- Imported people: 186
- Imported companies: 56
- Contacts with email: 186
- Contacts with phone: 80

## Generated platform data files

| File | Purpose |
|---|---|
| `public/safe-data/projects/golden-hill/project-directory.json` | Human-readable company/person directory for the Directory page |
| `public/safe-data/projects/golden-hill/project-contacts.json` | Normalized Contacts model scaffold for login/contact management |
| `public/safe-data/projects/golden-hill/assignable-parties.json` | Shared assignment picker source for RFIs, Submittals, workflow steps, packages, and distribution lists |

## Sync architecture

The CSV import should normalize each project participant into three related platform concepts:

1. **Directory Person** — what the user sees in the project directory.
2. **Contact** — project-scoped contact record used for invitations, email distribution, login matching, and contact management.
3. **AssignableParty** — assignment/search index used by RFI and Submittal pickers.

The same normalized email should connect all three.

## Required joins

| Module | Contact usage |
|---|---|
| RFI Log | RFI Manager, Ball in Court, Assignees, Responsible Contractor, Distribution Recipients |
| RFI Detail | Recipient Access, Distribution History, Login Access History, External Link actions |
| Submittal Log | Submitter, Reviewer, Submittal Manager, Responsible Contractor, Ball in Court, Distribution Recipients |
| Submittal Detail | Workflow Participants, Package Distribution, Recipient Access, Distribution History |
| Assignability | Search/select registered users, contacts without login, companies, role placeholders |
| Access/Login | Match logged-in user by email to Contact, then ProjectAccess |
| Project Contacts | Edit, merge, revoke, upgrade, export contacts |

## Contact matching rules

1. Normalize email to lowercase and trim whitespace.
2. Primary match key is `project_id + normalized email`.
3. If a logged-in user matches a Contact by email, link `user_id` and update `last_seen_at`.
4. If no Contact exists for an invited/distributed email, create one with the proper source.
5. Do not create duplicate Contacts for the same project/email.
6. If duplicate contacts already exist, flag them for admin merge.
7. Do not overwrite manually verified company data without confirmation.
8. Infer company from domain only as unverified.

## Assignment sync rules

1. Every Contact with an email becomes an AssignableParty unless suspended/removed.
2. Internal CAST team contacts can be RFI/Submittal Managers, Project Engineers, Ball in Court, Watchers, and Distribution recipients.
3. Design/engineering contacts can be Reviewers, Approvers, RFI Responders, Submittal Reviewers, Watchers, and Distribution recipients.
4. Trade partner contacts can be Responsible Contractors, RFI Responders, Submittal Submitters, Submittal Reviewers, Watchers, and Distribution recipients.
5. No Access contacts require approval before assignment-created access.
6. Private RFIs/Submittals always require explicit approval before assignment-created access.

## Distribution sync rules

1. RFI and Submittal distribution lists may store either `user_id` or `contact_id`.
2. If a recipient is not registered, store `contact_id`, email, name, and company.
3. When that recipient later logs in, update the Contact and Distribution List display to show the linked user profile.
4. Distribution history must remain immutable even if the Contact is later edited or merged.

## UI behavior

The project Directory page should show the imported directory and assignment-readiness summary. RFI/Submittal assignment pickers should read from the same AssignableParty index rather than maintaining separate lists.

## Production backend requirement

The static JSON files are safe read-first scaffolds. Production must replace these with server tables and API routes for Contacts, UserProfiles, ProjectAccess, AccessInvitations, AssignableParties, EntityAssignments, RFIDistributionRecipients, and SubmittalDistributionRecipients.
