import bcrypt from "bcryptjs";

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

function ensureSeedSuperAdmin(store: PasswordStore): PasswordStore {
  if (store[SEED_SUPER_ADMIN_ID]) return store;
  return {
    ...store,
    [SEED_SUPER_ADMIN_ID]: bcrypt.hashSync(SEED_SUPER_ADMIN_PASSWORD, 10),
  };
}

export function hasLocalPassword(employeeId: string): boolean {
  const store = ensureSeedSuperAdmin(readStore());
  if (!readStore()[SEED_SUPER_ADMIN_ID] && store[SEED_SUPER_ADMIN_ID]) {
    writeStore(store);
  }
  return Boolean(store[employeeId.trim()]);
}

export function verifyLocalPassword(employeeId: string, password: string): boolean {
  const id = employeeId.trim();
  const store = ensureSeedSuperAdmin(readStore());
  if (!readStore()[SEED_SUPER_ADMIN_ID] && store[SEED_SUPER_ADMIN_ID]) {
    writeStore(store);
  }
  const hash = store[id];
  if (!hash) return false;
  return bcrypt.compareSync(password, hash);
}

export function setLocalPassword(employeeId: string, password: string): { ok: true } | { ok: false; error: string } {
  const id = employeeId.trim();
  const store = ensureSeedSuperAdmin(readStore());
  if (store[id]) {
    return { ok: false, error: "รหัสพนักงานนี้ตั้งรหัสผ่านแล้ว" };
  }
  store[id] = bcrypt.hashSync(password, 10);
  writeStore(store);
  return { ok: true };
}

export function resetLocalPassword(employeeId: string, password: string): void {
  const id = employeeId.trim();
  const store = ensureSeedSuperAdmin(readStore());
  store[id] = bcrypt.hashSync(password, 10);
  writeStore(store);
}

export function localPasswordIsSet(employeeId: string): boolean {
  return hasLocalPassword(employeeId);
}
