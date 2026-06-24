-- Staff edit reason visible to employees on rejected entries
alter table public.run_entries
  add column if not exists staff_edit_note text;

alter table public.weight_entries
  add column if not exists staff_edit_note text;

comment on column public.run_entries.staff_edit_note is 'Admin note when correcting a rejected entry; shown to employee';
comment on column public.weight_entries.staff_edit_note is 'Admin note when correcting a rejected entry; shown to employee';
