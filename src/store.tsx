import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import {
  aloneTimeLogs as seedAloneTimeLogs,
  dogs as seedDogs,
  exposureItems as seedExposureItems,
  feedbackLoopRules,
  groceryList as seedGroceryList,
  households as seedHouseholds,
  inventory as seedInventory,
  items as seedItems,
  journalEntries as seedJournalEntries,
  locations,
  meals as seedMeals,
  milestones as seedMilestones,
  people as seedPeople,
  recipeIngredients as seedRecipeIngredients,
  relationshipLogs as seedRelationshipLogs,
  shelfLifeDefaultsDays,
} from "./data";
import * as mapping from "./dataMapping";
import { getSupabaseClient, isBackendConfigured } from "./supabaseClient";
import {
  AloneTimeLog,
  ChecklistItemValue,
  Dog,
  ExposureItem,
  GroceryListItem,
  Household,
  InboxRequest,
  InventoryItem,
  Item,
  ItemDeletion,
  ItemDeletionScope,
  ItemHistoryEntry,
  ItemLog,
  ItemOccurrence,
  JournalEntry,
  LogFieldValue,
  Meal,
  Milestone,
  Person,
  ProductFeedback,
  QuickLogInput,
  QuickLogResult,
  RecipeIngredient,
  RelationshipLog,
} from "./types";
import {
  adjustStepSessions,
  buildDefaultChecklist,
  computeMilestoneStatus,
  isMilestoneComplete,
  milestoneDogs,
  milestoneProgress,
  milestoneStatusFor,
  nextTrainingFocus,
  resolveChecklistDefs,
  resolveDependencies,
  stepSessions,
} from "./utils";

const PREFIX = "dog-life-os";

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(`${PREFIX}-${key}`);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, value: T) {
  try {
    localStorage.setItem(`${PREFIX}-${key}`, JSON.stringify(value));
  } catch {
    // storage unavailable (private browsing, quota); state still holds the value in memory
  }
}

let cachedHouseholdId: string | null = null;

async function getHouseholdId(): Promise<string> {
  if (cachedHouseholdId) return cachedHouseholdId;
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase.from("households").select("id").limit(1).single();
  if (error || !data) throw new Error(error?.message ?? "No household found — run supabase/seed.sql first.");
  cachedHouseholdId = data.id;
  return data.id;
}

type Mapper<T> = { fromRow: (row: any) => T; toRow: (item: T, householdId: string) => Record<string, unknown> };

function usePersistedCollection<T extends { id: string }>(key: string, seed: T[]) {
  const [items, setItems] = useState<T[]>(() => loadJSON(key, seed));

  useEffect(() => {
    saveJSON(key, items);
  }, [key, items]);

  async function add(item: T) {
    setItems((prev) => [...prev, item]);
    return true;
  }
  async function update(id: string, patch: Partial<T>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    return true;
  }
  async function remove(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    return true;
  }
  return { items, setItems, add, update, remove, loaded: true };
}

// Most tables use a DB-generated uuid primary key (gen_random_uuid() default),
// so the app-side id from makeId() must be dropped before insert — Postgres
// rejects it outright ("invalid input syntax for type uuid"). Milestones and
// exposure items instead use meaningful text-slug ids with no DB default, so
// those must be sent as-is.
function useSupabaseCollection<T extends { id: string }>(table: string, mapper: Mapper<T>, idStrategy: "server" | "client" = "server") {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let active = true;

    supabase
      .from(table)
      .select("*")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error(`Failed to load ${table}:`, error.message);
          setLoaded(true);
          return;
        }
        setItems((data ?? []).map(mapper.fromRow));
        setLoaded(true);
      });

    const channel = supabase
      .channel(`public:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        setItems((prev) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: string }).id;
            return prev.filter((item) => item.id !== oldId);
          }
          const incoming = mapper.fromRow(payload.new);
          const exists = prev.some((item) => item.id === incoming.id);
          return exists ? prev.map((item) => (item.id === incoming.id ? incoming : item)) : [...prev, incoming];
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [table]);

  async function add(item: T) {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const householdId = await getHouseholdId();
    const row = mapper.toRow(item, householdId);
    if (idStrategy === "server") delete (row as { id?: unknown }).id;
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) {
      console.error(`Failed to add to ${table}:`, error.message);
      return false;
    }
    const mapped = mapper.fromRow(data);
    setItems((prev) => (prev.some((existing) => existing.id === mapped.id) ? prev : [...prev, mapped]));
    return true;
  }

  async function update(id: string, patch: Partial<T>) {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const current = itemsRef.current.find((item) => item.id === id);
    if (!current) return false;
    const merged = { ...current, ...patch };
    const householdId = await getHouseholdId();
    const row = mapper.toRow(merged, householdId);
    delete (row as { id?: unknown }).id;
    const { error } = await supabase.from(table).update(row).eq("id", id);
    if (error) {
      console.error(`Failed to update ${table}:`, error.message);
      return false;
    }
    setItems((prev) => prev.map((item) => (item.id === id ? merged : item)));
    return true;
  }

  async function remove(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      console.error(`Failed to remove from ${table}:`, error.message);
      return false;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    return true;
  }

  async function replaceAll(next: T[]) {
    const supabase = getSupabaseClient();
    if (!supabase || next.length === 0) return;
    const householdId = await getHouseholdId();
    const { error } = await supabase.from(table).upsert(next.map((item) => mapper.toRow(item, householdId)));
    if (error) {
      console.error(`Failed to import ${table}:`, error.message);
      return;
    }
    setItems(next);
  }

  return { items, setItems: replaceAll, add, update, remove, loaded };
}

function useCollection<T extends { id: string }>(
  key: string,
  seed: T[],
  table: string,
  mapper: Mapper<T>,
  idStrategy: "server" | "client" = "server",
) {
  const local = usePersistedCollection<T>(key, seed);
  const remote = useSupabaseCollection<T>(table, mapper, idStrategy);
  return isBackendConfigured() ? remote : local;
}

function useDataStore() {
  const households = usePersistedCollection<Household>("households", seedHouseholds);
  const dogs = useCollection<Dog>("dogs", seedDogs, "dogs", mapping.dog);
  const people = useCollection<Person>("people", seedPeople, "people", mapping.person);
  const items = useCollection<Item>("items", seedItems, "items", mapping.item);
  const milestones = useCollection<Milestone>("milestones", seedMilestones, "milestones", mapping.milestone, "client");
  const journalEntries = useCollection<JournalEntry>("journal-entries", seedJournalEntries, "journal_entries", mapping.journalEntry);
  const exposureItems = useCollection<ExposureItem>(
    "exposure-items",
    seedExposureItems,
    "exposure_items",
    mapping.exposureItem,
    "client",
  );
  const relationshipLogs = useCollection<RelationshipLog>("relationship-logs", seedRelationshipLogs, "relationship_logs", mapping.relationshipLog);
  const productFeedback = useCollection<ProductFeedback>("product-feedback", [], "product_feedback", mapping.productFeedback);
  const itemDeletions = useCollection<ItemDeletion>("item-deletions", [], "item_deletions", mapping.itemDeletion, "client");
  const aloneTimeLogs = useCollection<AloneTimeLog>("alone-time-logs", seedAloneTimeLogs, "alone_time_logs", mapping.aloneTimeLog);
  const itemOccurrences = useCollection<ItemOccurrence>("item-occurrences", [], "item_occurrences", mapping.itemOccurrence, "client");
  const itemLogs = useCollection<ItemLog>("item-logs", [], "item_logs", mapping.itemLog, "client");
  const inboxRequests = useCollection<InboxRequest>("inbox-requests", [], "inbox_requests", mapping.inboxRequest, "client");
  const meals = useCollection<Meal>("meals", seedMeals, "meals", mapping.meal);
  const recipeIngredients = useCollection<RecipeIngredient>("recipe-ingredients", seedRecipeIngredients, "recipe_ingredients", mapping.recipeIngredient);
  const inventory = useCollection<InventoryItem>("inventory", seedInventory, "inventory", mapping.inventoryItem);
  const groceryList = useCollection<GroceryListItem>("grocery-list", seedGroceryList, "grocery_list", mapping.groceryListItem);

  const backend = isBackendConfigured();

  const allDogIds = dogs.items.map((dog) => dog.id);

  useEffect(() => {
    const stale = milestones.items.filter((milestone) => {
      const computed = computeMilestoneStatus(milestone, milestones.items, allDogIds);
      return computed !== milestone.status && computed !== "locked";
    });
    if (stale.length > 0) {
      stale.forEach((milestone) => {
        const computed = computeMilestoneStatus(milestone, milestones.items, allDogIds);
        milestones.update(milestone.id, { status: computed });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones.items, dogs.items]);

  /** Quick-complete from a card: materializes the occurrence for `date` and closes it
   * with just an overall rating. Previously this wrote a `DailyFeedback` row keyed on
   * task id alone with no date, which meant completing a daily routine once marked it
   * done forever — and it also fabricated mood/notes/accident/fear/guarding from the
   * rating rather than observing anything. Both are gone; completion state now lives
   * in exactly one place, per date. */
  async function completeTask(item: Item, rating: number, date: string) {
    const instance = ensureInstance(item, date);
    const nowIso = new Date().toISOString();
    const started = instance.startTime ? instance : { ...instance, startTime: nowIso };
    return persistInstance({
      ...started,
      state: "completed",
      endTime: nowIso,
      rating,
      checklist: instance.checklist.length > 0 ? instance.checklist : buildDefaultChecklist(item, milestones.items),
      history: withHistory(instance, { type: "end", oldValue: instance.state, newValue: "completed", reason: "" }),
    });
  }

  /** The occurrence for an item on a given date, if it has been touched at all. */
  function occurrenceFor(itemId: string, date: string): ItemOccurrence | undefined {
    return itemOccurrences.items.find((entry) => entry.itemId === itemId && entry.originalDate === date);
  }

  function isCompletedOn(itemId: string, date: string): boolean {
    return occurrenceFor(itemId, date)?.state === "completed";
  }

  function logExposure(itemId: string, entry: ExposureItem["log"][number], status: ExposureItem["status"]) {
    const current = exposureItems.items.find((item) => item.id === itemId);
    if (!current) return;
    exposureItems.update(itemId, { log: [...current.log, entry], status });
  }

  // Deleting "this occurrence" of a recurring item doesn't remove the item row —
  // it adds the date to excludedDates so generateOccurrences skips it, keeping the
  // rest of the series intact. Deleting "the series" (or a one-off item) removes
  // the row outright. Either way a required note gets logged for the record.
  async function deleteItem(item: Item, scope: ItemDeletionScope, occurrenceDate: string | undefined, note: string) {
    // Detach observations before the item goes. `item_logs.item_id` is `on delete
    // cascade`, which is right for a log *of* an item — a vet visit's weights die with
    // the visit — but a potty Quick log that merely satisfied this slot is a record
    // about the dog. Deleting the "Morning potty" routine must not take months of
    // stool-consistency history with it. Excluding one date is the same problem in
    // miniature: the log would survive pointing at a day the item no longer occurs.
    const orphaned = itemLogs.items.filter(
      (log) =>
        log.itemId === item.id &&
        log.quickLogKind &&
        (scope === "series" || !occurrenceDate || log.occurrenceDate === occurrenceDate),
    );
    // `occurrenceDate` deliberately survives: on an unattached Quick log it just means
    // the day the thing happened, which is still true and still what the feed reads.
    await Promise.all(orphaned.map((log) => itemLogs.update(log.id, { itemId: undefined })));

    const ok =
      scope === "instance" && occurrenceDate
        ? await items.update(item.id, { excludedDates: [...(item.excludedDates ?? []), occurrenceDate] })
        : await items.remove(item.id);
    if (!ok) return false;
    return itemDeletions.add({
      id: makeId("itemdel"),
      itemId: item.id,
      itemTitle: item.title,
      scope,
      occurrenceDate: scope === "instance" ? occurrenceDate : undefined,
      note,
      deletedAt: new Date().toISOString(),
    });
  }

  // --- Item lifecycle workflow (start/stop/delegate/reschedule/skip) --------

  // Looks up by originalDate (the item's natural recurring slot), not the
  // possibly-rescheduled current `date`, so a moved occurrence is still found when
  // re-visiting the day it was originally supposed to happen.
  function getInstance(itemId: string, originalDate: string): ItemOccurrence | undefined {
    return itemOccurrences.items.find((occurrence) => occurrence.itemId === itemId && occurrence.originalDate === originalDate);
  }

  function ensureInstance(item: Item, date: string): ItemOccurrence {
    return (
      getInstance(item.id, date) ?? {
        id: makeId("occurrence"),
        itemId: item.id,
        originalDate: date,
        date,
        state: "not_started",
        assignedTo: item.assignedTo,
        originalAssignedTo: item.assignedTo,
        scheduledTime: item.startTime ?? "",
        checklist: buildDefaultChecklist(item, milestones.items),
        history: [],
      }
    );
  }

  // Instances currently scheduled on `date` due to a reschedule that moved them
  // in from a different original day — used so the destination day's agenda
  // shows them too, not just the day they were originally supposed to happen.
  function getRescheduledInto(date: string): ItemOccurrence[] {
    return itemOccurrences.items.filter((occurrence) => occurrence.date === date && occurrence.originalDate !== date);
  }

  function withHistory(instance: ItemOccurrence, entry: Omit<ItemHistoryEntry, "id" | "timestamp">): ItemHistoryEntry[] {
    return [...instance.history, { ...entry, id: makeId("hist"), timestamp: new Date().toISOString() }];
  }

  async function persistInstance(instance: ItemOccurrence) {
    const exists = itemOccurrences.items.some((occurrence) => occurrence.id === instance.id);
    return exists ? itemOccurrences.update(instance.id, instance) : itemOccurrences.add(instance);
  }

  async function startTask(template: Item, date: string, startTime: string, startTimeZone: string) {
    const instance = ensureInstance(template, date);
    return persistInstance({
      ...instance,
      state: "in_progress",
      startTime,
      startTimeZone,
      history: withHistory(instance, { type: "start", oldValue: "", newValue: startTime, reason: "" }),
    });
  }

  // Ticking a checklist row that came from a milestone step is the same act as
  // saying "we ran that step today" — so completing the item advances the milestone
  // rather than making Andrew log the same session twice in two places. Only rows
  // that are actually checked count, and only for items linked via
  // checklistSourceMilestoneId (a plain relatedMilestoneId link is display-only).
  // `direction` is +1 on completion and -1 when a completion is undone, so
  // reopening rolls the progress back rather than stranding a session that never
  // happened. Returns whether anything actually moved, which is what sets the
  // occurrence's milestoneAdvanced guard.
  async function advanceLinkedMilestone(item: Item, checklist: ChecklistItemValue[], direction: 1 | -1) {
    if (!item.checklistSourceMilestoneId) return false;
    const milestone = milestones.items.find((entry) => entry.id === item.checklistSourceMilestoneId);
    if (!milestone) return false;
    const checked = checklist.filter((row) => row.value === true);
    if (checked.length === 0) return false;
    // Now that progress is per-dog, a checklist row's `dogId` finally means something
    // to the milestone: a row assigned to Mara advances only Mara. An unassigned row
    // is shared work, so it counts for every dog the item involves.
    const sharedDogs = item.dogIds && item.dogIds.length > 0 ? item.dogIds : milestone.dogIds;
    let steps = milestone.steps;
    checked.forEach((row) => {
      steps = adjustStepSessions(steps, [row.itemName], row.dogId ? [row.dogId] : sharedDogs, direction);
    });
    return milestones.update(milestone.id, { steps });
  }

  async function endTask(
    instanceId: string,
    endTime: string,
    endTimeZone: string,
    checklist: ChecklistItemValue[],
    rating?: number,
    ratingNotes?: string,
  ) {
    const instance = itemOccurrences.items.find((occurrence) => occurrence.id === instanceId);
    if (!instance) return false;
    const item = items.items.find((entry) => entry.id === instance.itemId);
    // Only the first completion counts toward the milestone. Re-saving via "Edit
    // this completion" hits this same path, and without the guard each save would
    // advance the milestone again.
    const shouldAdvance = !instance.milestoneAdvanced;
    const advanced = shouldAdvance && item ? await advanceLinkedMilestone(item, checklist, 1) : false;
    return persistInstance({
      ...instance,
      state: "completed",
      endTime,
      endTimeZone,
      checklist,
      rating,
      ratingNotes,
      milestoneAdvanced: instance.milestoneAdvanced || advanced,
      history: withHistory(instance, { type: "end", oldValue: instance.startTime ?? "", newValue: endTime, reason: "" }),
    });
  }

  /** Undo a start — back to not-started, before any completion data exists. Just
   * clears the start time so the task looks untouched; nothing else to roll back
   * since only a completion (not a start) can advance a milestone. */
  async function unstartTask(instanceId: string) {
    const instance = itemOccurrences.items.find((occurrence) => occurrence.id === instanceId);
    if (!instance) return false;
    return persistInstance({
      ...instance,
      state: "not_started",
      startTime: undefined,
      startTimeZone: undefined,
      history: withHistory(instance, { type: "unstart", oldValue: instance.startTime ?? "", newValue: "", reason: "" }),
    });
  }

  /** Undo a completion — back to not-started, keeping the checklist and scores that
   * were recorded so reopening isn't destructive. Any milestone progress this
   * occurrence contributed is rolled back, since the session is no longer claimed
   * to have happened. */
  async function reopenTask(instanceId: string, reason: string) {
    const instance = itemOccurrences.items.find((occurrence) => occurrence.id === instanceId);
    if (!instance) return false;
    if (instance.milestoneAdvanced) {
      const item = items.items.find((entry) => entry.id === instance.itemId);
      if (item) await advanceLinkedMilestone(item, instance.checklist, -1);
    }
    return persistInstance({
      ...instance,
      state: "not_started",
      endTime: undefined,
      endTimeZone: undefined,
      milestoneAdvanced: false,
      // Dropped along with the completion: a hand-reopened slot is open on the person's
      // say-so, and leaving the claims would mean the next log deletion tried to reopen
      // something that's already open, or a stale claim silently re-closed it.
      satisfiedByLogIds: [],
      history: withHistory(instance, { type: "reopen", oldValue: "completed", newValue: "not_started", reason }),
    });
  }

  async function rescheduleTask(template: Item, date: string, newDate: string, newTime: string, reason: string) {
    const instance = ensureInstance(template, date);
    return persistInstance({
      ...instance,
      state: "rescheduled",
      date: newDate,
      scheduledTime: newTime,
      history: withHistory(instance, {
        type: "reschedule",
        oldValue: `${instance.date} ${instance.scheduledTime}`,
        newValue: `${newDate} ${newTime}`,
        reason,
      }),
    });
  }

  async function skipTask(template: Item, date: string, reason: string) {
    const instance = ensureInstance(template, date);
    return persistInstance({
      ...instance,
      state: "skipped",
      history: withHistory(instance, { type: "skip", oldValue: instance.state, newValue: "skipped", reason }),
    });
  }

  async function delegateTask(template: Item, date: string, fromPersonId: string, toPersonId: string) {
    const instance = ensureInstance(template, date);
    const updated: ItemOccurrence = {
      ...instance,
      state: "assigned_pending",
      history: withHistory(instance, { type: "delegate", oldValue: fromPersonId, newValue: toPersonId, reason: "" }),
    };
    const ok = await persistInstance(updated);
    if (!ok) return false;
    return inboxRequests.add({
      id: makeId("inbox"),
      itemOccurrenceId: updated.id,
      fromPersonId,
      toPersonId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  }

  // --- Logging --------------------------------------------------------------

  /** A logged "Weight" field — from the Health quick log or (rarely) a custom
   * item's own log fields — is also a growth-chart data point, not just log history,
   * so it's mirrored onto every tagged dog's `weightHistory` here rather than leaving
   * the Health page's chart fed by a separate entry point nothing actually calls.
   *
   * Keyed by `logId` rather than always appending: editing a weight entry (fixing a
   * typo, correcting the value) should move that same point, not leave the old one
   * behind and add a second. Also drops the point for any dog the edit un-tagged, or
   * whose Weight field got cleared — a stale entry from before the edit is worse
   * than none. Every dog is checked, not just the entry's current `dogIds`, since a
   * dog dropped by the edit still has a stale entry, but is no longer in that list. */
  async function syncWeightFromLog(logId: string, values: LogFieldValue[], dogIds: string[], notes: string, happenedAt: string) {
    const weightValue = values.find((value) => value.fieldName === "Weight" && typeof value.value === "number");
    const date = happenedAt.slice(0, 10);
    const pounds = weightValue?.value as number | undefined;

    for (const dog of dogs.items) {
      const existingIndex = dog.weightHistory.findIndex((entry) => entry.logId === logId);
      if (dogIds.includes(dog.id) && pounds !== undefined) {
        const point = { date, pounds, notes, logId };
        const weightHistory =
          existingIndex >= 0
            ? dog.weightHistory.map((entry, index) => (index === existingIndex ? point : entry))
            : [...dog.weightHistory, point];
        await dogs.update(dog.id, { weight: pounds, weightHistory });
      } else if (existingIndex >= 0) {
        await dogs.update(dog.id, { weightHistory: dog.weightHistory.filter((_, index) => index !== existingIndex) });
      }
    }
  }

  async function addItemLog(entry: Omit<ItemLog, "id" | "loggedAt">) {
    const loggedAt = new Date().toISOString();
    const id = makeId("log");
    const ok = await itemLogs.add({ ...entry, id, loggedAt });
    if (ok) await syncWeightFromLog(id, entry.values, entry.dogIds, entry.text, entry.happenedAt ?? loggedAt);
    return ok;
  }

  /** Rolls a Quick log's milestone progress back — each step it advanced drops one
   * session (never below zero) — and re-locks anything that entry alone had unlocked.
   * Re-locking is held to a narrow standard: only milestones with *no* logged work at
   * all, whose prerequisites genuinely aren't met without this entry, get touched. A
   * milestone someone has already put real sessions into is never yanked back, even
   * if this rollback would otherwise make its prerequisites look unmet.
   *
   * Returns the rolled-back milestone (or undefined if there was nothing to roll
   * back) so a caller that immediately re-applies a new advance — editQuickLog — can
   * project forward from the correct baseline instead of re-reading `milestones.items`,
   * which hasn't flushed this update yet within the same call. */
  async function rollbackMilestoneAdvance(log: ItemLog): Promise<Milestone | undefined> {
    if (!log.milestoneId || !log.advancedStepTitles || log.advancedStepTitles.length === 0) return undefined;
    const milestone = milestones.items.find((entry) => entry.id === log.milestoneId);
    if (!milestone) return undefined;

    // Rolled back only for the dogs the entry was logged against — a session logged
    // for Mara must not take anything off Griz's count.
    const withRolledBackSteps: Milestone = {
      ...milestone,
      steps: adjustStepSessions(milestone.steps, log.advancedStepTitles, log.dogIds, -1),
    };
    // Recompute the status rather than carrying the old one into the projection below.
    // `resolveDependencies` treats a milestone as met if its steps are done — so a
    // stale "completed" left on the rolled-back milestone would keep every dependent
    // looking satisfied and nothing would re-lock.
    const rolledBack: Milestone = {
      ...withRolledBackSteps,
      status: computeMilestoneStatus(withRolledBackSteps, milestones.items, allDogIds),
    };
    await milestones.update(milestone.id, { steps: rolledBack.steps, status: rolledBack.status });

    const projected = milestones.items.map((entry) => (entry.id === rolledBack.id ? rolledBack : entry));
    // Re-lock per dog: a milestone goes back to locked only if it's locked for every
    // dog it covers once this entry's progress is removed. A dog with real sessions
    // logged is never yanked back, which is what the zero-sessions test protects.
    const reLock = projected.filter((entry) => {
      if (entry.status === "locked" || entry.status === "skipped" || entry.status === "delayed") return false;
      if (entry.dependencies.length === 0) return false;
      return milestoneDogs(entry, allDogIds).every(
        (dogId) =>
          entry.steps.every((step) => stepSessions(step, dogId) === 0) &&
          !resolveDependencies(entry, projected, dogId).every((dep) => dep.met),
      );
    });
    await Promise.all(reLock.map((entry) => milestones.update(entry.id, { status: "locked" })));

    return rolledBack;
  }

  /** An occurrence's required dogs: its own override if one was set ("just today,
   * no Mara"), otherwise the item's. Kept as one function so every place that checks
   * coverage — satisfying, releasing, and editing the dog list itself — agrees on
   * which set that is. */
  function requiredDogsFor(item: Item, instance: ItemOccurrence): string[] {
    return instance.dogIds ?? item.dogIds ?? [];
  }

  /** Claims a scheduled slot on behalf of one or more Quick logs written in the same
   * submission: the entry (or entries) is the observation that the expected thing
   * happened. Takes an array so logging both dogs at once — as two single-dog logs,
   * one per dog, when their details differ — can be evaluated as one unit instead of
   * needing `itemLogs.items` to have flushed the first insert before the second runs.
   *
   * Completion is gated on dog coverage. An occurrence carries one `state` for every
   * dog it involves, so flipping it on a log that only covers Mara would be asserting
   * Griz went out too — the same fabricated data the completion rework exists to
   * prevent. Until the logs claiming this slot span its dogs it stays open, and the
   * next log closes it naturally.
   *
   * The occurrence rating takes the *lowest* score across the claiming logs, so one
   * bad break isn't averaged out of existence by a good one. */
  async function satisfyOccurrence(logs: ItemLog[]): Promise<void> {
    const [first] = logs;
    if (!first || !first.itemId || !first.occurrenceDate) return;
    const item = items.items.find((entry) => entry.id === first.itemId);
    if (!item || !item.requiresCompletion) return;

    const instance = ensureInstance(item, first.occurrenceDate);
    const newIds = logs.map((entry) => entry.id);
    const claimIds = Array.from(new Set([...(instance.satisfiedByLogIds ?? []), ...newIds]));
    // Include these logs explicitly: `itemLogs.items` hasn't flushed their inserts yet
    // within the same call, so reading it back would miss the entries we're claiming for.
    const claimingLogs = [...logs, ...itemLogs.items.filter((entry) => claimIds.includes(entry.id) && !newIds.includes(entry.id))];

    const covered = new Set(claimingLogs.flatMap((entry) => entry.dogIds));
    const required = requiredDogsFor(item, instance);
    const fullyCovered = required.length === 0 || required.every((id) => covered.has(id));

    const ratings = claimingLogs.map((entry) => entry.rating).filter((value): value is number => typeof value === "number");
    const rating = ratings.length > 0 ? Math.min(...ratings) : undefined;

    if (!fullyCovered) {
      // Recorded but not closed. Persisting the claim now is what lets the next log
      // for the other dog see it and finish the job. If an edit narrowed the dogs on a
      // log that had closed this slot, coverage is gone and the slot has to reopen —
      // this function decides the occurrence's state purely from its claims, so it
      // handles that case rather than needing a separate release pass.
      const wasClosedByClaims = instance.state === "completed" && (instance.satisfiedByLogIds ?? []).length > 0;
      await persistInstance({
        ...instance,
        satisfiedByLogIds: claimIds,
        ...(wasClosedByClaims
          ? {
              state: "not_started" as const,
              endTime: undefined,
              endTimeZone: undefined,
              rating: undefined,
              milestoneAdvanced: false,
              history: withHistory(instance, {
                type: "reopen" as const,
                oldValue: "completed",
                newValue: "not_started",
                reason: "Log no longer covers every dog",
              }),
            }
          : {}),
      });
      return;
    }

    // A training Quick log already advanced its milestone through `advancedStepTitles`.
    // Marking the occurrence as advanced stops `advanceLinkedMilestone` counting the
    // same session a second time if this item is later completed or reopened.
    const milestoneAdvanced = instance.milestoneAdvanced || logs.some((entry) => entry.quickLogKind === "training" && !!entry.milestoneId);
    // The latest of the new logs' own times — when the slot actually became fully
    // covered, not necessarily when any single one of them happened.
    const endTime = logs.map((entry) => entry.happenedAt ?? entry.loggedAt).sort().slice(-1)[0];

    await persistInstance({
      ...instance,
      state: "completed",
      endTime,
      satisfiedByLogIds: claimIds,
      rating,
      milestoneAdvanced,
      history: withHistory(instance, { type: "end", oldValue: instance.state, newValue: "completed", reason: "Logged" }),
    });
  }

  /** Per-occurrence override of which dogs this item's slot needs — "just today, no
   * Mara" — without touching the recurring series. Recomputes completion against the
   * new required set from whatever logs already claim this slot, the same coverage
   * rule `satisfyOccurrence` uses, so narrowing to a dog that's already logged can
   * close the slot immediately, and widening it back can reopen one. */
  async function setOccurrenceDogs(item: Item, date: string, dogIds: string[]): Promise<boolean> {
    const instance = ensureInstance(item, date);
    const claimingLogs = itemLogs.items.filter((entry) => (instance.satisfiedByLogIds ?? []).includes(entry.id));
    const covered = new Set(claimingLogs.flatMap((entry) => entry.dogIds));
    const fullyCovered = dogIds.length === 0 || dogIds.every((id) => covered.has(id));
    const ratings = claimingLogs.map((entry) => entry.rating).filter((value): value is number => typeof value === "number");

    const history = withHistory(instance, {
      type: "edit_dogs",
      oldValue: requiredDogsFor(item, instance).join(", ") || "—",
      newValue: dogIds.join(", ") || "—",
      reason: "Edited dogs for this occurrence",
    });

    if (fullyCovered && claimingLogs.length > 0) {
      return persistInstance({
        ...instance,
        dogIds,
        state: "completed",
        endTime: instance.endTime ?? claimingLogs.map((entry) => entry.happenedAt ?? entry.loggedAt).sort().slice(-1)[0],
        rating: ratings.length > 0 ? Math.min(...ratings) : instance.rating,
        history,
      });
    }

    if (!fullyCovered && instance.state === "completed") {
      return persistInstance({
        ...instance,
        dogIds,
        state: "not_started",
        endTime: undefined,
        endTimeZone: undefined,
        rating: undefined,
        milestoneAdvanced: false,
        history,
      });
    }

    return persistInstance({ ...instance, dogIds, history });
  }

  /** Releases whatever `satisfyOccurrence` claimed, when the log is deleted or edited
   * to point somewhere else. Reopens the slot only if this log's removal actually
   * breaks it: no claims left, or the remaining ones no longer cover every dog. A slot
   * completed by hand is never touched, since it carries no claim. */
  async function releaseSatisfiedOccurrence(log: ItemLog): Promise<void> {
    if (!log.itemId || !log.occurrenceDate) return;
    const instance = getInstance(log.itemId, log.occurrenceDate);
    if (!instance || !(instance.satisfiedByLogIds ?? []).includes(log.id)) return;

    const item = items.items.find((entry) => entry.id === log.itemId);
    const claimIds = (instance.satisfiedByLogIds ?? []).filter((id) => id !== log.id);
    const claimingLogs = itemLogs.items.filter((entry) => claimIds.includes(entry.id));

    const covered = new Set(claimingLogs.flatMap((entry) => entry.dogIds));
    const required = item ? requiredDogsFor(item, instance) : [];
    const stillCovered = claimIds.length > 0 && (required.length === 0 || required.every((id) => covered.has(id)));

    const ratings = claimingLogs.map((entry) => entry.rating).filter((value): value is number => typeof value === "number");

    if (stillCovered) {
      await persistInstance({ ...instance, satisfiedByLogIds: claimIds, rating: ratings.length > 0 ? Math.min(...ratings) : undefined });
      return;
    }

    await persistInstance({
      ...instance,
      state: "not_started",
      endTime: undefined,
      endTimeZone: undefined,
      rating: undefined,
      satisfiedByLogIds: claimIds,
      milestoneAdvanced: false,
      history: withHistory(instance, { type: "reopen", oldValue: instance.state, newValue: "not_started", reason: "Log removed" }),
    });
  }

  /** Removes the `alone_time_logs` row a Quick log's alone-time entry wrote, so a
   * deleted or edited-away session isn't still counted by the readiness math. No
   * stored link between the two rows — `alone_time_logs` ids are DB-generated and
   * `add` doesn't hand them back — so the pair is matched on what the Quick log wrote
   * (same day, same duration, same dogs), taking the most recent on a tie. Gated on
   * the training type actually being alone time: every training log carries a
   * Duration, so matching on that alone would let this remove an unrelated
   * same-length milestone session. */
  async function removeMatchedAloneTimeLog(log: ItemLog): Promise<void> {
    const isAloneTime = log.values.some((value) => value.fieldName === "Training type" && value.value === "Alone time");
    const minutes = log.values.find((value) => value.fieldName === "Duration" && value.unit === "min")?.value;
    if (!isAloneTime || typeof minutes !== "number") return;
    const matches = aloneTimeLogs.items.filter(
      (entry) =>
        entry.date === log.occurrenceDate &&
        entry.durationMinutes === minutes &&
        entry.dogIds.length === log.dogIds.length &&
        entry.dogIds.every((id) => log.dogIds.includes(id)),
    );
    const match = matches[matches.length - 1];
    if (match) await aloneTimeLogs.remove(match.id);
  }

  /** Applies a training advance against an explicit baseline list of milestones
   * (rather than always trusting `milestones.items`, which may already be stale
   * within the same call — see `rollbackMilestoneAdvance`) and reports what changed:
   * step progress, completion, anything newly unlocked, and what to work on next. */
  async function advanceMilestoneAndReport(
    baseMilestones: Milestone[],
    targetMilestone: Milestone | undefined,
    completedStepTitles: string[],
    dogIds: string[],
  ): Promise<QuickLogResult> {
    if (!targetMilestone || completedStepTitles.length === 0 || dogIds.length === 0) return { perDog: [] };

    const nextMilestone: Milestone = {
      ...targetMilestone,
      steps: adjustStepSessions(targetMilestone.steps, completedStepTitles, dogIds, 1),
    };

    const saved = await milestones.update(targetMilestone.id, { steps: nextMilestone.steps });
    if (!saved) return { perDog: [] };

    const before = baseMilestones;
    const after = before.map((item) => (item.id === nextMilestone.id ? nextMilestone : item));

    // Everything below is computed per dog against the same projection. Two dogs
    // logged in one session almost always land differently — one may finish the
    // milestone while the other is two sessions off — so a single shared summary
    // would have to lie about at least one of them.
    return {
      perDog: dogIds.map((dogId) => ({
        dogId,
        unlocked: after
          .filter((item) => {
            const previous = before.find((entry) => entry.id === item.id);
            if (!previous) return false;
            return (
              milestoneStatusFor(previous, before, dogId) === "locked" && milestoneStatusFor(item, after, dogId) !== "locked"
            );
          })
          .map((item) => ({ id: item.id, title: item.title })),
        nextFocus: nextTrainingFocus(after, dogId) ?? undefined,
        milestone: {
          id: nextMilestone.id,
          title: nextMilestone.title,
          progress: milestoneProgress(nextMilestone, dogId),
          completed: isMilestoneComplete(nextMilestone, dogId),
          advancedSteps: nextMilestone.steps
            .filter((step) => completedStepTitles.includes(step.title))
            .map((step) => ({
              title: step.title,
              completedSessions: stepSessions(step, dogId),
              sessionsRequired: step.sessionsRequired,
            })),
        },
      })),
    };
  }

  // Built here rather than through addItemLog so the row can be handed straight to
  // satisfyOccurrence — `itemLogs.items` hasn't flushed the insert yet at that point,
  // so reading it back would find nothing to claim the slot with. Shared by
  // addQuickLog and addQuickLogGroup so a split (one row per dog) builds each row
  // exactly the same way a single shared-dogs entry would.
  function buildQuickLogRow(entry: QuickLogInput): ItemLog {
    const milestone = entry.milestoneId ? milestones.items.find((item) => item.id === entry.milestoneId) : undefined;
    const advancing = !!milestone && entry.completedStepTitles.length > 0;
    return {
      id: makeId("log"),
      loggedAt: new Date().toISOString(),
      quickLogKind: entry.kind,
      // Both set when this entry says a scheduled slot actually happened. The date key
      // doubles as the occurrence key, so an attached entry points at the right day of
      // a recurring item rather than at the series.
      itemId: entry.itemId,
      occurrenceDate: entry.itemId ? (entry.occurrenceDate ?? entry.date) : entry.date,
      happenedAt: entry.happenedAt,
      loggedBy: people.items[0]?.id ?? "",
      text: entry.notes,
      values: entry.values,
      dogIds: entry.dogIds,
      rating: entry.rating,
      milestoneId: entry.milestoneId,
      advancedStepTitles: advancing ? entry.completedStepTitles : undefined,
    };
  }

  /** Everything a Quick log changed, handed back so the form can say what just
   * happened instead of silently closing. The "what's next / what unlocked" half of
   * Andrew's ask (2026-07-26) lives here — logging a training session is only useful
   * if it visibly moves the milestone it belongs to. */
  async function addQuickLog(entry: QuickLogInput): Promise<QuickLogResult | null> {
    const milestone = entry.milestoneId ? milestones.items.find((item) => item.id === entry.milestoneId) : undefined;
    const log = buildQuickLogRow(entry);
    const ok = await itemLogs.add(log);
    if (!ok) return null;

    await satisfyOccurrence([log]);
    await syncWeightFromLog(log.id, entry.values, entry.dogIds, entry.notes, log.happenedAt ?? log.loggedAt);

    // Alone time is a training type like any other in the Quick log, but it also
    // feeds `computeDogAloneTimeReadiness`, which only reads `alone_time_logs`. Writing
    // both keeps the readiness panel working off the same single entry point rather
    // than stranding it behind the separate form it used to have.
    if (entry.aloneTimeMinutes && entry.aloneTimeMinutes > 0) {
      await aloneTimeLogs.add({
        id: makeId("alone"),
        date: entry.date,
        durationMinutes: entry.aloneTimeMinutes,
        dogIds: entry.dogIds,
        notes: entry.notes,
      });
    }

    return advanceMilestoneAndReport(milestones.items, milestone, entry.completedStepTitles, entry.dogIds);
  }

  /** Same submission as addQuickLog, but for the Quick log form's "these differ per
   * dog" toggle: each dog gets its own row with its own values/rating/notes instead
   * of one row shared across all of them. All the new rows are evaluated against the
   * shared occurrence slot in one satisfyOccurrence call — calling addQuickLog once
   * per dog instead would have each call read `itemLogs.items` before the previous
   * one's insert had flushed, so a later dog's log could never see an earlier one's
   * claim and the slot would never close on its own.
   *
   * Milestone progress is evaluated once across the whole group (union of every
   * entry's dogIds) rather than per entry: the form keeps the milestone and ticked
   * steps shared when splitting per dog — only rating and notes differ — so this
   * mirrors the existing single-entry multi-dog path instead of risking
   * double-counted sessions from separate sequential calls. */
  async function addQuickLogGroup(entries: QuickLogInput[]): Promise<QuickLogResult | null> {
    const [first] = entries;
    if (!first) return null;

    const logs = entries.map((entry) => buildQuickLogRow(entry));
    const oks = await Promise.all(logs.map((log) => itemLogs.add(log)));
    if (!oks.every(Boolean)) return null;

    await satisfyOccurrence(logs);
    await Promise.all(
      entries.map((entry, index) =>
        syncWeightFromLog(logs[index].id, entry.values, entry.dogIds, entry.notes, logs[index].happenedAt ?? logs[index].loggedAt),
      ),
    );

    await Promise.all(
      entries
        .filter((entry) => entry.aloneTimeMinutes && entry.aloneTimeMinutes > 0)
        .map((entry) =>
          aloneTimeLogs.add({
            id: makeId("alone"),
            date: entry.date,
            durationMinutes: entry.aloneTimeMinutes!,
            dogIds: entry.dogIds,
            notes: entry.notes,
          }),
        ),
    );

    const milestone = first.milestoneId ? milestones.items.find((item) => item.id === first.milestoneId) : undefined;
    return advanceMilestoneAndReport(milestones.items, milestone, first.completedStepTitles, entries.flatMap((entry) => entry.dogIds));
  }

  /** Edit a Quick log in place: correct the rating, notes, dogs, or which steps got
   * ticked, without pretending it's a brand-new session. What kind of entry it is and
   * (for training) which milestone it's against are fixed — those aren't mistakes an
   * edit fixes, they're what you'd delete-and-relog for instead.
   *
   * Rolls the old milestone/alone-time effects back first, then re-applies the edited
   * ones from that rolled-back baseline — never from `milestones.items` directly,
   * which is still the pre-rollback snapshot within this same call. */
  async function editQuickLog(logId: string, entry: QuickLogInput): Promise<QuickLogResult | null> {
    const existing = itemLogs.items.find((item) => item.id === logId);
    if (!existing) return null;

    const rolledBack = await rollbackMilestoneAdvance(existing);
    await removeMatchedAloneTimeLog(existing);

    const targetMilestone = rolledBack ?? (entry.milestoneId ? milestones.items.find((item) => item.id === entry.milestoneId) : undefined);
    const baseMilestones = rolledBack ? milestones.items.map((item) => (item.id === rolledBack.id ? rolledBack : item)) : milestones.items;
    const advancing = !!targetMilestone && entry.completedStepTitles.length > 0;

    const patch = {
      text: entry.notes,
      values: entry.values,
      dogIds: entry.dogIds,
      rating: entry.rating,
      milestoneId: entry.milestoneId,
      advancedStepTitles: advancing ? entry.completedStepTitles : undefined,
      // Which slot the entry counts toward is editable — that's how you correct a
      // wrongly-confirmed match, or attach an entry you'd first logged as unscheduled.
      itemId: entry.itemId,
      occurrenceDate: entry.itemId ? (entry.occurrenceDate ?? entry.date) : entry.date,
      happenedAt: entry.happenedAt ?? existing.happenedAt,
    };
    const ok = await itemLogs.update(logId, patch);
    if (!ok) return null;

    // Release only when the entry moved to a different slot (or off one entirely) —
    // the old occurrence has to be told it lost a claim. Staying on the same slot goes
    // straight to satisfy, which recomputes that occurrence's state from its claims
    // and reopens it by itself if the edit dropped a dog.
    const updated: ItemLog = { ...existing, ...patch };
    const slotChanged = existing.itemId !== updated.itemId || existing.occurrenceDate !== updated.occurrenceDate;
    if (slotChanged) await releaseSatisfiedOccurrence(existing);
    await satisfyOccurrence([updated]);
    await syncWeightFromLog(logId, entry.values, entry.dogIds, entry.notes, updated.happenedAt ?? updated.loggedAt);

    if (entry.aloneTimeMinutes && entry.aloneTimeMinutes > 0) {
      await aloneTimeLogs.add({
        id: makeId("alone"),
        date: entry.date,
        durationMinutes: entry.aloneTimeMinutes,
        dogIds: entry.dogIds,
        notes: entry.notes,
      });
    }

    return advanceMilestoneAndReport(baseMilestones, targetMilestone, entry.completedStepTitles, entry.dogIds);
  }

  /** Undo a Quick log entirely. Rolls back anything it caused (see
   * rollbackMilestoneAdvance / removeMatchedAloneTimeLog) before removing the row. */
  async function deleteQuickLog(logId: string) {
    const log = itemLogs.items.find((entry) => entry.id === logId);
    if (!log) return false;

    await rollbackMilestoneAdvance(log);
    await removeMatchedAloneTimeLog(log);
    await releaseSatisfiedOccurrence(log);

    return itemLogs.remove(logId);
  }

  /** Called by the review-logs skill after it has folded a batch into the dog
   * record / milestones / docs, so the next run only reads what's new. */
  async function markLogsProcessed(logIds: string[]) {
    const stamp = new Date().toISOString();
    const results = await Promise.all(logIds.map((id) => itemLogs.update(id, { processedAt: stamp })));
    return results.every(Boolean);
  }

  function logsForItem(itemId: string, occurrenceDate?: string): ItemLog[] {
    return itemLogs.items
      .filter((log) => log.itemId === itemId && (!occurrenceDate || log.occurrenceDate === occurrenceDate))
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  }

  // Declined delegations silently fall back to the original assignee rather than
  // prompting the requester — simplest default until the household says otherwise.
  async function respondToDelegation(requestId: string, accept: boolean) {
    const request = inboxRequests.items.find((item) => item.id === requestId);
    if (!request) return false;
    const responded = await inboxRequests.update(requestId, { status: accept ? "accepted" : "declined", respondedAt: new Date().toISOString() });
    if (!responded) return false;
    const instance = itemOccurrences.items.find((occurrence) => occurrence.id === request.itemOccurrenceId);
    if (!instance) return true;
    if (accept) {
      return persistInstance({
        ...instance,
        state: "reassigned",
        assignedTo: request.toPersonId,
        history: withHistory(instance, { type: "accept", oldValue: instance.assignedTo, newValue: request.toPersonId, reason: "" }),
      });
    }
    return persistInstance({
      ...instance,
      state: "not_started",
      assignedTo: instance.originalAssignedTo,
      history: withHistory(instance, { type: "decline", oldValue: request.toPersonId, newValue: instance.originalAssignedTo, reason: "" }),
    });
  }

  function snapshot() {
    return {
      households: households.items,
      dogs: dogs.items,
      people: people.items,
      items: items.items,
      itemLogs: itemLogs.items,
      milestones: milestones.items,
      journalEntries: journalEntries.items,
      exposureItems: exposureItems.items,
      relationshipLogs: relationshipLogs.items,
      itemOccurrences: itemOccurrences.items,
    };
  }

  function restore(payload: Partial<ReturnType<typeof snapshot>>) {
    if (Array.isArray(payload.households)) households.setItems(payload.households);
    if (Array.isArray(payload.dogs)) dogs.setItems(payload.dogs);
    if (Array.isArray(payload.people)) people.setItems(payload.people);
    if (Array.isArray(payload.items)) items.setItems(payload.items);
    if (Array.isArray(payload.itemLogs)) itemLogs.setItems(payload.itemLogs);
    if (Array.isArray(payload.milestones)) milestones.setItems(payload.milestones);
    if (Array.isArray(payload.journalEntries)) journalEntries.setItems(payload.journalEntries);
    if (Array.isArray(payload.exposureItems)) exposureItems.setItems(payload.exposureItems);
    if (Array.isArray(payload.relationshipLogs)) relationshipLogs.setItems(payload.relationshipLogs);
    if (Array.isArray(payload.itemOccurrences)) itemOccurrences.setItems(payload.itemOccurrences);
  }


  return {
    households,
    dogs,
    people,
    items,
    milestones,
    journalEntries,
    exposureItems,
    relationshipLogs,
    productFeedback,
    itemDeletions,
    deleteItem,
    aloneTimeLogs,
    itemOccurrences,
    itemLogs,
    addItemLog,
    addQuickLog,
    addQuickLogGroup,
    editQuickLog,
    deleteQuickLog,
    markLogsProcessed,
    logsForItem,
    inboxRequests,
    meals,
    recipeIngredients,
    inventory,
    groceryList,
    feedbackLoopRules,
    locations,
    shelfLifeDefaultsDays,
    completeTask,
    reopenTask,
    unstartTask,
    occurrenceFor,
    isCompletedOn,
    logExposure,
    getInstance,
    ensureInstance,
    getRescheduledInto,
    startTask,
    endTask,
    rescheduleTask,
    skipTask,
    delegateTask,
    setOccurrenceDogs,
    respondToDelegation,
    snapshot,
    restore,
  };
}

type Store = ReturnType<typeof useDataStore>;

const StoreContext = createContext<Store | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const value = useDataStore();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within a DataProvider");
  return ctx;
}
