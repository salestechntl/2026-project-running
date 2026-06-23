-- Approval workflow: pending → approved | rejected
-- Migrate legacy "submitted" rows to "pending" for lead review.

alter table public.run_entries drop constraint if exists run_entries_status_check;
alter table public.weight_entries drop constraint if exists weight_entries_status_check;

update public.run_entries set status = 'pending' where status = 'submitted';
update public.weight_entries set status = 'pending' where status = 'submitted';

alter table public.run_entries
  add constraint run_entries_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.weight_entries
  add constraint weight_entries_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.run_entries
  add column if not exists approved_by text references public.employees (employee_id),
  add column if not exists approved_at timestamptz;

alter table public.weight_entries
  add column if not exists approved_by text references public.employees (employee_id),
  add column if not exists approved_at timestamptz;

-- Allow multiple weight rows per month/period (resubmit after rejection).
alter table public.weight_entries
  drop constraint if exists weight_entries_employee_id_month_period_key;
