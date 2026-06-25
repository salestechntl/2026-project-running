export const PASSWORD_MIN_LEN = 4;
export const PASSWORD_MAX_LEN = 30;

export const PASSWORD_FORMAT_HINT =
  "4–30 ตัวอักษร · ใช้ได้เฉพาะภาษาอังกฤษ ตัวเลข และสัญลักษณ์";

/** Printable ASCII only — rejects Thai and other non-Latin scripts. */
const PASSWORD_ALLOWED_PATTERN = /^[\x20-\x7E]+$/;

/** Real-time check while typing (skips length). */
export function validatePasswordCharacters(password: string): string | null {
  if (!password) return null;
  if (!PASSWORD_ALLOWED_PATTERN.test(password)) {
    return "รหัสผ่านใช้ได้เฉพาะภาษาอังกฤษ ตัวเลข และสัญลักษณ์เท่านั้น";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  const charError = validatePasswordCharacters(password);
  if (charError) return charError;
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
