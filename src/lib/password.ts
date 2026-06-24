export const PASSWORD_MIN_LEN = 4;
export const PASSWORD_MAX_LEN = 30;

export const PASSWORD_FORMAT_HINT =
  "4–30 ตัวอักษร · ใช้ได้เฉพาะภาษาอังกฤษ ตัวเลข และสัญลักษณ์ (ห้ามภาษาไทย)";

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

export function passwordsMatch(password: string, confirm: string): string | null {
  if (password !== confirm) return "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน";
  return null;
}
