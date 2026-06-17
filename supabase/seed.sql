-- Seed data for Running Camp 2026
-- Run AFTER 001_initial_schema.sql
-- Replace YOUR_EMPLOYEE_ID with your real employee_id before running in production.

-- Monthly missions (Jul–Dec 2026)
insert into public.monthly_missions (month, name, objective) values
  ('2026-07', 'Run Together', 'เปิดโครงการด้วย Teamwork ระหว่างพื้นที่ ภาค'),
  ('2026-08', 'Branch Buddy Challenge', 'ดึงสาขาเข้ามามีส่วนร่วม'),
  ('2026-09', 'Route of Pride', 'สร้าง Story และความภูมิใจของแต่ละพื้นที่'),
  ('2026-10', 'Road to Race Day', 'วัดความพร้อมก่อนงานวิ่งจริง'),
  ('2026-11', 'Race Month', 'พิสูจน์ผลลัพธ์จากการฝึกซ้อม'),
  ('2026-12', 'Victory Run: Finish Strong, Close the Year', 'ปิดปีด้วย Team Spirit และ Momentum การปิดยอด')
on conflict (month) do update set
  name = excluded.name,
  objective = excluded.objective;

-- Demo org chart (same as src/lib/data.ts — replace via CSV import in production)
insert into public.employees (employee_id, name, position, department, manager_id, role, is_active) values
  ('10001', 'ปวริศา ทองดี', 'ผู้อำนวยการฝ่าย', 'People & Culture', null, 'employee', true),
  ('10002', 'ธนกฤต ศรีสุข', 'ผู้จัดการทีม', 'People & Culture', '10001', 'employee', true),
  ('10010', 'ณัฐวุฒิ พิพัฒน์', 'เจ้าหน้าที่อาวุโส', 'People & Culture', '10002', 'employee', true),
  ('10011', 'สิริกร วงศ์ไทย', 'เจ้าหน้าที่', 'People & Culture', '10002', 'employee', true),
  ('10012', 'ภูริช เจริญพร', 'เจ้าหน้าที่', 'People & Culture', '10002', 'employee', true),
  ('10013', 'อารยา สุวรรณ', 'เจ้าหน้าที่', 'People & Culture', '10002', 'employee', true),
  ('10003', 'กิตติพงศ์ มั่นคง', 'ผู้จัดการทีม', 'Operations', '10001', 'employee', true),
  ('10020', 'ชนิกานต์ แก้วใส', 'เจ้าหน้าที่อาวุโส', 'Operations', '10003', 'employee', true),
  ('10021', 'ดนัย รัตนชัย', 'เจ้าหน้าที่', 'Operations', '10003', 'employee', true),
  ('10022', 'พิมพ์ชนก ใจดี', 'เจ้าหน้าที่', 'Operations', '10003', 'employee', true)
on conflict (employee_id) do update set
  name = excluded.name,
  position = excluded.position,
  department = excluded.department,
  manager_id = excluded.manager_id,
  is_active = excluded.is_active;

-- Super admin: set YOUR employee_id here (demo uses 10001)
-- update public.employees set role = 'super_admin' where employee_id = 'YOUR_EMPLOYEE_ID';
update public.employees set role = 'super_admin' where employee_id = '10001';
