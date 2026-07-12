export type DogStatus = "puppy" | "adult" | "senior";

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
  medications: string[];
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

export type TaskCategory =
  | "care"
  | "training"
  | "health"
  | "handling"
  | "socialization"
  | "exercise"
  | "relationship"
  | "journal";

export type Task = {
  id: string;
  title: string;
  category: TaskCategory;
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

export type CalendarEventCategory =
  | "gym"
  | "sports"
  | "concert"
  | "comedy"
  | "family"
  | "travel"
  | "curling"
  | "volleyball"
  | "downtime"
  | "other";

export type CalendarEvent = {
  id: string;
  title: string;
  category: CalendarEventCategory;
  kind: "recurring" | "one-off";
  dayOfWeek?: DayOfWeek;
  activeFrom?: string;
  activeTo?: string;
  date?: string;
  windowLabel: string;
  timeLabel: string;
  durationHours?: number;
  coverageNeeded: "none" | "rover" | "full-day";
  status: "confirmed" | "placeholder";
  importance?: "marquee" | "normal";
  notes: string;
  /** Person id(s) this block belongs to / is expected to attend. Omit for whole-household events. */
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

export type AloneTimeLog = {
  id: string;
  date: string;
  durationMinutes: number;
  notes: string;
};

export type FeedbackLoopRule = {
  id: string;
  trigger: string;
  route: "algorithm" | "genAI" | "human-review";
  cadence: "instant" | "nightly" | "weekly" | "on-demand";
  updates: string[];
  costControl: string;
};
