# Phase 1 Setup — Vercel + Supabase

คู่มือตั้งค่า Foundation: Database, Login API (รหัสพนักงาน + JWT), Deploy

---

## 1. สร้างบัญชี

1. [Supabase](https://supabase.com) → New Project
2. [Vercel](https://vercel.com) → เชื่อม GitHub
3. Push โปรเจคนี้ขึ้น GitHub repo

---

## 2. ตั้งค่า Supabase

### รัน Migration

1. เปิด Supabase Dashboard → **SQL Editor**
2. วางเนื้อหาจาก `supabase/migrations/001_initial_schema.sql` → Run
3. วางเนื้อหาจาก `supabase/seed.sql` → Run

### กำหนด Super Admin (คุณ)

แก้ `employee_id` ใน seed หรือรัน:

```sql
UPDATE public.employees SET role = 'super_admin' WHERE employee_id = 'YOUR_ID';
```

### จดค่า API Keys

Dashboard → **Project Settings → API**:

| ค่า | ใช้ที่ |
|-----|--------|
| Project URL | `VITE_SUPABASE_URL` + `SUPABASE_URL` |
| `anon` `public` | `VITE_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` (server only) |

---

## 3. ตั้งค่า Environment Variables

### Local

```bash
cp .env.example .env.local
# แก้ค่าให้ครบ แล้วสร้าง JWT_SECRET:
openssl rand -hex 32
```

### Vercel (Production / Preview)

Project Settings → Environment Variables:

| Name | Environments |
|------|-------------|
| `VITE_SUPABASE_URL` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_URL` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview, Development |
| `JWT_SECRET` | Production, Preview, Development |

---

## 4. รัน Local

### โหมด Demo (ไม่มี Supabase)

```bash
npm install
npm run dev
```

ใช้ mock data ใน `src/lib/data.ts` — login ด้วย `10002`, `10010` ฯลฯ

### โหมด Production-like (Supabase + API)

```bash
npm install
# ตั้ง .env.local ให้ครบ
npm run dev:full
```

`vercel dev` รัน Frontend + `/api/auth/*` พร้อมกัน

---

## 5. Deploy บน Vercel

```bash
npx vercel link
npx vercel --prod
```

หรือเชื่อม GitHub repo แล้ว Vercel auto-deploy ทุก push

---

## 6. ทดสอบ Login API

```bash
curl -X POST https://YOUR_APP.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"10010"}'
```

ควรได้ `{ "token": "...", "user": {...}, "isLead": false }`

---

## โครงสร้าง Phase 1 ที่เพิ่มเข้ามา

```
api/auth/login.ts      ← ตรวจรหัสพนักงานจาก Supabase → ออก JWT
api/auth/me.ts         ← ตรวจ session
lib/auth/jwt.ts        ← sign / verify JWT
lib/supabase/admin.ts  ← service_role client
supabase/migrations/   ← schema ทั้งหมด (Phase 2–4 รอใช้)
src/lib/auth.tsx       ← รองรับ api + local fallback
```

## ขั้นตอนถัดไป (Phase 2)

- ย้าย `saveRun` / `saveWeight` จาก localStorage → Supabase
- หน้า Super Admin อัปโหลด org CSV
- ลบ mock `EMPLOYEES` ออกจาก frontend
