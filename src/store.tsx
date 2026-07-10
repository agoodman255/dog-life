import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import {
  dogs as seedDogs,
  exposureItems as seedExposureItems,
  feedbackLoopRules,
  healthEvents as seedHealthEvents,
  households as seedHouseholds,
  journalEntries as seedJournalEntries,
  milestones as seedMilestones,
  people as seedPeople,
  relationshipLogs as seedRelationshipLogs,
  todayTasks as seedTasks,
} from "./data";
import {
  DailyFeedback,
  Dog,
  ExposureItem,
  HealthEvent,
  Household,
  JournalEntry,
  Milestone,
  Person,
  RelationshipLog,
  Task,
} from "./types";
import { computeMilestoneStatus } from "./utils";

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

function usePersistedCollection<T extends { id: string }>(key: string, seed: T[]) {
  const [items, setItems] = useState<T[]>(() => loadJSON(key, seed));

  useEffect(() => {
    saveJSON(key, items);
  }, [key, items]);

  function add(item: T) {
    setItems((prev) => [...prev, item]);
  }
  function update(id: string, patch: Partial<T>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }
  return { items, setItems, add, update, remove };
}

function useDataStore() {
  const households = usePersistedCollection<Household>("households", seedHouseholds);
  const dogs = usePersistedCollection<Dog>("dogs", seedDogs);
  const people = usePersistedCollection<Person>("people", seedPeople);
  const tasks = usePersistedCollection<Task>("tasks", seedTasks);
  const milestones = usePersistedCollection<Milestone>("milestones", seedMilestones);
  const healthEvents = usePersistedCollection<HealthEvent>("health-events", seedHealthEvents);
  const journalEntries = usePersistedCollection<JournalEntry>("journal-entries", seedJournalEntries);
  const exposureItems = usePersistedCollection<ExposureItem>("exposure-items", seedExposureItems);
  const relationshipLogs = usePersistedCollection<RelationshipLog>("relationship-logs", seedRelationshipLogs);

  const [feedback, setFeedback] = useState<DailyFeedback[]>(() => loadJSON("feedback", [] as DailyFeedback[]));
  useEffect(() => saveJSON("feedback", feedback), [feedback]);

  useEffect(() => {
    const stale = milestones.items.filter((milestone) => {
      const computed = computeMilestoneStatus(milestone, milestones.items);
      return computed !== milestone.status && computed !== "locked";
    });
    if (stale.length > 0) {
      milestones.setItems((prev) =>
        prev.map((milestone) => {
          const computed = computeMilestoneStatus(milestone, prev);
          return computed !== "locked" && computed !== milestone.status ? { ...milestone, status: computed } : milestone;
        }),
      );
    }
  }, [milestones.items]);

  function completeTask(task: Task, rating: number) {
    const entry: DailyFeedback = {
      taskId: task.id,
      completed: true,
      rating,
      mood: rating >= 4 ? "calm" : rating === 3 ? "tired" : "frustrated",
      successScore: rating * 20,
      notes: rating >= 4 ? "Went well." : "Needs an easier setup tomorrow.",
      accident: task.id === "morning-potty" && rating <= 2,
      barking: false,
      fear: rating <= 2 && task.category === "socialization",
      guarding: rating <= 2 && task.category === "relationship",
      completedAt: new Date().toISOString(),
    };
    setFeedback((prev) => [...prev.filter((item) => item.taskId !== task.id), entry]);
  }

  function logMilestoneSession(milestoneId: string, stepTitle: string) {
    milestones.update(milestoneId, {
      steps: (milestones.items.find((item) => item.id === milestoneId)?.steps ?? []).map((step) =>
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
    if (Array.isArray(payload.feedback)) setFeedback(payload.feedback);
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
    feedback,
    feedbackLoopRules,
    completeTask,
    logMilestoneSession,
    logExposure,
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
