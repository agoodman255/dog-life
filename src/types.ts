export type DogStatus = "puppy" | "adult" | "senior";

export type Dog = {
  id: string;
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
  name: string;
  color: string;
  taskIds: string[];
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

export type FeedbackLoopRule = {
  id: string;
  trigger: string;
  route: "algorithm" | "genAI" | "human-review";
  cadence: "instant" | "nightly" | "weekly" | "on-demand";
  updates: string[];
  costControl: string;
};
