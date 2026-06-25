-- Fix employees_role_check before migration 010 (run in Supabase SQL Editor)
-- Safe to re-run. Drops ALL check constraints on employees.role, normalizes data, re-adds constraint.

-- 1) Drop every CHECK constraint on public.employees that references role
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
    raise notice 'dropped constraint %', r.conname;
  end loop;
end $$;

-- 2) Normalize role values (whitespace / case)
update public.employees
set role = lower(trim(role))
where role is distinct from lower(trim(role));

update public.employees
set role = 'checker'
where role = 'admin';

-- 3) Report unexpected roles (should return 0 rows before step 4)
-- select employee_id, role, length(role) as len
-- from public.employees
-- where role not in ('employee', 'checker', 'super_admin');

-- 4) Fallback: unknown roles → employee (comment out if you prefer to fix manually)
update public.employees
set role = 'employee'
where role not in ('employee', 'checker', 'super_admin');

-- 5) Re-create constraint
alter table public.employees
  add constraint employees_role_check
  check (role in ('employee', 'checker', 'super_admin'));
