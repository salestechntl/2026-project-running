import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { findEmployee, isChecker as employeeIsChecker, isSuperAdmin as employeeIsSuperAdmin, isTeamLead } from "./data";
import { getAuthMode } from "./auth-config";
import { apiLogin, apiMe, apiSetPassword, apiChangePassword, ApiError, getStoredToken, setStoredToken } from "./api";
import {
  hasLocalPassword,
  setLocalPassword,
  changeLocalPassword,
  verifyLocalPassword,
} from "./local-passwords";
import { normalizeEmployeeId } from "./employee-id";
import { validatePassword } from "./password";
import type { Employee } from "./types";

export interface LoginResult {
  ok: boolean;
  error?: string;
  needsPassword?: boolean;
}

interface AuthState {
  user: Employee | null;
  isLead: boolean;
  isChecker: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  authMode: "api" | "local";
  login: (employeeId: string, password: string) => Promise<LoginResult>;
  setPassword: (employeeId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (
    employeeId: string,
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ ok: boolean; error?: string; needsPassword?: boolean }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const LOCAL_SESSION_KEY = "rc2026.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const authMode = getAuthMode();
  const [user, setUser] = useState<Employee | null>(null);
  const [isLead, setIsLead] = useState(false);
  const [isChecker, setIsChecker] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(authMode === "api");

  const applyUser = useCallback((emp: Employee, lead: boolean, checker: boolean, superAdmin: boolean) => {
    setUser(emp);
    setIsLead(lead);
    setIsChecker(checker);
    setIsSuperAdmin(superAdmin);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setIsLead(false);
    setIsChecker(false);
    setIsSuperAdmin(false);
    setStoredToken(null);
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }, []);

  useEffect(() => {
    if (authMode === "local") {
      const id = localStorage.getItem(LOCAL_SESSION_KEY);
      if (id) {
        const emp = findEmployee(id);
        if (emp) applyUser(emp, isTeamLead(emp.id), employeeIsChecker(emp), employeeIsSuperAdmin(emp));
      }
      setLoading(false);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiMe()
      .then((data) => {
        applyUser(
          {
            id: data.user.id,
            name: data.user.name,
            position: data.user.position,
            department: data.user.department,
            managerId: data.user.managerId,
            role: data.user.role,
          },
          data.isLead,
          data.isChecker,
          data.isSuperAdmin,
        );
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => setLoading(false));
  }, [authMode, applyUser, clearSession]);

  const login: AuthState["login"] = async (employeeId, password) => {
    const id = normalizeEmployeeId(employeeId);
    if (!id) return { ok: false, error: "กรุณากรอกรหัสพนักงาน" };
    if (!password) return { ok: false, error: "กรุณากรอกรหัสผ่าน" };

    if (authMode === "local") {
      const emp = findEmployee(id);
      if (!emp) return { ok: false, error: "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง" };
      if (!hasLocalPassword(id)) {
        return { ok: false, needsPassword: true, error: "ยังไม่ได้ตั้งรหัสผ่าน กรุณาสร้างรหัสผ่านก่อน" };
      }
      if (!verifyLocalPassword(id, password)) {
        return { ok: false, error: "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง" };
      }
      localStorage.setItem(LOCAL_SESSION_KEY, emp.id);
      applyUser(emp, isTeamLead(emp.id), employeeIsChecker(emp), employeeIsSuperAdmin(emp));
      return { ok: true };
    }

    try {
      const data = await apiLogin(id, password);
      setStoredToken(data.token);
      applyUser(
        {
          id: data.user.id,
          name: data.user.name,
          position: data.user.position,
          department: data.user.department,
          managerId: data.user.managerId,
          role: data.user.role,
        },
        data.isLead,
        data.isChecker,
        data.isSuperAdmin,
      );
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.code === "PASSWORD_NOT_SET") {
        return { ok: false, needsPassword: true, error: err.message };
      }
      return { ok: false, error: err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ" };
    }
  };

  const setPassword: AuthState["setPassword"] = async (employeeId, password) => {
    const id = normalizeEmployeeId(employeeId);
    if (!id) return { ok: false, error: "กรุณากรอกรหัสพนักงาน" };
    const passwordError = validatePassword(password);
    if (passwordError) return { ok: false, error: passwordError };

    if (authMode === "local") {
      const emp = findEmployee(id);
      if (!emp) return { ok: false, error: "ไม่พบรหัสพนักงานนี้ในระบบ หรือบัญชีถูกปิดใช้งาน" };
      const result = setLocalPassword(id, password);
      if (!result.ok) return result;
      return { ok: true };
    }

    try {
      await apiSetPassword(id, password);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "ไม่สามารถตั้งรหัสผ่านได้" };
    }
  };

  const changePassword: AuthState["changePassword"] = async (employeeId, currentPassword, newPassword) => {
    const id = normalizeEmployeeId(employeeId);
    if (!id) return { ok: false, error: "กรุณากรอกรหัสพนักงาน" };
    if (!currentPassword) return { ok: false, error: "กรุณากรอกรหัสผ่านเดิม" };

    const passwordError = validatePassword(newPassword);
    if (passwordError) return { ok: false, error: passwordError };
    if (currentPassword === newPassword) {
      return { ok: false, error: "รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม" };
    }

    if (authMode === "local") {
      const emp = findEmployee(id);
      if (!emp) return { ok: false, error: "ไม่พบรหัสพนักงานนี้ในระบบ หรือบัญชีถูกปิดใช้งาน" };
      return changeLocalPassword(id, currentPassword, newPassword);
    }

    try {
      await apiChangePassword(id, currentPassword, newPassword);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.code === "PASSWORD_NOT_SET") {
        return { ok: false, needsPassword: true, error: err.message };
      }
      return { ok: false, error: err instanceof Error ? err.message : "ไม่สามารถเปลี่ยนรหัสผ่านได้" };
    }
  };

  const logout = () => clearSession();

  return (
    <AuthContext.Provider
      value={{ user, isLead, isChecker, isSuperAdmin, loading, authMode, login, setPassword, changePassword, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
