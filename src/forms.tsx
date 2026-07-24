import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AloneTimeLog,
  CalendarEvent,
  Category,
  DayOfWeek,
  Dog,
  DogStatus,
  ExposureItem,
  HealthEvent,
  JournalEntry,
  MedicationEntry,
  MedicationKind,
  Person,
  Recurrence,
  RecurrenceFrequency,
  RelationshipLog,
  Task,
} from "./types";
import { makeId } from "./store";
import { computeEventTimes, to12Hour, to24Hour } from "./utils";

export const CATEGORY_OPTIONS: Category[] = [
  "potty",
  "meals",
  "training",
  "health",
  "handling",
  "socialization",
  "exercise",
  "relationship",
  "alone-time",
  "chores",
  "family",
  "social",
  "entertainment",
  "sports",
  "travel",
  "downtime",
  "journal",
  "other",
];

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

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.enum(CATEGORY_OPTIONS as [Category, ...Category[]]),
  assignedTo: z.string().min(1),
  time: z.string().min(1),
  duration: z.number().min(1),
  priority: z.enum(["essential", "important", "optional"]),
  supplies: z.string(),
  setting: z.enum(["indoor", "outdoor", "either"]),
  difficulty: z.number().min(1).max(5),
  dogIds: z.string(),
  checklist: z.string(),
  grizParticipation: z.enum(["yes", "separate", "managed", "not yet"]),
  notes: z.string(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export function taskFormValuesToTask(values: TaskFormValues, id: string): Task {
  return {
    id,
    title: values.title,
    category: values.category as Category,
    assignedTo: values.assignedTo,
    time: values.time,
    duration: values.duration,
    priority: values.priority,
    supplies: csvToArray(values.supplies),
    setting: values.setting,
    difficulty: values.difficulty as Task["difficulty"],
    dogIds: csvToArray(values.dogIds),
    checklist: csvToArray(values.checklist),
    grizParticipation: values.grizParticipation,
    notes: values.notes,
  };
}

export function TaskForm({
  initial,
  peopleOptions,
  dogOptions,
  onSubmit,
  onCancel,
}: {
  initial?: Task;
  peopleOptions: { id: string; name: string }[];
  dogOptions: { id: string; name: string }[];
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: initial?.title ?? "",
      category: initial?.category ?? "potty",
      assignedTo: initial?.assignedTo ?? peopleOptions[0]?.id ?? "",
      time: initial?.time ?? "8:00 AM",
      duration: initial?.duration ?? 10,
      priority: initial?.priority ?? "important",
      supplies: arrayToCsv(initial?.supplies ?? []),
      setting: initial?.setting ?? "indoor",
      difficulty: initial?.difficulty ?? 1,
      dogIds: arrayToCsv(initial?.dogIds ?? (dogOptions[0] ? [dogOptions[0].id] : [])),
      checklist: arrayToCsv(initial?.checklist ?? []),
      grizParticipation: initial?.grizParticipation ?? "not yet",
      notes: initial?.notes ?? "",
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
          Category
          <select {...register("category")}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigned to
          <select {...register("assignedTo")}>
            {peopleOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Time
          <input {...register("time")} placeholder="7:15 AM" />
        </label>
        <label>
          Duration (minutes)
          <input type="number" min={1} {...register("duration", { valueAsNumber: true })} />
        </label>
        <label>
          Priority
          <select {...register("priority")}>
            <option value="essential">Essential</option>
            <option value="important">Important</option>
            <option value="optional">Optional</option>
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
          Dogs (comma separated ids: {dogOptions.map((dog) => dog.id).join(", ")})
          <input {...register("dogIds")} />
        </label>
        <label>
          Supplies (comma separated)
          <input {...register("supplies")} />
        </label>
        <label>
          Checklist (comma separated)
          <input {...register("checklist")} />
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
          Save task
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

const healthEventSchema = z.object({
  dogId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1),
  kind: z.enum(["vaccine", "vet", "medication", "grooming", "weight", "insurance"]),
  notes: z.string(),
  documentUrl: z.string(),
});

type HealthEventFormValues = z.infer<typeof healthEventSchema>;

export function healthEventFormValuesToEvent(values: HealthEventFormValues, id: string): HealthEvent {
  return { id, ...values, documentUrl: values.documentUrl || undefined };
}

export function HealthEventForm({
  initial,
  dogOptions,
  onSubmit,
  onCancel,
}: {
  initial?: HealthEvent;
  dogOptions: { id: string; name: string }[];
  onSubmit: (values: HealthEventFormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<HealthEventFormValues>({
    resolver: zodResolver(healthEventSchema),
    defaultValues: {
      dogId: initial?.dogId ?? dogOptions[0]?.id ?? "",
      title: initial?.title ?? "",
      date: initial?.date ?? new Date().toISOString().slice(0, 10),
      kind: initial?.kind ?? "vet",
      notes: initial?.notes ?? "",
      documentUrl: initial?.documentUrl ?? "",
    },
  });
  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <label>
          Dog
          <select {...register("dogId")}>
            {dogOptions.map((dog) => (
              <option key={dog.id} value={dog.id}>
                {dog.name}
              </option>
            ))}
          </select>
        </label>
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
          Kind
          <select {...register("kind")}>
            {["vaccine", "vet", "medication", "grooming", "weight", "insurance"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} {...register("notes")} />
      </label>
      <label>
        Record / receipt link (optional)
        <input {...register("documentUrl")} placeholder="https://…" />
      </label>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Save health event
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

const calendarEventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    category: z.enum(CATEGORY_OPTIONS as [Category, ...Category[]]),
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
    attendeeMode: z.enum(["everyone", "specific"]),
    attendees: z.array(z.string()),
    aloneTimeRequired: z.enum(["all", "partial", "no"]),
    aloneTimeRequiredAmount: z.number().min(0).optional(),
    status: z.enum(["confirmed", "placeholder"]),
    importance: z.enum(["marquee", "normal", ""]),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.kind === "recurring" && !values.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "Start date is required for recurring events" });
    }
    const filledTimeFields = [values.startTime, values.endTime, values.durationHours > 0].filter(Boolean).length;
    if (filledTimeFields < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startTime"], message: "Fill in at least 2 of start time, end time, duration" });
    }
    if (values.aloneTimeRequired === "partial" && !(values.aloneTimeRequiredAmount && values.aloneTimeRequiredAmount > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["aloneTimeRequiredAmount"], message: "Enter how much alone time this event needs" });
    }
  });

type CalendarEventFormValues = z.infer<typeof calendarEventSchema>;

export function calendarEventFormValuesToEvent(
  values: CalendarEventFormValues,
  id: string,
  extra?: Pick<CalendarEvent, "excludedDates" | "roverVisits" | "prepSteps" | "roverInstructions" | "postSteps">,
): CalendarEvent {
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
    kind: values.kind,
    recurrence,
    date: values.kind === "one-off" ? values.date || undefined : undefined,
    windowLabel: values.windowLabel,
    startTime: values.startTime ? to12Hour(values.startTime) : undefined,
    endTime: values.endTime ? to12Hour(values.endTime) : undefined,
    durationHours: values.durationHours || undefined,
    attendees: values.attendeeMode === "everyone" ? undefined : values.attendees,
    aloneTimeRequired: values.aloneTimeRequired,
    aloneTimeRequiredAmount: values.aloneTimeRequired === "partial" ? values.aloneTimeRequiredAmount : undefined,
    status: values.status,
    importance: values.importance || undefined,
    notes: values.notes,
    ...extra,
  };
}

export function CalendarEventForm({
  initial,
  peopleOptions,
  onSubmit,
  onCancel,
}: {
  initial?: CalendarEvent;
  peopleOptions: { id: string; name: string }[];
  onSubmit: (values: CalendarEventFormValues) => void;
  onCancel: () => void;
}) {
  const rec = initial?.recurrence;
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<CalendarEventFormValues>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: {
      title: initial?.title ?? "",
      category: initial?.category ?? "other",
      kind: initial?.kind ?? "one-off",
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
      attendeeMode: initial?.attendees && initial.attendees.length > 0 ? "specific" : "everyone",
      attendees: initial?.attendees ?? [],
      aloneTimeRequired: initial?.aloneTimeRequired ?? "no",
      aloneTimeRequiredAmount: initial?.aloneTimeRequiredAmount,
      status: initial?.status ?? "placeholder",
      importance: initial?.importance ?? "",
      notes: initial?.notes ?? "",
    },
  });
  const kind = watch("kind");
  const frequency = watch("frequency");
  const endMode = watch("endMode");
  const attendeeMode = watch("attendeeMode");
  const aloneTimeRequired = watch("aloneTimeRequired");
  const daysOfWeek = watch("daysOfWeek");
  const attendees = watch("attendees");

  function toggleDayOfWeek(day: DayOfWeek) {
    const current = getValues("daysOfWeek");
    setValue("daysOfWeek", current.includes(day) ? current.filter((d) => d !== day) : [...current, day]);
  }

  function toggleAttendee(id: string) {
    const current = getValues("attendees");
    setValue("attendees", current.includes(id) ? current.filter((a) => a !== id) : [...current, id]);
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

  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <label>
          Title
          <input {...register("title")} />
          {errors.title && <small className="form-error">{errors.title.message}</small>}
        </label>
        <label>
          Category
          <select {...register("category")}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recurring or one-off
          <select {...register("kind")}>
            <option value="one-off">One-off event</option>
            <option value="recurring">Recurring</option>
          </select>
        </label>

        {kind === "recurring" ? (
          <>
            <label>
              Repeats
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
              <label>
                Days of week
                <div className="subtabs" role="group" aria-label="Days of week">
                  {DAY_OF_WEEK_OPTIONS.map((day) => (
                    <button key={day} type="button" className={daysOfWeek.includes(day) ? "active" : ""} onClick={() => toggleDayOfWeek(day)}>
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </label>
            )}
            {frequency === "monthly" && (
              <label>
                Day of month (optional — defaults to start date's day)
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
              Date (leave blank if only a window is known)
              <input type="date" {...register("date")} />
            </label>
            <label>
              Window label (e.g. "mid-to-late September")
              <input {...register("windowLabel")} />
            </label>
          </>
        )}

        <label>
          Start time
          <input type="time" {...startTimeReg} onBlur={(e) => { startTimeReg.onBlur(e); handleTimeBlur(); }} />
        </label>
        <label>
          End time
          <input type="time" {...endTimeReg} onBlur={(e) => { endTimeReg.onBlur(e); handleTimeBlur(); }} />
        </label>
        <label>
          Duration (hours)
          <input type="number" min={0} step="0.25" {...durationReg} onBlur={(e) => { durationReg.onBlur(e); handleTimeBlur(); }} />
        </label>
        {errors.startTime && <small className="form-error">{errors.startTime.message}</small>}

        <label>
          Assigned to
          <select {...register("attendeeMode")}>
            <option value="everyone">Everyone</option>
            <option value="specific">Specific people</option>
          </select>
        </label>
        {attendeeMode === "specific" && (
          <label>
            Who
            <div className="subtabs" role="group" aria-label="Assigned people">
              {peopleOptions.map((person) => (
                <button key={person.id} type="button" className={attendees.includes(person.id) ? "active" : ""} onClick={() => toggleAttendee(person.id)}>
                  {person.name}
                </button>
              ))}
            </div>
          </label>
        )}

        <label>
          Dog alone time required
          <select {...register("aloneTimeRequired")}>
            <option value="no">No</option>
            <option value="all">Yes — all of it</option>
            <option value="partial">Yes — partial</option>
          </select>
        </label>
        {aloneTimeRequired === "partial" && (
          <label>
            How much (hours)
            <input type="number" min={0} step="0.5" {...register("aloneTimeRequiredAmount", { valueAsNumber: true })} />
            {errors.aloneTimeRequiredAmount && <small className="form-error">{errors.aloneTimeRequiredAmount.message}</small>}
          </label>
        )}

        <label>
          Status
          <select {...register("status")}>
            <option value="confirmed">Confirmed</option>
            <option value="placeholder">Placeholder</option>
          </select>
        </label>
        <label>
          Importance
          <select {...register("importance")}>
            <option value="">—</option>
            <option value="normal">Normal</option>
            <option value="marquee">Marquee / heavy week</option>
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
          Save event
        </button>
      </div>
    </form>
  );
}

const aloneTimeLogSchema = z.object({
  date: z.string().min(1),
  durationMinutes: z.number().min(1),
  notes: z.string(),
});

type AloneTimeLogFormValues = z.infer<typeof aloneTimeLogSchema>;

export function aloneTimeLogFormValuesToLog(values: AloneTimeLogFormValues, id: string): AloneTimeLog {
  return { id, date: values.date, durationMinutes: values.durationMinutes, notes: values.notes };
}

export function AloneTimeLogForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: AloneTimeLogFormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit } = useForm<AloneTimeLogFormValues>({
    resolver: zodResolver(aloneTimeLogSchema),
    defaultValues: { date: new Date().toISOString().slice(0, 10), durationMinutes: 30, notes: "" },
  });
  return (
    <form className="entity-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <label>
          Date
          <input type="date" {...register("date")} />
        </label>
        <label>
          Duration (minutes)
          <input type="number" min={1} {...register("durationMinutes", { valueAsNumber: true })} />
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} {...register("notes")} placeholder="How did it go? Any signs of stress?" />
      </label>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Log alone time
        </button>
      </div>
    </form>
  );
}
