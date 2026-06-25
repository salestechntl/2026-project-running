import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, UserCog, RefreshCw, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  apiCreateEmployee,
  apiDeleteEmployee,
  apiFetchEmployees,
  apiResetEmployeePassword,
  apiUpdateEmployee,
} from "@/lib/api";
import {
  emptyEmployeeForm,
  errorsByField,
  validateEmployeeForm,
  type EmployeeFormState,
  type EmployeeRecord,
} from "@/lib/employee-admin";
import { isCheckerRole } from "@/lib/roles";
import { Badge, Button, Card, ConfirmDialog, Field, Input, PasswordInput, Select, LoadingBlock } from "@/components/ui";
import { cn } from "@/lib/utils";
import { passwordsMatch, validatePassword, validatePasswordCharacters, PASSWORD_FORMAT_HINT } from "@/lib/password";

const ROLE_LABEL = { employee: "พนักงาน", checker: "Checker", super_admin: "Super Admin" } as const;

type ActiveFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | "employee" | "checker" | "super_admin";

function toForm(row: EmployeeRecord): EmployeeFormState {
  return {
    employeeId: row.employeeId,
    name: row.name,
    position: row.position,
    department: row.department,
    managerId: row.managerId,
    role: row.role,
    isActive: row.isActive,
  };
}

function diffLines(before: EmployeeFormState, after: EmployeeFormState): string[] {
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`ชื่อ: ${before.name} → ${after.name}`);
  if (before.position !== after.position) lines.push(`ตำแหน่ง: ${before.position || "—"} → ${after.position || "—"}`);
  if (before.department !== after.department) lines.push(`แผนก: ${before.department || "—"} → ${after.department || "—"}`);
  if (before.managerId !== after.managerId) {
    lines.push(`หัวหน้า: ${before.managerId ?? "—"} → ${after.managerId ?? "—"}`);
  }
  if (before.role !== after.role) lines.push(`บทบาท: ${ROLE_LABEL[before.role]} → ${ROLE_LABEL[after.role]}`);
  if (before.isActive !== after.isActive) {
    lines.push(`สถานะ: ${before.isActive ? "ใช้งาน" : "ไม่ใช้งาน"} → ${after.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}`);
  }
  return lines;
}

export default function EmployeeAdmin() {
  const { user, authMode } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<string>();

  const [filterId, setFilterId] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterRole, setFilterRole] = useState<RoleFilter>("all");
  const [filterActive, setFilterActive] = useState<ActiveFilter>("all");

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<EmployeeFormState>(emptyEmployeeForm);
  const [addErrors, setAddErrors] = useState<Partial<Record<keyof EmployeeFormState, string>>>({});
  const [addSaving, setAddSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EmployeeFormState | null>(null);
  const [editOriginal, setEditOriginal] = useState<EmployeeFormState | null>(null);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EmployeeFormState, string>>>({});
  const [confirmSave, setConfirmSave] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState<string>();
  const [resetConfirmError, setResetConfirmError] = useState<string>();
  const [resetSaving, setResetSaving] = useState(false);

  const ctx = useMemo(() => {
    const existingIds = new Set(employees.map((e) => e.employeeId));
    const superAdminIds = new Set(employees.filter((e) => e.role === "super_admin").map((e) => e.employeeId));
    return { existingIds, superAdminIds };
  }, [employees]);

  const filtered = useMemo(() => {
    const idQ = filterId.trim().toLowerCase();
    const nameQ = filterName.trim().toLowerCase();
    return employees.filter((e) => {
      if (idQ && !e.employeeId.toLowerCase().includes(idQ)) return false;
      if (nameQ && !e.name.toLowerCase().includes(nameQ)) return false;
      if (filterRole !== "all") {
        if (filterRole === "checker") {
          if (!isCheckerRole(e.role)) return false;
        } else if (e.role !== filterRole) return false;
      }
      if (filterActive === "active" && !e.isActive) return false;
      if (filterActive === "inactive" && e.isActive) return false;
      return true;
    });
  }, [employees, filterId, filterName, filterRole, filterActive]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(undefined), 4000);
  }, []);

  const load = useCallback(async () => {
    if (authMode !== "api") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setEmployees(await apiFetchEmployees());
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [authMode]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(row: EmployeeRecord) {
    const form = toForm(row);
    setEditingId(row.employeeId);
    setEditDraft(form);
    setEditOriginal(form);
    setEditErrors({});
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditOriginal(null);
    setEditErrors({});
    setConfirmSave(false);
  }

  function requestSaveEdit() {
    if (!editDraft || !editOriginal || !editingId) return;
    const errs = validateEmployeeForm(editDraft, {
      mode: "update",
      existingIds: ctx.existingIds,
      superAdminIds: ctx.superAdminIds,
      actorId: user?.id,
      originalId: editingId,
    });
    setEditErrors(errorsByField(errs));
    if (errs.length > 0) return;
    setConfirmSave(true);
  }

  async function commitSaveEdit() {
    if (!editDraft || !editingId) return;
    setEditSaving(true);
    try {
      await apiUpdateEmployee(editingId, {
        name: editDraft.name,
        position: editDraft.position,
        department: editDraft.department,
        managerId: editDraft.managerId?.trim() || null,
        role: editDraft.role,
        isActive: editDraft.isActive,
      });
      flash("บันทึกการแก้ไขเรียบร้อยแล้ว");
      cancelEdit();
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setEditSaving(false);
      setConfirmSave(false);
    }
  }

  async function submitAdd() {
    const draft = { ...addForm, employeeId: addForm.employeeId.trim() };
    const errs = validateEmployeeForm(draft, {
      mode: "create",
      existingIds: ctx.existingIds,
      superAdminIds: ctx.superAdminIds,
      actorId: user?.id,
    });
    setAddErrors(errorsByField(errs));
    if (errs.length > 0) return;

    setAddSaving(true);
    try {
      await apiCreateEmployee({
        ...draft,
        managerId: draft.managerId?.trim() || null,
      });
      flash("เพิ่มพนักงานเรียบร้อยแล้ว");
      setAddForm(emptyEmployeeForm());
      setShowAdd(false);
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setAddSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleteSaving(true);
    try {
      await apiDeleteEmployee(deleteId);
      flash("ลบพนักงานเรียบร้อยแล้ว");
      if (editingId === deleteId) cancelEdit();
      setDeleteId(null);
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleteSaving(false);
    }
  }

  function openResetPassword(employeeId: string) {
    setResetId(employeeId);
    setResetPassword("");
    setResetConfirm("");
    setResetPasswordError(undefined);
    setResetConfirmError(undefined);
  }

  function closeResetPassword() {
    setResetId(null);
    setResetPassword("");
    setResetConfirm("");
    setResetPasswordError(undefined);
    setResetConfirmError(undefined);
  }

  async function confirmResetPassword() {
    if (!resetId) return;
    setResetPasswordError(undefined);
    setResetConfirmError(undefined);

    const passwordError = validatePassword(resetPassword);
    if (passwordError) {
      setResetPasswordError(passwordError);
      return;
    }
    const matchError = passwordsMatch(resetPassword, resetConfirm);
    if (matchError) {
      setResetConfirmError(matchError);
      return;
    }

    setResetSaving(true);
    try {
      const updated = await apiResetEmployeePassword(resetId, resetPassword);
      setEmployees((rows) => rows.map((r) => (r.employeeId === updated.employeeId ? updated : r)));
      flash(`รีเซ็ตรหัสผ่านของ ${resetId} เรียบร้อยแล้ว`);
      closeResetPassword();
    } catch (e) {
      setResetPasswordError(e instanceof Error ? e.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    } finally {
      setResetSaving(false);
    }
  }

  if (authMode !== "api") {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-[hsl(32_80%_34%)]">
        จัดการพนักงานใช้ได้ในโหมด API (เชื่อมต่อ Supabase) เท่านั้น
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground">
            <UserCog className="h-7 w-7 text-primary" />
            จัดการพนักงาน
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ดู แก้ไข เพิ่ม และลบข้อมูลในตาราง employees
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            รีเฟรช
          </Button>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-4 w-4" />
            เพิ่มพนักงาน
          </Button>
        </div>
      </header>

      {toast && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          {toast}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="กรองรหัสพนักงาน" htmlFor="f-id">
          <Input id="f-id" placeholder="เช่น 10002" value={filterId} onChange={(e) => setFilterId(e.target.value)} className="tnum" />
        </Field>
        <Field label="กรองชื่อ" htmlFor="f-name">
          <Input id="f-name" placeholder="ชื่อพนักงาน" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
        </Field>
        <Field label="กรองบทบาท" htmlFor="f-role">
          <Select id="f-role" value={filterRole} onChange={(e) => setFilterRole(e.target.value as RoleFilter)}>
            <option value="all">ทั้งหมด</option>
            <option value="employee">พนักงาน</option>
            <option value="checker">Checker</option>
            <option value="super_admin">Super Admin</option>
          </Select>
        </Field>
        <Field label="กรองสถานะ" htmlFor="f-active">
          <Select id="f-active" value={filterActive} onChange={(e) => setFilterActive(e.target.value as ActiveFilter)}>
            <option value="all">ทั้งหมด</option>
            <option value="active">ใช้งาน</option>
            <option value="inactive">ไม่ใช้งาน</option>
          </Select>
        </Field>
      </Card>

      {showAdd && (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-foreground">เพิ่มพนักงานใหม่</h2>
          <EmployeeFields
            form={addForm}
            errors={addErrors}
            idEditable
            onChange={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowAdd(false); setAddForm(emptyEmployeeForm()); setAddErrors({}); }}>
              ยกเลิก
            </Button>
            <Button onClick={() => void submitAdd()} disabled={addSaving}>
              {addSaving ? "กำลังบันทึก…" : "บันทึกรายการใหม่"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <LoadingBlock label="กำลังโหลดรายชื่อพนักงาน…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">รหัส</th>
                  <th className="px-3 py-2.5">ชื่อ</th>
                  <th className="px-3 py-2.5">ตำแหน่ง</th>
                  <th className="px-3 py-2.5">แผนก</th>
                  <th className="px-3 py-2.5">หัวหน้า</th>
                  <th className="px-3 py-2.5">บทบาท</th>
                  <th className="px-3 py-2.5">สถานะ</th>
                  <th className="px-3 py-2.5">รหัสผ่าน</th>
                  <th className="px-3 py-2.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                      ไม่พบข้อมูลตามตัวกรอง
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const editing = editingId === row.employeeId;
                    const draft = editing && editDraft ? editDraft : toForm(row);
                    return (
                      <tr key={row.employeeId} className={cn(editing && "bg-primary/[0.04]")}>
                        <td className="px-3 py-2 tnum font-medium">{row.employeeId}</td>
                        <CellInput
                          editing={editing}
                          value={draft.name}
                          error={editErrors.name}
                          onChange={(v) => setEditDraft((d) => (d ? { ...d, name: v } : d))}
                        />
                        <CellInput
                          editing={editing}
                          value={draft.position}
                          error={editErrors.position}
                          onChange={(v) => setEditDraft((d) => (d ? { ...d, position: v } : d))}
                        />
                        <CellInput
                          editing={editing}
                          value={draft.department}
                          error={editErrors.department}
                          onChange={(v) => setEditDraft((d) => (d ? { ...d, department: v } : d))}
                        />
                        <CellInput
                          editing={editing}
                          value={draft.managerId ?? ""}
                          error={editErrors.managerId}
                          placeholder="—"
                          className="tnum"
                          onChange={(v) => setEditDraft((d) => (d ? { ...d, managerId: v.trim() || null } : d))}
                        />
                        <td className="px-3 py-2">
                          {editing ? (
                            <Select
                              value={draft.role}
                              onChange={(e) =>
                                setEditDraft((d) =>
                                  d ? { ...d, role: e.target.value as EmployeeFormState["role"] } : d,
                                )
                              }
                              className="h-9 text-xs"
                            >
                              <option value="employee">พนักงาน</option>
                              <option value="checker">Checker</option>
                              <option value="super_admin">Super Admin</option>
                            </Select>
                          ) : (
                            <Badge tone={row.role === "super_admin" || isCheckerRole(row.role) ? "accent" : "neutral"}>
                              {isCheckerRole(row.role) ? ROLE_LABEL.checker : ROLE_LABEL[row.role]}
                            </Badge>
                          )}
                          {editing && editErrors.role && (
                            <p className="mt-1 text-xs text-danger">{editErrors.role}</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <Select
                              value={draft.isActive ? "true" : "false"}
                              onChange={(e) =>
                                setEditDraft((d) => (d ? { ...d, isActive: e.target.value === "true" } : d))
                              }
                              className="h-9 text-xs"
                            >
                              <option value="true">ใช้งาน</option>
                              <option value="false">ไม่ใช้งาน</option>
                            </Select>
                          ) : (
                            <Badge tone={row.isActive ? "success" : "neutral"}>
                              {row.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={row.hasPassword ? "success" : "neutral"}>
                            {row.hasPassword ? "ตั้งแล้ว" : "ยังไม่ตั้ง"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            {editing ? (
                              <>
                                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={editSaving}>
                                  ยกเลิก
                                </Button>
                                <Button size="sm" onClick={requestSaveEdit} disabled={editSaving}>
                                  บันทึก
                                </Button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openResetPassword(row.employeeId)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label="รีเซ็ตรหัสผ่าน"
                                  title="รีเซ็ตรหัสผ่าน"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label="แก้ไข"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteId(row.employeeId)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger"
                                  aria-label="ลบ"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          แสดง {filtered.length} จาก {employees.length} รายการ
        </p>
      </Card>

      <ConfirmDialog
        open={confirmSave}
        title="ยืนยันบันทึกการแก้ไข?"
        tone="primary"
        confirmLabel={editSaving ? "กำลังบันทึก…" : "ยืนยันบันทึก"}
        message={
          editDraft && editOriginal ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {diffLines(editOriginal, editDraft).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            "บันทึกการเปลี่ยนแปลงข้อมูลพนักงาน"
          )
        }
        onConfirm={() => void commitSaveEdit()}
        onCancel={() => setConfirmSave(false)}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="ลบพนักงานคนนี้?"
        message={
          deleteId ? (
            <span>
              รหัส <strong className="tnum">{deleteId}</strong> จะถูกลบถาวรจากระบบ — ไม่สามารถกู้คืนได้
            </span>
          ) : undefined
        }
        confirmLabel={deleteSaving ? "กำลังลบ…" : "ลบรายการ"}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteId(null)}
      />

      {resetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md space-y-4 p-5 shadow-xl">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">รีเซ็ตรหัสผ่าน</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ตั้งรหัสผ่านใหม่ให้รหัสพนักงาน <span className="tnum font-medium text-foreground">{resetId}</span>
              </p>
            </div>
            <Field
              label="รหัสผ่านใหม่"
              required
              htmlFor="reset-pw"
              hint={PASSWORD_FORMAT_HINT}
              error={resetPasswordError}
            >
              <PasswordInput
                id="reset-pw"
                autoComplete="new-password"
                value={resetPassword}
                onChange={(e) => {
                  const value = e.target.value;
                  setResetPassword(value);
                  setResetPasswordError(validatePasswordCharacters(value) ?? undefined);
                }}
              />
            </Field>
            <Field label="ยืนยันรหัสผ่านใหม่" required htmlFor="reset-confirm" error={resetConfirmError}>
              <PasswordInput
                id="reset-confirm"
                autoComplete="new-password"
                value={resetConfirm}
                onChange={(e) => {
                  setResetConfirm(e.target.value);
                  if (resetConfirmError) setResetConfirmError(undefined);
                }}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeResetPassword} disabled={resetSaving}>
                ยกเลิก
              </Button>
              <Button
                onClick={() => void confirmResetPassword()}
                disabled={resetSaving || !!validatePasswordCharacters(resetPassword)}
              >
                {resetSaving ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function CellInput({
  editing,
  value,
  error,
  onChange,
  placeholder,
  className,
}: {
  editing: boolean;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  if (!editing) {
    return <td className={cn("px-3 py-2 text-foreground", className)}>{value || "—"}</td>;
  }
  return (
    <td className="px-3 py-2">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-9 text-xs", className)}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </td>
  );
}

function EmployeeFields({
  form,
  errors,
  idEditable,
  onChange,
}: {
  form: EmployeeFormState;
  errors: Partial<Record<keyof EmployeeFormState, string>>;
  idEditable?: boolean;
  onChange: (patch: Partial<EmployeeFormState>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="รหัสพนักงาน" required htmlFor="emp-id" error={errors.employeeId}>
        <Input
          id="emp-id"
          className="tnum"
          disabled={!idEditable}
          value={form.employeeId}
          onChange={(e) => onChange({ employeeId: e.target.value })}
          placeholder="เช่น 10002"
        />
      </Field>
      <Field label="ชื่อ" required htmlFor="emp-name" error={errors.name}>
        <Input id="emp-name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="ตำแหน่ง" htmlFor="emp-pos" error={errors.position}>
        <Input id="emp-pos" value={form.position} onChange={(e) => onChange({ position: e.target.value })} />
      </Field>
      <Field label="แผนก" htmlFor="emp-dept" error={errors.department}>
        <Input id="emp-dept" value={form.department} onChange={(e) => onChange({ department: e.target.value })} />
      </Field>
      <Field label="รหัสหัวหน้า" htmlFor="emp-mgr" error={errors.managerId} hint="เว้นว่างถ้าไม่มี">
        <Input
          id="emp-mgr"
          className="tnum"
          value={form.managerId ?? ""}
          onChange={(e) => onChange({ managerId: e.target.value.trim() || null })}
          placeholder="เช่น 10001"
        />
      </Field>
      <Field label="บทบาท" htmlFor="emp-role" error={errors.role}>
        <Select id="emp-role" value={form.role} onChange={(e) => onChange({ role: e.target.value as EmployeeFormState["role"] })}>
          <option value="employee">พนักงาน</option>
          <option value="checker">Checker</option>
          <option value="super_admin">Super Admin</option>
        </Select>
      </Field>
      <Field label="สถานะ" htmlFor="emp-active">
        <Select
          id="emp-active"
          value={form.isActive ? "true" : "false"}
          onChange={(e) => onChange({ isActive: e.target.value === "true" })}
        >
          <option value="true">ใช้งาน</option>
          <option value="false">ไม่ใช้งาน</option>
        </Select>
      </Field>
    </div>
  );
}
