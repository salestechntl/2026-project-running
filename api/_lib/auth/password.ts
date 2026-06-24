import bcrypt from "bcryptjs";

export const PASSWORD_MIN_LEN = 4;
export const PASSWORD_MAX_LEN = 30;

const THAI_CHAR_PATTERN = /[\u0E00-\u0E7F]/;

export function validatePassword(password: string): string | null {
  if (THAI_CHAR_PATTERN.test(password)) {
    return "รหัสผ่านห้ามมีตัวอักษรภาษาไทย — ใช้ภาษาอังกฤษ ตัวเลข หรือสัญลักษณ์เท่านั้น";
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
