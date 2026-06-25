import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSuperAdmin } from "./_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "./_lib/supabase/admin.js";
import { mapEmployee, toDbPayload, type DbEmployeeRow } from "./_lib/employees/map.js";
import {
  fieldErrorsToMessage,
  normalizeEmployeeInput,
  validateEmployeeInput,
} from "./_lib/employees/validate.js";
import { hashPassword, validatePassword } from "./_lib/auth/password.js";
import { normalizeEmployeeId } from "./_lib/employees/normalize-id.js";

async function loadEmployeeContext(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from("employees")
    .select("employee_id, role")
    .order("employee_id", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Pick<DbEmployeeRow, "employee_id" | "role">[];
  const existingIds = new Set(rows.map((r) => r.employee_id));
  const superAdminIds = new Set(rows.filter((r) => r.role === "super_admin").map((r) => r.employee_id));
  return { existingIds, superAdminIds };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = requireSuperAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: "เฉพาะ Super Admin เท่านั้น" });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured on the server" });
  }

  try {
    const supabase = createAdminClient();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("employee_id", { ascending: true });

      if (error) {
        console.error("employees list error:", error);
        return res.status(500).json({ error: "ไม่สามารถโหลดรายชื่อพนักงานได้" });
      }

      return res.status(200).json({
        employees: ((data ?? []) as DbEmployeeRow[]).map(mapEmployee),
      });
    }

    const ctx = await loadEmployeeContext(supabase);

    if (req.method === "POST") {
      const input = normalizeEmployeeInput((req.body ?? {}) as Record<string, unknown>);
      const errors = validateEmployeeInput(input, {
        mode: "create",
        existingIds: ctx.existingIds,
        superAdminIds: ctx.superAdminIds,
        actorId: admin.sub,
      });
      if (errors.length > 0) {
        return res.status(400).json({ error: fieldErrorsToMessage(errors), fields: errors });
      }

      const { data, error } = await supabase
        .from("employees")
        .insert({
          employee_id: input.employeeId,
          ...toDbPayload(input),
        })
        .select("*")
        .single();

      if (error) {
        console.error("employee create error:", error);
        return res.status(500).json({ error: "ไม่สามารถเพิ่มพนักงานได้" });
      }

      await supabase.from("audit_log").insert({
        actor_id: admin.sub,
        action: "employee.create",
        target_type: "employee",
        target_id: input.employeeId,
      });

      return res.status(201).json({ employee: mapEmployee(data as DbEmployeeRow) });
    }

    if (req.method === "PATCH") {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const originalId = normalizeEmployeeId(String(body.employeeId ?? body.employee_id ?? ""));
      if (!originalId) {
        return res.status(400).json({ error: "กรุณาระบุรหัสพนักงาน" });
      }

      const { data: existing, error: fetchError } = await supabase
        .from("employees")
        .select("*")
        .eq("employee_id", originalId)
        .maybeSingle();

      if (fetchError || !existing) {
        return res.status(404).json({ error: "ไม่พบพนักงาน" });
      }

      const current = existing as DbEmployeeRow;
      const resetPassword = body.resetPassword ?? body.reset_password;
      const clearPassword = body.clearPassword === true || body.clear_password === true;

      if (clearPassword && resetPassword !== undefined) {
        return res.status(400).json({ error: "เลือกได้เพียงอย่างใดอย่างหนึ่ง — ตั้งรหัสผ่านใหม่หรือรีเซ็ตเป็นยังไม่ตั้ง" });
      }

      const input = normalizeEmployeeInput({
        employeeId: originalId,
        name: body.name ?? current.name,
        position: body.position ?? current.position,
        department: body.department ?? current.department,
        managerId: body.managerId ?? body.manager_id ?? current.manager_id,
        role: body.role ?? current.role,
        isActive: body.isActive ?? body.is_active ?? current.is_active,
      });

      const errors = validateEmployeeInput(input, {
        mode: "update",
        existingIds: ctx.existingIds,
        superAdminIds: ctx.superAdminIds,
        actorId: admin.sub,
        originalId,
      });
      if (errors.length > 0) {
        return res.status(400).json({ error: fieldErrorsToMessage(errors), fields: errors });
      }

      const dbUpdate: Record<string, unknown> = { ...toDbPayload(input) };

      if (clearPassword) {
        dbUpdate.password_hash = null;
      } else if (resetPassword !== undefined) {
        const password = String(resetPassword);
        const passwordError = validatePassword(password);
        if (passwordError) {
          return res.status(400).json({ error: passwordError });
        }
        dbUpdate.password_hash = await hashPassword(password);
      }

      const { data: updated, error: updateError } = await supabase
        .from("employees")
        .update(dbUpdate)
        .eq("employee_id", originalId)
        .select("*")
        .single();

      if (updateError) {
        console.error("employee update error:", updateError);
        return res.status(500).json({ error: "ไม่สามารถบันทึกการแก้ไขได้" });
      }

      await supabase.from("audit_log").insert({
        actor_id: admin.sub,
        action: "employee.update",
        target_type: "employee",
        target_id: originalId,
      });

      if (clearPassword) {
        await supabase.from("audit_log").insert({
          actor_id: admin.sub,
          action: "auth.clear_password",
          target_type: "employee",
          target_id: originalId,
        });
      } else if (resetPassword !== undefined) {
        await supabase.from("audit_log").insert({
          actor_id: admin.sub,
          action: "auth.reset_password",
          target_type: "employee",
          target_id: originalId,
        });
      }

      return res.status(200).json({ employee: mapEmployee(updated as DbEmployeeRow) });
    }

    if (req.method === "DELETE") {
      const id = normalizeEmployeeId(String(req.query.employee_id ?? req.query.id ?? ""));
      if (!id) {
        return res.status(400).json({ error: "กรุณาระบุรหัสพนักงาน" });
      }

      if (id === admin.sub) {
        return res.status(400).json({ error: "ไม่สามารถลบบัญชีของตนเองได้" });
      }

      if (ctx.superAdminIds.has(id) && ctx.superAdminIds.size <= 1) {
        return res.status(400).json({ error: "ต้องมี Super Admin อย่างน้อย 1 คนในระบบ" });
      }

      const { error } = await supabase.from("employees").delete().eq("employee_id", id);

      if (error) {
        console.error("employee delete error:", error);
        if (error.code === "23503") {
          return res.status(400).json({
            error: "ลบไม่ได้ — พนักงานคนนี้มีข้อมูลการวิ่ง/น้ำหนักในระบบ ลองตั้ง is_active เป็นไม่ใช้งานแทน",
          });
        }
        return res.status(500).json({ error: "ไม่สามารถลบพนักงานได้" });
      }

      await supabase.from("audit_log").insert({
        actor_id: admin.sub,
        action: "employee.delete",
        target_type: "employee",
        target_id: id,
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("employees handler error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
