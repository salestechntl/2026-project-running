-- Pending entries expire after 5 calendar days from created_at (Asia/Bangkok).

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
