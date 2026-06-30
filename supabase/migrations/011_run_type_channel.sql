-- Add run_type "channel" (เพิ่มวิ่งกับช่องทาง)

alter table public.run_entries drop constraint if exists run_entries_run_type_check;

alter table public.run_entries
  add constraint run_entries_run_type_check
  check (run_type in ('discipline', 'mission', 'channel'));
