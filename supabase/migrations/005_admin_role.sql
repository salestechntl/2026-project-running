-- Org-wide approver role (approve/reject all teams; not super_admin).

alter table public.employees drop constraint if exists employees_role_check;

alter table public.employees
  add constraint employees_role_check
  check (role in ('employee', 'admin', 'super_admin'));
