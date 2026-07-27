// send-reminders — Supabase Edge Function
//
// Meant to be invoked on a schedule (Supabase dashboard: Database > Cron Jobs >
// New cron job > "Supabase Edge Function", every 15-30 min is plenty). Each run:
//   1. Loads every household and its items that have at least one reminder configured.
//   2. Expands each item's occurrences over a lookahead window (recurrence rules,
//      one-off dates, exclusions — same rules the app's calendar uses).
//   3. For any occurrence + reminder offset whose due time has passed and hasn't
//      been sent yet, emails REMINDER_TO via Resend, tagged with who it's for.
//
// Every reminder goes to one fixed inbox (REMINDER_TO) rather than resolving a
// per-person address — Andrew's call: simpler than requiring every household
// member to have their own login, and works with Resend's free sandbox sender
// (which can only send to the Resend account's own email anyway). The subject
// line is tagged "[Name]" / "[Household]" so a Gmail filter can forward the
// ones relevant to someone else.
//
// Deliberately self-contained: this runs in Deno, not the Vite/React bundle, so
// the date/recurrence helpers below are a small, faithful port of the same logic
// in src/utils.ts and src/timezones.ts rather than a cross-runtime import. Keep
// the two in sync if either changes.
//
// Required secrets (Supabase dashboard: Edge Functions > send-reminders > Secrets,
// or `supabase secrets set NAME=value`):
//   RESEND_API_KEY   — from resend.com.
//   REMINDER_FROM    — e.g. "Dog Life OS <onboarding@resend.dev>" (Resend's
//                      sandbox sender) or your own verified domain.
//   REMINDER_TO      — the one inbox every reminder is sent to.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the
// platform — no need to set those.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Minimal date/recurrence port (mirrors src/utils.ts) --------------------
// Every "calendar date" here is a UTC-midnight Date used purely for Y-M-D
// arithmetic — never treated as a real instant. The only place a real instant
// gets computed is zonedTimeToUtc, right before comparing against `now`.

type DayOfWeek = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
const DAY_NAMES: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

type Recurrence = {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  daysOfWeek?: DayOfWeek[];
  monthDay?: number;
  startDate: string;
  endDate?: string;
  occurrenceCount?: number;
};

type ReminderRow = { id: string; amount: number; unit: "minutes" | "hours" | "days" };

type ItemRow = {
  id: string;
  household_id: string;
  title: string;
  kind: "recurring" | "one-off";
  recurrence: Recurrence | null;
  excluded_dates: string[] | null;
  date: string | null;
  start_time: string | null;
  assigned_to: string | null;
  category: string;
  reminders: ReminderRow[] | null;
};

function parseDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

function dateFromKey(key: string): Date {
  const { y, m, d } = parseDateKey(key);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + amount);
  return next;
}

function weekStartDate(date: Date): Date {
  return addDays(date, -date.getUTCDay());
}

function dayOfWeekName(date: Date): DayOfWeek {
  return DAY_NAMES[date.getUTCDay()];
}

/** Every date (YYYY-MM-DD) an item occurs on within [rangeStart, rangeEnd], inclusive. */
function generateOccurrences(item: ItemRow, rangeStart: Date, rangeEnd: Date): string[] {
  const rangeStartKey = toDateKey(rangeStart);
  const rangeEndKey = toDateKey(rangeEnd);
  const excluded = new Set(item.excluded_dates ?? []);

  if (item.kind === "one-off") {
    if (!item.date || excluded.has(item.date)) return [];
    return item.date >= rangeStartKey && item.date <= rangeEndKey ? [item.date] : [];
  }

  const rec = item.recurrence;
  if (!rec) return [];

  const startDate = dateFromKey(rec.startDate);
  const endDate = rec.endDate ? dateFromKey(rec.endDate) : null;
  const maxOccurrences = rec.occurrenceCount ?? Infinity;
  const interval = Math.max(1, rec.interval || 1);
  const ITER_CAP = 5000;

  const results: string[] = [];
  let totalOccurrences = 0;

  function emit(d: Date): boolean {
    if (endDate && d > endDate) return false;
    totalOccurrences += 1;
    if (totalOccurrences > maxOccurrences) return false;
    const key = toDateKey(d);
    if (key > rangeEndKey) return false;
    if (key >= rangeStartKey && !excluded.has(key)) results.push(key);
    return true;
  }

  if (rec.frequency === "weekly") {
    const days = rec.daysOfWeek && rec.daysOfWeek.length > 0 ? rec.daysOfWeek : [dayOfWeekName(startDate)];
    const dayIndices = days.map((d) => DAY_NAMES.indexOf(d)).sort((a, b) => a - b);
    let weekCursor = weekStartDate(startDate);
    outer: for (let i = 0; i < ITER_CAP; i++) {
      for (const dayIndex of dayIndices) {
        const occDate = addDays(weekCursor, dayIndex);
        if (occDate < startDate) continue;
        if (!emit(occDate)) break outer;
      }
      weekCursor = addDays(weekCursor, 7 * interval);
    }
  } else {
    let cursor = startDate;
    const monthDay = rec.monthDay ?? startDate.getUTCDate();
    for (let i = 0; i < ITER_CAP; i++) {
      const occDate =
        rec.frequency === "monthly" ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), monthDay)) : cursor;
      if (!emit(occDate)) break;
      cursor =
        rec.frequency === "daily" ? addDays(cursor, interval) : rec.frequency === "monthly" ? addMonths(cursor, interval) : addMonths(cursor, 12 * interval);
    }
  }

  return results.sort();
}

/** Minutes-since-midnight from a label like "7:15 AM". Null if unparseable. */
function parseTimeLabel(label: string): number | null {
  const match = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/** The zone's offset (in minutes, positive = ahead of UTC) at the given instant. */
function offsetMinutesAt(zoneId: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zoneId,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instant)
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {} as Record<string, string>);
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - instant.getTime()) / 60000;
}

/** Converts a wall-clock date + minutes-since-midnight in a given IANA zone to a real instant. */
function zonedTimeToUtc(dateKey: string, minutesSinceMidnight: number, zoneId: string): Date {
  const { y, m, d } = parseDateKey(dateKey);
  const utcGuess = Date.UTC(y, m - 1, d, Math.floor(minutesSinceMidnight / 60), minutesSinceMidnight % 60);
  const offset = offsetMinutesAt(zoneId, new Date(utcGuess));
  return new Date(utcGuess - offset * 60000);
}

function offsetMinutes(amount: number, unit: ReminderRow["unit"]): number {
  if (unit === "minutes") return amount;
  if (unit === "hours") return amount * 60;
  return amount * 60 * 24;
}

function offsetLabel(amount: number, unit: ReminderRow["unit"]): string {
  const plural = amount === 1 ? "" : "s";
  return `${amount} ${unit === "minutes" ? "minute" : unit === "hours" ? "hour" : "day"}${plural} before`;
}

// --- Main run ----------------------------------------------------------------

const LOOKAHEAD_DAYS = 35;

async function sendEmail(to: string[], subject: string, html: string, text: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("REMINDER_FROM");
  if (!apiKey || !from) throw new Error("RESEND_API_KEY / REMINDER_FROM not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async () => {
  const reminderTo = Deno.env.get("REMINDER_TO");
  if (!reminderTo) return new Response("REMINDER_TO not configured", { status: 500 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  const rangeStart = addDays(now, -1);
  const rangeEnd = addDays(now, LOOKAHEAD_DAYS);

  const { data: households, error: householdsError } = await supabase.from("households").select("id, timezone");
  if (householdsError) return new Response(`households query failed: ${householdsError.message}`, { status: 500 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const household of households ?? []) {
    const zoneId = household.timezone || "America/Denver";

    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("id, household_id, title, kind, recurrence, excluded_dates, date, start_time, assigned_to, category, reminders")
      .eq("household_id", household.id);
    if (itemsError) {
      errors.push(`household ${household.id} items query failed: ${itemsError.message}`);
      continue;
    }

    const itemsWithReminders = (items ?? []).filter((item: ItemRow) => (item.reminders ?? []).length > 0);
    if (itemsWithReminders.length === 0) continue;

    const { data: people } = await supabase.from("people").select("id, name").eq("household_id", household.id);

    function nameForPersonId(personId: string | null): string {
      if (!personId) return "Household";
      return (people ?? []).find((p: { id: string; name: string }) => p.id === personId)?.name ?? "Household";
    }

    for (const item of itemsWithReminders) {
      if (!item.start_time) {
        skipped += 1;
        continue; // no clock time to count down from
      }
      const minutes = parseTimeLabel(item.start_time);
      if (minutes === null) {
        skipped += 1;
        continue;
      }

      const occurrenceDates = generateOccurrences(item, rangeStart, rangeEnd);
      if (occurrenceDates.length === 0) continue;

      const { data: occurrenceRows } = await supabase
        .from("item_occurrences")
        .select("original_date, date, scheduled_time, state, assigned_to")
        .eq("item_id", item.id)
        .in("original_date", occurrenceDates);
      const occurrenceByOriginalDate = new Map((occurrenceRows ?? []).map((row: any) => [row.original_date, row]));

      for (const originalDate of occurrenceDates) {
        const occurrence = occurrenceByOriginalDate.get(originalDate);
        if (occurrence && (occurrence.state === "completed" || occurrence.state === "skipped")) continue;

        const effectiveDate = occurrence?.state === "rescheduled" && occurrence.date ? occurrence.date : originalDate;
        const effectiveMinutes =
          occurrence?.state === "rescheduled" && occurrence.scheduled_time ? parseTimeLabel(occurrence.scheduled_time) ?? minutes : minutes;
        const effectiveAssignedTo = occurrence?.assigned_to ?? item.assigned_to;

        const startInstant = zonedTimeToUtc(effectiveDate, effectiveMinutes, zoneId);

        for (const reminder of item.reminders ?? []) {
          const dueAt = new Date(startInstant.getTime() - offsetMinutes(reminder.amount, reminder.unit) * 60000);
          if (dueAt > now) continue; // not due yet

          const { data: alreadySent } = await supabase
            .from("sent_item_reminders")
            .select("item_id")
            .eq("item_id", item.id)
            .eq("occurrence_date", originalDate)
            .eq("reminder_id", reminder.id)
            .maybeSingle();
          if (alreadySent) continue;

          const whenLabel = new Intl.DateTimeFormat("en-US", {
            timeZone: zoneId,
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(startInstant);
          const tag = nameForPersonId(effectiveAssignedTo || null);

          try {
            await sendEmail(
              [reminderTo],
              `[${tag}] ${item.title} — ${whenLabel}`,
              `<p><strong>${item.title}</strong></p><p>${whenLabel}</p><p>${offsetLabel(reminder.amount, reminder.unit)}. For: ${tag}.</p>`,
              `${item.title}\n${whenLabel}\n${offsetLabel(reminder.amount, reminder.unit)}. For: ${tag}.`,
            );
            await supabase.from("sent_item_reminders").insert({ item_id: item.id, occurrence_date: originalDate, reminder_id: reminder.id });
            sent += 1;
          } catch (err) {
            errors.push(`item ${item.id} reminder ${reminder.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, skipped, errors }), {
    status: errors.length > 0 ? 207 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
