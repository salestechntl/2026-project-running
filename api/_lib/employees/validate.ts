import type { DbRole } from "../auth/types.js";

export interface EmployeeFormInput {
  employeeId: string;
  name: string;
  position: string;
  department: string;
  managerId: string | null;
  role: DbRole;
  isActive: boolean;
}

export interface FieldError {
  field: keyof EmployeeFormInput | "employeeId";
  message: string;
}

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function normalizeEmployeeInput(raw: Record<string, unknown>): EmployeeFormInput {
  const managerRaw = String(raw.managerId ?? raw.manager_id ?? "").trim();
  const roleRaw = String(raw.role ?? "employee").trim();
  const activeRaw = raw.isActive ?? raw.is_active;

  return {
    employeeId: String(raw.employeeId ?? raw.employee_id ?? "").trim(),
    name: String(raw.name ?? "").trim(),
    position: String(raw.position ?? "").trim(),
    department: String(raw.department ?? "").trim(),
    managerId: managerRaw || null,
    role: roleRaw === "super_admin" ? "super_admin" : "employee",
    isActive: activeRaw === false || activeRaw === "false" ? false : Boolean(activeRaw ?? true),
  };
}

export function validateEmployeeInput(
  input: EmployeeFormInput,
  opts: {
    mode: "create" | "update";
    existingIds: Set<string>;
    superAdminIds: Set<string>;
    actorId: string;
    originalId?: string;
  },
): FieldError[] {
  const errors: FieldError[] = [];

  if (opts.mode === "create") {
    if (!input.employeeId) {
      errors.push({ field: "employeeId", message: "กรุณากรอกรหัสพนักงาน" });
    } else if (!ID_RE.test(input.employeeId)) {
      errors.push({
        field: "employeeId",
        message: "รหัสพนักงานใช้ได้เฉพาะ A-Z, 0-9, _ และ - (สูงสุด 32 ตัว)",
      });
    } else if (opts.existingIds.has(input.employeeId)) {
      errors.push({ field: "employeeId", message: "รหัสพนักงานนี้มีในระบบแล้ว" });
    }
  } else if (!opts.originalId) {
    errors.push({ field: "employeeId", message: "ไม่พบรหัสพนักงาน" });
  }

  const id = opts.originalId ?? input.employeeId;

  if (!input.name) {
    errors.push({ field: "name", message: "กรุณากรอกชื่อ" });
  } else if (input.name.length > 120) {
    errors.push({ field: "name", message: "ชื่อยาวเกิน 120 ตัวอักษร" });
  }

  if (input.position.length > 120) {
    errors.push({ field: "position", message: "ตำแหน่งยาวเกิน 120 ตัวอักษร" });
  }
  if (input.department.length > 120) {
    errors.push({ field: "department", message: "แผนกยาวเกิน 120 ตัวอักษร" });
  }

  if (input.managerId) {
    if (input.managerId === id) {
      errors.push({ field: "managerId", message: "หัวหน้าต้องไม่ใช่ตัวเอง" });
    } else if (!opts.existingIds.has(input.managerId)) {
      errors.push({ field: "managerId", message: "ไม่พบรหัสหัวหน้าในระบบ" });
    }
  }

  if (input.role !== "employee" && input.role !== "super_admin") {
    errors.push({ field: "role", message: "บทบาทไม่ถูกต้อง" });
  }

  if (
    opts.mode === "update" &&
    opts.originalId &&
    opts.superAdminIds.has(opts.originalId) &&
    input.role !== "super_admin"
  ) {
    const others = [...opts.superAdminIds].filter((x) => x !== opts.originalId);
    if (others.length === 0) {
      errors.push({ field: "role", message: "ต้องมี Super Admin อย่างน้อย 1 คนในระบบ" });
    }
  }

  if (opts.mode === "update" && opts.originalId === opts.actorId && input.role !== "super_admin") {
    errors.push({ field: "role", message: "ไม่สามารถลดสิทธิ์ตัวเองได้" });
  }

  return errors;
}

export function fieldErrorsToMessage(errors: FieldError[]): string {
  return errors.map((e) => e.message).join(" · ");
}
