import type { DbRole } from "./auth-types";

export interface EmployeeRecord {
  employeeId: string;
  name: string;
  position: string;
  department: string;
  managerId: string | null;
  role: DbRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeFormState = Omit<EmployeeRecord, "createdAt" | "updatedAt">;

export interface EmployeeFieldError {
  field: keyof EmployeeFormState;
  message: string;
}

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function emptyEmployeeForm(): EmployeeFormState {
  return {
    employeeId: "",
    name: "",
    position: "",
    department: "",
    managerId: null,
    role: "employee",
    isActive: true,
  };
}

export function validateEmployeeForm(
  input: EmployeeFormState,
  opts: {
    mode: "create" | "update";
    existingIds: Set<string>;
    superAdminIds: Set<string>;
    actorId?: string;
    originalId?: string;
  },
): EmployeeFieldError[] {
  const errors: EmployeeFieldError[] = [];
  const id = opts.originalId ?? input.employeeId;

  if (opts.mode === "create") {
    if (!input.employeeId.trim()) {
      errors.push({ field: "employeeId", message: "กรุณากรอกรหัสพนักงาน" });
    } else if (!ID_RE.test(input.employeeId.trim())) {
      errors.push({
        field: "employeeId",
        message: "รหัสพนักงานใช้ได้เฉพาะ A-Z, 0-9, _ และ - (สูงสุด 32 ตัว)",
      });
    } else if (opts.existingIds.has(input.employeeId.trim())) {
      errors.push({ field: "employeeId", message: "รหัสพนักงานนี้มีในระบบแล้ว" });
    }
  }

  if (!input.name.trim()) {
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

  const managerId = input.managerId?.trim() || null;
  if (managerId) {
    if (managerId === id) {
      errors.push({ field: "managerId", message: "หัวหน้าต้องไม่ใช่ตัวเอง" });
    } else if (!opts.existingIds.has(managerId)) {
      errors.push({ field: "managerId", message: "ไม่พบรหัสหัวหน้าในระบบ" });
    }
  }

  if (
    opts.mode === "update" &&
    opts.originalId &&
    opts.superAdminIds.has(opts.originalId) &&
    input.role !== "super_admin" &&
    [...opts.superAdminIds].filter((x) => x !== opts.originalId).length === 0
  ) {
    errors.push({ field: "role", message: "ต้องมี Super Admin อย่างน้อย 1 คนในระบบ" });
  }

  if (opts.mode === "update" && opts.originalId && opts.actorId === opts.originalId && input.role !== "super_admin") {
    errors.push({ field: "role", message: "ไม่สามารถลดสิทธิ์ตัวเองได้" });
  }

  return errors;
}

export function errorsByField(errors: EmployeeFieldError[]): Partial<Record<keyof EmployeeFormState, string>> {
  const map: Partial<Record<keyof EmployeeFormState, string>> = {};
  for (const e of errors) map[e.field] = e.message;
  return map;
}
