import bcrypt from "bcryptjs";
import { normalizeEmployeeId } from "./employee-id";
import { validatePassword } from "./password";

const STORAGE_KEY = "rc2026.passwords";

/** Seed super_admin 10001 — default P@ssw0rd (local demo only) */
const SEED_SUPER_ADMIN_ID = "10001";
const SEED_SUPER_ADMIN_PASSWORD = "P@ssw0rd";

type PasswordStore = Record<string, string>;

function readStore(): PasswordStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PasswordStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: PasswordStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function canonicalKey(employeeId: string): string {
  return normalizeEmployeeId(employeeId);
}

/** Migrate legacy mixed-case keys to canonical uppercase. */
function migrateStoreKeys(store: PasswordStore): PasswordStore {
  let changed = false;
  const next: PasswordStore = {};
  for (const [key, hash] of Object.entries(store)) {
    const canon = canonicalKey(key);
    if (canon !== key) changed = true;
    if (!next[canon]) next[canon] = hash;
  }
  if (changed) writeStore(next);
  return next;
}

function ensureSeedSuperAdmin(store: PasswordStore): PasswordStore {
  if (store[SEED_SUPER_ADMIN_ID]) return store;
  return {
    ...store,
    [SEED_SUPER_ADMIN_ID]: bcrypt.hashSync(SEED_SUPER_ADMIN_PASSWORD, 10),
  };
}

function loadStore(): PasswordStore {
  const seeded = ensureSeedSuperAdmin(readStore());
  if (!readStore()[SEED_SUPER_ADMIN_ID] && seeded[SEED_SUPER_ADMIN_ID]) {
    writeStore(seeded);
  }
  return migrateStoreKeys(seeded);
}

export function hasLocalPassword(employeeId: string): boolean {
  const store = loadStore();
  return Boolean(store[canonicalKey(employeeId)]);
}

export function verifyLocalPassword(employeeId: string, password: string): boolean {
  const id = canonicalKey(employeeId);
  const store = loadStore();
  const hash = store[id];
  if (!hash) return false;
  return bcrypt.compareSync(password, hash);
}

export function setLocalPassword(employeeId: string, password: string): { ok: true } | { ok: false; error: string } {
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  const id = canonicalKey(employeeId);
  const store = loadStore();
  if (store[id]) {
    return { ok: false, error: "รหัสพนักงานนี้ตั้งรหัสผ่านแล้ว" };
  }
  store[id] = bcrypt.hashSync(password, 10);
  writeStore(store);
  return { ok: true };
}

export function resetLocalPassword(employeeId: string, password: string): void {
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  const id = canonicalKey(employeeId);
  const store = loadStore();
  store[id] = bcrypt.hashSync(password, 10);
  writeStore(store);
}

export function changeLocalPassword(
  employeeId: string,
  currentPassword: string,
  newPassword: string,
): { ok: true } | { ok: false; error: string } {
  const id = canonicalKey(employeeId);
  if (!hasLocalPassword(id)) {
    return { ok: false, error: "ยังไม่ได้ตั้งรหัสผ่าน กรุณาสร้างรหัสผ่านก่อน" };
  }
  if (!verifyLocalPassword(id, currentPassword)) {
    return { ok: false, error: "รหัสผ่านเดิมไม่ถูกต้อง" };
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return { ok: false, error: passwordError };
  if (currentPassword === newPassword) {
    return { ok: false, error: "รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม" };
  }

  const store = loadStore();
  store[id] = bcrypt.hashSync(newPassword, 10);
  writeStore(store);
  return { ok: true };
}

export function localPasswordIsSet(employeeId: string): boolean {
  return hasLocalPassword(employeeId);
}
