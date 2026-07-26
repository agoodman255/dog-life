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

/** One vocabulary across the app. Also drives the default log fields an item
 * offers (see DEFAULT_LOG_FIELDS in utils.ts) — picking "vet" pre-loads weight and
 * temperature rather than making you invent the fields yourself. */
export type Category =
  | "potty"
  | "meals"
  | "training"
  | "health"
  | "vet"
  | "vaccine"
  | "medication"
  | "grooming"
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

// --- Checklists -------------------------------------------------------------

export type ChecklistDataType = "boolean" | "counter" | "duration_minutes" | "free_text";

export type ChecklistItemDef = {
  itemName: string;
  dataType: ChecklistDataType;
  /** Which dog this specific step is for. Undefined = the whole item / every dog
   * involved. Lets one training session carry different work for each dog — Griz
   * proofing a known cue while Mara learns it from scratch — instead of forcing two
   * separate calendar items. Generalizes what the old `grizParticipation` enum was
   * reaching for, without hardcoding a dog. */
  dogId?: string;
};

export type ChecklistItemValue = {
  itemName: string;
  dataType: ChecklistDataType;
  value: boolean | number | string | null;
  notes: string;
  /** 1-5, per-row. Andrew's call (2026-07-25): every checklist row is scored on its
   * own AND the item gets an overall score, so a bad step is visible even when the
   * session as a whole went fine. */
  rating?: number;
  /** Copied from the matching ChecklistItemDef at completion time. */
  dogId?: string;
};

// --- Logging ----------------------------------------------------------------

export type LogFieldDataType = "number" | "text" | "date";

/** A structured field an item prompts for each time it's logged. Seeded from the
 * item's category (weight/temperature for health, reps for training…) but fully
 * editable — the point is that the log has *some* structure the ingest pass can
 * read without forcing every item into a fixed schema. */
export type LogFieldDef = {
  fieldName: string;
  dataType: LogFieldDataType;
  unit?: string;
};

export type LogFieldValue = {
  fieldName: string;
  dataType: LogFieldDataType;
  unit?: string;
  value: number | string | null;
};

/** One timestamped log against an item. Multiple entries per item (and per
 * occurrence) are the point — weight over time, symptoms across days. Free text
 * always allowed; structured `values` come from the item's logFields. */
export type ItemLog = {
  id: string;
  itemId: string;
  /** YYYY-MM-DD of the occurrence this log belongs to, when the item recurs. */
  occurrenceDate?: string;
  loggedAt: string;
  loggedBy: string;
  text: string;
  values: LogFieldValue[];
  dogIds: string[];
  /** ISO timestamp set by the review-logs skill once it has folded this entry into
   * the dog record / milestones / docs. Absent = not yet ingested, so re-runs stay
   * incremental instead of re-reading the whole history. */
  processedAt?: string;
};

// --- The unified item -------------------------------------------------------

/** What the user is actually creating. Presets in the Add menu set the two
 * capability flags (`requiresCompletion` / `requiresLog`) — the intent is stored
 * so the UI can label the item and re-seed sensible defaults on edit. */
export type ItemIntent = "routine" | "event" | "appointment" | "training" | "health-record";

/** One type for everything that lands on the calendar. Replaces the old
 * Task / CalendarEvent / HealthEvent split, which forced the scheduling machinery
 * (recurrence, times, coverage) onto one type and the completion machinery
 * (checklist, lifecycle, rating) onto another. Two independent capability flags
 * decide what an item asks of you rather than three fixed types deciding for you. */
export type Item = {
  id: string;
  title: string;
  category: Category;
  intent: ItemIntent;

  // --- scheduling ---
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
  status: "confirmed" | "placeholder";

  // --- who ---
  /** Person id who owns getting this done. Blank = whole household. */
  assignedTo: string;
  /** Person id(s) expected to attend. Omit for whole-household events. */
  attendees?: string[];
  /** Dog id(s) this item involves. Omit when it isn't dog-specific. */
  dogIds?: string[];

  // --- completion capability ---
  /** True = this isn't done until someone checks it off. False = it just sits on
   * the calendar (a concert, a work block) and asks nothing of you. */
  requiresCompletion: boolean;
  /** Sub-items that must be worked through before the item can close. Each row
   * carries its own value, notes, and 1-5 score at completion time. */
  checklist: ChecklistItemDef[];
  /** When set, `checklist` is derived from this milestone's steps instead of being
   * hand-typed, and ticking rows off advances the milestone's completedSessions. */
  checklistSourceMilestoneId?: string;

  // --- logging capability ---
  /** True = prompt for a log entry (free text + `logFields`) so the weekly ingest
   * pass has something to read. Independent of requiresCompletion: a vet visit logs
   * without a checklist, a training session does both. */
  requiresLog: boolean;
  logFields: LogFieldDef[];

  // --- dog coverage (unchanged from CalendarEvent) ---
  aloneTimeRequired: "all" | "partial" | "no";
  aloneTimeRequiredAmount?: number;
  coverageConfirmed?: boolean;
  coverageNotes?: string;

  // --- carried over from Task ---
  priority: "essential" | "important" | "optional";
  supplies: string[];
  setting: "indoor" | "outdoor" | "either";
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Reference location id (see `locations` in data.ts). */
  location?: string;
  /** How the dogs are physically arranged during this activity. */
  formation?: DogFormation;
  /** Links to a milestone for click-through (status, sources, next steps). Separate
   * from checklistSourceMilestoneId, which additionally drives the checklist. */
  relatedMilestoneId?: string;

  // --- carried over from HealthEvent ---
  /** Link to a stored receipt/vaccine record/document. */
  documentUrl?: string;

  // --- away-from-home planning (carried over from CalendarEvent) ---
  /** Number of Rover sitter visits recommended while away (0/undefined = none needed). */
  roverVisits?: number;
  /** Checklist to run through before leaving the house. */
  prepSteps?: string[];
  /** What the Rover sitter should do during each visit. */
  roverInstructions?: string[];
  /** Checklist for the moment someone gets home. */
  postSteps?: string[];

  notes: string;
};

// --- Item lifecycle workflow (start/stop/delegate/reschedule/skip) ----------

export type ItemState =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped"
  | "rescheduled"
  | "assigned_pending"
  | "reassigned";

export type ItemHistoryEntryType = "start" | "end" | "reopen" | "reschedule" | "skip" | "delegate" | "accept" | "decline";

export type ItemHistoryEntry = {
  id: string;
  type: ItemHistoryEntryType;
  oldValue: string;
  newValue: string;
  reason: string;
  timestamp: string;
};

/** Per-date state for an item. Separate from `Item` because a recurring item needs
 * independent completion state per occurrence — finishing Monday's must not finish
 * Tuesday's. Invisible to the user; they only ever see "the item". */
export type ItemOccurrence = {
  id: string;
  itemId: string;
  /** YYYY-MM-DD — the item's natural recurring slot this occurrence was generated
   * for. Fixed at creation; used as the lookup key so a reschedule can move `date`
   * away without losing track of which day it was originally supposed to happen. */
  originalDate: string;
  /** YYYY-MM-DD — the day this occurrence is currently scheduled for. Equals
   * `originalDate` unless it's been rescheduled. */
  date: string;
  state: ItemState;
  assignedTo: string;
  originalAssignedTo: string;
  /** Wall-clock label for the day, e.g. "7:15 AM" — copied from the item, changes on reschedule. */
  scheduledTime: string;
  startTime?: string;
  startTimeZone?: string;
  endTime?: string;
  endTimeZone?: string;
  /** Overall 1-5 for the item as a whole, alongside each checklist row's own score. */
  rating?: number;
  ratingNotes?: string;
  checklist: ChecklistItemValue[];
  /** True once this occurrence has counted toward its linked milestone's progress.
   * Guards against double-counting: re-saving a completion (via "Edit this
   * completion") or reopening and finishing again would otherwise advance the
   * milestone every time. Cleared on reopen, which also rolls the advance back. */
  milestoneAdvanced?: boolean;
  history: ItemHistoryEntry[];
};

export type ItemDeletionScope = "instance" | "series";

/** Audit trail for deleted items/occurrences — required note captured at delete time. */
export type ItemDeletion = {
  id: string;
  itemId: string;
  itemTitle: string;
  scope: ItemDeletionScope;
  /** YYYY-MM-DD — set only when scope is "instance". */
  occurrenceDate?: string;
  note: string;
  deletedAt: string;
};

export type InboxRequestStatus = "pending" | "accepted" | "declined";

export type InboxRequest = {
  id: string;
  itemOccurrenceId: string;
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

export type JournalEntry = {
  id: string;
  dogIds: string[];
  date: string;
  title: string;
  text: string;
  tags: string[];
  mood: "great" | "steady" | "hard";
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
  kind: "overdue-task" | "upcoming-health" | "milestone-unlocked" | "missed-task" | "coverage-needed";
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

export type AloneTimeLog = {
  id: string;
  date: string;
  durationMinutes: number;
  /** Which dog(s) this session actually covers — readiness is tracked per dog since
   * an adult dog and a puppy build alone-time tolerance at very different paces. */
  dogIds: string[];
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
