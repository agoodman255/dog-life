import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AloneTimeLog,
  CalendarEvent,
  Dog,
  DogStatus,
  ExposureItem,
  HealthEvent,
  JournalEntry,
  Person,
  RelationshipLog,
  Task,
  TaskCategory,
} from "./types";

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
  medications: z.string(),
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
    medications: arrayToCsv(dog?.medications ?? []),
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
    medications: csvToArray(values.medications),
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
          Medications (comma separated)
          <input {...register("medications")} />
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
  category: z.enum(["care", "training", "health", "handling", "socialization", "exercise", "relationship", "journal"]),
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
    category: values.category as TaskCategory,
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
      category: initial?.category ?? "care",
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
            {["care", "training", "health", "handling", "socialization", "exercise", "relationship", "journal"].map((option) => (
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
          Difficulty (1-5)
          <input type="number" min={1} max={5} {...register("difficulty", { valueAsNumber: true })} />
        </label>
        <label>
          Griz participation
          <select {...register("grizParticipation")}>
            <option value="yes">Yes</option>
            <option value="separate">Separate</option>
            <option value="managed">Managed</option>
            <option value="not yet">Not yet</option>
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
});

type HealthEventFormValues = z.infer<typeof healthEventSchema>;

export function healthEventFormValuesToEvent(values: HealthEventFormValues, id: string): HealthEvent {
  return { id, ...values };
}

export function HealthEventForm({
  dogOptions,
  onSubmit,
  onCancel,
}: {
  dogOptions: { id: string; name: string }[];
  onSubmit: (values: HealthEventFormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<HealthEventFormValues>({
    resolver: zodResolver(healthEventSchema),
    defaultValues: {
      dogId: dogOptions[0]?.id ?? "",
      title: "",
      date: new Date().toISOString().slice(0, 10),
      kind: "vet",
      notes: "",
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

const calendarEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.enum(["gym", "sports", "concert", "comedy", "family", "travel", "curling", "volleyball", "other"]),
  kind: z.enum(["recurring", "one-off"]),
  dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", ""]),
  activeFrom: z.string(),
  activeTo: z.string(),
  date: z.string(),
  windowLabel: z.string(),
  timeLabel: z.string().min(1, "Time label is required"),
  durationHours: z.number().min(0),
  coverageNeeded: z.enum(["none", "rover", "full-day"]),
  status: z.enum(["confirmed", "placeholder"]),
  importance: z.enum(["marquee", "normal", ""]),
  notes: z.string(),
});

type CalendarEventFormValues = z.infer<typeof calendarEventSchema>;

export function calendarEventFormValuesToEvent(values: CalendarEventFormValues, id: string): CalendarEvent {
  return {
    id,
    title: values.title,
    category: values.category,
    kind: values.kind,
    dayOfWeek: values.dayOfWeek || undefined,
    activeFrom: values.activeFrom || undefined,
    activeTo: values.activeTo || undefined,
    date: values.date || undefined,
    windowLabel: values.windowLabel,
    timeLabel: values.timeLabel,
    durationHours: values.durationHours || undefined,
    coverageNeeded: values.coverageNeeded,
    status: values.status,
    importance: values.importance || undefined,
    notes: values.notes,
  };
}

export function CalendarEventForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: CalendarEvent;
  onSubmit: (values: CalendarEventFormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CalendarEventFormValues>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: {
      title: initial?.title ?? "",
      category: initial?.category ?? "other",
      kind: initial?.kind ?? "one-off",
      dayOfWeek: initial?.dayOfWeek ?? "",
      activeFrom: initial?.activeFrom ?? "",
      activeTo: initial?.activeTo ?? "",
      date: initial?.date ?? "",
      windowLabel: initial?.windowLabel ?? "",
      timeLabel: initial?.timeLabel ?? "",
      durationHours: initial?.durationHours ?? 0,
      coverageNeeded: initial?.coverageNeeded ?? "none",
      status: initial?.status ?? "placeholder",
      importance: initial?.importance ?? "",
      notes: initial?.notes ?? "",
    },
  });
  const kind = watch("kind");
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
            {["gym", "sports", "concert", "comedy", "family", "travel", "curling", "volleyball", "other"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recurring or one-off
          <select {...register("kind")}>
            <option value="recurring">Recurring weekly</option>
            <option value="one-off">One-off event</option>
          </select>
        </label>
        {kind === "recurring" ? (
          <>
            <label>
              Day of week
              <select {...register("dayOfWeek")}>
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Active from (optional)
              <input type="date" {...register("activeFrom")} />
            </label>
            <label>
              Active to (optional)
              <input type="date" {...register("activeTo")} />
            </label>
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
          Time label
          <input {...register("timeLabel")} placeholder="6:00 PM, TBA, Kickoff TBA…" />
          {errors.timeLabel && <small className="form-error">{errors.timeLabel.message}</small>}
        </label>
        <label>
          Duration (hours, optional)
          <input type="number" min={0} step="0.5" {...register("durationHours", { valueAsNumber: true })} />
        </label>
        <label>
          Coverage needed
          <select {...register("coverageNeeded")}>
            <option value="none">None</option>
            <option value="rover">Rover</option>
            <option value="full-day">Full day</option>
          </select>
        </label>
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
