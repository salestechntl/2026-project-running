-- Phase 2: inline image payloads until Supabase Storage (Phase 3)
alter table public.run_entries
  add column if not exists strava_images jsonb not null default '[]'::jsonb;

alter table public.weight_entries
  add column if not exists proof_image text;
