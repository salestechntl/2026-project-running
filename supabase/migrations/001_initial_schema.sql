-- Running Camp 2026 — initial schema (Phase 1+)
-- Run in Supabase SQL Editor or via: supabase db push

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Employees (org chart — uploaded monthly by super_admin)
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  employee_id   text primary key,
  name          text not null,
  position      text not null default '',
  department    text not null default '',
  manager_id    text references public.employees (employee_id) on delete set null,
  role          text not null default 'employee'
                check (role in ('employee', 'super_admin')),
  is_active     boolean not null default true,
  import_batch_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_employees_manager on public.employees (manager_id);
create index if not exists idx_employees_active on public.employees (is_active);

-- ---------------------------------------------------------------------------
-- Org import batches (monthly CSV uploads)
-- ---------------------------------------------------------------------------
create table if not exists public.org_import_batches (
  id            uuid primary key default gen_random_uuid(),
  uploaded_by   text not null references public.employees (employee_id),
  file_name     text not null,
  row_count     int not null default 0,
  error_count   int not null default 0,
  status        text not null default 'preview'
                check (status in ('preview', 'committed', 'failed')),
  uploaded_at   timestamptz not null default now()
);

alter table public.employees
  add constraint fk_employees_import_batch
  foreign key (import_batch_id) references public.org_import_batches (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Monthly missions
-- ---------------------------------------------------------------------------
create table if not exists public.monthly_missions (
  month       text primary key check (month ~ '^\d{4}-\d{2}$'),
  name        text not null,
  objective   text not null default '',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Run entries (Phase 2)
-- ---------------------------------------------------------------------------
create table if not exists public.run_entries (
  id            uuid primary key default gen_random_uuid(),
  employee_id   text not null references public.employees (employee_id),
  run_date      date not null,
  run_type      text not null default 'discipline'
                check (run_type in ('discipline', 'mission')),
  distance_km   numeric(8, 2) not null check (distance_km > 0),
  duration_sec  int not null check (duration_sec > 0),
  mission_month text not null check (mission_month ~ '^\d{4}-\d{2}$'),
  note          text,
  status        text not null default 'submitted'
                check (status in ('submitted', 'rejected')),
  reject_note   text,
  rejected_by   text references public.employees (employee_id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_runs_employee on public.run_entries (employee_id);
create index if not exists idx_runs_date on public.run_entries (run_date desc);

-- ---------------------------------------------------------------------------
-- Weight entries (Phase 2)
-- ---------------------------------------------------------------------------
create table if not exists public.weight_entries (
  id            uuid primary key default gen_random_uuid(),
  employee_id   text not null references public.employees (employee_id),
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  period        text not null check (period in ('start', 'end')),
  weight_kg     numeric(5, 1) not null check (weight_kg > 0),
  status        text not null default 'submitted'
                check (status in ('submitted', 'rejected')),
  reject_note   text,
  rejected_by   text references public.employees (employee_id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (employee_id, month, period)
);

create index if not exists idx_weights_employee on public.weight_entries (employee_id);

-- ---------------------------------------------------------------------------
-- Attachments (Phase 3)
-- ---------------------------------------------------------------------------
create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  entry_type    text not null check (entry_type in ('run', 'weight')),
  entry_id      uuid not null,
  version       int not null default 1,
  storage_path  text not null,
  file_hash     text,
  mime_type     text,
  file_size_bytes int,
  uploaded_by   text not null references public.employees (employee_id),
  is_current    boolean not null default true,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_attachments_entry on public.attachments (entry_type, entry_id);

-- ---------------------------------------------------------------------------
-- Entry versions (audit snapshots — Phase 3)
-- ---------------------------------------------------------------------------
create table if not exists public.entry_versions (
  id            uuid primary key default gen_random_uuid(),
  entry_type    text not null check (entry_type in ('run', 'weight')),
  entry_id      uuid not null,
  version       int not null,
  snapshot      jsonb not null,
  changed_by    text not null references public.employees (employee_id),
  change_reason text,
  changed_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      text references public.employees (employee_id),
  action        text not null,
  target_type   text,
  target_id     text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_created on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employees_updated on public.employees;
create trigger trg_employees_updated
  before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists trg_runs_updated on public.run_entries;
create trigger trg_runs_updated
  before update on public.run_entries
  for each row execute function public.set_updated_at();

drop trigger if exists trg_weights_updated on public.weight_entries;
create trigger trg_weights_updated
  before update on public.weight_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — deny public access; API uses service_role key
-- ---------------------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.org_import_batches enable row level security;
alter table public.monthly_missions enable row level security;
alter table public.run_entries enable row level security;
alter table public.weight_entries enable row level security;
alter table public.attachments enable row level security;
alter table public.entry_versions enable row level security;
alter table public.audit_log enable row level security;
