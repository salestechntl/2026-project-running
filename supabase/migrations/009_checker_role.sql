-- Rename org-wide approver role: admin → checker (same permissions)

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
