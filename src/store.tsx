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
  Meal,
  Milestone,
  Person,
  ProductFeedback,
  RecipeIngredient,
  RelationshipLog,
} from "./types";
import { buildDefaultChecklist, computeMilestoneStatus, resolveChecklistDefs } from "./utils";

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

  useEffect(() => {
    const stale = milestones.items.filter((milestone) => {
      const computed = computeMilestoneStatus(milestone, milestones.items);
      return computed !== milestone.status && computed !== "locked";
    });
    if (stale.length > 0) {
      stale.forEach((milestone) => {
        const computed = computeMilestoneStatus(milestone, milestones.items);
        milestones.update(milestone.id, { status: computed });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones.items]);

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

  function logMilestoneSession(milestoneId: string, stepTitle: string) {
    const target = milestones.items.find((item) => item.id === milestoneId);
    if (!target) return;
    milestones.update(milestoneId, {
      steps: target.steps.map((step) =>
        step.title === stepTitle
          ? { ...step, completedSessions: Math.min(step.sessionsRequired, step.completedSessions + 1) }
          : step,
      ),
    });
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
  async function advanceLinkedMilestone(item: Item, checklist: ChecklistItemValue[]) {
    if (!item.checklistSourceMilestoneId) return;
    const milestone = milestones.items.find((entry) => entry.id === item.checklistSourceMilestoneId);
    if (!milestone) return;
    const completedNames = new Set(checklist.filter((row) => row.value === true).map((row) => row.itemName));
    if (completedNames.size === 0) return;
    await milestones.update(milestone.id, {
      steps: milestone.steps.map((step) =>
        completedNames.has(step.title)
          ? { ...step, completedSessions: Math.min(step.sessionsRequired, step.completedSessions + 1) }
          : step,
      ),
    });
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
    const ok = await persistInstance({
      ...instance,
      state: "completed",
      endTime,
      endTimeZone,
      checklist,
      rating,
      ratingNotes,
      history: withHistory(instance, { type: "end", oldValue: instance.startTime ?? "", newValue: endTime, reason: "" }),
    });
    if (!ok) return false;
    const item = items.items.find((entry) => entry.id === instance.itemId);
    if (item) await advanceLinkedMilestone(item, checklist);
    return true;
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

  async function addItemLog(entry: Omit<ItemLog, "id" | "loggedAt">) {
    return itemLogs.add({ ...entry, id: makeId("log"), loggedAt: new Date().toISOString() });
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
    occurrenceFor,
    isCompletedOn,
    logMilestoneSession,
    logExposure,
    getInstance,
    ensureInstance,
    getRescheduledInto,
    startTask,
    endTask,
    rescheduleTask,
    skipTask,
    delegateTask,
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
