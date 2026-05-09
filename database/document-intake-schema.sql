-- CAST Document Intake schema proposal.
-- Apply only after the platform DB/auth provider is selected and tenant/project isolation is wired.

create table if not exists document_intake_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  uploaded_by_user_id text not null,
  original_file_name text not null,
  stored_file_name text not null,
  file_extension text,
  mime_type text,
  file_size bigint,
  original_storage_path text not null,
  processed_text_path text,
  module_classification text not null,
  document_type text,
  confidence_score numeric(5,4),
  suggested_folder_path text not null,
  final_folder_path text,
  status text not null default 'needs_review',
  requires_human_review boolean not null default true,
  extracted_metadata_json jsonb not null default '{}'::jsonb,
  linked_records_json jsonb not null default '[]'::jsonb,
  upload_source text not null default 'global_intake',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_intake_uploads_project_status_idx on document_intake_uploads(project_id, status, created_at desc);
create index if not exists document_intake_uploads_module_idx on document_intake_uploads(project_id, module_classification);
create index if not exists document_intake_uploads_folder_idx on document_intake_uploads(project_id, suggested_folder_path);

create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references document_intake_uploads(id) on delete cascade,
  version_number integer not null,
  uploaded_by_user_id text not null,
  file_name text not null,
  storage_path text not null,
  change_summary text,
  created_at timestamptz not null default now(),
  unique(document_id, version_number)
);

create table if not exists document_audit_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references document_intake_uploads(id) on delete cascade,
  user_id text not null,
  action text not null,
  previous_value_json jsonb,
  new_value_json jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references document_intake_uploads(id) on delete cascade,
  linked_module text not null,
  linked_record_id text not null,
  link_type text not null default 'suggested',
  created_by_user_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists project_contact_directory (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  name text not null,
  company text,
  email text,
  phone text,
  role text,
  trade text,
  source text not null default 'document_intake',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_contact_directory_project_email_idx on project_contact_directory(project_id, lower(email));
create index if not exists document_links_document_idx on document_links(document_id, linked_module);
