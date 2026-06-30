-- =============================================================================
-- Running Camp 2026 — Production deploy (run once in Supabase SQL Editor)
-- Run AFTER migrations 001–005 are already applied.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 006 — expired status (pending → expired after 5 days)
-- -----------------------------------------------------------------------------
alter table public.run_entries drop constraint if exists run_entries_status_check;
alter table public.weight_entries drop constraint if exists weight_entries_status_check;

alter table public.run_entries
  add constraint run_entries_status_check
  check (status in ('pending', 'approved', 'rejected', 'expired'));

alter table public.weight_entries
  add constraint weight_entries_status_check
  check (status in ('pending', 'approved', 'rejected', 'expired'));

alter table public.run_entries
  add column if not exists expired_at timestamptz;

alter table public.weight_entries
  add column if not exists expired_at timestamptz;

create index if not exists idx_runs_pending_created on public.run_entries (status, created_at)
  where status = 'pending';

create index if not exists idx_weights_pending_created on public.weight_entries (status, created_at)
  where status = 'pending';

-- -----------------------------------------------------------------------------
-- 007 — employee login passwords (bcrypt hash)
-- -----------------------------------------------------------------------------
alter table public.employees
  add column if not exists password_hash text null;

comment on column public.employees.password_hash is 'bcrypt hash; null = user must set password on first login';

-- -----------------------------------------------------------------------------
-- Post-deploy: primary super_admin default password (P@ssw0rd)
-- แก้ YOUR_SUPER_ADMIN_ID เป็นรหัสพนักงาน super_admin จริงของ production
-- รันครั้งเดียว — super_admin คนอื่นต้องไปสร้างรหัสผ่านเองที่ /set-password
-- -----------------------------------------------------------------------------
-- update public.employees
-- set password_hash = '$2b$10$IkZCX0EToT6Hq0sgz1oxfu3bwVS3MXoF1wA16h2wI5JZN/g0BDAb2'
-- where employee_id = 'YOUR_SUPER_ADMIN_ID'
--   and role = 'super_admin'
--   and password_hash is null;

-- -----------------------------------------------------------------------------
-- 008 — staff edit note (visible to employees)
-- -----------------------------------------------------------------------------
alter table public.run_entries
  add column if not exists staff_edit_note text;

alter table public.weight_entries
  add column if not exists staff_edit_note text;

comment on column public.run_entries.staff_edit_note is 'Admin note when correcting a rejected entry; shown to employee';
comment on column public.weight_entries.staff_edit_note is 'Checker note when correcting a rejected entry; shown to employee';

-- -----------------------------------------------------------------------------
-- 009 — rename role admin → checker (same permissions)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'employees'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format('alter table public.employees drop constraint %I', r.conname);
  end loop;
end $$;

update public.employees
set role = lower(trim(role))
where role is distinct from lower(trim(role));

update public.employees
  set role = 'checker'
  where role = 'admin';

update public.employees
  set role = 'employee'
  where role not in ('employee', 'checker', 'super_admin');

alter table public.employees
  add constraint employees_role_check
  check (role in ('employee', 'checker', 'super_admin'));

-- -----------------------------------------------------------------------------
-- 010 — canonical uppercase employee_id (AS123456)
-- Skip the role block below if 009 already succeeded; start at collision check.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from public.employees
    group by upper(employee_id)
    having count(*) > 1
  ) then
    raise exception 'employee_id case collision: resolve duplicates before migration 010';
  end if;
end $$;

alter table public.employees drop constraint if exists employees_manager_id_fkey;
alter table public.employees
  add constraint employees_manager_id_fkey
  foreign key (manager_id) references public.employees (employee_id)
  on update cascade on delete set null;

alter table public.org_import_batches drop constraint if exists org_import_batches_uploaded_by_fkey;
alter table public.org_import_batches
  add constraint org_import_batches_uploaded_by_fkey
  foreign key (uploaded_by) references public.employees (employee_id)
  on update cascade on delete restrict;

alter table public.run_entries drop constraint if exists run_entries_employee_id_fkey;
alter table public.run_entries
  add constraint run_entries_employee_id_fkey
  foreign key (employee_id) references public.employees (employee_id)
  on update cascade on delete restrict;

alter table public.run_entries drop constraint if exists run_entries_rejected_by_fkey;
alter table public.run_entries
  add constraint run_entries_rejected_by_fkey
  foreign key (rejected_by) references public.employees (employee_id)
  on update cascade on delete set null;

alter table public.run_entries drop constraint if exists run_entries_approved_by_fkey;
alter table public.run_entries
  add constraint run_entries_approved_by_fkey
  foreign key (approved_by) references public.employees (employee_id)
  on update cascade on delete set null;

alter table public.weight_entries drop constraint if exists weight_entries_employee_id_fkey;
alter table public.weight_entries
  add constraint weight_entries_employee_id_fkey
  foreign key (employee_id) references public.employees (employee_id)
  on update cascade on delete restrict;

alter table public.weight_entries drop constraint if exists weight_entries_rejected_by_fkey;
alter table public.weight_entries
  add constraint weight_entries_rejected_by_fkey
  foreign key (rejected_by) references public.employees (employee_id)
  on update cascade on delete set null;

alter table public.weight_entries drop constraint if exists weight_entries_approved_by_fkey;
alter table public.weight_entries
  add constraint weight_entries_approved_by_fkey
  foreign key (approved_by) references public.employees (employee_id)
  on update cascade on delete set null;

alter table public.attachments drop constraint if exists attachments_uploaded_by_fkey;
alter table public.attachments
  add constraint attachments_uploaded_by_fkey
  foreign key (uploaded_by) references public.employees (employee_id)
  on update cascade on delete restrict;

alter table public.entry_versions drop constraint if exists entry_versions_changed_by_fkey;
alter table public.entry_versions
  add constraint entry_versions_changed_by_fkey
  foreign key (changed_by) references public.employees (employee_id)
  on update cascade on delete set null;

alter table public.audit_log drop constraint if exists audit_log_actor_id_fkey;
alter table public.audit_log
  add constraint audit_log_actor_id_fkey
  foreign key (actor_id) references public.employees (employee_id)
  on update cascade on delete set null;

update public.employees
set employee_id = upper(employee_id)
where employee_id <> upper(employee_id);

update public.audit_log
set target_id = upper(target_id)
where target_type = 'employee'
  and target_id is not null
  and target_id <> upper(target_id);

-- -----------------------------------------------------------------------------
-- 011 — run_type "channel" (เพิ่มวิ่งกับช่องทาง)
-- -----------------------------------------------------------------------------
alter table public.run_entries drop constraint if exists run_entries_run_type_check;

alter table public.run_entries
  add constraint run_entries_run_type_check
  check (run_type in ('discipline', 'mission', 'channel'));
