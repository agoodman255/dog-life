import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AloneTimeLog,
  Category,
  DayOfWeek,
  Dog,
  DogFormation,
  DogStatus,
  ExposureItem,
  Item,
  ItemIntent,
  JournalEntry,
  LogFieldDataType,
  LogFieldDef,
  MedicationEntry,
  MedicationKind,
  Milestone,
  Person,
  Recurrence,
  RecurrenceFrequency,
  ReminderOffsetUnit,
  RelationshipLog,
} from "./types";
import { locations } from "./data";
import { MilestonePicker } from "./milestonePicker";
import { makeId } from "./store";
import {
  computeEventCoverageNeeded,
  computeEventTimes,
  defaultLogFieldsFor,
  dogsNeedingCoverage,
  ITEM_INTENT_PRESETS,
  quickLogKindForCategory,
  to12Hour,
  to24Hour,
} from "./utils";

// Alphabetical by label — CategoryPicker and every plain <select> that maps over
// this array inherit the order, so there's one place that controls it.
export const CATEGORY_OPTIONS: Category[] = [
  "alone-time",
  "chores",
  "downtime",
  "entertainment",
  "exercise",
  "family",
  "grooming",
  "handling",
  "health",
  "journal",
  "meals",
  "medication",
  "other",
  "potty",
  "relationship",
  "social",
  "socialization",
  "sports",
  "training",
  "travel",
  "vaccine",
  "vet",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  "alone-time": "Alone time",
  chores: "Chores",
  downtime: "Downtime",
  entertainment: "Entertainment",
  exercise: "Exercise",
  family: "Family",
  grooming: "Grooming",
  handling: "Handling",
  health: "Health admin",
  journal: "Journal",
  meals: "Meals",
  medication: "Medication",
  other: "Other",
  potty: "Potty",
  relationship: "Relationship",
  social: "Social",
  socialization: "Socialization",
  sports: "Sports",
  training: "Training",
  travel: "Travel",
  vaccine: "Vaccine",
  vet: "Vet",
};

// Written to disambiguate the pairs that read as near-synonyms at a glance
// (socialization vs. social, relationship vs. family) — that ambiguity is exactly
// what prompted adding these descriptions in the first place.
export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  "alone-time": "Practicing or logging time with the dogs left home alone.",
  chores: "Household errands and pet-care logistics — supply runs, cleaning, admin.",
  downtime: "Deliberate rest or unstructured relaxation, for the humans or the dogs.",
  entertainment: "Shows, concerts, movies — things attended for fun.",
  exercise: "Physical activity for the dogs — walks, runs, play, fetch.",
  family: "Time with family — visits, gatherings, family events.",
  grooming: "Groomer visits and at-home grooming. Logs weight and cost by default.",
  handling: "Cooperative-care practice — touch, paws, ears, restraint tolerance.",
  health: "Health admin and general records — insurance, weigh-ins, supply reorders.",
  journal: "A reflection or log entry, not a scheduled activity.",
  meals: "Feeding times and mealtime routines.",
  medication: "Doses given and medication records. Logs dose and cost by default.",
  other: "Anything that doesn't fit the categories above.",
  potty: "Bathroom breaks and house-training check-ins.",
  relationship: "Building the bond between the two dogs — parallel walks, structured together-time.",
  social: "Get-togethers with friends or other people — not dog-focused.",
  socialization: "Planned exposure to new dogs, people, places, or sounds to build the dogs' confidence.",
  sports: "Games, leagues, or sporting events — playing or watching.",
  training: "Structured skill-building — obedience, commands, tricks.",
  travel: "Trips, camping, and time away from home.",
  vaccine: "Shots and boosters. Logs vaccine name, next-due date, and cost by default.",
  vet: "Vet appointments. Logs weight, temperature, cost, and next-due date by default.",
};

function CategoryPicker({ value, onChange }: { value: Category; onChange: (category: Category) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [infoFor, setInfoFor] = useState<Category | null>(null);
  const matches = CATEGORY_OPTIONS.filter((option) => CATEGORY_LABELS[option].toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="category-picker">
      <button type="button" className="text-button" onClick={() => setOpen((prev) => !prev)}>
        {CATEGORY_LABELS[value]}
      </button>
      {open && (
        <div className="category-picker-panel">
          <input
            autoFocus
            placeholder="Search categories…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="category-picker-list">
            {matches.map((option) => (
              <div key={option} className="category-picker-row">
                <button
                  type="button"
                  className={option === value ? "active" : ""}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setQuery("");
                    setInfoFor(null);
                  }}
                >
                  {CATEGORY_LABELS[option]}
                </button>
                <button
                  type="button"
                  className="icon-button category-picker-info"
                  aria-label={`What belongs in ${CATEGORY_LABELS[option]}?`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setInfoFor((prev) => (prev === option ? null : option));
                  }}
                >
                  <Info size={14} aria-hidden />
                </button>
              </div>
            ))}
            {matches.length === 0 && <p className="small">No categories match "{query}".</p>}
          </div>
          {infoFor && (
            <p className="category-picker-description">
              <strong>{CATEGORY_LABELS[infoFor]}:</strong> {CATEGORY_DESCRIPTIONS[infoFor]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const medicationKinds: MedicationKind[] = ["medication", "supplement", "injection", "preventive"];

function parseMedicationLines(text: string): MedicationEntry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", kind = "", dosage = "", frequency = "", notes = ""] = line.split("|").map((part) => part.trim());
      const validKind = medicationKinds.includes(kind as MedicationKind) ? (kind as MedicationKind) : "medication";
      return { id: makeId("med"), name, kind: validKind, dosage, frequency, notes };
    });
}

function medicationEntriesToLines(entries: MedicationEntry[]): string {
  return entries.map((entry) => [entry.name, entry.kind, entry.dosage, entry.frequency, entry.notes].join(" | ")).join("\n");
}

function csvToArray(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToCsv(value: string[]): string {
  return value.join(", ");
}

const dogSchema = z.object({
  name: z.string().min(1, "Name is required"),
  breed: z.string().min(1, "Breed is required"),
  birthday: z.string().min(1, "Birthday is required"),
  sex: z.string().min(1),
  color: z.string().min(1),
  weight: z.number().min(0),
  expectedAdultWeight: z.number().min(0),
  microchip: z.string(),
  photo: z.string(),
  veterinarian: z.string(),
  insurance: z.string(),
  breeder: z.string(),
  healthSummary: z.string(),
  medicalHistory: z.string(),
  allergies: z.string(),
  medicationEntries: z.string(),
  energy: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  fearfulness: z.number().min(0).max(100),
  resourceGuarding: z.number().min(0).max(100),
  dogFriendliness: z.number().min(0).max(100),
  humanFriendliness: z.number().min(0).max(100),
  noiseSensitivity: z.number().min(0).max(100),
  favoriteRewards: z.string(),
  favoriteToys: z.string(),
  masteredCommands: z.string(),
  exerciseNeed: z.string(),
  status: z.enum(["puppy", "adult", "senior"]),
});

type DogFormValues = z.infer<typeof dogSchema>;

function dogDefaults(dog?: Dog): DogFormValues {
  return {
    name: dog?.name ?? "",
    breed: dog?.breed ?? "",
    birthday: dog?.birthday ?? new Date().toISOString().slice(0, 10),
    sex: dog?.sex ?? "Unknown",
    color: dog?.color ?? "#2f6f64",
    weight: dog?.weight ?? 0,
    expectedAdultWeight: dog?.expectedAdultWeight ?? 0,
    microchip: dog?.microchip ?? "Pending",
    photo: dog?.photo ?? "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=700&q=80",
    veterinarian: dog?.veterinarian ?? "",
    insurance: dog?.insurance ?? "",
    breeder: dog?.breeder ?? "",
    healthSummary: dog?.healthSummary ?? "",
    medicalHistory: arrayToCsv(dog?.medicalHistory ?? []),
    allergies: arrayToCsv(dog?.allergies ?? []),
    medicationEntries: medicationEntriesToLines(dog?.medicationEntries ?? []),
    energy: dog?.energy ?? 50,
    confidence: dog?.confidence ?? 50,
    fearfulness: dog?.fearfulness ?? 20,
    resourceGuarding: dog?.resourceGuarding ?? 20,
    dogFriendliness: dog?.dogFriendliness ?? 50,
    humanFriendliness: dog?.humanFriendliness ?? 50,
    noiseSensitivity: dog?.noiseSensitivity ?? 30,
    favoriteRewards: arrayToCsv(dog?.favoriteRewards ?? []),
    favoriteToys: arrayToCsv(dog?.favoriteToys ?? []),
    masteredCommands: arrayToCsv(dog?.masteredCommands ?? []),
    exerciseNeed: dog?.exerciseNeed ?? "",
    status: dog?.status ?? "puppy",
  };
}

export function dogFormValuesToDog(values: DogFormValues, base: Pick<Dog, "id" | "householdId" | "weightHistory">): Dog {
  return {
    ...base,
    name: values.name,
    breed: values.breed,
    birthday: values.birthday,
    sex: values.sex,
    color: values.color,
    weight: values.weight,
    expectedAdultWeight: values.expectedAdultWeight,
    microchip: values.microchip,
    photo: values.photo,
    veterinarian: values.veterinarian,
    insurance: values.insurance,
    breeder: values.breeder,
    healthSummary: values.healthSummary,
    medicalHistory: csvToArray(values.medicalHistory),
    allergies: csvToArray(values.allergies),
    medicationEntries: parseMedicationLines(values.medicationEntries),
    energy: values.energy,
    confidence: values.confidence,
    fearfulness: values.fearfulness,
    resourceGuarding: values.resourceGuarding,
    dogFriendliness: values.dogFriendliness,
    humanFriendliness: values.humanFriendliness,
    noiseSensitivity: values.noiseSensitivity,
    favoriteRewards: csvToArray(values.favoriteRewards),
    favoriteToys: csvToArray(values.favoriteToys),
    masteredCommands: csvToArray(values.masteredCommands),
    exerciseNeed: values.exerciseNeed,
    status: values.status as DogStatus,
  };
}

export function DogForm({ initial, onSubmit, onCancel }: { initial?: Dog; onSubmit: (values: DogFormValues) => void; onCancel: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DogFormValues>({ resolver: zodResolver(dogSchema), defaultValues: dogDefaults(initial) });

  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <label>
          Name
          <input {...register("name")} />
          {errors.name && <small className="form-error">{errors.name.message}</small>}
        </label>
        <label>
          Breed
          <input {...register("breed")} />
          {errors.breed && <small className="form-error">{errors.breed.message}</small>}
        </label>
        <label>
          Birthday
          <input type="date" {...register("birthday")} />
        </label>
        <label>
          Sex
          <input {...register("sex")} />
        </label>
        <label>
          Color
          <input type="color" {...register("color")} />
        </label>
        <label>
          Status
          <select {...register("status")}>
            <option value="puppy">Puppy</option>
            <option value="adult">Adult</option>
            <option value="senior">Senior</option>
          </select>
        </label>
        <label>
          Weight (lb)
          <input type="number" step="0.1" {...register("weight", { valueAsNumber: true })} />
        </label>
        <label>
          Expected adult weight (lb)
          <input type="number" step="0.1" {...register("expectedAdultWeight", { valueAsNumber: true })} />
        </label>
        <label>
          Microchip
          <input {...register("microchip")} />
        </label>
        <label>
          Veterinarian
          <input {...register("veterinarian")} />
        </label>
        <label>
          Insurance
          <input {...register("insurance")} />
        </label>
        <label>
          Breeder
          <input {...register("breeder")} />
        </label>
        <label>
          Exercise need
          <input {...register("exerciseNeed")} />
        </label>
        <label>
          Photo URL
          <input {...register("photo")} />
        </label>
      </div>
      <label>
        Health summary
        <textarea rows={2} {...register("healthSummary")} />
      </label>
      <label>
        Medications, supplements & injections (one per line: name | medication/supplement/injection/preventive | dosage | frequency | notes)
        <textarea rows={4} {...register("medicationEntries")} placeholder="Gabapentin | medication | 1 pill | 2x/day with meals | " />
      </label>
      <div className="form-grid">
        <label>
          Medical history (comma separated)
          <input {...register("medicalHistory")} />
        </label>
        <label>
          Allergies (comma separated)
          <input {...register("allergies")} />
        </label>
        <label>
          Favorite rewards (comma separated)
          <input {...register("favoriteRewards")} />
        </label>
        <label>
          Favorite toys (comma separated)
          <input {...register("favoriteToys")} />
        </label>
        <label>
          Mastered commands (comma separated)
          <input {...register("masteredCommands")} />
        </label>
      </div>
      <div className="form-grid">
        {(["confidence", "energy", "fearfulness", "resourceGuarding", "dogFriendliness", "humanFriendliness", "noiseSensitivity"] as const).map(
          (field) => (
            <label key={field}>
              {field} (0-100)
              <input type="number" min={0} max={100} {...register(field, { valueAsNumber: true })} />
            </label>
          ),
        )}
      </div>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Save dog
        </button>
      </div>
    </form>
  );
}

const personSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().min(1),
});

type PersonFormValues = z.infer<typeof personSchema>;

export function PersonForm({ initial, onSubmit, onCancel }: { initial?: Person; onSubmit: (values: PersonFormValues) => void; onCancel: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: { name: initial?.name ?? "", color: initial?.color ?? "#2f6f64" },
  });
  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <label>
          Name
          <input {...register("name")} />
          {errors.name && <small className="form-error">{errors.name.message}</small>}
        </label>
        <label>
          Color
          <input type="color" {...register("color")} />
        </label>
      </div>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Save person
        </button>
      </div>
    </form>
  );
}

const journalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1),
  text: z.string().min(1, "Add a note"),
  tags: z.string(),
  mood: z.enum(["great", "steady", "hard"]),
  dogIds: z.string(),
});

type JournalFormValues = z.infer<typeof journalSchema>;

export function journalFormValuesToEntry(values: JournalFormValues, id: string): JournalEntry {
  return {
    id,
    dogIds: csvToArray(values.dogIds),
    date: values.date,
    title: values.title,
    text: values.text,
    tags: csvToArray(values.tags),
    mood: values.mood,
  };
}

export function JournalForm({
  dogOptions,
  onSubmit,
  onCancel,
}: {
  dogOptions: { id: string; name: string }[];
  onSubmit: (values: JournalFormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<JournalFormValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      title: "",
      date: new Date().toISOString().slice(0, 10),
      text: "",
      tags: "",
      mood: "steady",
      dogIds: arrayToCsv(dogOptions.map((dog) => dog.id)),
    },
  });
  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <label>
          Title
          <input {...register("title")} />
          {errors.title && <small className="form-error">{errors.title.message}</small>}
        </label>
        <label>
          Date
          <input type="date" {...register("date")} />
        </label>
        <label>
          Mood
          <select {...register("mood")}>
            <option value="great">Great</option>
            <option value="steady">Steady</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label>
          Tags (comma separated)
          <input {...register("tags")} />
        </label>
        <label>
          Dogs (comma separated ids: {dogOptions.map((dog) => dog.id).join(", ")})
          <input {...register("dogIds")} />
        </label>
      </div>
      <label>
        Note
        <textarea rows={3} {...register("text")} />
        {errors.text && <small className="form-error">{errors.text.message}</small>}
      </label>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Save entry
        </button>
      </div>
    </form>
  );
}

const exposureLogSchema = z.object({
  reaction: z.enum(["confident", "curious", "cautious", "fearful"]),
  notes: z.string(),
  status: z.enum(["not-started", "introduced", "comfortable"]),
});

type ExposureLogFormValues = z.infer<typeof exposureLogSchema>;

export function ExposureLogForm({
  item,
  onSubmit,
  onCancel,
}: {
  item: ExposureItem;
  onSubmit: (values: ExposureLogFormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit } = useForm<ExposureLogFormValues>({
    resolver: zodResolver(exposureLogSchema),
    defaultValues: { reaction: "curious", notes: "", status: item.status === "comfortable" ? "comfortable" : "introduced" },
  });
  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <p className="eyebrow">{item.title}</p>
      <div className="form-grid">
        <label>
          Reaction
          <select {...register("reaction")}>
            <option value="confident">Confident</option>
            <option value="curious">Curious</option>
            <option value="cautious">Cautious</option>
            <option value="fearful">Fearful</option>
          </select>
        </label>
        <label>
          Overall status
          <select {...register("status")}>
            <option value="not-started">Not started</option>
            <option value="introduced">Introduced</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} {...register("notes")} />
      </label>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Log exposure
        </button>
      </div>
    </form>
  );
}

const relationshipLogSchema = z.object({
  date: z.string().min(1),
  comfort: z.number().min(0).max(100),
  sharedToys: z.number().min(0).max(100),
  sharedBeds: z.number().min(0).max(100),
  sharedWalks: z.number().min(0).max(100),
  bodyLanguage: z.number().min(0).max(100),
  resourceGuarding: z.number().min(0).max(100),
  playQuality: z.number().min(0).max(100),
  corrections: z.number().min(0),
  recoveryMinutes: z.number().min(0),
  notes: z.string(),
});

type RelationshipLogFormValues = z.infer<typeof relationshipLogSchema>;

export function relationshipLogFormValuesToLog(values: RelationshipLogFormValues, id: string, dogIds: [string, string]): RelationshipLog {
  return { id, dogIds, ...values };
}

export function RelationshipLogForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: RelationshipLogFormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit } = useForm<RelationshipLogFormValues>({
    resolver: zodResolver(relationshipLogSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      comfort: 60,
      sharedToys: 30,
      sharedBeds: 20,
      sharedWalks: 50,
      bodyLanguage: 60,
      resourceGuarding: 20,
      playQuality: 45,
      corrections: 1,
      recoveryMinutes: 3,
      notes: "",
    },
  });
  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <label>
          Date
          <input type="date" {...register("date")} />
        </label>
        {(["comfort", "sharedToys", "sharedBeds", "sharedWalks", "bodyLanguage", "resourceGuarding", "playQuality"] as const).map((field) => (
          <label key={field}>
            {field} (0-100)
            <input type="number" min={0} max={100} {...register(field, { valueAsNumber: true })} />
          </label>
        ))}
        <label>
          Corrections needed
          <input type="number" min={0} {...register("corrections", { valueAsNumber: true })} />
        </label>
        <label>
          Recovery time (minutes)
          <input type="number" min={0} {...register("recoveryMinutes", { valueAsNumber: true })} />
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} {...register("notes")} />
      </label>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Log check-in
        </button>
      </div>
    </form>
  );
}

const DAY_OF_WEEK_OPTIONS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Alone time used to have its own standalone log form here. It's now one of the
// training types in the Dashboard's Quick log (see QuickLogForm in components.tsx),
// which writes the same `alone_time_logs` row the readiness math reads — so there's
// one place to record it instead of two forms that never knew about each other.

// --- The unified item form --------------------------------------------------
//
// Replaces the old TaskForm / CalendarEventForm / HealthEventForm trio. What made
// those three confusing wasn't the fields — it was that picking a *type* up front
// silently decided whether you would ever be asked to complete or log anything,
// with no way to tell from the UI which was which. Here the two capabilities are
// explicit checkboxes that say what they do, and the Add-menu presets pre-tick them.

const checklistDefSchema = z.object({
  itemName: z.string().min(1, "Name the step"),
  dataType: z.enum(["boolean", "counter", "duration_minutes", "free_text"]),
  /** "" means the step applies to every dog involved; otherwise a dog id. */
  dogId: z.string(),
});

const logFieldSchema = z.object({
  fieldName: z.string().min(1, "Name the field"),
  dataType: z.enum(["number", "text", "date"]),
  unit: z.string(),
});

const reminderSchema = z.object({
  id: z.string(),
  amount: z.number().min(1, "Enter a number"),
  unit: z.enum(["minutes", "hours", "days"]),
});

const itemSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    category: z.enum(CATEGORY_OPTIONS as [Category, ...Category[]]),
    intent: z.enum(["routine", "event", "appointment", "training", "health-record"]),
    kind: z.enum(["recurring", "one-off"]),
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().min(1),
    daysOfWeek: z.array(z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])),
    monthDay: z.number().min(1).max(31).optional(),
    startDate: z.string(),
    endMode: z.enum(["never", "on-date", "after-count"]),
    endDate: z.string(),
    occurrenceCount: z.number().min(1).optional(),
    date: z.string(),
    windowLabel: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    durationHours: z.number().min(0),
    remindersEnabled: z.boolean(),
    reminders: z.array(reminderSchema),
    assignedTo: z.string(),
    attendees: z.array(z.string()),
    dogIds: z.array(z.string()),
    requiresCompletion: z.boolean(),
    checklist: z.array(checklistDefSchema),
    checklistSourceMilestoneId: z.string(),
    requiresLog: z.boolean(),
    logFields: z.array(logFieldSchema),
    aloneTimeRequired: z.enum(["all", "partial", "no"]),
    aloneTimeRequiredAmount: z.number().min(0).optional(),
    coverageConfirmed: z.boolean(),
    coverageNotes: z.string(),
    priority: z.enum(["essential", "important", "optional"]),
    supplies: z.string(),
    setting: z.enum(["indoor", "outdoor", "either"]),
    difficulty: z.number().min(1).max(5),
    location: z.string(),
    formation: z.string(),
    relatedMilestoneId: z.string(),
    documentUrl: z.string(),
    calendarVisibility: z.enum(["calendar", "checklist-only"]),
    status: z.enum(["confirmed", "placeholder"]),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.kind === "recurring" && !values.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "Start date is required for recurring items" });
    }
    // Only enforce the 2-of-3 time rule once the user has actually engaged with
    // times. A health record ("Mara weighed 14 lbs") legitimately has no clock time
    // at all — the old form demanded one anyway, which is part of why logging
    // something after the fact felt like fighting the UI.
    const timeFields = [values.startTime, values.endTime, values.durationHours > 0].filter(Boolean).length;
    if (timeFields === 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "Fill in at least 2 of start time, end time, duration — or leave all three blank",
      });
    }
    // Exempt for categories Quick log covers: a potty break or a meal gets completed by
    // logging what happened, and demanding a hand-typed checklist first is what produced
    // the Peed/Pooped/Treats duplication of the potty spec in the first place.
    if (
      values.requiresCompletion &&
      values.checklist.length === 0 &&
      !values.checklistSourceMilestoneId &&
      !quickLogKindForCategory(values.category)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checklist"],
        message: "Add at least one step, or pull the checklist from a training milestone",
      });
    }
    if (values.aloneTimeRequired === "partial" && !(values.aloneTimeRequiredAmount && values.aloneTimeRequiredAmount > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["aloneTimeRequiredAmount"], message: "Enter how much alone time this needs" });
    }
    if (values.coverageConfirmed && !values.coverageNotes.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["coverageNotes"], message: "Explain what the arranged coverage is" });
    }
    if (values.remindersEnabled && values.reminders.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reminders"], message: "Add at least one reminder, or turn this off" });
    }
  });

export type ItemFormValues = z.infer<typeof itemSchema>;

export function itemFormValuesToItem(
  values: ItemFormValues,
  id: string,
  extra?: Pick<Item, "excludedDates" | "roverVisits" | "prepSteps" | "roverInstructions" | "postSteps">,
): Item {
  const recurrence: Recurrence | undefined =
    values.kind === "recurring"
      ? {
          frequency: values.frequency as RecurrenceFrequency,
          interval: values.interval,
          daysOfWeek: values.frequency === "weekly" ? (values.daysOfWeek as DayOfWeek[]) : undefined,
          monthDay: values.frequency === "monthly" ? values.monthDay : undefined,
          startDate: values.startDate,
          endDate: values.endMode === "on-date" ? values.endDate || undefined : undefined,
          occurrenceCount: values.endMode === "after-count" ? values.occurrenceCount : undefined,
        }
      : undefined;
  return {
    id,
    title: values.title,
    category: values.category,
    intent: values.intent as ItemIntent,
    kind: values.kind,
    recurrence,
    date: values.kind === "one-off" ? values.date || undefined : undefined,
    windowLabel: values.windowLabel,
    startTime: values.startTime ? to12Hour(values.startTime) : undefined,
    endTime: values.endTime ? to12Hour(values.endTime) : undefined,
    durationHours: values.durationHours || undefined,
    status: values.status,
    reminders: values.remindersEnabled ? values.reminders : [],
    assignedTo: values.assignedTo,
    attendees: values.attendees.length > 0 ? values.attendees : undefined,
    dogIds: values.dogIds.length > 0 ? values.dogIds : undefined,
    requiresCompletion: values.requiresCompletion,
    checklist: values.requiresCompletion
      ? values.checklist.map((row) => ({ itemName: row.itemName, dataType: row.dataType, dogId: row.dogId || undefined }))
      : [],
    checklistSourceMilestoneId: values.checklistSourceMilestoneId || undefined,
    requiresLog: values.requiresLog,
    logFields: values.requiresLog ? values.logFields.map((row) => ({ ...row, unit: row.unit || undefined })) : [],
    aloneTimeRequired: values.aloneTimeRequired,
    aloneTimeRequiredAmount: values.aloneTimeRequired === "partial" ? values.aloneTimeRequiredAmount : undefined,
    coverageConfirmed: values.aloneTimeRequired !== "no" ? values.coverageConfirmed : undefined,
    coverageNotes: values.aloneTimeRequired !== "no" && values.coverageNotes ? values.coverageNotes : undefined,
    priority: values.priority,
    supplies: csvToArray(values.supplies),
    setting: values.setting,
    difficulty: values.difficulty as Item["difficulty"],
    location: values.location || undefined,
    formation: (values.formation || undefined) as Item["formation"],
    relatedMilestoneId: values.relatedMilestoneId || undefined,
    documentUrl: values.documentUrl || undefined,
    calendarVisibility: values.calendarVisibility,
    notes: values.notes,
    ...extra,
  };
}

const CHECKLIST_TYPE_LABELS: Record<string, string> = {
  boolean: "Tick box",
  counter: "Count",
  duration_minutes: "Minutes",
  free_text: "Text",
};

const LOG_TYPE_LABELS: Record<LogFieldDataType, string> = { number: "Number", text: "Text", date: "Date" };

/** Duplicated from components.tsx's formationLabels rather than imported — forms.tsx
 * importing from components.tsx would close an import cycle (components imports forms
 * indirectly through the store). Keep the two in sync if either changes. */
const FORMATION_LABELS: Record<DogFormation, string> = {
  together: "Together",
  "parallel-buffered": "Parallel — dog, human, human, dog",
  "separate-rooms": "Separate rooms",
  "separate-locations": "Separate locations",
  solo: "Solo (other dog managed elsewhere)",
};

/** `LogFieldDef.unit` is optional on the stored type (most fields have no unit) but
 * the form needs a controlled string for the input, so it gets normalized on entry
 * and dropped again on save. */
function withUnits(fields: LogFieldDef[]): ItemFormValues["logFields"] {
  return fields.map((field) => ({ ...field, unit: field.unit ?? "" }));
}

export function ItemForm({
  initial,
  presetIntent,
  peopleOptions,
  dogOptions,
  milestoneOptions,
  aloneTimeLogs,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Item;
  /** Which Add-menu preset opened this form. Ignored when editing an existing item. */
  presetIntent?: ItemIntent;
  peopleOptions: { id: string; name: string }[];
  dogOptions: { id: string; name: string }[];
  milestoneOptions: Milestone[];
  aloneTimeLogs: AloneTimeLog[];
  onSubmit: (values: ItemFormValues) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const preset = ITEM_INTENT_PRESETS.find((entry) => entry.id === (presetIntent ?? "event"));
  const rec = initial?.recurrence;
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      title: initial?.title ?? "",
      category: initial?.category ?? preset?.defaultCategory ?? "other",
      intent: initial?.intent ?? preset?.id ?? "event",
      kind: initial?.kind ?? preset?.defaultKind ?? "one-off",
      frequency: rec?.frequency ?? "weekly",
      interval: rec?.interval ?? 1,
      daysOfWeek: rec?.daysOfWeek ?? [],
      monthDay: rec?.monthDay,
      startDate: rec?.startDate ?? "",
      endMode: rec?.occurrenceCount ? "after-count" : rec?.endDate ? "on-date" : "never",
      endDate: rec?.endDate ?? "",
      occurrenceCount: rec?.occurrenceCount,
      date: initial?.date ?? "",
      windowLabel: initial?.windowLabel ?? "",
      startTime: initial?.startTime ? to24Hour(initial.startTime) : "",
      endTime: initial?.endTime ? to24Hour(initial.endTime) : "",
      durationHours: initial?.durationHours ?? 0,
      remindersEnabled: (initial?.reminders?.length ?? 0) > 0,
      reminders: initial?.reminders ?? [],
      assignedTo: initial?.assignedTo ?? "",
      attendees: initial?.attendees ?? [],
      dogIds: initial?.dogIds ?? [],
      requiresCompletion: initial?.requiresCompletion ?? preset?.requiresCompletion ?? false,
      checklist: (initial?.checklist ?? []).map((row) => ({ ...row, dogId: row.dogId ?? "" })),
      checklistSourceMilestoneId: initial?.checklistSourceMilestoneId ?? "",
      requiresLog: initial?.requiresLog ?? preset?.requiresLog ?? false,
      logFields: withUnits(initial?.logFields ?? (preset?.requiresLog ? defaultLogFieldsFor(preset.defaultCategory) : [])),
      aloneTimeRequired: initial?.aloneTimeRequired ?? "no",
      aloneTimeRequiredAmount: initial?.aloneTimeRequiredAmount,
      coverageConfirmed: initial?.coverageConfirmed ?? false,
      coverageNotes: initial?.coverageNotes ?? "",
      priority: initial?.priority ?? "important",
      supplies: arrayToCsv(initial?.supplies ?? []),
      setting: initial?.setting ?? "either",
      difficulty: initial?.difficulty ?? 1,
      location: initial?.location ?? "",
      formation: initial?.formation ?? "",
      relatedMilestoneId: initial?.relatedMilestoneId ?? "",
      documentUrl: initial?.documentUrl ?? "",
      calendarVisibility: initial?.calendarVisibility ?? "calendar",
      status: initial?.status ?? "confirmed",
      notes: initial?.notes ?? "",
    },
  });
  const kind = watch("kind");
  const frequency = watch("frequency");
  const endMode = watch("endMode");
  const category = watch("category");
  const requiresCompletion = watch("requiresCompletion");
  const requiresLog = watch("requiresLog");
  const checklist = watch("checklist");
  const checklistSourceMilestoneId = watch("checklistSourceMilestoneId");
  const logFields = watch("logFields");
  const aloneTimeRequired = watch("aloneTimeRequired");
  const aloneTimeRequiredAmount = watch("aloneTimeRequiredAmount");
  const durationHours = watch("durationHours");
  const startTime = watch("startTime");
  const remindersEnabled = watch("remindersEnabled");
  const reminders = watch("reminders");
  const daysOfWeek = watch("daysOfWeek");
  const attendees = watch("attendees");
  const dogIds = watch("dogIds");
  const coverageManuallySet = useRef(false);
  const logFieldsManuallySet = useRef(!!initial);
  const allDogIds = dogOptions.map((dog) => dog.id);
  const coverageNeeded = computeEventCoverageNeeded(
    { aloneTimeRequired, aloneTimeRequiredAmount, durationHours, dogIds },
    allDogIds,
    aloneTimeLogs,
  );
  const dogsNeedingCoverageNames = dogsNeedingCoverage({ aloneTimeRequired, dogIds }, allDogIds)
    .map((id) => dogOptions.find((dog) => dog.id === id)?.name ?? id)
    .join(" & ");
  const sourceMilestone = milestoneOptions.find((entry) => entry.id === checklistSourceMilestoneId);
  const selectedDogs = dogOptions.filter((dog) => dogIds.includes(dog.id));

  function toggleDayOfWeek(day: DayOfWeek) {
    const current = getValues("daysOfWeek");
    setValue("daysOfWeek", current.includes(day) ? current.filter((d) => d !== day) : [...current, day]);
  }

  function toggleAttendee(id: string) {
    const current = getValues("attendees");
    setValue("attendees", current.includes(id) ? current.filter((a) => a !== id) : [...current, id]);
  }

  // Dogs involved (who is actually going) and dog coverage (who is left home and
  // for how long) are separate fields, but selecting dogs involved suggests an
  // obvious starting point for coverage: both dogs going along means nobody is home
  // alone, so default coverage to "no"; a partial selection means at least one dog
  // is staying behind, so default to "all". Stops autofilling once the user edits
  // coverage directly, so it never clobbers a deliberate choice.
  function toggleDogId(id: string) {
    const current = getValues("dogIds");
    const next = current.includes(id) ? current.filter((d) => d !== id) : [...current, id];
    setValue("dogIds", next);
    if (!coverageManuallySet.current && next.length > 0) {
      setValue("aloneTimeRequired", next.length === dogOptions.length ? "no" : "all");
    }
  }

  // Switching category re-seeds the log fields (vet -> weight/temp/cost) until the
  // user edits them, at which point their choices win. Same "suggest, do not
  // clobber" contract as the coverage default above.
  function handleCategoryChange(next: Category) {
    setValue("category", next);
    if (!logFieldsManuallySet.current) setValue("logFields", withUnits(defaultLogFieldsFor(next)));
  }

  function addChecklistRow() {
    setValue("checklist", [...getValues("checklist"), { itemName: "", dataType: "boolean" as const, dogId: "" }]);
  }
  function updateChecklistRow(index: number, patch: Partial<ItemFormValues["checklist"][number]>) {
    setValue(
      "checklist",
      getValues("checklist").map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function removeChecklistRow(index: number) {
    setValue(
      "checklist",
      getValues("checklist").filter((_, i) => i !== index),
    );
  }

  function addLogField() {
    logFieldsManuallySet.current = true;
    setValue("logFields", [...getValues("logFields"), { fieldName: "", dataType: "number" as const, unit: "" }]);
  }
  function updateLogField(index: number, patch: Partial<ItemFormValues["logFields"][number]>) {
    logFieldsManuallySet.current = true;
    setValue(
      "logFields",
      getValues("logFields").map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function removeLogField(index: number) {
    logFieldsManuallySet.current = true;
    setValue(
      "logFields",
      getValues("logFields").filter((_, i) => i !== index),
    );
  }

  function addReminderRow() {
    setValue("reminders", [...getValues("reminders"), { id: makeId("reminder"), amount: 1, unit: "hours" as const }]);
  }
  function updateReminderRow(index: number, patch: Partial<ItemFormValues["reminders"][number]>) {
    setValue(
      "reminders",
      getValues("reminders").map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  function removeReminderRow(index: number) {
    setValue(
      "reminders",
      getValues("reminders").filter((_, i) => i !== index),
    );
  }

  async function submitForm(values: ItemFormValues) {
    setSaveState("saving");
    const ok = await onSubmit(values);
    setSaveState(ok ? "saved" : "error");
  }

  function handleTimeBlur() {
    const values = getValues();
    const computed = computeEventTimes({
      startTime: values.startTime ? to12Hour(values.startTime) : undefined,
      endTime: values.endTime ? to12Hour(values.endTime) : undefined,
      durationHours: values.durationHours || undefined,
    });
    if (computed.durationHours !== undefined) setValue("durationHours", computed.durationHours);
    if (computed.endTime !== undefined && !values.endTime) setValue("endTime", to24Hour(computed.endTime));
    if (computed.startTime !== undefined && !values.startTime) setValue("startTime", to24Hour(computed.startTime));
  }

  const startTimeReg = register("startTime");
  const endTimeReg = register("endTime");
  const durationReg = register("durationHours", { valueAsNumber: true });
  const aloneTimeRequiredReg = register("aloneTimeRequired");

  if (saveState === "saved") {
    return (
      <>
        <p className="form-success">&quot;{getValues("title")}&quot; was saved.</p>
        <div className="form-actions">
          <button className="primary-button" type="button" onClick={onCancel}>
            Done
          </button>
        </div>
      </>
    );
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit(submitForm)}>
      <div className="form-grid">
        <label>
          Title
          <input {...register("title")} />
          {errors.title && <small className="form-error">{errors.title.message}</small>}
        </label>
        <div className="form-field">
          Category
          <CategoryPicker value={category} onChange={handleCategoryChange} />
        </div>
      </div>

      {/* The two capability toggles, stated in plain language. This block is the
          answer to "which items need a checklist vs. are just events vs. need
          logging" — it is no longer implied by a type picked on a previous screen. */}
      <fieldset className="capability-group">
        <legend>What does this item need?</legend>
        <label className="capability-toggle">
          <input type="checkbox" {...register("requiresCompletion")} />
          <span>
            <strong>Needs completing</strong>
            <small>Work through a checklist and score it. Until then it counts as outstanding.</small>
          </span>
        </label>
        <label className="capability-toggle">
          <input type="checkbox" {...register("requiresLog")} />
          <span>
            <strong>Needs logging</strong>
            <small>Record details each time — weight, cost, how it went. This is what the weekly AI pass reads.</small>
          </span>
        </label>
        {!requiresCompletion && !requiresLog && (
          <p className="small capability-hint">
            Neither ticked: this just sits on the calendar as something to be aware of. That is a perfectly good option.
          </p>
        )}
      </fieldset>

      {/* Separate from the capability toggles above: those say what the item asks of
          you, this says where it shows up. A potty break every two hours has to be
          tracked and has no business on a calendar someone else is reading. */}
      <div className="form-field">
        Where should this show up?
        <select {...register("calendarVisibility")}>
          <option value="calendar">On the calendar, like everything else</option>
          <option value="checklist-only">Dashboard only — too frequent for the calendar</option>
        </select>
      </div>

      {requiresCompletion && (
        <fieldset className="capability-detail">
          <legend>Checklist</legend>
          {milestoneOptions.length > 0 && (
            <div className="form-field">
              Pull steps from a training milestone (optional)
              <MilestonePicker
                milestones={milestoneOptions}
                dogIds={dogIds}
                dogs={selectedDogs}
                value={checklistSourceMilestoneId}
                onChange={(id) => setValue("checklistSourceMilestoneId", id)}
                noneOption={{ id: "", label: "Write my own steps below" }}
                emptyLabel="Write my own steps below"
              />
            </div>
          )}
          {sourceMilestone ? (
            <div className="milestone-pull">
              <p className="small">
                Steps come from <strong>{sourceMilestone.title}</strong> and stay in sync with it. Ticking them off here
                advances that milestone&apos;s progress.
              </p>
              <ul>
                {sourceMilestone.steps.map((step) => (
                  <li key={step.title}>{step.title}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {checklist.map((row, index) => (
                <div className="checklist-def-row" key={index}>
                  <input
                    placeholder="Step name"
                    value={row.itemName}
                    onChange={(event) => updateChecklistRow(index, { itemName: event.target.value })}
                  />
                  <select
                    value={row.dataType}
                    onChange={(event) => updateChecklistRow(index, { dataType: event.target.value as typeof row.dataType })}
                  >
                    {Object.entries(CHECKLIST_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {/* Only worth showing once more than one dog is actually involved —
                      with a single dog every step is obviously that dog's. */}
                  {selectedDogs.length > 1 && (
                    <select
                      aria-label={`Which dog is "${row.itemName || "this step"}" for?`}
                      value={row.dogId}
                      onChange={(event) => updateChecklistRow(index, { dogId: event.target.value })}
                    >
                      <option value="">Both dogs</option>
                      {selectedDogs.map((dog) => (
                        <option key={dog.id} value={dog.id}>
                          {dog.name} only
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="button" className="text-button danger" onClick={() => removeChecklistRow(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="text-button" onClick={addChecklistRow}>
                + Add step
              </button>
              <p className="small">
                Every step gets its own notes box and 1-5 score when you complete the item.
                {selectedDogs.length > 1
                  ? " Assign steps to one dog to run different work for each in the same session."
                  : ""}
              </p>
            </>
          )}
          {errors.checklist && <small className="form-error">{errors.checklist.message}</small>}
        </fieldset>
      )}

      {requiresLog && (
        <fieldset className="capability-detail">
          <legend>Log fields</legend>
          <p className="small">
            Free-text notes are always available. These are the extra values you will be prompted for — seeded from the
            category, edit freely.
          </p>
          {logFields.map((row, index) => (
            <div className="log-field-row" key={index}>
              <input
                placeholder="Field name"
                value={row.fieldName}
                onChange={(event) => updateLogField(index, { fieldName: event.target.value })}
              />
              <select
                value={row.dataType}
                onChange={(event) => updateLogField(index, { dataType: event.target.value as typeof row.dataType })}
              >
                {Object.entries(LOG_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input placeholder="Unit" value={row.unit} onChange={(event) => updateLogField(index, { unit: event.target.value })} />
              <button type="button" className="text-button danger" onClick={() => removeLogField(index)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="text-button" onClick={addLogField}>
            + Add field
          </button>
        </fieldset>
      )}

      <div className="form-grid">
        <label>
          Repeats?
          <select {...register("kind")}>
            <option value="one-off">Just once</option>
            <option value="recurring">Repeats</option>
          </select>
        </label>

        {kind === "recurring" ? (
          <>
            <label>
              How often
              <select {...register("frequency")}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            <label>
              Every ({frequency === "daily" ? "days" : frequency === "weekly" ? "weeks" : frequency === "monthly" ? "months" : "years"})
              <input type="number" min={1} {...register("interval", { valueAsNumber: true })} />
            </label>
            {frequency === "weekly" && (
              <div className="form-field">
                Days of week
                <div className="subtabs" role="group" aria-label="Days of week">
                  {DAY_OF_WEEK_OPTIONS.map((day) => (
                    <button key={day} type="button" className={daysOfWeek.includes(day) ? "active" : ""} onClick={() => toggleDayOfWeek(day)}>
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {frequency === "monthly" && (
              <label>
                Day of month (optional — defaults to start date&apos;s day)
                <input type="number" min={1} max={31} {...register("monthDay", { valueAsNumber: true })} />
              </label>
            )}
            <label>
              Start date
              <input type="date" {...register("startDate")} />
              {errors.startDate && <small className="form-error">{errors.startDate.message}</small>}
            </label>
            <label>
              Ends
              <select {...register("endMode")}>
                <option value="never">Never</option>
                <option value="on-date">On date</option>
                <option value="after-count">After a number of times</option>
              </select>
            </label>
            {endMode === "on-date" && (
              <label>
                End date
                <input type="date" {...register("endDate")} />
              </label>
            )}
            {endMode === "after-count" && (
              <label>
                Number of occurrences
                <input type="number" min={1} {...register("occurrenceCount", { valueAsNumber: true })} />
              </label>
            )}
          </>
        ) : (
          <>
            <label>
              Date
              <input type="date" {...register("date")} />
            </label>
            <label>
              Window label (e.g. &quot;mid-to-late September&quot;)
              <input {...register("windowLabel")} />
            </label>
          </>
        )}

        <label>
          Start time (optional)
          <input type="time" {...startTimeReg} onBlur={(e) => { startTimeReg.onBlur(e); handleTimeBlur(); }} />
        </label>
        <label>
          End time
          <input type="time" {...endTimeReg} onBlur={(e) => { endTimeReg.onBlur(e); handleTimeBlur(); }} />
        </label>
        <label>
          Duration (hours)
          <input type="number" min={0} step="any" {...durationReg} onBlur={(e) => { durationReg.onBlur(e); handleTimeBlur(); }} />
        </label>
        {errors.startTime && <small className="form-error">{errors.startTime.message}</small>}

        <label>
          Owner (optional)
          <select {...register("assignedTo")}>
            <option value="">Whole household</option>
            {peopleOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-field">
          Also attending (optional)
          <div className="subtabs" role="group" aria-label="Attendees">
            {peopleOptions.map((person) => (
              <button key={person.id} type="button" className={attendees.includes(person.id) ? "active" : ""} onClick={() => toggleAttendee(person.id)}>
                {person.name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          Dogs involved (optional)
          <div className="subtabs" role="group" aria-label="Dogs involved">
            {dogOptions.map((dog) => (
              <button key={dog.id} type="button" className={dogIds.includes(dog.id) ? "active" : ""} onClick={() => toggleDogId(dog.id)}>
                {dog.name}
              </button>
            ))}
          </div>
        </div>

        <label>
          Dog alone time required
          <select
            {...aloneTimeRequiredReg}
            onChange={(e) => {
              coverageManuallySet.current = true;
              aloneTimeRequiredReg.onChange(e);
            }}
          >
            <option value="no">No</option>
            <option value="all">Yes — all of it</option>
            <option value="partial">Yes — partial</option>
          </select>
        </label>
        {aloneTimeRequired === "partial" && (
          <label>
            How much (hours)
            <input type="number" min={0} step="any" {...register("aloneTimeRequiredAmount", { valueAsNumber: true })} />
            {errors.aloneTimeRequiredAmount && <small className="form-error">{errors.aloneTimeRequiredAmount.message}</small>}
          </label>
        )}
      </div>

      {coverageNeeded && (
        <div className="coverage-confirm">
          <p className="form-error">
            This needs more coverage than {dogsNeedingCoverageNames || "the dog(s) left home"}{" "}
            {dogsNeedingCoverageNames.includes("&") ? "have" : "has"} proven they can handle — arrange a sitter and confirm below.
          </p>
          <label className="checkbox-row">
            <input type="checkbox" {...register("coverageConfirmed")} />
            Coverage is arranged
          </label>
          <label>
            What&apos;s the coverage plan? (required once confirmed)
            <textarea rows={2} {...register("coverageNotes")} />
            {errors.coverageNotes && <small className="form-error">{errors.coverageNotes.message}</small>}
          </label>
        </div>
      )}

      <fieldset className="capability-detail">
        <legend>Email reminder</legend>
        <label className="capability-toggle">
          <input type="checkbox" {...register("remindersEnabled")} />
          <span>
            <strong>Send an email reminder</strong>
            <small>Emailed ahead of when this is scheduled, tagged with who it&apos;s assigned to (or &quot;Household&quot; if no one&apos;s assigned).</small>
          </span>
        </label>
        {remindersEnabled && (
          <>
            {!startTime && (
              <p className="small capability-hint">Add a start time above — reminders need a clock time to count down from.</p>
            )}
            {reminders.map((row, index) => (
              <div className="reminder-row" key={row.id}>
                <input
                  type="number"
                  min={1}
                  aria-label="Amount"
                  value={row.amount}
                  onChange={(event) => updateReminderRow(index, { amount: Number(event.target.value) })}
                />
                <select
                  aria-label="Unit"
                  value={row.unit}
                  onChange={(event) => updateReminderRow(index, { unit: event.target.value as ReminderOffsetUnit })}
                >
                  <option value="minutes">Minutes before</option>
                  <option value="hours">Hours before</option>
                  <option value="days">Days before</option>
                </select>
                <button type="button" className="text-button danger" onClick={() => removeReminderRow(index)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="text-button" onClick={addReminderRow}>
              + Add reminder
            </button>
            {errors.reminders && !Array.isArray(errors.reminders) && (
              <small className="form-error">{errors.reminders.message}</small>
            )}
          </>
        )}
      </fieldset>

      <button type="button" className="text-button" onClick={() => setShowAdvanced((prev) => !prev)}>
        {showAdvanced ? "Hide" : "Show"} more options
      </button>
      {showAdvanced && (
        <div className="form-grid">
          <label>
            Priority
            <select {...register("priority")}>
              <option value="essential">Essential</option>
              <option value="important">Important</option>
              <option value="optional">Optional</option>
            </select>
          </label>
          <label>
            Status
            <select {...register("status")}>
              <option value="confirmed">Confirmed</option>
              <option value="placeholder">Placeholder (date TBD)</option>
            </select>
          </label>
          <label>
            Setting
            <select {...register("setting")}>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
              <option value="either">Either</option>
            </select>
          </label>
          <label>
            Difficulty (1-5)
            <input type="number" min={1} max={5} {...register("difficulty", { valueAsNumber: true })} />
          </label>
          <label>
            Location
            <select {...register("location")}>
              <option value="">Not specified</option>
              {locations.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dog formation
            <select {...register("formation")}>
              <option value="">Not specified</option>
              {(Object.keys(FORMATION_LABELS) as DogFormation[]).map((value) => (
                <option key={value} value={value}>
                  {FORMATION_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Linked milestone (reference only)
            <select {...register("relatedMilestoneId")}>
              <option value="">None</option>
              {milestoneOptions.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Supplies (comma separated)
            <input {...register("supplies")} placeholder="Treat pouch, Leash" />
          </label>
          <label>
            Record / receipt link
            <input {...register("documentUrl")} placeholder="https://…" />
          </label>
        </div>
      )}

      <label>
        Notes
        <textarea rows={2} {...register("notes")} />
      </label>
      {saveState === "error" && <p className="form-error">That didn&apos;t save — check the browser console and try again.</p>}
      <div className="form-actions">
        {onDelete && (
          <button className="text-button danger" type="button" onClick={onDelete} style={{ marginRight: "auto" }} disabled={saveState === "saving"}>
            Delete
          </button>
        )}
        <button className="text-button" type="button" onClick={onCancel} disabled={saveState === "saving"}>
          Cancel
        </button>
        <button className="primary-button" type="submit" disabled={saveState === "saving"}>
          {saveState === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
