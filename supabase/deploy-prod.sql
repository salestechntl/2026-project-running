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
update public.employees
  set role = 'checker'
  where role = 'admin';

alter table public.employees drop constraint if exists employees_role_check;
alter table public.employees
  add constraint employees_role_check
  check (role in ('employee', 'checker', 'super_admin'));
