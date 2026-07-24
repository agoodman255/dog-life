import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import {
  aloneTimeLogs as seedAloneTimeLogs,
  calendarEvents as seedCalendarEvents,
  dogs as seedDogs,
  exposureItems as seedExposureItems,
  feedbackLoopRules,
  groceryList as seedGroceryList,
  healthEvents as seedHealthEvents,
  households as seedHouseholds,
  inventory as seedInventory,
  journalEntries as seedJournalEntries,
  locations,
  meals as seedMeals,
  milestones as seedMilestones,
  people as seedPeople,
  recipeIngredients as seedRecipeIngredients,
  relationshipLogs as seedRelationshipLogs,
  shelfLifeDefaultsDays,
  todayTasks as seedTasks,
} from "./data";
import * as mapping from "./dataMapping";
import { getSupabaseClient, isBackendConfigured } from "./supabaseClient";
import {
  AloneTimeLog,
  CalendarEvent,
  CalendarEventDeletion,
  CalendarEventDeletionScope,
  ChecklistItemValue,
  DailyFeedback,
  Dog,
  ExposureItem,
  GroceryListItem,
  HealthEvent,
  Household,
  InboxRequest,
  InventoryItem,
  JournalEntry,
  Meal,
  Milestone,
  Person,
  ProductFeedback,
  RecipeIngredient,
  RelationshipLog,
  Task,
  TaskHistoryEntry,
  TaskInstance,
} from "./types";
import { buildDefaultChecklist, computeMilestoneStatus } from "./utils";

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
  const tasks = useCollection<Task>("tasks", seedTasks, "tasks", mapping.task);
  const milestones = useCollection<Milestone>("milestones", seedMilestones, "milestones", mapping.milestone, "client");
  const healthEvents = useCollection<HealthEvent>("health-events", seedHealthEvents, "health_events", mapping.healthEvent);
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
  const calendarEvents = useCollection<CalendarEvent>("calendar-events", seedCalendarEvents, "calendar_events", mapping.calendarEvent);
  const calendarEventDeletions = useCollection<CalendarEventDeletion>(
    "calendar-event-deletions",
    [],
    "calendar_event_deletions",
    mapping.calendarEventDeletion,
    "client",
  );
  const aloneTimeLogs = useCollection<AloneTimeLog>("alone-time-logs", seedAloneTimeLogs, "alone_time_logs", mapping.aloneTimeLog);
  const taskInstances = useCollection<TaskInstance>("task-instances", [], "task_instances", mapping.taskInstance, "client");
  const inboxRequests = useCollection<InboxRequest>("inbox-requests", [], "inbox_requests", mapping.inboxRequest, "client");
  const meals = useCollection<Meal>("meals", seedMeals, "meals", mapping.meal);
  const recipeIngredients = useCollection<RecipeIngredient>("recipe-ingredients", seedRecipeIngredients, "recipe_ingredients", mapping.recipeIngredient);
  const inventory = useCollection<InventoryItem>("inventory", seedInventory, "inventory", mapping.inventoryItem);
  const groceryList = useCollection<GroceryListItem>("grocery-list", seedGroceryList, "grocery_list", mapping.groceryListItem);

  const backend = isBackendConfigured();
  const local = usePersistedCollection<DailyFeedback & { id: string }>(
    "feedback",
    ([] as DailyFeedback[]).map((item) => ({ ...item, id: item.taskId })),
  );
  const [remoteFeedback, setRemoteFeedback] = useState<DailyFeedback[]>([]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !backend) return;
    let active = true;
    supabase
      .from("feedback")
      .select("*")
      .then(({ data, error }) => {
        if (!active || error) return;
        setRemoteFeedback((data ?? []).map(mapping.feedback.fromRow));
      });
    const channel = supabase
      .channel("public:feedback")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, (payload) => {
        setRemoteFeedback((prev) => {
          if (payload.eventType === "DELETE") {
            const oldTaskId = (payload.old as { task_id: string }).task_id;
            return prev.filter((item) => item.taskId !== oldTaskId);
          }
          const incoming = mapping.feedback.fromRow(payload.new);
          return [...prev.filter((item) => item.taskId !== incoming.taskId), incoming];
        });
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [backend]);

  const feedback = backend ? remoteFeedback : local.items.map(({ id: _id, ...rest }) => rest);

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

  async function completeTask(task: Task, rating: number) {
    const entry: DailyFeedback = {
      taskId: task.id,
      completed: true,
      rating,
      mood: rating >= 4 ? "calm" : rating === 3 ? "tired" : "frustrated",
      successScore: rating * 20,
      notes: rating >= 4 ? "Went well." : "Needs an easier setup tomorrow.",
      accident: task.category === "potty" && rating <= 2,
      barking: false,
      fear: rating <= 2 && task.category === "socialization",
      guarding: rating <= 2 && task.category === "relationship",
      completedAt: new Date().toISOString(),
    };
    if (!backend) {
      const next = [...local.items.filter((item) => item.taskId !== task.id), { ...entry, id: task.id }];
      local.setItems(next);
      return true;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const householdId = await getHouseholdId();
    const { error } = await supabase
      .from("feedback")
      .upsert(mapping.feedback.toRow(entry, householdId), { onConflict: "household_id,task_id" });
    if (error) {
      console.error("Failed to log feedback:", error.message);
      return false;
    }
    setRemoteFeedback((prev) => [...prev.filter((item) => item.taskId !== task.id), entry]);
    return true;
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

  // Deleting "this occurrence" of a recurring event doesn't remove the event row —
  // it adds the date to excludedDates so generateOccurrences skips it, keeping the
  // rest of the series intact. Deleting "the series" (or a one-off event) removes
  // the row outright. Either way a required note gets logged for the record.
  async function deleteCalendarEvent(
    event: CalendarEvent,
    scope: CalendarEventDeletionScope,
    occurrenceDate: string | undefined,
    note: string,
  ) {
    const ok =
      scope === "instance" && occurrenceDate
        ? await calendarEvents.update(event.id, { excludedDates: [...(event.excludedDates ?? []), occurrenceDate] })
        : await calendarEvents.remove(event.id);
    if (!ok) return false;
    return calendarEventDeletions.add({
      id: makeId("evtdel"),
      eventId: event.id,
      eventTitle: event.title,
      scope,
      occurrenceDate: scope === "instance" ? occurrenceDate : undefined,
      note,
      deletedAt: new Date().toISOString(),
    });
  }

  // --- Task lifecycle workflow (start/stop/delegate/reschedule/skip) --------

  // Looks up by originalDate (the template's natural recurring slot), not the
  // possibly-rescheduled current `date`, so a moved instance is still found when
  // re-visiting the day it was originally supposed to happen.
  function getInstance(templateId: string, originalDate: string): TaskInstance | undefined {
    return taskInstances.items.find((instance) => instance.templateId === templateId && instance.originalDate === originalDate);
  }

  function ensureInstance(template: Task, date: string): TaskInstance {
    return (
      getInstance(template.id, date) ?? {
        id: makeId("instance"),
        templateId: template.id,
        originalDate: date,
        date,
        state: "not_started",
        assignedTo: template.assignedTo,
        originalAssignedTo: template.assignedTo,
        scheduledTime: template.time,
        checklist: buildDefaultChecklist(template),
        history: [],
      }
    );
  }

  // Instances currently scheduled on `date` due to a reschedule that moved them
  // in from a different original day — used so the destination day's agenda
  // shows them too, not just the day they were originally supposed to happen.
  function getRescheduledInto(date: string): TaskInstance[] {
    return taskInstances.items.filter((instance) => instance.date === date && instance.originalDate !== date);
  }

  function withHistory(instance: TaskInstance, entry: Omit<TaskHistoryEntry, "id" | "timestamp">): TaskHistoryEntry[] {
    return [...instance.history, { ...entry, id: makeId("hist"), timestamp: new Date().toISOString() }];
  }

  async function persistInstance(instance: TaskInstance) {
    const exists = taskInstances.items.some((item) => item.id === instance.id);
    return exists ? taskInstances.update(instance.id, instance) : taskInstances.add(instance);
  }

  async function startTask(template: Task, date: string, startTime: string, startTimeZone: string) {
    const instance = ensureInstance(template, date);
    return persistInstance({
      ...instance,
      state: "in_progress",
      startTime,
      startTimeZone,
      history: withHistory(instance, { type: "start", oldValue: "", newValue: startTime, reason: "" }),
    });
  }

  async function endTask(instanceId: string, endTime: string, endTimeZone: string, checklist: ChecklistItemValue[], rating?: number) {
    const instance = taskInstances.items.find((item) => item.id === instanceId);
    if (!instance) return false;
    return persistInstance({
      ...instance,
      state: "completed",
      endTime,
      endTimeZone,
      checklist,
      rating,
      history: withHistory(instance, { type: "end", oldValue: instance.startTime ?? "", newValue: endTime, reason: "" }),
    });
  }

  async function rescheduleTask(template: Task, date: string, newDate: string, newTime: string, reason: string) {
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

  async function skipTask(template: Task, date: string, reason: string) {
    const instance = ensureInstance(template, date);
    return persistInstance({
      ...instance,
      state: "skipped",
      history: withHistory(instance, { type: "skip", oldValue: instance.state, newValue: "skipped", reason }),
    });
  }

  async function delegateTask(template: Task, date: string, fromPersonId: string, toPersonId: string) {
    const instance = ensureInstance(template, date);
    const updated: TaskInstance = {
      ...instance,
      state: "assigned_pending",
      history: withHistory(instance, { type: "delegate", oldValue: fromPersonId, newValue: toPersonId, reason: "" }),
    };
    const ok = await persistInstance(updated);
    if (!ok) return false;
    return inboxRequests.add({
      id: makeId("inbox"),
      taskInstanceId: updated.id,
      fromPersonId,
      toPersonId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  }

  // Declined delegations silently fall back to the original assignee rather than
  // prompting the requester — simplest default until the household says otherwise.
  async function respondToDelegation(requestId: string, accept: boolean) {
    const request = inboxRequests.items.find((item) => item.id === requestId);
    if (!request) return false;
    const responded = await inboxRequests.update(requestId, { status: accept ? "accepted" : "declined", respondedAt: new Date().toISOString() });
    if (!responded) return false;
    const instance = taskInstances.items.find((item) => item.id === request.taskInstanceId);
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
      tasks: tasks.items,
      milestones: milestones.items,
      healthEvents: healthEvents.items,
      journalEntries: journalEntries.items,
      exposureItems: exposureItems.items,
      relationshipLogs: relationshipLogs.items,
      feedback,
    };
  }

  function restore(payload: Partial<ReturnType<typeof snapshot>>) {
    if (Array.isArray(payload.households)) households.setItems(payload.households);
    if (Array.isArray(payload.dogs)) dogs.setItems(payload.dogs);
    if (Array.isArray(payload.people)) people.setItems(payload.people);
    if (Array.isArray(payload.tasks)) tasks.setItems(payload.tasks);
    if (Array.isArray(payload.milestones)) milestones.setItems(payload.milestones);
    if (Array.isArray(payload.healthEvents)) healthEvents.setItems(payload.healthEvents);
    if (Array.isArray(payload.journalEntries)) journalEntries.setItems(payload.journalEntries);
    if (Array.isArray(payload.exposureItems)) exposureItems.setItems(payload.exposureItems);
    if (Array.isArray(payload.relationshipLogs)) relationshipLogs.setItems(payload.relationshipLogs);
    if (Array.isArray(payload.feedback)) {
      if (backend) {
        importFeedback(payload.feedback);
      } else {
        local.setItems(payload.feedback.map((item) => ({ ...item, id: item.taskId })));
      }
    }
  }

  async function importFeedback(items: DailyFeedback[]) {
    const supabase = getSupabaseClient();
    if (!supabase || items.length === 0) return;
    const householdId = await getHouseholdId();
    const { error } = await supabase
      .from("feedback")
      .upsert(items.map((item) => mapping.feedback.toRow(item, householdId)), { onConflict: "household_id,task_id" });
    if (error) {
      console.error("Failed to import feedback:", error.message);
      return;
    }
    setRemoteFeedback(items);
  }

  return {
    households,
    dogs,
    people,
    tasks,
    milestones,
    healthEvents,
    journalEntries,
    exposureItems,
    relationshipLogs,
    productFeedback,
    calendarEvents,
    calendarEventDeletions,
    deleteCalendarEvent,
    aloneTimeLogs,
    taskInstances,
    inboxRequests,
    meals,
    recipeIngredients,
    inventory,
    groceryList,
    feedback,
    feedbackLoopRules,
    locations,
    shelfLifeDefaultsDays,
    completeTask,
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
