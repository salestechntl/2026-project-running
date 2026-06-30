import { SaveRunStepError, SaveWeightStepError } from "./save-progress";

export const LOAD_SLOW_MS = 3_000;
export const LOAD_TIMEOUT_MS = 15_000;

export const USER_MESSAGES = {
  offline:
    "ไม่มีการเชื่อมต่ออินเทอร์เน็ต — ตรวจสอบ Wi‑Fi หรือข้อมูลมือถือ แล้วลองใหม่",
  network:
    "เชื่อมต่อไม่สำเร็จ — ตรวจสอบสัญญาณแล้วลองใหม่ ข้อมูลในฟอร์มยังอยู่",
  loadSlow: "ใช้เวลานานกว่าปกติ — ตรวจสอบสัญญาณอินเทอร์เน็ต",
  loadTimeout: "โหลดข้อมูลไม่สำเร็จ — ใช้เวลานานเกินไป กรุณาลองใหม่",
  loadFailed: "โหลดข้อมูลไม่สำเร็จ — ตรวจสอบสัญญาณแล้วกดลองใหม่",
  server: "ระบบขัดข้องชั่วคราว — ลองใหม่ในอีกสักครู่ หากยังไม่ได้ติดต่อผู้ดูแล",
  sessionExpired: "เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่",
  unknown: "ดำเนินการไม่สำเร็จ — กรุณาลองใหม่",
  runPartialUpload:
    "รายการถูกบันทึกแล้วแต่รูปยังไม่ครบ — กดบันทึกอีกครั้งเพื่ออัปโหลดรูปต่อ ข้อมูลในฟอร์มยังอยู่",
} as const;

export type ErrorKind = "offline" | "network" | "timeout" | "auth" | "client" | "server" | "unknown";

export class UserFacingError extends Error {
  kind: ErrorKind;

  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "UserFacingError";
    this.kind = kind;
  }
}

export class RunSavePartialError extends Error {
  runId: string;

  constructor(runId: string, message = USER_MESSAGES.runPartialUpload) {
    super(message);
    this.name = "RunSavePartialError";
    this.runId = runId;
  }
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function assertOnline(): void {
  if (isOffline()) throw new UserFacingError("offline", USER_MESSAGES.offline);
}

function isNetworkErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("network request failed")
  );
}

export function userMessageFromError(error: unknown, fallback?: string): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof RunSavePartialError) return error.message;
  if (error instanceof SaveRunStepError || error instanceof SaveWeightStepError) return error.message;
  if (error instanceof Error) {
    if (isOffline()) return USER_MESSAGES.offline;
    if (isNetworkErrorMessage(error.message)) return USER_MESSAGES.network;
    if (error.message.startsWith("Request failed (401)")) return USER_MESSAGES.sessionExpired;
    if (/Request failed \(5\d{2}\)/.test(error.message)) return USER_MESSAGES.server;
    if (error.message && error.message !== "Error") return error.message;
  }
  return fallback ?? USER_MESSAGES.unknown;
}
