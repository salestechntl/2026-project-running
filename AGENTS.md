# Running Camp 2026 — คู่มือสำหรับ Cursor / AI Agent

เอกสารนี้อธิบาย **ขอบเขตโปรเจกต์ กฎธุรกิจ สถาปัตยกรรม และแนวทางพัฒนา** เพื่อให้ agent แก้โค้ดได้ตรงบริบท โดยไม่ต้องสำรวจทั้ง repo ทุกครั้ง

Production: `https://2026-project-running.vercel.app`  
Deploy: `vercel --prod` (หลังตั้ง env บน Vercel แล้ว)

---

## 1. วัตถุประสงค์

เว็บแอปสำหรับพนักงาน **บันทึกการวิ่งและน้ำหนัก** ภายใต้โครงการ Running Camp 2026

- พนักงาน: login → บันทึกกิจกรรม → ดูสถานะ
- หัวหน้าทีม (Lead): อนุมัติ/ไม่อนุมัติรายการลูกทีม
- Checker: ดูทั้งองค์กร + แก้ไขรายการ (staff edit) ภายในกฎ
- Super Admin: จัดการพนักงาน, โครงสร้าง org, export

UI ภาษาไทยเป็นหลัก ข้อความ error/label ควรเป็นภาษาไทยที่เข้าใจง่าย

---

## 2. Tech stack

| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, React Router |
| API | Vercel Serverless Functions (`api/**/*.ts`) |
| Database / Auth | Supabase (Postgres + Storage) |
| Auth token | JWT (`JWT_SECRET`) ฝั่ง server |
| Icons | lucide-react |
| ไม่ใช้ | Next.js, shadcn CLI (มี UI แบบ custom ใน `src/components/ui.tsx`) |

### รันพัฒนา

```bash
npm install
npm run dev          # frontend อย่างเดียว (local mode ได้)
npm run dev:full     # vercel dev — รวม API
npm run build        # tsc + vite build
```

- **API mode**: ต้องมี Supabase env + ใช้ `vercel dev` หรือ deploy บน Vercel
- **Local mode**: ไม่มี `VITE_SUPABASE_URL` → ใช้ mock data + `localStorage` (`src/lib/store.ts`)

---

## 3. โครงสร้างโฟลเดอร์สำคัญ

```
src/
  pages/           # หน้าจอหลัก (Login, Home, LogEntry, Admin, …)
  components/      # AppShell, ui.tsx, DateSelect, SimulatedDateBanner
  lib/
    missions.ts    # กฎวันที่วิ่ง/น้ำหนัก + monthly missions (แหล่งความจริงฝั่ง UI)
    effective-date.ts   # วันนี้ + โหมดจำลอง (VITE_SIMULATED_TODAY)
    entries.ts       # facade: เรียก API หรือ local store
    api.ts           # HTTP client ไป /api/*
    auth.tsx         # AuthProvider, login, roles
    store.ts         # localStorage backend (dev/demo)
api/
  _lib/            # shared server logic (อย่า import จาก src/)
    entries/         # weight-window, run-date-bounds, map, expire
    time/effective-date.ts  # SIMULATED_TODAY (server)
    team/access.ts   # สิทธิ์ทีม / subordinates
    auth/            # JWT, password, require
  runs/, weights/, employees/, auth/, team/, org/, export/
```

**กฎสำคัญ:** กฎวันที่/น้ำหนักต้องสอดคล้องกัน **ทั้ง** `src/lib/missions.ts` (UI) **และ** `api/_lib/entries/*.ts` (validation server)

---

## 4. เส้นทางและบทบาท

### Routes (`src/App.tsx`)

| Path | หน้า | สิทธิ์ |
|------|------|--------|
| `/` | Login | public |
| `/set-password` | สร้างรหัสผ่านครั้งแรก | public |
| `/change-password` | เปลี่ยนรหัสผ่าน | public |
| `/app` | Home | login |
| `/app/log` | บันทึกข้อมูล (วิ่ง/น้ำหนัก) | login |
| `/app/dashboard` | Tableau embed | login |
| `/app/admin` | ข้อมูลทีม | Lead / Checker / Super Admin |
| `/app/employees` | จัดการพนักงาน | Super Admin |
| `/app/super-admin` | import org | Super Admin |
| `/app/export` | export CSV | Super Admin |

### บทบาท (`employees.role`)

| Role | ความสามารถ |
|------|------------|
| `employee` | บันทึกของตนเอง |
| `checker` | ดูทั้ง org, อนุมัติ, staff edit (เดิมชื่อ `admin` ยังรองรับใน JWT เก่า) |
| `super_admin` | ทุกอย่างของ checker + จัดการพนักงาน/org/export |

- **Lead** = มี `manager_id` ชี้มาที่ผู้ใช้ → เห็นลูกทีมตามสายบังคับบัญชา (`api/_lib/team/access.ts`)
- Lead อนุมัติรายการตัวเองได้ทันที (auto-approved)

---

## 5. กฎธุรกิจหลัก (ต้องรักษาให้ UI = API)

### 5.1 การวิ่ง

- พนักงานเลือกวันที่ได้ **เฉพาะวันนี้และเมื่อวาน** (`runDateBounds`)
- Checker แก้ไขวันที่ได้ช่วงกว้างกว่า (`staffRunDateBounds` — วันที่ 1–7 ของเดือนรวมเดือนก่อน)
- ภารกิจรายเดือน: 1 เดือน = 1 mission (`MONTHLY_MISSIONS` ใน `missions.ts`)
- เดือนอนาคต: ไม่แสดงชื่อภารกิจ (`visibleMissionForDate`)
- รายการ `pending` หมดอายุหลัง 5 วัน (cron + `expirePendingEntries`)

### 5.2 น้ำหนัก

**ไม่มี date picker** — ระบบกำหนดเดือน + ช่วง (ต้น/สิ้นเดือน) อัตโนมัติ

| ช่วง | เปิดบันทึก |
|------|------------|
| ต้นเดือน (`start`) | เฉพาะวันที่ 1 ของเดือนนั้น |
| สิ้นเดือน (`end`) | วันสุดท้ายของเดือน M ถึงวันที่ 2 ของเดือน M+1 |

- `endWeightTargetMonth()`: วันที่ 1–2 ของเดือนปัจจุบัน → ชี้ไปเดือนก่อนหน้า (กรอกย้อนหลัง)
- รายการ `rejected`: ส่งใหม่ได้เฉพาะในช่วงเวลาเปิดรับ
- มี `pending` ของช่วงนั้นอยู่แล้ว → แก้ไข pending ได้ในช่วงเวลา

### 5.3 สถานะรายการ (`EntryStatus`)

`pending` → `approved` | `rejected` | `expired`

- Reject ต้องมีเหตุผล (`RejectReasonDialog`)
- Staff edit (Checker): ต้องมี `staffEditNote` อย่างน้อย 5 ตัวอักษร
- รายการ rejected แก้ไขตรงไม่ได้ — ต้องส่งรายการใหม่

### 5.4 รหัสผ่าน

- รูปแบบ: 4–30 ตัว, ตัวอักษร/ตัวเลข/สัญลักษณ์ที่กำหนด (`src/lib/password.ts`)
- ลืมรหัสผ่าน: ติดต่อ `LST-Sales-Technology@tidlor.com` (ข้อความบนหน้า Login)
- Super Admin ตั้ง/ล้างรหัสผ่านได้จากหน้าจัดการพนักงาน (`resetPassword` / `clearPassword` ใน `PATCH /api/employees`)

---

## 6. โหมดจำลองวันที่ (ทดสอบเท่านั้น)

ตั้ง **ทั้งสองตัว** เป็นค่า `yyyy-mm-dd` เดียวกัน แล้ว redeploy:

```
VITE_SIMULATED_TODAY=2026-07-01   # frontend build-time
SIMULATED_TODAY=2026-07-01        # API runtime
```

- UI: `src/lib/effective-date.ts` + `SimulatedDateBanner` (sticky ใต้ header, ไม่ทับเมนู)
- API: `api/_lib/time/effective-date.ts`
- **อย่าเปิดบน production จริง**

---

## 7. แนวทางพัฒนา (สำหรับ agent)

### ทำ

1. **แก้น้อยที่สุดที่ถูกต้อง** — อย่า refactor นอก scope
2. **คงรูปแบบเดิม** — อ่านไฟล์รอบๆ ก่อนเพิ่ม component/helper
3. **ซิงก์ UI + API** เมื่อแก้กฎวันที่/น้ำหนัก/สิทธิ์
4. **ข้อความ UI ภาษาไทย** — error จาก API แสดงตรงๆ ได้
5. **Modal** ใช้ `ConfirmDialog`, `AlertDialog`, `RejectReasonDialog` จาก `ui.tsx` — ห้าม `window.alert` / `window.confirm`
6. **Responsive** — หน้า Admin ใช้ stack layout บนมือถือ (`flex-col md:flex-row`) สำหรับรายการวิ่ง/น้ำหนัก
7. **รันห `npm run build`** หลังแก้ TypeScript

### อย่าทำ

- อย่า commit/push/deploy ถ้าผู้ใช้ไม่ขอ
- อย่าใส่ secret ใน repo
- อย่า import `src/` จาก `api/` หรือกลับกัน
- อย่าเพิ่ม dependency ใหม่ถ้าไม่จำเป็น
- อย่าสร้างไฟล์ markdown/doc เพิ่มโดยไม่ถูกขอ
- อย่าใช้ `SIMULATED_CURRENT_MONTH` แบบ hardcode (เลิกใช้แล้ว — ใช้ env แทน)

### UI / Design tokens

- สีผ่าน CSS variables (`hsl(var(--primary))` ฯลฯ) ใน `src/index.css`
- ตัวเลขใช้ class `tnum` (tabular-nums)
- Layout หลัก: `AppShell` (header sticky + mobile bottom tab)
- Component พื้นฐาน: `Button`, `Field`, `Input`, `Card`, `Badge` ใน `src/components/ui.tsx`

---

## 8. ไฟล์ที่มักแตะตามงาน

| งาน | ไฟล์ |
|-----|------|
| กฎวิ่ง/น้ำหนัก/mission | `src/lib/missions.ts`, `api/_lib/entries/weight-window.ts`, `api/_lib/entries/run-date-bounds.ts` |
| ฟอร์มบันทึก | `src/pages/LogEntry.tsx`, `src/lib/save-run.ts`, `src/lib/save-weight.ts` |
| อนุมัติทีม | `src/pages/Admin.tsx` |
| Auth | `src/lib/auth.tsx`, `api/auth/login.ts` |
| พนักงาน CRUD | `src/pages/EmployeeAdmin.tsx`, `api/employees.ts` |
| Org import | `src/pages/SuperAdmin.tsx`, `api/org/import.ts` |
| รูปแนบ | `api/_lib/storage/attachments.ts` |
| Env ตัวอย่าง | `.env.example` |

---

## 9. Data flow สั้นๆ

```
Browser → src/lib/entries.ts (getAuthMode)
   ├─ local → src/lib/store.ts (localStorage)
   └─ api   → src/lib/api.ts → /api/* → Supabase (service role)
```

- Cache: `src/lib/request-cache.ts` + event `DATA_CHANGED_EVENT` หลังบันทึก
- Hooks: `src/lib/hooks/useEntries.ts`, `useTeam.ts`, `useHomeStats`

---

## 10. การทดสอบที่ควรรู้

- Local mock users: `src/lib/data.ts` (เช่น `10002` = lead)
- ทดสอบกฎวันที่: ตั้ง `VITE_SIMULATED_TODAY` + `SIMULATED_TODAY` แล้ว deploy preview
- ตัวอย่างวันที่ 2026-07-01: เปิดต้นเดือน ก.ค. + สิ้นเดือน มิ.ย. พร้อมกัน

---

## 11. งานที่ยังไม่ทำ / ข้อจำกัดที่รู้

- รายชื่อทีมบนมือถือ: ยัง scroll ยาว (มี pagination 5 คน + sort อัปเดตล่าสุดแล้ว) — อาจทำ sticky member picker ในอนาคต
- โหลด Admin ทั้ง org: fetch runs/weights ทุกคนแบบ parallel — อาจช้าเมื่อพนักงาน ~250 คน (ยังไม่มี summary API)
- รูปเก่าที่ `is_current=false` อาจยังค้างใน Supabase Storage (ไม่ได้ลบอัตโนมัติ)
- README บางส่วนอ้าง architecture เดิม (RPA/Sheet) — โค้ดจริงใช้ Supabase แล้ว

---

## 12. Git / Deploy

- Branch หลัก: `master`
- Commit เฉพาะเมื่อผู้ใช้ขอ
- หลังเปลี่ยน `VITE_*` ต้อง rebuild/redeploy บน Vercel

---

*อัปเดตล่าสุดตามสถานะโปรเจกต์ มิ.ย. 2026 — แก้เอกสารนี้เมื่อกฎธุรกิจหรือสถาปัตยกรรมเปลี่ยนอย่างมีนัยสำคัญ*
