/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTH_MODE?: "api" | "local";
  readonly VITE_API_PROXY?: string;
  /** หน่วง spinner ใน dev (ms) — ตั้ง 0 เพื่อปิด */
  readonly VITE_LOADING_DEMO_MS?: string;
  /** จำลองวันที่ yyyy-mm-dd สำหรับทดสอบกฎบันทึก — อย่าใช้บน Production */
  readonly VITE_SIMULATED_TODAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by Vite `define` in vite.config.ts */
declare const __APP_VERSION__: string;
