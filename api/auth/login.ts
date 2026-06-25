import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { signToken } from "../_lib/auth/jwt.js";
import { hashPassword, validatePassword, verifyPassword } from "../_lib/auth/password.js";
import type { AuthUser, DbEmployee, LoginResponse } from "../_lib/auth/types.js";
import { isCheckerRole, normalizeDbRole } from "../_lib/auth/roles.js";
import { normalizeEmployeeId } from "../_lib/employees/normalize-id.js";

const LOGIN_FAILED_MSG = "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง";

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

async function issueLogin(
  supabase: ReturnType<typeof createAdminClient>,
  emp: DbEmployee,
  res: VercelResponse,
) {
  const { count } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("manager_id", emp.employee_id)
    .eq("is_active", true);

  const isLead = (count ?? 0) > 0;
  const isChecker = isCheckerRole(emp.role);
  const isSuperAdmin = emp.role === "super_admin";
  const role = normalizeDbRole(emp.role);

  const token = signToken({
    sub: emp.employee_id,
    name: emp.name,
    position: emp.position,
    department: emp.department,
    managerId: emp.manager_id,
    role,
    isLead,
  });

  const { error: auditError } = await supabase.from("audit_log").insert({
    actor_id: emp.employee_id,
    action: "auth.login",
    target_type: "employee",
    target_id: emp.employee_id,
    metadata: { is_lead: isLead, is_checker: isChecker, is_super_admin: isSuperAdmin },
  });
  if (auditError) console.error("audit_log insert error:", auditError);

  const body: LoginResponse = {
    token,
    user: toAuthUser({ ...emp, role }),
    isLead,
    isChecker,
    isSuperAdmin,
  };

  return res.status(200).json(body);
}

async function handleSetPassword(req: VercelRequest, res: VercelResponse) {
  const employeeId = normalizeEmployeeId(String(req.body?.employee_id ?? req.body?.employeeId ?? ""));
  const password = String(req.body?.password ?? "");

  if (!employeeId) {
    return res.status(400).json({ error: "กรุณากรอกรหัสพนักงาน" });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const supabase = createAdminClient();

  const { data: emp, error } = await supabase
    .from("employees")
    .select("employee_id, password_hash, is_active")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (error) {
    console.error("set_password query error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบรหัสพนักงาน" });
  }

  if (!emp || !emp.is_active) {
    return res.status(400).json({ error: "ไม่พบรหัสพนักงานนี้ในระบบ หรือบัญชีถูกปิดใช้งาน" });
  }

  if (emp.password_hash) {
    return res.status(400).json({ error: "รหัสพนักงานนี้ตั้งรหัสผ่านแล้ว" });
  }

  const passwordHash = await hashPassword(password);
  const canonicalId = emp.employee_id;

  const { error: updateError } = await supabase
    .from("employees")
    .update({ password_hash: passwordHash })
    .eq("employee_id", canonicalId);

  if (updateError) {
    console.error("set_password update error:", updateError);
    return res.status(500).json({ error: "ไม่สามารถบันทึกรหัสผ่านได้" });
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    actor_id: canonicalId,
    action: "auth.set_password",
    target_type: "employee",
    target_id: canonicalId,
  });
  if (auditError) console.error("audit_log insert error:", auditError);

  return res.status(200).json({ ok: true });
}

async function handleChangePassword(req: VercelRequest, res: VercelResponse) {
  const employeeId = normalizeEmployeeId(String(req.body?.employee_id ?? req.body?.employeeId ?? ""));
  const currentPassword = String(req.body?.current_password ?? req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.new_password ?? req.body?.newPassword ?? "");

  if (!employeeId) {
    return res.status(400).json({ error: "กรุณากรอกรหัสพนักงาน" });
  }
  if (!currentPassword) {
    return res.status(400).json({ error: "กรุณากรอกรหัสผ่านเดิม" });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: "รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม" });
  }

  const supabase = createAdminClient();

  const { data: emp, error } = await supabase
    .from("employees")
    .select("employee_id, password_hash, is_active")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (error) {
    console.error("change_password query error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบรหัสพนักงาน" });
  }

  if (!emp || !emp.is_active) {
    return res.status(400).json({ error: "ไม่พบรหัสพนักงานนี้ในระบบ หรือบัญชีถูกปิดใช้งาน" });
  }

  if (!emp.password_hash) {
    return res.status(403).json({
      error: "ยังไม่ได้ตั้งรหัสผ่าน กรุณาสร้างรหัสผ่านก่อน",
      code: "PASSWORD_NOT_SET",
    });
  }

  const valid = await verifyPassword(currentPassword, emp.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
  }

  const passwordHash = await hashPassword(newPassword);
  const canonicalId = emp.employee_id;

  const { error: updateError } = await supabase
    .from("employees")
    .update({ password_hash: passwordHash })
    .eq("employee_id", canonicalId);

  if (updateError) {
    console.error("change_password update error:", updateError);
    return res.status(500).json({ error: "ไม่สามารถเปลี่ยนรหัสผ่านได้" });
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    actor_id: canonicalId,
    action: "auth.change_password",
    target_type: "employee",
    target_id: canonicalId,
  });
  if (auditError) console.error("audit_log insert error:", auditError);

  return res.status(200).json({ ok: true });
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  const employeeId = normalizeEmployeeId(String(req.body?.employee_id ?? req.body?.employeeId ?? ""));
  const password = String(req.body?.password ?? "");

  if (!employeeId) {
    return res.status(400).json({ error: "กรุณากรอกรหัสพนักงาน" });
  }
  if (!password) {
    return res.status(400).json({ error: "กรุณากรอกรหัสผ่าน" });
  }

  const supabase = createAdminClient();

  const { data: emp, error } = await supabase
    .from("employees")
    .select("employee_id, name, position, department, manager_id, role, is_active, password_hash")
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("login query error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบรหัสพนักงาน" });
  }

  if (!emp) {
    return res.status(401).json({ error: LOGIN_FAILED_MSG });
  }

  if (!emp.password_hash) {
    return res.status(403).json({
      error: "ยังไม่ได้ตั้งรหัสผ่าน กรุณาสร้างรหัสผ่านก่อน",
      code: "PASSWORD_NOT_SET",
    });
  }

  const valid = await verifyPassword(password, emp.password_hash);
  if (!valid) {
    return res.status(401).json({ error: LOGIN_FAILED_MSG });
  }

  return issueLogin(supabase, emp as DbEmployee, res);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured on the server" });
  }

  try {
    const action = String(req.body?.action ?? "login").trim();
    if (action === "set_password") {
      return handleSetPassword(req, res);
    }
    if (action === "change_password") {
      return handleChangePassword(req, res);
    }
    return handleLogin(req, res);
  } catch (err) {
    console.error("auth handler error:", err);
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดภายในระบบ";
    return res.status(500).json({ error: message });
  }
}
