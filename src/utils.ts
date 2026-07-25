import { useMemo } from "react";
import {
  AloneTimeLog,
  Category,
  ChecklistItemDef,
  ChecklistItemValue,
  DailyFeedback,
  DayOfWeek,
  Dog,
  GroceryListItem,
  InventoryItem,
  Item,
  ItemIntent,
  ItemState,
  LogFieldDef,
  LogFieldValue,
  Meal,
  Milestone,
  NotificationItem,
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
  training: [{ fieldName: "Reps", dataType: "number" }],
  meals: [{ fieldName: "Amount eaten", dataType: "text" }],
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
    if (milestone) return milestone.steps.map((step) => ({ itemName: step.title, dataType: "boolean" as const }));
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
  }));
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

export function milestoneProgress(milestone: Milestone) {
  const total = milestone.steps.reduce((sum, step) => sum + step.sessionsRequired, 0);
  const done = milestone.steps.reduce((sum, step) => sum + Math.min(step.completedSessions, step.sessionsRequired), 0);
  return total === 0 ? 0 : pct(done, total);
}

export function isMilestoneComplete(milestone: Milestone) {
  return milestone.steps.every((step) => step.completedSessions >= step.sessionsRequired);
}

export type DependencyStatus = {
  id: string;
  title: string;
  met: boolean;
  progress: number;
};

export function resolveDependencies(milestone: Milestone, allMilestones: Milestone[]): DependencyStatus[] {
  return milestone.dependencies.map((depId) => {
    const dep = allMilestones.find((item) => item.id === depId);
    if (!dep) {
      return { id: depId, title: depId, met: false, progress: 0 };
    }
    return { id: dep.id, title: dep.title, met: isMilestoneComplete(dep) || dep.status === "completed", progress: milestoneProgress(dep) };
  });
}

export function computeMilestoneStatus(milestone: Milestone, allMilestones: Milestone[]): Milestone["status"] {
  if (milestone.status === "skipped" || milestone.status === "delayed") return milestone.status;
  if (isMilestoneComplete(milestone)) return "completed";
  const hasLoggedProgress = milestone.steps.some((step) => step.completedSessions > 0);
  if (hasLoggedProgress) return "current";
  const deps = resolveDependencies(milestone, allMilestones);
  const allDepsMet = deps.every((dep) => dep.met);
  return allDepsMet ? "current" : "locked";
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

export function useAdaptivePlan(items: Item[], feedback: DailyFeedback[]) {
  return useMemo(() => {
    const hardDays = feedback.slice(-6).filter((item) => item.rating <= 2 || item.fear || item.guarding).length;
    const optionalLimit = hardDays >= 3 ? 1 : 3;
    const completed = new Set(feedback.filter((item) => item.completed).map((item) => item.taskId));
    const visibleTasks = items
      .filter((item) => item.requiresCompletion)
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
      trainingMinutes,
      targetTrainingMinutes: [20, 30] as [number, number],
      targetExerciseMinutes: [30, 60] as [number, number],
      mode: hardDays >= 3 ? "Recovery workload" : "Balanced workload",
      coach:
        hardDays >= 3
          ? "Several difficult logs were detected, so tomorrow should protect essentials and reduce optional training."
          : "Today is balanced: short structured sessions, relationship care, and essential health routines stay visible.",
    };
  }, [items, feedback]);
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

export function formatMinutes(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
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

export function computeNotifications(
  items: Item[],
  feedback: DailyFeedback[],
  milestones: Milestone[],
  dogs: Pick<Dog, "id" | "name">[],
  aloneTimeLogs: AloneTimeLog[],
): NotificationItem[] {
  const notifications: NotificationItem[] = [];
  const now = new Date();
  const completedItemIds = new Set(feedback.filter((item) => item.completed).map((item) => item.taskId));

  items.forEach((item) => {
    if (!item.requiresCompletion) return;
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
    const status = computeMilestoneStatus(milestone, milestones);
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
 * with a long combined prep+cook time to an already-packed evening. */
export function dayLoadMinutes(dateKey: string, items: Item[]): number {
  const day = parseLocalDate(dateKey);
  return items
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
