-- Phase 3: Supabase Storage bucket for entry attachments (private — served via signed URLs from API)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'running-camp-attachments',
  'running-camp-attachments',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
