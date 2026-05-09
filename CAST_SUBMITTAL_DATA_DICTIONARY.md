# CAST Submittal Data Dictionary

## Models

Projects, Users, Companies, ProjectTeamMembers, Submittals, SubmittalPackages, SubmittalPackageItems, SubmittalRevisions, SubmittalWorkflowTemplates, SubmittalWorkflowSteps, SubmittalWorkflowParticipants, SubmittalResponses, SubmittalComments, SubmittalAttachments, SubmittalDistributionList, SubmittalTransmittals, Drawings, DrawingRevisions, Documents, DocumentRevisions, SpecSections, Locations, RFIs, AuditLog, Notifications, Permissions.

## Submittals minimum fields

id, project_id, submittal_number, revision_number, title, description, submittal_type, status, priority, spec_section_id, spec_section_number, spec_section_title, drawing_id, drawing_number, document_id, location_id, package_id, responsible_company_id, submitter_user_id, submittal_manager_user_id, created_by_user_id, ball_in_court_user_ids, current_workflow_step_id, workflow_template_id, issue_date, received_date, sent_date, required_on_site_date, lead_time_days, planned_return_date, final_due_date, actual_return_date, date_closed, closed_by_user_id, cost_impact_status, schedule_impact_status, private_flag, official_response_id, root_submittal_id, previous_revision_id, linked_rfi_ids, distribution_user_ids, created_at, updated_at.

## Package fields

id, project_id, package_number, package_title, description, status, spec_section_id, responsible_company_id, submittal_manager_user_id, created_by_user_id, due_date, date_submitted, date_returned, date_closed, created_at, updated_at.

## Workflow step fields

id, project_id, submittal_id, workflow_template_id, step_number, step_name, review_type, due_date, original_due_date, days_allocated, status, ball_in_court_flag, started_at, completed_at, created_at, updated_at.

## Participant fields

id, workflow_step_id, user_id, company_id, role, response_status, response_id, due_date, sent_at, responded_at, created_at, updated_at.
