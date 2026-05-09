# CAST RFI Email Distribution Spec

## Purpose

Allow issued and responded RFIs to be distributed by email while preserving secure system access, external package links, recipient history, and auditability.

## Tables

### RFIDistributions

| Field | Notes |
|---|---|
| id | Primary key |
| project_id | Project foreign key |
| rfi_id | RFI foreign key |
| distribution_type | Issued RFI Distribution, Responded RFI Distribution, General RFI Update, Overdue Reminder, Closeout Distribution |
| subject | Email subject |
| message | Email body |
| sent_by_user_id | Sender |
| sent_at | Sent timestamp |
| issued_rfi_link_id | ExternalLinks id |
| responded_rfi_link_id | ExternalLinks id |
| recipient_count | Count snapshot |
| status | Draft, Queued, Sent, Failed, Partially Sent |
| created_at | Created timestamp |
| updated_at | Updated timestamp |

### RFIDistributionRecipients

| Field | Notes |
|---|---|
| id | Primary key |
| distribution_id | RFIDistributions id |
| rfi_id | RFI id |
| user_id | Nullable registered user id |
| contact_id | Nullable contact id |
| email | Recipient email snapshot |
| name | Recipient name snapshot |
| company | Recipient company snapshot |
| recipient_type | To, CC, BCC, Distribution Only |
| delivery_status | Pending, Sent, Failed, Opened, Clicked, Bounced, Unknown |
| opened_at | Optional tracking timestamp |
| clicked_at | Optional tracking timestamp |
| last_error | Delivery failure detail |
| created_at | Created timestamp |
| updated_at | Updated timestamp |

## Issued RFI workflow

1. User opens RFI.
2. User confirms Issued RFI Link.
3. User selects recipients from project team, assignees, responsible contractor, RFI Manager, and distribution list.
4. User clicks Distribute Issued RFI.
5. System generates email.
6. System includes secure link to the RFI record.
7. System includes Issued RFI Dropbox/external link.
8. System records distribution and recipients.
9. System updates `last_distributed_at`.
10. System logs `Issued RFI distributed`.

## Responded RFI workflow

1. User opens RFI.
2. User confirms Responded RFI Link.
3. User confirms official response exists or override reason is provided.
4. User selects recipients.
5. User clicks Distribute Responded RFI.
6. System generates email.
7. System includes secure link to the RFI record.
8. System includes Responded RFI Dropbox/external link.
9. System includes official response summary.
10. System records distribution and recipients.
11. System updates `last_response_distributed_at`.
12. System logs `Responded RFI distributed`.

## Email template: Issued RFI

Subject:

`Issued RFI {RFI Number}: {Subject}`

Body:

```text
You have been issued RFI {RFI Number} for project {Project Name}.

Subject:
{Subject}

Due Date:
{Due Date}

Ball in Court:
{Ball in Court}

Issued RFI Package:
{Issued RFI Link}

Secure Project Record:
{System RFI Link}

Please log in to review the full RFI record, attachments, comments, linked drawings, and project history.
```

## Email template: Responded RFI

Subject:

`Responded RFI {RFI Number}: {Subject}`

Body:

```text
RFI {RFI Number} for project {Project Name} has been responded to.

Subject:
{Subject}

Official Response:
{Official Response Summary}

Response Date:
{Response Date}

Responded RFI Package:
{Responded RFI Link}

Secure Project Record:
{System RFI Link}

Please log in to review the complete RFI record, response history, attachments, and linked references.
```

## Validation

- Issued RFI cannot be distributed without an Issued RFI Link unless an authorized override reason exists.
- Responded RFI cannot be distributed without a Responded RFI Link unless an authorized override reason exists.
- Private RFI distribution requires explicit permission.
- Emails must not expose private RFI details or confidential attachments directly unless explicitly allowed.
