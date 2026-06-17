import type { DbRole } from "../auth/types.js";

export interface DbEmployeeRow {
  employee_id: string;
  name: string;
  position: string;
  department: string;
  manager_id: string | null;
  role: DbRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDto {
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

export function mapEmployee(row: DbEmployeeRow): EmployeeDto {
  return {
    employeeId: row.employee_id,
    name: row.name,
    position: row.position,
    department: row.department,
    managerId: row.manager_id,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDbPayload(dto: {
  name: string;
  position: string;
  department: string;
  managerId: string | null;
  role: DbRole;
  isActive: boolean;
}) {
  return {
    name: dto.name,
    position: dto.position,
    department: dto.department,
    manager_id: dto.managerId,
    role: dto.role,
    is_active: dto.isActive,
  };
}
