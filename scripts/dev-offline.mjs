// Launches the Vite dev server with the Supabase env vars forced empty, so the
// app falls back to its local-storage/seed-data mode (see src/supabaseClient.ts
// and src/auth.tsx AuthGate) and skips login entirely. Setting them to "" here
// takes precedence over .env.local without touching that file at all — used for
// browser-based UI verification that doesn't need real credentials.
import { spawn } from "node:child_process";

process.env.VITE_SUPABASE_URL = "";
process.env.VITE_SUPABASE_ANON_KEY = "";

const child = spawn("npx", ["vite", "--host", "0.0.0.0"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
