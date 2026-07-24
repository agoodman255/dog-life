export type DogStatus = "puppy" | "adult" | "senior";

export type MedicationKind = "medication" | "supplement" | "injection" | "preventive";

export type MedicationEntry = {
  id: string;
  name: string;
  kind: MedicationKind;
  dosage: string;
  frequency: string;
  notes: string;
};

export type Household = {
  id: string;
  name: string;
  memberIds: string[];
  dogIds: string[];
};

export type Dog = {
  id: string;
  householdId: string;
  name: string;
  breed: string;
  birthday: string;
  sex: string;
  color: string;
  weight: number;
  expectedAdultWeight: number;
  weightHistory: Array<{ date: string; pounds: number; notes: string }>;
  microchip: string;
  photo: string;
  veterinarian: string;
  insurance: string;
  breeder: string;
  healthSummary: string;
  medicalHistory: string[];
  allergies: string[];
  medicationEntries: MedicationEntry[];
  energy: number;
  confidence: number;
  fearfulness: number;
  resourceGuarding: number;
  dogFriendliness: number;
  humanFriendliness: number;
  noiseSensitivity: number;
  favoriteRewards: string[];
  favoriteToys: string[];
  masteredCommands: string[];
  exerciseNeed: string;
  status: DogStatus;
};

export type Person = {
  id: string;
  householdId: string;
  name: string;
  color: string;
};

/** Unified category taxonomy shared by Tasks and CalendarEvents — one vocabulary across the app. */
export type Category =
  | "potty"
  | "meals"
  | "training"
  | "health"
  | "handling"
  | "socialization"
  | "exercise"
  | "relationship"
  | "alone-time"
  | "journal"
  | "chores"
  | "family"
  | "social"
  | "entertainment"
  | "sports"
  | "travel"
  | "downtime"
  | "other";

export type DogFormation = "together" | "parallel-buffered" | "separate-rooms" | "separate-locations" | "solo";

export type Task = {
  id: string;
  title: string;
  category: Category;
  assignedTo: string;
  time: string;
  duration: number;
  priority: "essential" | "important" | "optional";
  supplies: string[];
  setting: "indoor" | "outdoor" | "either";
  difficulty: 1 | 2 | 3 | 4 | 5;
  dogIds: string[];
  checklist: string[];
  grizParticipation: "yes" | "separate" | "managed" | "not yet";
  notes: string;
  /** Reference location id (see `locations` in data.ts). */
  location?: string;
  /** How the dogs are physically arranged during this activity. */
  formation?: DogFormation;
  /** Links a training task to its milestone for click-through (status, sources, next steps). */
  relatedMilestoneId?: string;
  /** Structured checklist definition for the lifecycle workflow (Start/End Task).
   * Falls back to treating every `checklist` string as a boolean item when absent. */
  checklistSchema?: ChecklistItemDef[];
};

// --- Task lifecycle workflow (start/stop/delegate/reschedule/skip) ---------

export type ChecklistDataType = "boolean" | "counter" | "duration_minutes" | "free_text";

export type ChecklistItemDef = {
  itemName: string;
  dataType: ChecklistDataType;
};

export type ChecklistItemValue = {
  itemName: string;
  dataType: ChecklistDataType;
  value: boolean | number | string | null;
  notes: string;
};

export type TaskState =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped"
  | "rescheduled"
  | "assigned_pending"
  | "reassigned";

export type TaskHistoryEntryType = "start" | "end" | "reschedule" | "skip" | "delegate" | "accept" | "decline";

export type TaskHistoryEntry = {
  id: string;
  type: TaskHistoryEntryType;
  oldValue: string;
  newValue: string;
  reason: string;
  timestamp: string;
};

export type TaskInstance = {
  id: string;
  templateId: string;
  /** YYYY-MM-DD — the template's natural recurring slot this instance was generated
   * for. Fixed at creation; used as the lookup key so a reschedule can move `date`
   * away without losing track of which day it was originally supposed to happen. */
  originalDate: string;
  /** YYYY-MM-DD — the day this instance is currently scheduled for. Equals
   * `originalDate` unless it's been rescheduled. */
  date: string;
  state: TaskState;
  assignedTo: string;
  originalAssignedTo: string;
  /** Wall-clock label for the day, e.g. "7:15 AM" — copied from the template, changes on reschedule. */
  scheduledTime: string;
  startTime?: string;
  startTimeZone?: string;
  endTime?: string;
  endTimeZone?: string;
  rating?: number;
  checklist: ChecklistItemValue[];
  history: TaskHistoryEntry[];
};

export type InboxRequestStatus = "pending" | "accepted" | "declined";

export type InboxRequest = {
  id: string;
  taskInstanceId: string;
  fromPersonId: string;
  toPersonId: string;
  status: InboxRequestStatus;
  createdAt: string;
  respondedAt?: string;
};

export type TrainingSource = {
  title: string;
  type: "video" | "article" | "plan";
  url: string;
  publisher: string;
};

export type MilestoneStep = {
  title: string;
  successCriteria: string;
  sessionsRequired: number;
  completedSessions: number;
};

export type Milestone = {
  id: string;
  title: string;
  track: "obedience" | "handling" | "socialization" | "confidence" | "health" | "relationship";
  dogIds: string[];
  status: "completed" | "current" | "locked" | "delayed" | "skipped";
  dependencies: string[];
  ageGateWeeks?: number;
  steps: MilestoneStep[];
  sources: TrainingSource[];
  why: string;
};

export type HealthEvent = {
  id: string;
  dogId: string;
  title: string;
  date: string;
  kind: "vaccine" | "vet" | "medication" | "grooming" | "weight" | "insurance";
  notes: string;
  /** Link to a stored receipt/vaccine record/document — e.g. a URL from the
   * Storage upload script (scripts/upload-asset.ts) or any external link. */
  documentUrl?: string;
};

export type JournalEntry = {
  id: string;
  dogIds: string[];
  date: string;
  title: string;
  text: string;
  tags: string[];
  mood: "great" | "steady" | "hard";
};

export type DailyFeedback = {
  taskId: string;
  completed: boolean;
  rating: number;
  mood: "calm" | "excited" | "fearful" | "frustrated" | "tired";
  successScore: number;
  notes: string;
  accident: boolean;
  barking: boolean;
  fear: boolean;
  guarding: boolean;
  completedAt: string;
};

export type ExposureCategory = "socialization" | "confidence" | "handling";

export type ExposureStatus = "not-started" | "introduced" | "comfortable";

export type ExposureLogEntry = {
  date: string;
  reaction: "confident" | "curious" | "cautious" | "fearful";
  notes: string;
};

export type ExposureItem = {
  id: string;
  category: ExposureCategory;
  title: string;
  dogIds: string[];
  status: ExposureStatus;
  log: ExposureLogEntry[];
};

export type RelationshipLog = {
  id: string;
  dogIds: [string, string];
  date: string;
  comfort: number;
  sharedToys: number;
  sharedBeds: number;
  sharedWalks: number;
  bodyLanguage: number;
  resourceGuarding: number;
  playQuality: number;
  corrections: number;
  recoveryMinutes: number;
  notes: string;
};

export type NotificationItem = {
  id: string;
  kind: "overdue-task" | "upcoming-health" | "milestone-unlocked" | "missed-task";
  title: string;
  detail: string;
  date: string;
  severity: "info" | "warning" | "critical";
};

export type FeedbackType = "quick-fix" | "feature" | "comment" | "question";

export type ProductFeedback = {
  id: string;
  page: string;
  feedbackType: FeedbackType;
  authorEmail: string;
  locationNote: string;
  message: string;
  createdAt: string;
};

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type Recurrence = {
  frequency: RecurrenceFrequency;
  /** Every N units of `frequency` — e.g. frequency "weekly", interval 2 = every 2 weeks. */
  interval: number;
  /** Which weekdays this recurs on. Only used/required when frequency is "weekly". */
  daysOfWeek?: DayOfWeek[];
  /** Day of the month (1-31) this recurs on. Only used when frequency is "monthly". Defaults to startDate's day-of-month when absent. */
  monthDay?: number;
  /** YYYY-MM-DD — required. The first possible occurrence. */
  startDate: string;
  /** YYYY-MM-DD — optional, mutually exclusive with occurrenceCount. Series never recurs past this date. */
  endDate?: string;
  /** Optional, mutually exclusive with endDate. Series stops after this many total occurrences. */
  occurrenceCount?: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  category: Category;
  kind: "recurring" | "one-off";
  /** Required when kind is "recurring". */
  recurrence?: Recurrence;
  /** YYYY-MM-DD dates to skip — how a single occurrence of a recurring series gets deleted without deleting the whole series. */
  excludedDates?: string[];
  date?: string;
  windowLabel: string;
  /** Wall-clock start time, e.g. "7:00 PM". At least 2 of startTime/endTime/durationHours must be set — the third is derived. */
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  /** Does this event need dog coverage arranged? "partial" carries a user-entered amount in aloneTimeRequiredAmount (hours). Whether that coverage is actually needed given proven alone-time tolerance is computed, not stored — see computeEventCoverageNeeded in utils.ts. */
  aloneTimeRequired: "all" | "partial" | "no";
  aloneTimeRequiredAmount?: number;
  status: "confirmed" | "placeholder";
  importance?: "marquee" | "normal";
  notes: string;
  /** Person id(s) this block belongs to / is expected to attend. Omit for whole-household ("everyone") events. */
  attendees?: string[];
  /** Number of Rover sitter visits recommended while away (0/undefined = no rover needed). */
  roverVisits?: number;
  /** Checklist to run through before leaving the house. */
  prepSteps?: string[];
  /** What the Rover sitter should do during each visit. */
  roverInstructions?: string[];
  /** Checklist for the moment someone gets home. */
  postSteps?: string[];
};

export type CalendarEventDeletionScope = "instance" | "series";

/** Audit trail for deleted calendar events/occurrences — required note captured at delete time. */
export type CalendarEventDeletion = {
  id: string;
  eventId: string;
  eventTitle: string;
  scope: CalendarEventDeletionScope;
  /** YYYY-MM-DD — set only when scope is "instance". */
  occurrenceDate?: string;
  note: string;
  deletedAt: string;
};

export type AloneTimeLog = {
  id: string;
  date: string;
  durationMinutes: number;
  notes: string;
};

export type LocationType = "fenced-yard" | "school-yard" | "park" | "trail" | "vet" | "gym" | "indoor" | "other";

export type Location = {
  id: string;
  name: string;
  type: LocationType;
  availability: string;
  notes: string;
};

// --- Meal planning, inventory, and grocery list -----------------------------

export type MealSource = "manual_entry" | "claude_code_import" | "ai_generated";

export type Meal = {
  id: string;
  name: string;
  description: string;
  source: MealSource;
  prepMinutes: number;
  cookMinutes: number;
  /** YYYY-MM-DD — unassigned (shows in the meal-idea pool) until scheduled to a day. */
  plannedDate?: string;
};

export type RecipeIngredient = {
  id: string;
  mealId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
};

export type InventoryLocation = "fridge" | "freezer" | "pantry";

export type InventoryCategory =
  | "produce"
  | "dairy"
  | "meat"
  | "seafood"
  | "eggs"
  | "bread"
  | "frozen"
  | "pantry-staple"
  | "leftovers"
  | "other";

export type InventoryItem = {
  id: string;
  itemName: string;
  category: InventoryCategory;
  location: InventoryLocation;
  quantity: number;
  unit: string;
  purchaseDate: string;
  estimatedExpirationDate: string;
};

export type GroceryItemStatus = "needed" | "already_have" | "ordered";

export type GroceryListItem = {
  id: string;
  itemName: string;
  quantityNeeded: number;
  unit: string;
  linkedMealIds: string[];
  status: GroceryItemStatus;
};

export type FeedbackLoopRule = {
  id: string;
  trigger: string;
  route: "algorithm" | "genAI" | "human-review";
  cadence: "instant" | "nightly" | "weekly" | "on-demand";
  updates: string[];
  costControl: string;
};
