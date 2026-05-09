-- CAST Document Intake schema proposal.
-- Apply only after the platform DB/auth provider is selected and tenant/project isolation is wired.

create table if not exists document_intake_items (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by_user_id text not null,
  uploaded_by_name text,
  suggested_module text not null,
  suggested_document_type text,
  confidence numeric(5,4),
  suggested_folder text not null,
  storage_object_key text,
  public_link text,
  dropbox_link text,
  linked_record_suggestions jsonb not null default '[]'::jsonb,
  email_distribution jsonb not null default '[]'::jsonb,
  contact_capture_suggestions jsonb not null default '[]'::jsonb,
  classification_debug jsonb not null default '{}'::jsonb,
  status text not null default 'needs_review',
  admin_override_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by_user_id text,
  rejected_at timestamptz,
  rejected_by_user_id text
);

create index if not exists document_intake_items_project_status_idx on document_intake_items(project_id, status, created_at desc);
create index if not exists document_intake_items_module_idx on document_intake_items(project_id, suggested_module);

create table if not exists document_intake_versions (
  id uuid primary key default gen_random_uuid(),
  intake_item_id uuid not null references document_intake_items(id) on delete cascade,
  version_number integer not null,
  storage_object_key text not null,
  file_name text not null,
  uploaded_by_user_id text not null,
  created_at timestamptz not null default now(),
  unique(intake_item_id, version_number)
);

create table if not exists document_intake_audit_log (
  id uuid primary key default gen_random_uuid(),
  intake_item_id uuid references document_intake_items(id) on delete cascade,
  actor_user_id text not null,
  action text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
