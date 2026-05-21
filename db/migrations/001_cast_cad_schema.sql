-- CAST CAD backend migration scaffold.
-- This repo currently runs as a static platform; this file is the normalized
-- PostgreSQL/JSONB schema target for the future authenticated CAST CAD backend.

create table if not exists cast_cad_projects (
  id text primary key,
  name text not null,
  project_number text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cast_cad_drawing_sets (
  id text primary key,
  project_id text not null references cast_cad_projects(id),
  name text not null,
  version_label text,
  status text not null default 'draft',
  source_pointer jsonb not null default '{}',
  published_at timestamptz,
  archived_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cast_cad_drawing_sheets (
  id text primary key,
  project_id text not null references cast_cad_projects(id),
  drawing_set_id text references cast_cad_drawing_sets(id),
  sheet_number text not null,
  sheet_name text,
  discipline text,
  page_number integer not null default 1,
  title_block jsonb not null default '{}',
  current_revision_id text,
  source_pointer jsonb not null default '{}',
  status text not null default 'current',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drawing_set_id, sheet_number)
);

create table if not exists cast_cad_drawing_revisions (
  id text primary key,
  drawing_sheet_id text not null references cast_cad_drawing_sheets(id),
  revision_number text not null,
  revision_date date,
  issue_date date,
  description text,
  file_hash text,
  source_pointer jsonb not null default '{}',
  superseded boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists cast_cad_documents (
  id text primary key,
  project_id text not null references cast_cad_projects(id),
  document_type text not null,
  title text not null,
  status text not null default 'active',
  source_pointer jsonb not null default '{}',
  permission_scope text not null default 'project',
  original_file_hash text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cast_cad_document_versions (
  id text primary key,
  document_id text not null references cast_cad_documents(id),
  version_number integer not null,
  source_pointer jsonb not null default '{}',
  file_hash text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table if not exists cast_cad_document_pages (
  id text primary key,
  document_version_id text not null references cast_cad_document_versions(id),
  page_number integer not null,
  page_label text,
  width_points numeric,
  height_points numeric,
  rotation integer not null default 0,
  thumbnail_pointer jsonb not null default '{}',
  unique (document_version_id, page_number)
);

create table if not exists cast_cad_document_ocr (
  id text primary key,
  document_page_id text not null references cast_cad_document_pages(id),
  ocr_engine text not null,
  text text not null,
  text_spans jsonb not null default '[]',
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists cast_cad_markups (
  id text primary key,
  project_id text not null references cast_cad_projects(id),
  drawing_set_id text references cast_cad_drawing_sets(id),
  sheet_id text references cast_cad_drawing_sheets(id),
  drawing_revision_id text references cast_cad_drawing_revisions(id),
  page_number integer not null default 1,
  subject text not null,
  description text,
  markup_type text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  severity text,
  discipline text,
  csi_division text,
  cost_code text,
  responsible_party text,
  author_user_id text not null,
  modified_by_user_id text,
  due_date date,
  closed_at timestamptz,
  properties jsonb not null default '{}',
  measurement_metadata jsonb not null default '{}',
  linked_records jsonb not null default '{}',
  original_pdf_coordinate_map jsonb not null default '{}',
  compatibility_metadata jsonb not null default '{}',
  ai_detected boolean not null default false,
  human_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cast_cad_markup_geometry (
  id text primary key,
  markup_id text not null references cast_cad_markups(id) on delete cascade,
  geometry_type text not null,
  normalized_page_geometry jsonb not null,
  pdf_coordinates jsonb not null default '{}',
  viewport_id text,
  created_at timestamptz not null default now()
);

create table if not exists cast_cad_markup_comments (
  id text primary key,
  markup_id text not null references cast_cad_markups(id) on delete cascade,
  parent_comment_id text,
  body text not null,
  author_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists cast_cad_markup_status_history (
  id text primary key,
  markup_id text not null references cast_cad_markups(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by_user_id text not null,
  changed_at timestamptz not null default now(),
  notes text
);

create table if not exists cast_cad_markup_attachments (
  id text primary key,
  markup_id text not null references cast_cad_markups(id) on delete cascade,
  attachment_type text not null,
  source_pointer jsonb not null,
  caption text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists cast_cad_tool_sets (
  id text primary key,
  project_id text references cast_cad_projects(id),
  scope text not null,
  name text not null,
  permissions jsonb not null default '{}',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists cast_cad_tool_items (
  id text primary key,
  tool_set_id text not null references cast_cad_tool_sets(id) on delete cascade,
  name text not null,
  mode text not null default 'properties',
  discipline text,
  cost_code text,
  tags text[] not null default '{}',
  properties jsonb not null default '{}',
  geometry_template jsonb not null default '{}'
);

create table if not exists cast_cad_measurements (
  id text primary key,
  markup_id text references cast_cad_markups(id) on delete set null,
  sheet_id text references cast_cad_drawing_sheets(id),
  measurement_type text not null,
  scale_metadata jsonb not null,
  geometry jsonb not null,
  quantity numeric not null,
  unit_of_measure text not null,
  formula text,
  precision integer not null default 2,
  human_verified boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists cast_cad_takeoff_workbooks (
  id text primary key,
  project_id text not null references cast_cad_projects(id),
  name text not null,
  status text not null default 'draft',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists cast_cad_takeoff_items (
  id text primary key,
  workbook_id text references cast_cad_takeoff_workbooks(id) on delete cascade,
  measurement_id text references cast_cad_measurements(id),
  sheet_id text references cast_cad_drawing_sheets(id),
  item text not null,
  quantity numeric not null,
  unit_of_measure text not null,
  unit_cost numeric,
  total_cost numeric,
  cost_code text,
  csi_division text,
  estimate_category text,
  verification_status text not null default 'needs_review'
);

create table if not exists cast_cad_spaces (id text primary key, project_id text not null references cast_cad_projects(id), name text not null, space_type text, geometry jsonb not null default '{}');
create table if not exists cast_cad_levels (id text primary key, project_id text not null references cast_cad_projects(id), name text not null, elevation numeric);
create table if not exists cast_cad_units (id text primary key, project_id text not null references cast_cad_projects(id), unit_number text not null, level_id text references cast_cad_levels(id));
create table if not exists cast_cad_comparison_jobs (id text primary key, project_id text not null references cast_cad_projects(id), status text not null, input jsonb not null, created_at timestamptz not null default now());
create table if not exists cast_cad_comparison_results (id text primary key, comparison_job_id text not null references cast_cad_comparison_jobs(id), result_type text not null, geometry jsonb not null default '{}', summary text);
create table if not exists cast_cad_visual_search_jobs (id text primary key, project_id text not null references cast_cad_projects(id), status text not null, query_geometry jsonb not null, results jsonb not null default '[]');
create table if not exists cast_cad_batch_jobs (id text primary key, project_id text not null references cast_cad_projects(id), job_type text not null, status text not null, progress jsonb not null default '{}', logs jsonb not null default '[]');
create table if not exists cast_cad_review_sessions (id text primary key, project_id text not null references cast_cad_projects(id), name text not null, status text not null, starts_at timestamptz, closes_at timestamptz);
create table if not exists cast_cad_session_participants (id text primary key, review_session_id text not null references cast_cad_review_sessions(id), user_id text not null, role text not null);
create table if not exists cast_cad_session_activity (id text primary key, review_session_id text not null references cast_cad_review_sessions(id), actor_user_id text, action text not null, payload jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists cast_cad_rfi_links (id text primary key, markup_id text references cast_cad_markups(id), rfi_id text not null, link_status text not null, snapshot_pointer jsonb not null default '{}');
create table if not exists cast_cad_submittal_links (id text primary key, markup_id text references cast_cad_markups(id), submittal_id text not null, link_status text not null, snapshot_pointer jsonb not null default '{}');
create table if not exists cast_cad_change_event_links (id text primary key, markup_id text references cast_cad_markups(id), change_event_id text not null, link_status text not null);
create table if not exists cast_cad_exports (id text primary key, project_id text not null references cast_cad_projects(id), export_type text not null, status text not null, output_pointer jsonb not null default '{}', created_by text, created_at timestamptz not null default now());
create table if not exists cast_cad_audit_logs (id text primary key, project_id text references cast_cad_projects(id), entity_type text not null, entity_id text not null, action text not null, actor_user_id text, previous_value jsonb, new_value jsonb, created_at timestamptz not null default now());
create table if not exists cast_cad_ai_findings (id text primary key, project_id text not null references cast_cad_projects(id), agent_name text not null, finding_type text not null, source_citation jsonb not null, confidence numeric not null, status text not null default 'ai_detected', human_verified boolean not null default false, created_at timestamptz not null default now());
create table if not exists cast_cad_ai_agent_runs (id text primary key, project_id text not null references cast_cad_projects(id), agent_name text not null, status text not null, input jsonb not null, output jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists cast_cad_user_preferences (id text primary key, user_id text not null, project_id text references cast_cad_projects(id), preferences jsonb not null default '{}');
create table if not exists cast_cad_keyboard_shortcuts (id text primary key, user_id text, command text not null, shortcut text not null);
create table if not exists cast_cad_integrations (id text primary key, project_id text references cast_cad_projects(id), provider text not null, status text not null, config jsonb not null default '{}');
create table if not exists cast_cad_external_collaborators (id text primary key, project_id text not null references cast_cad_projects(id), email text not null, company text, access_policy jsonb not null default '{}');
create table if not exists cast_cad_permissions (id text primary key, project_id text references cast_cad_projects(id), subject_type text not null, subject_id text not null, resource_type text not null, resource_id text, actions text[] not null default '{}');

create index if not exists idx_cast_cad_markups_sheet_status on cast_cad_markups(sheet_id, status);
create index if not exists idx_cast_cad_measurements_sheet on cast_cad_measurements(sheet_id);
create index if not exists idx_cast_cad_ai_findings_status on cast_cad_ai_findings(project_id, status);
create index if not exists idx_cast_cad_audit_entity on cast_cad_audit_logs(entity_type, entity_id);
