import bcrypt from "bcryptjs";

export const PASSWORD_MIN_LEN = 4;
export const PASSWORD_MAX_LEN = 30;

/** Printable ASCII only — rejects Thai and other non-Latin scripts. */
const PASSWORD_ALLOWED_PATTERN = /^[\x20-\x7E]+$/;

export function validatePassword(password: string): string | null {
  if (!PASSWORD_ALLOWED_PATTERN.test(password)) {
    return "รหัสผ่านใช้ได้เฉพาะภาษาอังกฤษ ตัวเลข และสัญลักษณ์เท่านั้น";
  }
  const len = password.length;
  if (len < PASSWORD_MIN_LEN || len > PASSWORD_MAX_LEN) {
    return `รหัสผ่านต้องมีความยาว ${PASSWORD_MIN_LEN}-${PASSWORD_MAX_LEN} ตัวอักษร`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Precomputed bcrypt hash for seed super_admin default password P@ssw0rd */
export const SEED_SUPER_ADMIN_PASSWORD_HASH =
  "$2b$10$IkZCX0EToT6Hq0sgz1oxfu3bwVS3MXoF1wA16h2wI5JZN/g0BDAb2";
