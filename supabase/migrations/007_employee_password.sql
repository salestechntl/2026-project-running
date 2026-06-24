-- Employee login passwords (bcrypt hash, never plain text)
alter table public.employees
  add column if not exists password_hash text null;

comment on column public.employees.password_hash is 'bcrypt hash; null = user must set password on first login';
