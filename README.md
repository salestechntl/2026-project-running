# Running Camp 2026

เว็บแอปบันทึกกิจกรรมวิ่งและน้ำหนักของพนักงาน — สร้างด้วย **React + Vite + TypeScript + Tailwind**
(สแตกเดียวกับ Lovable จึงนำขึ้น Lovable เป็น public link ได้ทันที)

## ฟีเจอร์ตามโจทย์

| ข้อ | รายละเอียด | ไฟล์ |
|----|-----------|------|
| 3 | **Login ด้วยรหัสพนักงาน** ตรวจสอบกับข้อมูลที่ RPA ดึงจาก HR DB | [src/pages/Login.tsx](src/pages/Login.tsx), [src/lib/auth.tsx](src/lib/auth.tsx) |
| 4 | **หน้าแรก** แสดงเมนู + ข้อมูลผู้ใช้และหัวหน้า (จากสายบังคับบัญชา) | [src/pages/Home.tsx](src/pages/Home.tsx) |
| 4.1 | **บันทึกข้อมูล** — แท็บ *การวิ่ง* (วันที่/ระยะทาง/เวลา/ภาพ Strava/ภารกิจรายเดือน) และ *น้ำหนัก* (ต้นเดือน–สิ้นเดือน พร้อมแนบภาพทั้งสองช่วง) | [src/pages/LogEntry.tsx](src/pages/LogEntry.tsx) |
| 4.2 | **Dashboard** เปิดลิงก์ Tableau | [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) |
| 4.3 | **หน้าแอดมิน** หัวหน้าทีมดูข้อมูลที่ลูกทีมบันทึก + กด “ขอให้แก้ไข” (reject) เพื่อเปิดสิทธิ์แก้ย้อนหลัง | [src/pages/Admin.tsx](src/pages/Admin.tsx) |

## ภารกิจรายเดือน (Monthly Mission) + กฎการแก้ไข

ออกแบบตามโจทย์: **1 เดือน = 1 ภารกิจ**, คอนฟิกชื่อได้, มองไม่เห็นภารกิจล่วงหน้า, แก้ย้อนหลังต้องผ่านหัวหน้า

- **คอนฟิกที่เดียว** — แก้ชื่อ/วัตถุประสงค์ภารกิจที่ `MONTHLY_MISSIONS` ใน [src/lib/missions.ts](src/lib/missions.ts)
- **ล็อกอนาคต** — เดือนที่ยังไม่ถึงจะแสดงเป็น 🔒 “เผยภารกิจเมื่อถึงเดือนนี้” (ดู Mission Timeline ในหน้าบันทึกข้อมูล)
- **ภารกิจอัตโนมัติ** — ระบบใส่ภารกิจให้ตาม “เดือนของวันที่วิ่ง” ผู้ใช้ไม่ต้องเลือกเอง
- **แก้ไขได้เฉพาะเดือนปัจจุบัน** — รายการของเดือนที่ผ่านไปแล้วจะถูกล็อก
- **แก้ย้อนหลัง** — หัวหน้าเปิดหน้า *ข้อมูลทีม* แล้วกด **“ขอให้แก้ไข” (reject)** → รายการนั้นปลดล็อกให้เจ้าตัวกลับไปแก้ได้ (พร้อมแนบเหตุผล)

> **โหมดทดสอบวันที่:** ตั้ง `VITE_SIMULATED_TODAY` และ `SIMULATED_TODAY` เป็น `yyyy-mm-dd` เดียวกัน (เช่น `2026-07-01`) บน Vercel แล้ว redeploy — ใช้ทดสอบกฎบันทึกวิ่ง/น้ำหนักทั้ง UI และ API **อย่าเปิดบน Production จริง**

> รหัสพนักงาน, ชื่อ จะ **prefill อัตโนมัติและ disable** ในฟอร์ม / วันที่วิ่ง **default เป็นวันนี้** / Mission เป็น **dropdown**

## ทดลองใช้

ติดตั้งและรัน:

```bash
npm install
npm run dev
```

รหัสทดสอบ (mock org data ใน [src/lib/data.ts](src/lib/data.ts)):

- `10002` — **หัวหน้าทีม** (เห็นเมนู "ข้อมูลทีม")
- `10010`, `10011`, `10012` — พนักงานในทีม
- `10001` — ผู้อำนวยการ (เห็นหัวหน้าทีมทั้งหมด)

## การเชื่อมต่อกับสถาปัตยกรรมจริง (ตาม `architecture.drawio`)

แอปนี้คือชั้น **1) FRONTEND** — ไม่มี backend ของตัวเอง ปัจจุบันบันทึกลง `localStorage`
เพื่อให้ทดลองได้ครบ เมื่อขึ้นจริงให้แทนที่จุดต่อไปนี้:

1. **ข้อมูลพนักงาน/สายบังคับบัญชา** — `EMPLOYEES` ใน [src/lib/data.ts](src/lib/data.ts)
   จะถูกแทนด้วยข้อมูลที่ **RPA** ดึงจาก HR DB แล้ว upload เข้า storage (ข้อ 2)
2. **การบันทึกฟอร์ม** — ฟังก์ชัน `saveRun` / `saveWeight` ใน [src/lib/store.ts](src/lib/store.ts)
   เปลี่ยนเป็น `HTTPS POST (JSON)` ไปยัง storage (Supabase / Google Sheet) → RPA อ่านแถว `status = NEW`
3. **Tableau** — แก้ `TABLEAU_URL` ใน [src/lib/data.ts](src/lib/data.ts) เป็นลิงก์ที่ publish จริง

## นำขึ้น Lovable

1. สร้างโปรเจกต์ Lovable (React/Vite) แล้วนำไฟล์ใน `src/` + config ขึ้น (หรือเชื่อม GitHub repo นี้)
2. Lovable มี Tailwind + shadcn อยู่แล้ว — โทเคนสีในไฟล์นี้ใช้รูปแบบ HSL variables แบบเดียวกัน
3. กด **Publish** เพื่อได้ public link

## ดีไซน์

- โทนกลางอบอุ่น + สีหลักเดียว (flame orange) ใช้เฉพาะปุ่มหลัก/โฟกัส
- ฟอนต์ IBM Plex Sans Thai (ไทย) + Inter (ตัวเลข, ใช้ `tabular-nums`)
- สเกลระยะห่าง/มุมโค้ง/เงา สม่ำเสมอ, มี hover/focus/disabled/empty/loading ครบ
- รองรับคีย์บอร์ด, โฟกัสริงชัดเจน, คอนทราสต์ผ่าน WCAG AA, responsive ตั้งแต่จอมือถือ
