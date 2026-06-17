import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

/** Load .env.local for `vercel dev` API handlers */
export function loadLocalEnv() {
  if (loaded) return;
  loaded = true;
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) config({ path });
  }
}
