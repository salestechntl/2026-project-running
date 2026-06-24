import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { signToken } from "../_lib/auth/jwt.js";
import type { AuthUser, DbEmployee, LoginResponse } from "../_lib/auth/types.js";

function toAuthUser(emp: DbEmployee): AuthUser {
  return {
    id: emp.employee_id,
    name: emp.name,
    position: emp.position,
    department: emp.department,
    managerId: emp.manager_id,
    role: emp.role,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured on the server" });
  }

  const employeeId = String(req.body?.employee_id ?? req.body?.employeeId ?? "").trim();
  if (!employeeId) {
    return res.status(400).json({ error: "กรุณากรอกรหัสพนักงาน" });
  }

  try {
    const supabase = createAdminClient();

    const { data: emp, error } = await supabase
      .from("employees")
      .select("employee_id, name, position, department, manager_id, role, is_active")
      .eq("employee_id", employeeId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("login query error:", error);
      return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบรหัสพนักงาน" });
    }

    if (!emp) {
      return res.status(401).json({ error: "ไม่พบรหัสพนักงานนี้ในระบบ กรุณาตรวจสอบอีกครั้ง" });
    }

    const { count } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("manager_id", emp.employee_id)
      .eq("is_active", true);

    const isLead = (count ?? 0) > 0;
    const isAdmin = emp.role === "admin";
    const isSuperAdmin = emp.role === "super_admin";

    const token = signToken({
      sub: emp.employee_id,
      name: emp.name,
      position: emp.position,
      department: emp.department,
      managerId: emp.manager_id,
      role: emp.role,
      isLead,
    });

    const { error: auditError } = await supabase.from("audit_log").insert({
      actor_id: emp.employee_id,
      action: "auth.login",
      target_type: "employee",
      target_id: emp.employee_id,
      metadata: { is_lead: isLead, is_admin: isAdmin, is_super_admin: isSuperAdmin },
    });
    if (auditError) console.error("audit_log insert error:", auditError);

    const body: LoginResponse = {
      token,
      user: toAuthUser(emp as DbEmployee),
      isLead,
      isAdmin,
      isSuperAdmin,
    };

    return res.status(200).json(body);
  } catch (err) {
    console.error("login error:", err);
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดภายในระบบ";
    return res.status(500).json({ error: message });
  }
}
