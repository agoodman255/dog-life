import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader — this repo has no dotenv dependency, so parse by hand.
function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2].trim();
  }
}
loadEnvLocal();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Add SUPABASE_SERVICE_ROLE_KEY=<your service_role key> to .env.local — it's already gitignored.\n" +
      "Never prefix it with VITE_ (that would bundle it into the client build) and never commit it.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const { data, error } = await supabase
  .from("product_feedback")
  .select("*")
  .order("created_at", { ascending: false });

if (error) {
  console.error("Failed to fetch product_feedback:", error.message);
  process.exit(1);
}

const rows = data ?? [];
const escape = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");

const lines = [
  "# Feedback",
  "",
  `Exported ${new Date().toISOString()} — ${rows.length} item(s). Regenerate with \`npx tsx scripts/export-feedback.ts\`.`,
  "",
  "| Type | Page | Location | Message | From | Logged |",
  "| --- | --- | --- | --- | --- | --- |",
  ...rows.map(
    (row) =>
      `| ${row.feedback_type} | ${row.page} | ${row.location_note || "—"} | ${escape(row.message)} | ${row.author_email || "—"} | ${row.created_at} |`,
  ),
];

writeFileSync(new URL("../FEEDBACK.md", import.meta.url), lines.join("\n") + "\n");
console.log(`Wrote FEEDBACK.md with ${rows.length} item(s).`);
