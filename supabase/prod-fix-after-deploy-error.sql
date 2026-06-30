-- รันครั้งเดียวใน Supabase Prod หลัง deploy-prod.sql error ที่บรรทัด 010
-- ปลอดภัยถ้ารันซ้ำ (ใช้ IF NOT EXISTS / IF EXISTS)

-- 007 — password_hash (จำเป็นสำหรับ login)
alter table public.employees
  add column if not exists password_hash text null;

-- 006 — expired (ถ้ายังไม่มี)
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

-- 008 — staff edit note
alter table public.run_entries
  add column if not exists staff_edit_note text;

alter table public.weight_entries
  add column if not exists staff_edit_note text;

-- ตั้งรหัสชั่วคราว super_admin 10001 → P@ssw0rd (เปลี่ยนทันทีหลัง login)
update public.employees
set password_hash = '$2b$10$IkZCX0EToT6Hq0sgz1oxfu3bwVS3MXoF1wA16h2wI5JZN/g0BDAb2'
where employee_id = '10001'
  and password_hash is null;
