# CAST Submittal Email Distribution Spec

## Tables

### SubmittalDistributions

Fields: id, project_id, submittal_id, package_id, distribution_type, subject, message, sent_by_user_id, sent_at, issued_submittal_link_id, returned_submittal_link_id, recipient_count, status, created_at, updated_at.

Distribution types: Issued Submittal Distribution, Returned Submittal Distribution, General Submittal Update, Overdue Reminder, Closeout Distribution, Package Distribution.

Status options: Draft, Queued, Sent, Failed, Partially Sent.

### SubmittalDistributionRecipients

Fields: id, distribution_id, submittal_id, package_id, user_id, contact_id, email, name, company, recipient_type, delivery_status, opened_at, clicked_at, last_error, created_at, updated_at.

Recipient types: To, CC, BCC, Distribution Only.

Delivery status: Pending, Sent, Failed, Opened, Clicked, Bounced, Unknown.

### SubmittalDistributionList

Fields: id, submittal_id, package_id, user_id, contact_id, email, name, company, recipient_type, added_by_user_id, created_at, updated_at.

## Issued Submittal workflow

1. User opens Submittal.
2. User confirms Issued Submittal Link.
3. User selects recipients from project team, submitter, responsible contractor, Submittal Manager, workflow participants, and distribution list.
4. System generates email with secure system link plus issued Dropbox/external link.
5. System records distribution and recipients.
6. System updates `last_issued_distribution_at`.
7. System logs `Issued Submittal distributed`.

## Returned Submittal workflow

1. User opens Submittal.
2. User confirms Returned Submittal Link.
3. User confirms official response exists or enters authorized override reason.
4. System generates email with secure system link, returned package link, and official response summary.
5. System records distribution and recipients.
6. System updates `last_returned_distribution_at`.
7. System logs `Returned Submittal distributed`.

## Email templates

Use the exact issued/returned templates supplied by Lawrence. Emails must not include confidential attachments directly unless explicitly allowed.
