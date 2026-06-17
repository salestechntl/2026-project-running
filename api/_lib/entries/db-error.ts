import type { PostgrestError } from "@supabase/supabase-js";

export function mapRunDbError(error: PostgrestError, action: "insert" | "update"): string {
  if (error.code === "23503") {
    return "ไม่พบรหัสพนักงานในระบบ — ตรวจสอบการนำเข้าข้อมูล Org";
  }
  if (error.code === "42P01") {
    return "ตาราง run_entries ยังไม่มี — รัน Supabase migration 001";
  }
  if (error.code === "23514" || error.message?.includes("mission_month")) {
    return "เดือนภารกิจหรือข้อมูลไม่ถูกต้อง";
  }
  if (error.code === "42703") {
    return "โครงสร้างฐานข้อมูลไม่ครบ — รัน migration 001–003 ใน Supabase";
  }
  return action === "insert" ? "ไม่สามารถบันทึกการวิ่งได้" : "ไม่สามารถบันทึกการแก้ไขได้";
}
