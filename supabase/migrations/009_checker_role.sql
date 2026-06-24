-- Rename org-wide approver role: admin → checker (same permissions)
update public.employees
  set role = 'checker'
  where role = 'admin';

alter table public.employees drop constraint if exists employees_role_check;
alter table public.employees
  add constraint employees_role_check
  check (role in ('employee', 'checker', 'super_admin'));
