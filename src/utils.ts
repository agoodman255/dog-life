import { useMemo } from "react";
import {
  AloneTimeLog,
  Category,
  ChecklistItemDef,
  ChecklistItemValue,
  DayOfWeek,
  Dog,
  GroceryListItem,
  InventoryItem,
  Item,
  ItemIntent,
  ItemLog,
  ItemOccurrence,
  ItemState,
  LogFieldDef,
  LogFieldValue,
  Meal,
  Milestone,
  MilestoneStatus,
  MilestoneStep,
  NotificationItem,
  QuickLogKind,
  RecipeIngredient,
} from "./types";

export const itemStateLabels: Record<ItemState, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
  rescheduled: "Rescheduled",
  assigned_pending: "Pending",
  reassigned: "Reassigned",
};

/** What each Add-menu preset turns on, and the plain-language promise shown on the
 * button. Presets exist so the choice at creation time is "what am I doing?" rather
 * than "which of three data types is this?" — the old framing nobody could follow. */
export const ITEM_INTENT_PRESETS: {
  id: ItemIntent;
  label: string;
  blurb: string;
  requiresCompletion: boolean;
  requiresLog: boolean;
  defaultCategory: Category;
  defaultKind: "recurring" | "one-off";
}[] = [
  {
    id: "routine",
    label: "Routine or to-do",
    blurb: "You check it off. Asks for a checklist and a score when you finish.",
    requiresCompletion: true,
    requiresLog: false,
    defaultCategory: "potty",
    defaultKind: "recurring",
  },
  {
    id: "event",
    label: "Event",
    blurb: "Just goes on the calendar. Nothing to complete, nothing to log.",
    requiresCompletion: false,
    requiresLog: false,
    defaultCategory: "social",
    defaultKind: "one-off",
  },
  {
    id: "training",
    label: "Training session",
    blurb: "Check off each step and log how it went — feeds milestone progress.",
    requiresCompletion: true,
    requiresLog: true,
    defaultCategory: "training",
    defaultKind: "recurring",
  },
  {
    id: "appointment",
    label: "Appointment",
    blurb: "Vet, groomer, anything you record details from afterwards.",
    requiresCompletion: false,
    requiresLog: true,
    defaultCategory: "vet",
    defaultKind: "one-off",
  },
  {
    id: "health-record",
    label: "Health record",
    blurb: "A weight, a dose, a vaccine — logged data, no scheduling needed.",
    requiresCompletion: false,
    requiresLog: true,
    defaultCategory: "health",
    defaultKind: "one-off",
  },
];

// --- Quick log ---------------------------------------------------------------
//
// The five things logged constantly during a day. Every one follows the same shape:
// one predetermined selection first, sub-fields that appear based on that selection,
// a 1-5 score, then a note. Declared as data rather than five hand-written forms so
// QuickLogForm renders them generically and the Dashboard's Log section can summarize
// any entry without knowing which kind it is.

export type QuickLogFieldInput = "choice" | "number";

export type QuickLogField = {
  /** Also the `fieldName` written into the log's `values`, so the ingest pass reads
   * a stable key rather than a UI label that might get reworded. */
  name: string;
  label: string;
  input: QuickLogFieldInput;
  options?: { value: string; label: string }[];
  unit?: string;
  /** Tap-to-fill shortcuts for a number field — typing "30" on a phone is the friction
   * this feature exists to remove. */
  presets?: number[];
  /** Only render once `field` holds one of `values`. How "consistency" stays hidden
   * until you've said it was a poo. */
  showWhen?: { field: string; values: string[] };
};

export type QuickLogSpec = {
  kind: QuickLogKind;
  label: string;
  /** The one selection made first. Always rendered as chips — it's the fastest tap
   * target and there are never more than five options. */
  primary: QuickLogField;
  /** Sub-fields, in order, revealed after the primary selection. */
  fields: QuickLogField[];
  ratingLabel: string;
  notesPlaceholder: string;
};

export const QUICK_LOG_SPECS: QuickLogSpec[] = [
  {
    kind: "potty",
    label: "Potty",
    primary: {
      name: "Type",
      label: "What was it?",
      input: "choice",
      options: [
        { value: "pee", label: "Pee" },
        { value: "poo", label: "Poo" },
        { value: "both", label: "Both" },
        { value: "nothing", label: "Nothing" },
      ],
    },
    fields: [
      {
        name: "Where",
        label: "Where?",
        input: "choice",
        options: [
          { value: "outside", label: "Outside" },
          { value: "on-walk", label: "On a walk" },
          { value: "inside", label: "Inside (accident)" },
          { value: "crate", label: "In the crate" },
        ],
      },
      {
        // A clear-to-dark scale, same idea as stool consistency: both are hydration/
        // health signals worth a quick tap rather than free text. Ordered light to
        // dark so the chips read left-to-right the way the scale is usually pictured.
        name: "Color",
        label: "Pee color",
        input: "choice",
        showWhen: { field: "Type", values: ["pee", "both"] },
        options: [
          { value: "clear", label: "Clear" },
          { value: "pale", label: "Pale yellow" },
          { value: "yellow", label: "Yellow" },
          { value: "dark", label: "Dark yellow" },
          { value: "amber", label: "Very dark / amber" },
        ],
      },
      {
        name: "Consistency",
        label: "Stool consistency",
        input: "choice",
        showWhen: { field: "Type", values: ["poo", "both"] },
        options: [
          { value: "firm", label: "Firm" },
          { value: "soft", label: "Soft" },
          { value: "loose", label: "Loose" },
          { value: "watery", label: "Watery" },
        ],
      },
    ],
    ratingLabel: "How did the break go?",
    notesPlaceholder: "Anything worth remembering — blood, straining, how long it took…",
  },
  {
    kind: "play",
    label: "Play time",
    primary: {
      name: "Type",
      label: "What kind of play?",
      input: "choice",
      options: [
        { value: "physical", label: "Physical" },
        { value: "mental", label: "Mental" },
      ],
    },
    fields: [
      { name: "Duration", label: "How long?", input: "number", unit: "min", presets: [5, 10, 15, 30, 60] },
      {
        name: "Where",
        label: "Where?",
        input: "choice",
        options: [
          { value: "indoors", label: "Indoors" },
          { value: "outdoors", label: "Outdoors" },
        ],
      },
      {
        name: "Energy after",
        label: "Energy afterwards",
        input: "choice",
        options: [
          { value: "settled", label: "Settled right down" },
          { value: "calm", label: "Calm" },
          { value: "still-wound", label: "Still wound up" },
          { value: "overtired", label: "Overtired / nippy" },
        ],
      },
    ],
    ratingLabel: "How was the session?",
    notesPlaceholder: "How did they play? Any resource guarding, over-arousal, good manners…",
  },
  {
    // Training's primary selection is the milestone picker, which is built from live
    // data rather than a fixed option list — QuickLogForm special-cases it. The sub-
    // fields below apply to every training entry regardless of which type was picked.
    kind: "training",
    label: "Training",
    primary: { name: "Training type", label: "What did you work on?", input: "choice" },
    fields: [
      { name: "Duration", label: "How long?", input: "number", unit: "min", presets: [2, 5, 10, 15, 20] },
      {
        name: "Distractions",
        label: "Distraction level",
        input: "choice",
        options: [
          { value: "none", label: "None (quiet room)" },
          { value: "low", label: "Low" },
          { value: "moderate", label: "Moderate" },
          { value: "high", label: "High (out in the world)" },
        ],
      },
    ],
    ratingLabel: "How did the session go?",
    notesPlaceholder: "What worked, what didn't, what to change next time…",
  },
  {
    kind: "food",
    label: "Food",
    primary: {
      name: "Type",
      label: "What was it?",
      input: "choice",
      options: [
        { value: "breakfast", label: "Breakfast" },
        { value: "dinner", label: "Dinner" },
        { value: "snack", label: "Snack" },
        { value: "treat", label: "Training treats" },
        { value: "chew", label: "Chew" },
      ],
    },
    fields: [
      {
        name: "Amount eaten",
        label: "How much did they eat?",
        input: "choice",
        options: [
          { value: "all", label: "All of it" },
          { value: "most", label: "Most" },
          { value: "half", label: "About half" },
          { value: "little", label: "A little" },
          { value: "none", label: "Refused" },
        ],
      },
      { name: "Amount", label: "Amount served", input: "number", unit: "cups" },
    ],
    ratingLabel: "How was the meal?",
    notesPlaceholder: "Appetite, speed, any food guarding, new food reactions…",
  },
  {
    kind: "water",
    label: "Water",
    primary: {
      name: "Intake",
      label: "How much did they drink?",
      input: "choice",
      options: [
        { value: "normal", label: "Normal" },
        { value: "more", label: "More than usual" },
        { value: "less", label: "Less than usual" },
        { value: "refused", label: "Wouldn't drink" },
      ],
    },
    fields: [],
    ratingLabel: "How's their hydration?",
    notesPlaceholder: "Anything unusual — gulping, panting, dry gums…",
  },
];

export function quickLogSpec(kind: QuickLogKind): QuickLogSpec {
  // Non-null: QUICK_LOG_SPECS covers every member of the QuickLogKind union, and the
  // compiler enforces that any new kind added there gets a spec here too.
  return QUICK_LOG_SPECS.find((spec) => spec.kind === kind)!;
}

/** Which scheduled items are the same thing as one of the five Quick logs. A "Morning
 * potty" on the calendar is the *expectation* that a break happens; a potty Quick log is
 * the *observation* that one did. Same event, two moments — so they should be captured
 * with the same fields, not a hand-typed checklist on one side and a structured spec on
 * the other.
 *
 * A category can map to more than one kind — the two aren't the same vocabulary, and
 * forcing a 1:1 correspondence would mean inventing a calendar category (or a second
 * routine) for every distinct thing that happens to occur at the same moment as
 * something else already scheduled. `meals` is the concrete case: one calendar slot,
 * but you feed *and* top up water at the same visit, so it's a candidate for both a
 * Food log and a Water log (2026-07-27). `exercise` and `relationship` both map to
 * `play` for a different reason — no seed item actually carries `exercise` as a
 * *completable* routine (the one that does is a one-off calendar event, which is
 * never completable), so without `relationship` the walk that's actually there
 * ("Parallel decompression walk") would have nothing to match Play logs against.
 *
 * The rest are unmapped on purpose:
 * - handling / socialization are treated as training by the seeds, but the training
 *   spec's primary selection *is* the milestone picker, and a cooperative handling
 *   mini shouldn't force you to name a milestone before you can record it. (This is
 *   a different call than `relationship`, which — despite also being training-
 *   adjacent — is deliberately included for `play`, not `training`.)
 * - health / vet / vaccine / medication / grooming keep `DEFAULT_LOG_FIELDS` below —
 *   weight, temperature, cost, next due have no chip-shaped equivalent. */
export const CATEGORY_QUICK_LOG_KIND: Partial<Record<Category, QuickLogKind[]>> = {
  potty: ["potty"],
  meals: ["food", "water"],
  training: ["training"],
  exercise: ["play"],
  relationship: ["play"],
};

export function quickLogKindsForCategory(category: Category): QuickLogKind[] {
  return CATEGORY_QUICK_LOG_KIND[category] ?? [];
}

/** The one kind a direct "Log X" button opens to, when a category maps to several —
 * first in the list wins (meals → food, not water). Every existing call site wants
 * exactly one kind to default into; only the reverse direction (does *this* Quick log
 * match *that* scheduled item — `scheduledSlotCandidates` below) needs the full set,
 * via `quickLogKindsForCategory`. */
export function quickLogKindForCategory(category: Category): QuickLogKind | undefined {
  return quickLogKindsForCategory(category)[0];
}

/** The special training type that isn't a milestone. Alone time was its own Dashboard
 * panel with its own Log button until 2026-07-26; it's a training type like any other,
 * it just also feeds the alone-time readiness math via its own `alone_time_logs` row. */
export const ALONE_TIME_TRAINING_ID = "alone-time";

/** A scheduled slot a Quick log might be the observation of. */
export type ScheduledSlotCandidate = {
  item: Item;
  /** The occurrence key — always `originalDate`, which is what occurrences are looked
   * up by and doesn't move when one gets rescheduled. */
  occurrenceDate: string;
  /** Wall-clock label for display, e.g. "7:15 AM". Empty for an untimed item. */
  timeLabel: string;
  /** How far the log sits from the slot, for ordering. `Infinity` when untimed. */
  distanceMinutes: number;
};

/** How far either side of a slot's start time a log can land and still be plausibly
 * that slot. The densest realistic routine is a potty break roughly every two hours,
 * so 90 minutes stays under half the gap between consecutive expectations — wide
 * enough for real life, narrow enough that two candidates means it genuinely is
 * ambiguous rather than that the window was greedy. */
export const SLOT_MATCH_WINDOW_MINUTES = 90;

/** Scheduled slots on `dateKey` that this log could be reporting on, nearest first.
 *
 * Deliberately says "here are the possibilities" rather than "here is the answer":
 * with breaks every two hours something is always nearest, and being confidently
 * wrong at 8:40am is worse than asking. The caller pre-fills only when exactly one
 * comes back, and otherwise offers the list.
 *
 * `minutesIntoDay` is when the thing happened, in the household's zone, so a log
 * entered at 9pm for a 7:18 break matches against 7:18. */
export function scheduledSlotCandidates(
  kind: QuickLogKind,
  dateKey: string,
  minutesIntoDay: number,
  dogIds: string[],
  items: Item[],
  occurrences: ItemOccurrence[],
): ScheduledSlotCandidate[] {
  const day = parseLocalDate(dateKey);
  const claimed: ItemState[] = ["completed", "skipped", "rescheduled"];

  return items
    .filter((item) => quickLogKindsForCategory(item.category).includes(kind) && item.requiresCompletion)
    // A slot only exists on days the item actually recurs — same expansion every other
    // consumer uses, so a candidate here is a row you'd see on the calendar.
    .filter((item) => generateOccurrences(item, day, day).length > 0)
    // An item naming no dogs is household-wide and always applies; one that names dogs
    // has to share at least one with the entry, or it's somebody else's slot.
    .filter((item) => !item.dogIds || item.dogIds.length === 0 || item.dogIds.some((id) => dogIds.includes(id)))
    .filter((item) => {
      const occurrence = occurrences.find((entry) => entry.itemId === item.id && entry.originalDate === dateKey);
      return !occurrence || !claimed.includes(occurrence.state);
    })
    .map((item) => {
      const slotMinutes = item.startTime ? parseTimeLabel(item.startTime) : null;
      return {
        item,
        occurrenceDate: dateKey,
        timeLabel: item.startTime ?? "",
        distanceMinutes: slotMinutes === null ? Infinity : Math.abs(slotMinutes - minutesIntoDay),
      };
    })
    // An untimed item is a candidate all day — there's no start time to be far from.
    .filter((entry) => entry.distanceMinutes === Infinity || entry.distanceMinutes <= SLOT_MATCH_WINDOW_MINUTES)
    .sort((a, b) => a.distanceMinutes - b.distanceMinutes);
}

// --- Log history -------------------------------------------------------------
//
// What the structured capture is *for*. Until now the Dashboard showed one day and
// nothing looked further back, so a potty spec with a stool scale and a urine colour
// scale was collecting data no one could read. Everything below is a pure function of
// the logs, so the numbers can be checked by hand against the raw rows.

/** Inclusive list of YYYY-MM-DD keys, oldest first. */
export function dateKeysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = parseLocalDate(startKey);
  const end = parseLocalDate(endKey);
  for (let i = 0; i < 1000 && cursor <= end; i++) {
    keys.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

/** Quick logs of one kind for one dog (or every dog) across a set of days, oldest
 * first by when they actually happened. */
export function logsForHistory(
  logs: ItemLog[],
  kind: QuickLogKind,
  dateKeys: string[],
  dogId?: string,
): ItemLog[] {
  const days = new Set(dateKeys);
  return logs
    .filter((log) => log.quickLogKind === kind)
    .filter((log) => !!log.occurrenceDate && days.has(log.occurrenceDate))
    .filter((log) => !dogId || log.dogIds.includes(dogId))
    .sort((a, b) => (a.happenedAt ?? a.loggedAt).localeCompare(b.happenedAt ?? b.loggedAt));
}

function logValue(log: ItemLog, fieldName: string): string | null {
  const match = log.values.find((value) => value.fieldName === fieldName);
  return typeof match?.value === "string" ? match.value : null;
}

/** An accident is a potty logged somewhere it shouldn't have happened. Same rule the
 * Analytics tile has used since Quick log v2 — kept in one place now that more than
 * one consumer asks the question. */
export function isAccident(log: ItemLog): boolean {
  if (log.quickLogKind !== "potty") return false;
  const where = logValue(log, "Where");
  return where === "inside" || where === "crate";
}

export type PottyIntervalStats = {
  /** Average gap between consecutive breaks, within a day. Null until there are two
   * breaks on at least one day — a gap needs two points. */
  averageMinutes: number | null;
  longestMinutes: number | null;
  /** Per-day averages, oldest first. The housetraining trend: the gap should widen. */
  byDay: { dateKey: string; averageMinutes: number | null; breaks: number }[];
};

/** How long the dog goes between potty breaks.
 *
 * The real housetraining metric, and the one that only became computable once logs
 * carry `happenedAt` and the day knows what it expected. Gaps are measured *within* a
 * day only — the overnight gap says how long someone slept, not how long the dog can
 * hold it, and averaging it in would swamp everything else. */
export function pottyIntervals(logs: ItemLog[], dogId: string, dateKeys: string[]): PottyIntervalStats {
  const byDay = dateKeys.map((dateKey) => {
    const dayLogs = logsForHistory(logs, "potty", [dateKey], dogId).filter((log) => logValue(log, "Type") !== "nothing");
    const gaps: number[] = [];
    for (let i = 1; i < dayLogs.length; i++) {
      const previous = new Date(dayLogs[i - 1].happenedAt ?? dayLogs[i - 1].loggedAt).getTime();
      const current = new Date(dayLogs[i].happenedAt ?? dayLogs[i].loggedAt).getTime();
      gaps.push(Math.round((current - previous) / 60000));
    }
    return {
      dateKey,
      averageMinutes: gaps.length > 0 ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : null,
      breaks: dayLogs.length,
      gaps,
    };
  });

  const allGaps = byDay.flatMap((day) => day.gaps);
  return {
    averageMinutes: allGaps.length > 0 ? Math.round(allGaps.reduce((sum, gap) => sum + gap, 0) / allGaps.length) : null,
    longestMinutes: allGaps.length > 0 ? Math.max(...allGaps) : null,
    byDay: byDay.map(({ dateKey, averageMinutes, breaks }) => ({ dateKey, averageMinutes, breaks })),
  };
}

export type AccidentTrend = {
  total: number;
  /** Whole days since the last accident. Null when there's never been one logged. */
  daysSinceLast: number | null;
  longestCleanStreak: number;
  byDay: { dateKey: string; accidents: number }[];
};

/** Accidents over time, plus the two numbers people actually want on a bad week:
 * how long since the last one, and what the best run has been. */
export function accidentTrend(logs: ItemLog[], dogId: string, dateKeys: string[]): AccidentTrend {
  const byDay = dateKeys.map((dateKey) => ({
    dateKey,
    accidents: logsForHistory(logs, "potty", [dateKey], dogId).filter(isAccident).length,
  }));

  let longestCleanStreak = 0;
  let running = 0;
  byDay.forEach((day) => {
    running = day.accidents > 0 ? 0 : running + 1;
    longestCleanStreak = Math.max(longestCleanStreak, running);
  });

  const lastAccidentIndex = byDay.map((day) => day.accidents > 0).lastIndexOf(true);
  return {
    total: byDay.reduce((sum, day) => sum + day.accidents, 0),
    daysSinceLast: lastAccidentIndex === -1 ? null : byDay.length - 1 - lastAccidentIndex,
    longestCleanStreak,
    byDay,
  };
}

/** Counts of each option picked for one Quick log field, in the spec's own order and
 * using its own labels — the vet-facing view of "what has her stool been like". */
export function fieldDistribution(
  logs: ItemLog[],
  kind: QuickLogKind,
  fieldName: string,
  dateKeys: string[],
  dogId?: string,
): { value: string; label: string; count: number }[] {
  const spec = quickLogSpec(kind);
  const field = [spec.primary, ...spec.fields].find((entry) => entry.name === fieldName);
  if (!field?.options) return [];
  const relevant = logsForHistory(logs, kind, dateKeys, dogId);
  return field.options.map((option) => ({
    value: option.value,
    label: option.label,
    count: relevant.filter((log) => logValue(log, fieldName) === option.value).length,
  }));
}

export type RoutineAdherence = {
  item: Item;
  /** Occurrences the schedule called for across the range. */
  expected: number;
  completed: number;
  /** 0-100. */
  rate: number;
};

/** How often each recurring routine actually gets done.
 *
 * Answers the question nobody could ask before: which of these are real, and which are
 * calendar decoration? A routine sitting at 20% is usually telling you to delete the
 * slot rather than to try harder. Only counts days that have already happened —
 * tomorrow's breakfast isn't a miss. */
export function routineAdherence(
  items: Item[],
  occurrences: ItemOccurrence[],
  dateKeys: string[],
  todayKey: string,
): RoutineAdherence[] {
  const past = dateKeys.filter((key) => key <= todayKey);
  if (past.length === 0) return [];
  const rangeStart = parseLocalDate(past[0]);
  const rangeEnd = parseLocalDate(past[past.length - 1]);

  return items
    .filter((item) => item.requiresCompletion)
    .map((item) => {
      const days = generateOccurrences(item, rangeStart, rangeEnd);
      const completed = days.filter((day) =>
        occurrences.some(
          (entry) => entry.itemId === item.id && entry.originalDate === day && entry.state === "completed",
        ),
      ).length;
      return { item, expected: days.length, completed, rate: days.length === 0 ? 0 : Math.round((completed / days.length) * 100) };
    })
    .filter((entry) => entry.expected > 0)
    .sort((a, b) => a.rate - b.rate);
}

/** One row of the Dashboard's day: something the day expected, or something that
 * happened without being expected. Splitting these into two panels was the original
 * complaint — the calendar knew what should happen, the Log knew what did, and neither
 * could see the other. */
export type TimelineEntry =
  | {
      kind: "expected";
      key: string;
      item: Item;
      occurrence?: ItemOccurrence;
      /** Everything logged against this slot, whether or not it closed it. */
      logs: ItemLog[];
      /** Minutes into the day, for sorting. `Infinity` for an untimed item. */
      minutes: number;
      timeLabel: string;
    }
  | { kind: "log"; key: string; log: ItemLog; minutes: number; timeLabel: string };

/** Everything about `dateKey`, in the order it was expected or happened.
 *
 * Deliberately does *not* reuse `useAdaptivePlan`'s visible set: that one hides
 * `optional` items on busy weeks, which is a defensible coaching move but a lie in a
 * list claiming to be the whole day. Everything scheduled shows up here.
 *
 * `minutesInZone` converts a stored instant into minutes past midnight in the
 * household's zone, so a log entered at 9pm for a 7:18 break sorts at 7:18 rather
 * than at the bottom. */
export function buildTodayTimeline(
  dateKey: string,
  items: Item[],
  occurrences: ItemOccurrence[],
  logs: ItemLog[],
  minutesInZone: (isoInstant: string) => number,
): TimelineEntry[] {
  const day = parseLocalDate(dateKey);

  const expected: TimelineEntry[] = items
    .filter((item) => item.requiresCompletion && generateOccurrences(item, day, day).length > 0)
    .map((item) => {
      const occurrence = occurrences.find((entry) => entry.itemId === item.id && entry.originalDate === dateKey);
      return {
        kind: "expected" as const,
        key: `expected-${item.id}`,
        item,
        occurrence,
        logs: logs.filter((log) => log.itemId === item.id && log.occurrenceDate === dateKey),
        minutes: item.startTime ? (parseTimeLabel(item.startTime) ?? Infinity) : Infinity,
        timeLabel: item.startTime ?? "",
      };
    });

  // Only logs with nowhere to belong. An attached one is already shown inside its slot,
  // and listing it twice would double-count the day.
  const free: TimelineEntry[] = logs
    .filter((log) => !log.itemId && log.occurrenceDate === dateKey)
    .map((log) => {
      const instant = log.happenedAt ?? log.loggedAt;
      return { kind: "log" as const, key: `log-${log.id}`, log, minutes: minutesInZone(instant), timeLabel: "" };
    });

  return [...expected, ...free].sort((a, b) => a.minutes - b.minutes);
}

/** Whether a Quick log field should render, given what's been picked so far. */
export function quickLogFieldVisible(field: QuickLogField, values: Record<string, string | number | null>): boolean {
  if (!field.showWhen) return true;
  const current = values[field.showWhen.field];
  return typeof current === "string" && field.showWhen.values.includes(current);
}

/** One-line summary of a log's structured selections, for the Log feed. Reads the
 * option labels back off the spec so the feed says "Poo · Inside (accident)" rather
 * than echoing the raw stored values. */
export function summarizeQuickLog(log: Pick<ItemLog, "quickLogKind" | "values">): string {
  if (!log.quickLogKind) return log.values.map((value) => `${value.fieldName}: ${value.value}`).join(" · ");
  const spec = quickLogSpec(log.quickLogKind);
  const allFields = [spec.primary, ...spec.fields];
  return log.values
    .map((value) => {
      const field = allFields.find((entry) => entry.name === value.fieldName);
      const option = field?.options?.find((entry) => entry.value === value.value);
      if (option) return option.label;
      if (value.unit) return `${value.value} ${value.unit}`;
      // The training type is written in by title rather than picked from an option
      // list, and the milestone name speaks for itself — labelling it would just read
      // "Training type: Marker word" in a feed row that already carries the icon.
      if (value.fieldName === "Training type") return String(value.value);
      return `${value.fieldName}: ${value.value}`;
    })
    .join(" · ");
}

/** The single step to work on next, with the milestone it belongs to. */
export type TrainingFocus = {
  milestoneId: string;
  milestoneTitle: string;
  stepTitle: string;
  successCriteria: string;
  completedSessions: number;
  sessionsRequired: number;
  /** Which dog this recommendation is for — two dogs are rarely on the same step. */
  dogId: string;
};

/** "What should we work on next?" — the deterministic half of Andrew's ask (2026-07-26)
 * that the Quick log's training type feeds. No model involved: milestone state already
 * says what's unlocked and what's unfinished, so a formula answers this honestly and
 * a generated sentence would only add a way to be wrong.
 *
 * The rule is momentum first, then curriculum order: finish a milestone that's already
 * underway before opening a new one, and otherwise take them in the order they're
 * authored, which is the order the training plan intends. Predictability matters more
 * than cleverness here — the answer should be the same tomorrow unless something was
 * actually logged. Anything richer (weaving training into meals and potty breaks by
 * time of day) is backlog item 12's rule engine, not this.
 *
 * Always scoped to one dog — "what's next" has no meaningful answer for two dogs at
 * once, since they're rarely on the same step. */
export function nextTrainingFocus(milestones: Milestone[], dogId: string): TrainingFocus | null {
  const candidates = milestones.filter((milestone) => {
    if (milestone.status === "skipped" || milestone.status === "delayed") return false;
    if (milestone.dogIds.length > 0 && !milestone.dogIds.includes(dogId)) return false;
    if (isMilestoneComplete(milestone, dogId)) return false;
    if (milestoneStatusFor(milestone, milestones, dogId) === "locked") return false;
    return milestone.steps.some((step) => stepSessions(step, dogId) < step.sessionsRequired);
  });
  if (candidates.length === 0) return null;

  const underway = candidates.filter((milestone) => milestone.steps.some((step) => stepSessions(step, dogId) > 0));
  const pick = (underway.length > 0 ? underway : candidates)[0];
  const step = pick.steps.find((entry) => stepSessions(entry, dogId) < entry.sessionsRequired);
  if (!step) return null;

  return {
    milestoneId: pick.id,
    milestoneTitle: pick.title,
    stepTitle: step.title,
    successCriteria: step.successCriteria,
    completedSessions: stepSessions(step, dogId),
    sessionsRequired: step.sessionsRequired,
    dogId,
  };
}

/** Quick logs recorded on a given day, newest first. */
export function quickLogsOn(logs: ItemLog[], dateKey: string): ItemLog[] {
  return logs
    .filter((log) => log.quickLogKind && log.occurrenceDate === dateKey)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

/** Structured fields an item starts with when you turn logging on, keyed by
 * category. Only a starting point — the form lets you add/remove rows. Anything
 * without an entry here logs free text only, which is the honest default: most
 * categories have no obvious numbers worth prompting for. */
export const DEFAULT_LOG_FIELDS: Partial<Record<Category, LogFieldDef[]>> = {
  vet: [
    { fieldName: "Weight", dataType: "number", unit: "lbs" },
    { fieldName: "Temperature", dataType: "number", unit: "°F" },
    { fieldName: "Cost", dataType: "number", unit: "$" },
    { fieldName: "Next due", dataType: "date" },
  ],
  vaccine: [
    { fieldName: "Vaccine name", dataType: "text" },
    { fieldName: "Next due", dataType: "date" },
    { fieldName: "Cost", dataType: "number", unit: "$" },
  ],
  medication: [
    { fieldName: "Dose", dataType: "text" },
    { fieldName: "Cost", dataType: "number", unit: "$" },
  ],
  grooming: [
    { fieldName: "Weight", dataType: "number", unit: "lbs" },
    { fieldName: "Cost", dataType: "number", unit: "$" },
  ],
  health: [
    { fieldName: "Weight", dataType: "number", unit: "lbs" },
    { fieldName: "Cost", dataType: "number", unit: "$" },
  ],
  // training and meals are gone: both categories now log through the Quick log spec,
  // which already asks for duration/distractions and amount-eaten in a better shape.
  // `alone-time` stays — it's what `aloneTimeMinutes` reads to write the readiness row.
  "alone-time": [{ fieldName: "Duration", dataType: "number", unit: "min" }],
};

export function defaultLogFieldsFor(category: Category): LogFieldDef[] {
  return (DEFAULT_LOG_FIELDS[category] ?? []).map((field) => ({ ...field }));
}

export function emptyLogValues(fields: LogFieldDef[]): LogFieldValue[] {
  return fields.map((field) => ({ fieldName: field.fieldName, dataType: field.dataType, unit: field.unit, value: null }));
}

/** The checklist definition an item actually runs, which is either its own
 * hand-typed rows or — when linked to a milestone — that milestone's steps. Keeping
 * this derived rather than copied means editing the milestone updates every item
 * pulling from it, instead of leaving stale duplicates behind. */
export function resolveChecklistDefs(item: Item, milestones: Milestone[]): ChecklistItemDef[] {
  if (item.checklistSourceMilestoneId) {
    const milestone = milestones.find((entry) => entry.id === item.checklistSourceMilestoneId);
    if (milestone) {
      // A milestone aimed at exactly one dog stamps that dog onto its steps, so a
      // pulled-through checklist lands pre-assigned instead of ambiguous. Milestones
      // covering both dogs leave it undefined — the step genuinely applies to both.
      const dogId = milestone.dogIds.length === 1 ? milestone.dogIds[0] : undefined;
      return milestone.steps.map((step) => ({ itemName: step.title, dataType: "boolean" as const, dogId }));
    }
  }
  return item.checklist;
}

/** Builds the default (all-empty) checklist values for an occurrence — used both
 * when a lifecycle action first materializes one and when the completion review
 * step needs a starting point to edit. */
export function buildDefaultChecklist(item: Item, milestones: Milestone[] = []): ChecklistItemValue[] {
  return resolveChecklistDefs(item, milestones).map((def) => ({
    itemName: def.itemName,
    dataType: def.dataType,
    value: def.dataType === "boolean" ? false : def.dataType === "free_text" ? "" : 0,
    notes: "",
    dogId: def.dogId,
  }));
}

/** Groups checklist rows by the dog they're assigned to, preserving order, with
 * unassigned ("everyone") rows first. Returns a single unlabelled group when no row
 * is dog-specific, so the common case renders exactly as it did before. */
export function groupChecklistByDog<T extends { dogId?: string }>(rows: T[]): { dogId?: string; rows: T[] }[] {
  if (!rows.some((row) => row.dogId)) return [{ dogId: undefined, rows }];
  const groups: { dogId?: string; rows: T[] }[] = [];
  rows.forEach((row) => {
    const existing = groups.find((group) => group.dogId === row.dogId);
    if (existing) existing.rows.push(row);
    else groups.push({ dogId: row.dogId, rows: [row] });
  });
  return groups.sort((a, b) => (a.dogId ? 1 : 0) - (b.dogId ? 1 : 0));
}

// `new Date("2026-08-01")` parses as UTC midnight per spec, which renders as
// the previous day in any timezone behind UTC (e.g. Mountain) — exactly the
// household this app is built for. Appending a local time-of-day avoids that
// off-by-one for every date-only ("YYYY-MM-DD") string in the app.
export function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return parseLocalDate(date).toLocaleDateString(undefined, options);
}

export function weeksOld(date: string) {
  const birthday = parseLocalDate(date).getTime();
  return Math.max(0, Math.floor((Date.now() - birthday) / (1000 * 60 * 60 * 24 * 7)));
}

export function ageLabel(date: string) {
  if (!date) return "Age TBD";
  const birth = parseLocalDate(date);
  if (Number.isNaN(birth.getTime())) return "Age TBD";
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  const weeks = weeksOld(date);
  if (weeks < 24) return `${weeks} weeks old`;
  if (months < 24) return `${months} months old`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years} years, ${remainder} months old` : `${years} years old`;
}

export function pct(value: number, max = 100) {
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

// --- Milestone progress ------------------------------------------------------
//
// Everything below is per-dog. A milestone covering both dogs holds one row of
// step definitions but two independent session counts, so Griz proofing "leave it"
// and Mara meeting it for the first time never share a number. The `…ForAll`
// variants exist only for the few places that genuinely have no dog in context
// (the stored `status` field, the aggregate Milestones list).

/** Sessions logged for one dog on one step. Read through this rather than indexing
 * `sessionsByDog` directly — the key is absent until the first session is logged. */
export function stepSessions(step: MilestoneStep, dogId: string): number {
  return step.sessionsByDog[dogId] ?? 0;
}

/** The dogs a milestone actually tracks. An empty `dogIds` means household-wide, in
 * which case every dog passed in counts. */
export function milestoneDogs(milestone: Milestone, allDogIds: string[]): string[] {
  return milestone.dogIds.length > 0 ? milestone.dogIds : allDogIds;
}

/** Moves the named steps' session counts by `direction` for each of `dogIds`,
 * clamped to [0, sessionsRequired]. The single place per-dog session arithmetic
 * happens — logging a session, undoing one, and re-applying an edited Quick log all
 * route through here so they can't drift apart on the clamping rules. */
export function adjustStepSessions(
  steps: MilestoneStep[],
  stepTitles: string[],
  dogIds: string[],
  direction: 1 | -1,
): MilestoneStep[] {
  const targets = new Set(stepTitles);
  return steps.map((step) => {
    if (!targets.has(step.title)) return step;
    const sessionsByDog = { ...step.sessionsByDog };
    dogIds.forEach((dogId) => {
      const next = (sessionsByDog[dogId] ?? 0) + direction;
      sessionsByDog[dogId] = Math.max(0, Math.min(step.sessionsRequired, next));
    });
    return { ...step, sessionsByDog };
  });
}

export function milestoneProgress(milestone: Milestone, dogId: string) {
  const total = milestone.steps.reduce((sum, step) => sum + step.sessionsRequired, 0);
  const done = milestone.steps.reduce((sum, step) => sum + Math.min(stepSessions(step, dogId), step.sessionsRequired), 0);
  return total === 0 ? 0 : pct(done, total);
}

export function isMilestoneComplete(milestone: Milestone, dogId: string) {
  return milestone.steps.every((step) => stepSessions(step, dogId) >= step.sessionsRequired);
}

/** Complete for every dog it covers — what the stored `status` field means. */
export function isMilestoneCompleteForAll(milestone: Milestone, allDogIds: string[]) {
  const dogIds = milestoneDogs(milestone, allDogIds);
  if (dogIds.length === 0) return false;
  return dogIds.every((dogId) => isMilestoneComplete(milestone, dogId));
}

export type DependencyStatus = {
  id: string;
  title: string;
  met: boolean;
  progress: number;
};

/** Dependencies resolved for one dog: Griz can't start "Sit" until *Griz* has
 * finished "Marker word", regardless of how far along Mara is. */
export function resolveDependencies(milestone: Milestone, allMilestones: Milestone[], dogId: string): DependencyStatus[] {
  return milestone.dependencies.map((depId) => {
    const dep = allMilestones.find((item) => item.id === depId);
    if (!dep) {
      return { id: depId, title: depId, met: false, progress: 0 };
    }
    // A dependency this dog isn't enrolled in can't be a blocker for them.
    const applies = dep.dogIds.length === 0 || dep.dogIds.includes(dogId);
    if (!applies) return { id: dep.id, title: dep.title, met: true, progress: 100 };
    return { id: dep.id, title: dep.title, met: isMilestoneComplete(dep, dogId), progress: milestoneProgress(dep, dogId) };
  });
}

export function milestoneStatusFor(milestone: Milestone, allMilestones: Milestone[], dogId: string): MilestoneStatus {
  if (milestone.status === "skipped" || milestone.status === "delayed") return milestone.status;
  if (isMilestoneComplete(milestone, dogId)) return "completed";
  const hasLoggedProgress = milestone.steps.some((step) => stepSessions(step, dogId) > 0);
  if (hasLoggedProgress) return "current";
  const deps = resolveDependencies(milestone, allMilestones, dogId);
  return deps.every((dep) => dep.met) ? "current" : "locked";
}

/** The stored status: completed once every covered dog is done, locked only while
 * it's locked for all of them, current as soon as any dog can work on it. */
export function computeMilestoneStatus(milestone: Milestone, allMilestones: Milestone[], allDogIds: string[]): MilestoneStatus {
  if (milestone.status === "skipped" || milestone.status === "delayed") return milestone.status;
  const dogIds = milestoneDogs(milestone, allDogIds);
  if (dogIds.length === 0) return milestone.status;
  const perDog = dogIds.map((dogId) => milestoneStatusFor(milestone, allMilestones, dogId));
  if (perDog.every((status) => status === "completed")) return "completed";
  return perDog.some((status) => status !== "locked") ? "current" : "locked";
}

export function readinessScore(
  kind: "vet" | "walk" | "recall" | "hiking" | "dogPark",
  dog: { confidence: number; humanFriendliness: number; dogFriendliness: number; fearfulness: number; noiseSensitivity: number; resourceGuarding: number; masteredCommands: string[] },
) {
  const vaccineBonus = kind === "dogPark" ? 8 : 18;
  const base =
    dog.confidence * 0.28 +
    dog.humanFriendliness * 0.14 +
    dog.dogFriendliness * 0.16 +
    (100 - dog.fearfulness) * 0.18 +
    (100 - dog.noiseSensitivity) * 0.1 +
    (100 - dog.resourceGuarding) * 0.08;
  const skillBonus = dog.masteredCommands.length * (kind === "recall" ? 5 : 3);
  const dampener = kind === "dogPark" ? 20 : kind === "hiking" ? 8 : 0;
  return Math.max(5, Math.min(98, Math.round(base + skillBonus + vaccineBonus - dampener)));
}

/** Occurrences completed on a specific day. The old version read `DailyFeedback`,
 * which was keyed on item id alone with no date — so completing a daily routine once
 * marked it done permanently. Everything here is date-scoped now. */
export function completedIdsOn(occurrences: ItemOccurrence[], dateKey: string): Set<string> {
  return new Set(
    occurrences.filter((entry) => entry.date === dateKey && entry.state === "completed").map((entry) => entry.itemId),
  );
}

export function useAdaptivePlan(items: Item[], occurrences: ItemOccurrence[], dateKey: string) {
  return useMemo(() => {
    // "Hard days" now reads real scores off the last handful of completed
    // occurrences, including per-checklist-row scores — a session that closed at 4/5
    // overall but had a step scored 1 still counts as hard, which the old
    // rating-only check missed entirely.
    const recent = occurrences
      .filter((entry) => entry.state === "completed" && entry.rating !== undefined)
      .slice()
      .sort((a, b) => (b.endTime ?? "").localeCompare(a.endTime ?? ""))
      .slice(0, 6);
    const hardDays = recent.filter(
      (entry) => (entry.rating ?? 5) <= 2 || entry.checklist.some((row) => (row.rating ?? 5) <= 2),
    ).length;
    const optionalLimit = hardDays >= 3 ? 1 : 3;
    const completed = completedIdsOn(occurrences, dateKey);
    const day = parseLocalDate(dateKey);
    const visibleTasks = items
      .filter((item) => item.requiresCompletion)
      // Only what actually lands on this date. Tasks used to have no recurrence and
      // rendered on every day unconditionally, so "Today" listed things that weren't
      // today's — now that items carry real recurrence, honour it.
      .filter((item) => generateOccurrences(item, day, day).length > 0)
      .filter((item) => item.priority !== "optional" || optionalLimit > 1 || completed.has(item.id))
      .slice()
      .sort((a, b) => {
        const aDone = completed.has(a.id);
        const bDone = completed.has(b.id);
        if (aDone !== bDone) return aDone ? 1 : -1;
        return (parseTimeLabel(a.startTime ?? "") ?? 0) - (parseTimeLabel(b.startTime ?? "") ?? 0);
      });
    const trainingMinutes = visibleTasks
      .filter((item) => item.category === "training" || item.category === "handling" || item.category === "relationship")
      .reduce((sum, item) => sum + itemDurationMinutes(item), 0);
    return {
      hardDays,
      optionalLimit,
      visibleTasks,
      completedIds: completed,
      trainingMinutes,
      targetTrainingMinutes: [20, 30] as [number, number],
      targetExerciseMinutes: [30, 60] as [number, number],
      mode: hardDays >= 3 ? "Recovery workload" : "Balanced workload",
      coach:
        hardDays >= 3
          ? "Several difficult logs were detected, so tomorrow should protect essentials and reduce optional training."
          : "Today is balanced: short structured sessions, relationship care, and essential health routines stay visible.",
    };
  }, [items, occurrences, dateKey]);
}

/** Minutes an item occupies. Items store hours (the calendar's unit) but tasks were
 * always authored in minutes, so every duration read goes through here rather than
 * scattering `* 60` across callsites. */
export function itemDurationMinutes(item: Pick<Item, "durationHours">): number {
  return Math.round((item.durationHours ?? 0) * 60);
}

export function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

/** Weekly (Sun-Sat) total minutes of dog-alone-time coverage required by events with
 * an occurrence that week, keyed by the week's Sunday (YYYY-MM-DD). Only counts events
 * with aloneTimeRequired !== "no" — "all" uses the event's own duration, "partial" uses
 * the user-entered aloneTimeRequiredAmount, mirroring computeEventCoverageNeeded. */
export function weeklyAloneTimeLoadMinutes(events: Item[], rangeStart: Date, rangeEnd: Date): Map<string, number> {
  const byWeek = new Map<string, number>();
  events.forEach((event) => {
    if (event.aloneTimeRequired === "no") return;
    const requiredMinutes =
      (event.aloneTimeRequired === "all" ? (event.durationHours ?? 0) : (event.aloneTimeRequiredAmount ?? 0)) * 60;
    if (requiredMinutes <= 0) return;
    generateOccurrences(event, rangeStart, rangeEnd).forEach((dateKey) => {
      const week = weekStart(dateKey);
      byWeek.set(week, (byWeek.get(week) ?? 0) + requiredMinutes);
    });
  });
  return byWeek;
}

/** Max proven alone-time stretch (minutes) for one specific dog, from logged sessions
 * that included that dog. Tracked per dog — not a single household number — since an
 * adult dog and a puppy build tolerance at very different paces. */
export function dogAloneTimeReadinessMinutes(dogId: string, logs: AloneTimeLog[]): number {
  return logs.reduce((max, log) => (log.dogIds.includes(dogId) ? Math.max(max, log.durationMinutes) : max), 0);
}

/** Which dog(s) this event actually leaves home alone: every dog NOT tagged in
 * dogIds ("dogs involved"/attending), when the event needs any coverage at all.
 * Empty when coverage isn't required or every dog is attending. */
export function dogsNeedingCoverage(event: Pick<Item, "aloneTimeRequired" | "dogIds">, allDogIds: string[]): string[] {
  if (event.aloneTimeRequired === "no") return [];
  const involved = new Set(event.dogIds ?? []);
  return allDogIds.filter((id) => !involved.has(id));
}

// A week is "busy" when the dog-alone-time coverage it needs exceeds what the dogs
// have actually proven they can sustain across 7 days — i.e. the household would need
// to arrange more coverage (Rover, split trips, shorter outings) than a normal week.
// "Normal" is calibrated to the household's weakest-linked dog (the lowest of each
// dog's own single best proven stretch × 7), since a week that overloads even one dog
// counts as busy for the household. Replaces the old manual "importance: marquee"
// checkbox — this one formula now drives every heavy/busy-week indicator in the app
// (Month view highlighting, Upcoming list tags).
export function heavyWeeks(events: Item[], logs: AloneTimeLog[], allDogIds: string[], rangeStart: Date, rangeEnd: Date): Set<string> {
  const readinessMinutes = allDogIds.length > 0 ? Math.min(...allDogIds.map((id) => dogAloneTimeReadinessMinutes(id, logs))) : 0;
  const weeklyBudgetMinutes = readinessMinutes * 7;
  const byWeek = weeklyAloneTimeLoadMinutes(events, rangeStart, rangeEnd);
  const heavy = new Set<string>();
  byWeek.forEach((minutes, week) => {
    if (minutes > weeklyBudgetMinutes) heavy.add(week);
  });
  return heavy;
}

export function isHeavyWeek(event: Item, weeks: Set<string>): boolean {
  return !!event.date && weeks.has(weekStart(event.date));
}

// --- Day/week/month calendar grid helpers -----------------------------------

const DAY_NAMES: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function dayOfWeekName(date: Date): DayOfWeek {
  return DAY_NAMES[date.getDay()];
}

/** Every date (as YYYY-MM-DD keys) this event occurs on within [rangeStart, rangeEnd],
 * inclusive, respecting excludedDates. The single source of truth for expanding a
 * Item into occurrences — replaces the old per-callsite dayOfWeek/activeFrom/
 * activeTo checks. Recurring series are walked from `recurrence.startDate` every call
 * (not incrementally cached), capped at ITER_CAP periods as a safety bound. */
export function generateOccurrences(event: Item, rangeStart: Date, rangeEnd: Date): string[] {
  const rangeStartKey = toDateKey(rangeStart);
  const rangeEndKey = toDateKey(rangeEnd);
  const excluded = new Set(event.excludedDates ?? []);

  if (event.kind === "one-off") {
    if (!event.date || excluded.has(event.date)) return [];
    return event.date >= rangeStartKey && event.date <= rangeEndKey ? [event.date] : [];
  }

  const rec = event.recurrence;
  if (!rec) return [];

  const startDate = parseLocalDate(rec.startDate);
  const endDate = rec.endDate ? parseLocalDate(rec.endDate) : null;
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
    const monthDay = rec.monthDay ?? startDate.getDate();
    for (let i = 0; i < ITER_CAP; i++) {
      const occDate = rec.frequency === "monthly" ? new Date(cursor.getFullYear(), cursor.getMonth(), monthDay) : cursor;
      if (!emit(occDate)) break;
      cursor =
        rec.frequency === "daily" ? addDays(cursor, interval) : rec.frequency === "monthly" ? addMonths(cursor, interval) : addMonths(cursor, 12 * interval);
    }
  }

  return results.sort();
}

/** Fills in whichever of startTime/endTime/durationHours is missing from the other
 * two (the "2 of 3 mandatory" rule). Leaves input untouched if fewer than 2 are set. */
export function computeEventTimes(input: {
  startTime?: string;
  endTime?: string;
  durationHours?: number;
}): { startTime?: string; endTime?: string; durationHours?: number } {
  const startMinutes = input.startTime ? parseTimeLabel(input.startTime) : null;
  const endMinutes = input.endTime ? parseTimeLabel(input.endTime) : null;
  const duration = input.durationHours;

  if (startMinutes !== null && endMinutes !== null) {
    let diff = endMinutes - startMinutes;
    if (diff < 0) diff += 24 * 60;
    return { ...input, durationHours: Math.round((diff / 60) * 100) / 100 };
  }
  if (startMinutes !== null && duration != null) {
    return { ...input, endTime: formatMinutes((startMinutes + duration * 60) % (24 * 60)) };
  }
  if (endMinutes !== null && duration != null) {
    let start = endMinutes - duration * 60;
    if (start < 0) start += 24 * 60;
    return { ...input, startTime: formatMinutes(start) };
  }
  return input;
}

/** Does this event need more dog coverage than the dog(s) actually left home alone
 * have proven they can handle? "Left home alone" is whichever dogs aren't tagged in
 * dogIds (dogs involved/attending) — so selecting only Bree+Mara on an event means
 * Griz is the one needing coverage, and his own readiness is what's checked. When
 * more than one dog is left home together, the threshold is the minimum of their
 * individual readiness values (the group can't safely go longer than its
 * least-tolerant member) — a global rule computed from whichever dogs are actually
 * involved, never a hardcoded dog. */
export function computeEventCoverageNeeded(
  event: Pick<Item, "aloneTimeRequired" | "aloneTimeRequiredAmount" | "durationHours" | "dogIds">,
  allDogIds: string[],
  logs: AloneTimeLog[],
): boolean {
  const needing = dogsNeedingCoverage(event, allDogIds);
  if (needing.length === 0) return false;
  const neededMinutes = (event.aloneTimeRequired === "all" ? (event.durationHours ?? 0) : (event.aloneTimeRequiredAmount ?? 0)) * 60;
  if (neededMinutes <= 0) return false;
  const threshold = Math.min(...needing.map((id) => dogAloneTimeReadinessMinutes(id, logs)));
  return neededMinutes > threshold;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Sunday that starts the week containing `date`. */
export function weekStartDate(date: Date): Date {
  return addDays(date, -date.getDay());
}

/** The 7 days (Sunday-Saturday) of the week containing `date`. */
export function weekDays(date: Date): Date[] {
  const start = weekStartDate(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** A 42-cell (6-week) grid covering the month containing `date`, including
 * leading/trailing days from adjacent months so every row is a full week. */
export function monthGridDays(date: Date): Date[] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = weekStartDate(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** Best-effort extraction of minutes-since-midnight from a free-text time
 * label like "~6:00 PM", "7:15 AM", or "Kickoff TBA". Returns null when no
 * clock time can be found (placeholders, "TBA", ranges without a clear start). */
export function parseTimeLabel(label: string): number | null {
  const match = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/** Minutes past midnight as a wall-clock label — "435" becomes "7:15 AM". For a
 * *length* of time use `formatDuration`; this one would call three hours "3:00 AM". */
export function formatMinutes(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

/** A span of time — "132" becomes "2h 12m". */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Native `<input type="time">` gives "HH:MM" 24-hour values — convert to the
 * "H:MM AM/PM" format used everywhere else in the app (Task.time, event labels). */
export function to12Hour(time24: string): string {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":").map(Number);
  return formatMinutes(hours * 60 + minutes);
}

/** Reverse of to12Hour — for pre-filling a native time input from a stored "H:MM AM/PM" value. */
export function to24Hour(label: string): string {
  const minutes = parseTimeLabel(label);
  if (minutes === null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type AloneTimeReadiness = {
  maxAchievedMinutes: number;
  nextEvent: Item | null;
  requiredMinutes: number;
  gapMinutes: number;
  ready: boolean;
};

/** One dog's own readiness picture: their proven max, and the next upcoming event
 * that actually leaves THEM home alone (i.e. this dog is in dogsNeedingCoverage for
 * it) — not just any event with coverage required, since an event either dog is
 * attending doesn't apply to the one staying home. */
export function computeDogAloneTimeReadiness(dogId: string, allDogIds: string[], logs: AloneTimeLog[], events: Item[]): AloneTimeReadiness {
  const maxAchievedMinutes = dogAloneTimeReadinessMinutes(dogId, logs);
  const now = Date.now();
  const upcoming = events
    .filter(
      (event) =>
        dogsNeedingCoverage(event, allDogIds).includes(dogId) && event.date && parseLocalDate(event.date).getTime() >= now,
    )
    .sort((a, b) => parseLocalDate(a.date as string).getTime() - parseLocalDate(b.date as string).getTime());
  const nextEvent = upcoming[0] ?? null;
  const requiredMinutes = nextEvent
    ? (nextEvent.aloneTimeRequired === "all" ? (nextEvent.durationHours ?? 0) : (nextEvent.aloneTimeRequiredAmount ?? 0)) * 60
    : 0;
  const gapMinutes = Math.max(0, requiredMinutes - maxAchievedMinutes);
  return { maxAchievedMinutes, nextEvent, requiredMinutes, gapMinutes, ready: requiredMinutes > 0 && gapMinutes === 0 };
}

/** Categories that represent a dog's health record rather than general household
 * life — drives the Health tab's lens and the overdue/upcoming health warnings. */
export const HEALTH_CATEGORIES: Category[] = ["health", "vet", "vaccine", "medication", "grooming"];

export function isHealthItem(item: Pick<Item, "category">): boolean {
  return HEALTH_CATEGORIES.includes(item.category);
}

/** A routine that happens so often it's noise on a shared calendar — hourly potty
 * breaks, every meal. Andrew's household still wants them tracked and completed;
 * Bree just doesn't want them burying the things she's actually looking for
 * (Feedback, 2026-07-12). Drives the Calendar's "Hide routines" toggle, which is a
 * per-viewer preference rather than a property of the item, so nothing is ever
 * hidden from the person who wants to see it.
 *
 * Reads the stored field, which is the only thing that gets this right: "Parallel
 * decompression walk" at 6:15pm belongs on a calendar and "Morning potty" doesn't, and
 * both are daily routines with the same intent. Items predating the field fall back to
 * the original guess so nothing that was hidden yesterday reappears today. */
export function isBackgroundRoutine(item: Pick<Item, "intent" | "recurrence" | "calendarVisibility">): boolean {
  if (item.calendarVisibility) return item.calendarVisibility === "checklist-only";
  return item.intent === "routine" && item.recurrence?.frequency === "daily";
}

export function computeNotifications(
  items: Item[],
  occurrences: ItemOccurrence[],
  milestones: Milestone[],
  dogs: Pick<Dog, "id" | "name">[],
  aloneTimeLogs: AloneTimeLog[],
): NotificationItem[] {
  const notifications: NotificationItem[] = [];
  const now = new Date();
  // Scoped to today, so finishing a daily routine clears its nag for today and it
  // returns tomorrow. The old check was item-wide and never came back once completed.
  const todayKey = toDateKey(now);
  const completedItemIds = completedIdsOn(occurrences, todayKey);

  items.forEach((item) => {
    if (!item.requiresCompletion) return;
    // Only nag about items that actually land on today.
    if (generateOccurrences(item, now, now).length === 0) return;
    if (item.priority === "essential" && !completedItemIds.has(item.id)) {
      notifications.push({
        id: `overdue-${item.id}`,
        kind: "overdue-task",
        title: `${item.title} is not logged yet`,
        detail: `Essential item assigned at ${item.startTime ?? "no set time"}.`,
        date: now.toISOString(),
        severity: "warning",
      });
    }
  });

  items.forEach((item) => {
    if (!isHealthItem(item) || !item.date) return;
    const itemDate = parseLocalDate(item.date);
    const daysAway = Math.ceil((itemDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAway < 0) {
      notifications.push({
        id: `overdue-health-${item.id}`,
        kind: "upcoming-health",
        title: `${item.title} is overdue`,
        detail: `${item.category} was due ${itemDate.toLocaleDateString()}.`,
        date: item.date,
        severity: "critical",
      });
    } else if (daysAway <= 3) {
      notifications.push({
        id: `upcoming-health-${item.id}`,
        kind: "upcoming-health",
        title: `${item.title} coming up`,
        detail: `${item.category} scheduled ${itemDate.toLocaleDateString()}.`,
        date: item.date,
        severity: "info",
      });
    }
  });

  milestones.forEach((milestone) => {
    const status = computeMilestoneStatus(milestone, milestones, dogs.map((dog) => dog.id));
    if (status === "current" && milestone.status === "locked") {
      notifications.push({
        id: `unlocked-${milestone.id}`,
        kind: "milestone-unlocked",
        title: `${milestone.title} just unlocked`,
        detail: "All prerequisites are now met.",
        date: now.toISOString(),
        severity: "info",
      });
    }
  });

  // Any occurrence in the next 7 days that needs more coverage than the dog(s) left
  // home alone have proven they can handle, and hasn't been confirmed arranged,
  // surfaces as a warning so it doesn't get missed just because the calendar view
  // happens to be scrolled elsewhere.
  const allDogIds = dogs.map((dog) => dog.id);
  const dogName = (id: string) => dogs.find((dog) => dog.id === id)?.name ?? id;
  const sevenDaysOut = addDays(now, 7);
  items.forEach((event) => {
    if (event.coverageConfirmed) return;
    if (!computeEventCoverageNeeded(event, allDogIds, aloneTimeLogs)) return;
    const needing = dogsNeedingCoverage(event, allDogIds).map(dogName).join(" & ");
    generateOccurrences(event, now, sevenDaysOut).forEach((dateKey) => {
      notifications.push({
        id: `coverage-${event.id}-${dateKey}`,
        kind: "coverage-needed",
        title: `${event.title} needs coverage arranged`,
        detail: `${formatDate(dateKey)} needs more coverage than ${needing} ${needing.includes("&") ? "have" : "has"} proven they can handle — confirm a sitter is arranged.`,
        date: dateKey,
        severity: "warning",
      });
    });
  });

  return notifications.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// --- Meal planning / inventory / grocery list -------------------------------

export function isExpiringSoon(item: InventoryItem, withinDays = 3): boolean {
  const expiration = parseLocalDate(item.estimatedExpirationDate).getTime();
  const cutoff = Date.now() + withinDays * 24 * 60 * 60 * 1000;
  return expiration <= cutoff;
}

export function isExpired(item: InventoryItem): boolean {
  return parseLocalDate(item.estimatedExpirationDate).getTime() < Date.now();
}

/** Rough total-scheduled-minutes for a day, used to warn when assigning a meal
 * with a long combined prep+cook time to an already-packed evening.
 *
 * Background routines are excluded. Five-minute potty breaks every couple of hours
 * would make every day read as packed, which is the opposite of the signal this is
 * for — the question is whether there's room for a long recipe, and the potty breaks
 * happen either way. */
export function dayLoadMinutes(dateKey: string, items: Item[]): number {
  const day = parseLocalDate(dateKey);
  return items
    .filter((item) => !isBackgroundRoutine(item))
    .filter((item) => generateOccurrences(item, day, day).length > 0)
    .reduce((sum, item) => sum + itemDurationMinutes(item), 0);
}

/** Diffs the ingredients needed for meals planned within `dateKeys` against
 * current inventory, producing a fresh grocery list (new ids each time this
 * runs — callers persist it via `groceryList.setItems(...)` to replace the
 * previous list). Matches ingredients to inventory by case-insensitive name
 * + unit; anything already on hand in sufficient quantity is marked
 * `already_have`, everything else `needed`. */
export function generateGroceryList(
  dateKeys: string[],
  meals: Meal[],
  recipeIngredients: RecipeIngredient[],
  inventory: InventoryItem[],
  makeId: (prefix: string) => string,
): GroceryListItem[] {
  const relevantMealIds = new Set(meals.filter((meal) => meal.plannedDate && dateKeys.includes(meal.plannedDate)).map((meal) => meal.id));
  const needed = new Map<string, { itemName: string; unit: string; quantity: number; mealIds: string[] }>();

  recipeIngredients
    .filter((ingredient) => relevantMealIds.has(ingredient.mealId))
    .forEach((ingredient) => {
      const key = `${ingredient.ingredientName.trim().toLowerCase()}|${ingredient.unit.trim().toLowerCase()}`;
      const existing = needed.get(key);
      if (existing) {
        existing.quantity += ingredient.quantity;
        existing.mealIds.push(ingredient.mealId);
      } else {
        needed.set(key, { itemName: ingredient.ingredientName, unit: ingredient.unit, quantity: ingredient.quantity, mealIds: [ingredient.mealId] });
      }
    });

  return Array.from(needed.values()).map((entry) => {
    const onHand = inventory.filter(
      (item) => item.itemName.trim().toLowerCase() === entry.itemName.trim().toLowerCase() && item.unit.trim().toLowerCase() === entry.unit.trim().toLowerCase(),
    );
    const onHandQuantity = onHand.reduce((sum, item) => sum + item.quantity, 0);
    const remaining = Math.max(0, entry.quantity - onHandQuantity);
    return {
      id: makeId("grocery"),
      itemName: entry.itemName,
      quantityNeeded: remaining,
      unit: entry.unit,
      linkedMealIds: entry.mealIds,
      status: remaining > 0 ? "needed" : "already_have",
    };
  });
}
