import { Activity, Check, ChevronDown, ChevronRight, Droplet, Dumbbell, GlassWater, GraduationCap, Lock, Play, Plus, Trophy, Unlock, Utensils, X } from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";
import { useSession } from "./auth";
import { useNavigation } from "./navigation";
import { makeId, useStore } from "./store";
import {
  ChecklistItemValue,
  Dog,
  DogFormation,
  FeedbackType,
  Item,
  ItemDeletionScope,
  ItemLog,
  ItemOccurrence,
  LogFieldValue,
  Milestone,
  Person,
  QuickLogKind,
  QuickLogResult,
} from "./types";
import { MilestonePicker } from "./milestonePicker";
import { formatInZone, isoToZonedParts, searchTimezones, zonedTimeToUtcIso, zoneLabel } from "./timezones";

import {
  ALONE_TIME_TRAINING_ID,
  buildDefaultChecklist,
  emptyLogValues,
  formatMinutes,
  groupChecklistByDog,
  itemDurationMinutes,
  itemStateLabels,
  milestoneProgress,
  milestoneStatusFor,
  stepSessions,
  QUICK_LOG_SPECS,
  quickLogFieldVisible,
  quickLogKindForCategory,
  quickLogKindsForCategory,
  summarizeQuickLog,
  quickLogSpec,
  scheduledSlotCandidates,
  resolveChecklistDefs,
  isHealthItem,
  resolveDependencies,
  to12Hour,
} from "./utils";

export function TimezonePicker({ value, onChange }: { value: string; onChange: (zoneId: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = searchTimezones(query);
  return (
    <div className="timezone-picker">
      <button type="button" className="text-button" onClick={() => setOpen((prev) => !prev)}>
        {zoneLabel(value)}
      </button>
      {open && (
        <div className="timezone-picker-panel">
          <input
            autoFocus
            placeholder="Search city or zone (e.g. Denver, Eastern)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="timezone-picker-list">
            {matches.map((tz) => (
              <button
                key={tz.id}
                type="button"
                className={tz.id === value ? "active" : ""}
                onClick={() => {
                  onChange(tz.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {tz.label} ({tz.abbreviation}) — {tz.cities.slice(0, 2).join(", ")}
              </button>
            ))}
            {matches.length === 0 && <p className="small">No match. Only the four US zones are supported for now.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export const formationLabels: Record<DogFormation, string> = {
  together: "Together",
  "parallel-buffered": "Parallel — dog, human, human, dog",
  "separate-rooms": "Separate rooms",
  "separate-locations": "Separate locations",
  solo: "Solo (other dog managed elsewhere)",
};

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between modal-head">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const FEEDBACK_TYPES: { id: FeedbackType; label: string }[] = [
  { id: "quick-fix", label: "Quick fix" },
  { id: "feature", label: "Feature" },
  { id: "comment", label: "Comment" },
  { id: "question", label: "Question" },
];

export function FeedbackWizard({ page, onClose }: { page: string; onClose: () => void }) {
  const store = useStore();
  const { session } = useSession();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("comment");
  const [locationNote, setLocationNote] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const authorEmail = session?.user?.email ?? "";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(false);
    const ok = await store.productFeedback.add({
      id: makeId("feedback"),
      page,
      feedbackType,
      authorEmail,
      locationNote: locationNote.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    });
    setSubmitting(false);
    if (ok) {
      setSubmitted(true);
    } else {
      setError(true);
    }
  }

  if (submitted) {
    return (
      <Modal title="Feedback sent" onClose={onClose}>
        <p className="form-success">Thanks — that's been logged and synced.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Send feedback" onClose={onClose}>
      <form className="entity-form" onSubmit={handleSubmit}>
        <p className="small">
          From {authorEmail || "this device"} · {page}
        </p>
        <div className="subtabs" role="group" aria-label="Feedback type">
          {FEEDBACK_TYPES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={feedbackType === option.id ? "active" : ""}
              onClick={() => setFeedbackType(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label>
          Section or specific place on the page (optional)
          <input
            value={locationNote}
            onChange={(event) => setLocationNote(event.target.value)}
            placeholder="e.g. Dashboard, task checklist"
          />
        </label>
        <label>
          What's on your mind?
          <textarea
            required
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe the issue, idea, or question…"
          />
        </label>
        {error && (
          <p className="form-error">
            That didn't save — the server rejected it (check the browser console for details). Your message is still
            here; try again in a moment.
          </p>
        )}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </Modal>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="bar" aria-label={`${value}%`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function AppMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <div className="metric">
      <Icon size={18} aria-hidden />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PersonName({ id }: { id: string }) {
  const { people } = useStore();
  const person = people.items.find((item) => item.id === id);
  return <span style={{ color: person?.color }}>{person?.name ?? id}</span>;
}

function dogsInvolvedLabel(dogIds: string[], allDogs: Dog[]): string {
  if (dogIds.length === 0) return "—";
  if (allDogs.length > 1 && dogIds.length === allDogs.length) return "Both";
  return dogIds
    .map((id) => {
      const dog = allDogs.find((item) => item.id === id);
      if (!dog) return id;
      return dog.status === "puppy" ? "Puppy" : dog.name;
    })
    .join(", ");
}

/** Real names, always. `dogsInvolvedLabel` says "Puppy" by design (Andrew's call, so
 * the label survives the puppy being renamed), which is fine for a meta line but wrong
 * when the whole point is *which dog* still needs taking out — and it would read as a
 * different dog from the "Mara" in the log row directly above it. */
function dogNamesLabel(dogIds: string[], allDogs: Dog[]): string {
  return dogIds.map((id) => allDogs.find((dog) => dog.id === id)?.name ?? id).join(" & ");
}

export function TaskCard({
  task,
  occurrence,
  logs = [],
  dogs,
  onComplete,
  onDelete,
  onOpenDetail,
  onQuickLog,
}: {
  task: Item;
  /** This item's state for the day being shown. Replaces the old `feedback` prop,
   * which carried no date and so reported an item as done forever after one tap. */
  occurrence?: ItemOccurrence;
  /** What's been logged against this slot today. A slot with logs but no completion is
   * the partial-coverage case — one dog recorded, the other still expected. */
  logs?: ItemLog[];
  dogs: Dog[];
  onComplete: (task: Item, rating: number) => Promise<boolean> | boolean | void;
  onDelete?: (task: Item) => void;
  onOpenDetail?: (task: Item) => void;
  /** Opens the Quick log for this item. Only offered for categories Quick log already
   * captures properly — a potty break, a meal, a training rep. Sits alongside the score
   * rather than replacing it, because right now a log and a completion are still two
   * separate records; that collapses into one once a log can satisfy the slot. */
  onQuickLog?: (task: Item) => void;
}) {
  const quickLogKind = quickLogKindForCategory(task.category);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isDone = occurrence?.state === "completed";
  const collapsed = isDone && !expanded;
  // Which of this item's dogs still have nothing logged. Non-empty while some but not
  // all are covered — the state that keeps the slot deliberately open rather than
  // claiming a dog went out on another dog's evidence.
  const loggedDogs = new Set(logs.flatMap((log) => log.dogIds));
  const awaitingDogs = isDone ? [] : (task.dogIds ?? []).filter((id) => !loggedDogs.has(id));
  const partiallyLogged = logs.length > 0 && awaitingDogs.length > 0;

  function toggleItem(item: string) {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  }

  async function handleRate(rating: number) {
    setFailed(false);
    const ok = await onComplete(task, rating);
    if (ok === false) setFailed(true);
  }

  return (
    <article className={`task-card ${isDone ? "is-done" : ""} ${collapsed ? "is-collapsed" : ""}`}>
      <div className="task-time">{task.startTime ?? "—"}</div>
      <div className="task-main">
        <div className="row between">
          <div>
            <p className="eyebrow">{task.category}</p>
            <h3>{task.title}</h3>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {isDone && occurrence?.rating && (
              <strong className="task-collapsed-rating">
                <Check size={14} aria-hidden /> {occurrence.rating}/5
              </strong>
            )}
            {!collapsed && <span className={`priority ${task.priority}`}>{task.priority}</span>}
            {isDone && (
              <button className="text-button" type="button" onClick={() => setExpanded((prev) => !prev)}>
                {collapsed ? "Details" : "Collapse"}
              </button>
            )}
            {!collapsed && onOpenDetail && (
              <button className="text-button" type="button" onClick={() => onOpenDetail(task)}>
                Manage
              </button>
            )}
            {!collapsed && onDelete && (
              <button className="text-button" type="button" onClick={() => onDelete(task)} aria-label={`Delete ${task.title}`}>
                Remove
              </button>
            )}
          </div>
        </div>
        {logs.length > 0 && (
          <ul className="task-card-logs">
            {logs.map((log) => (
              <li key={log.id}>
                {summarizeQuickLog(log) || "Logged"}
                {log.dogIds.length > 0 && ` — ${dogNamesLabel(log.dogIds, dogs)}`}
                {log.rating ? ` · ${log.rating}/5` : ""}
              </li>
            ))}
          </ul>
        )}
        {partiallyLogged && (
          <p className="small task-card-awaiting">Still expected: {dogNamesLabel(awaitingDogs, dogs)}</p>
        )}
        {!collapsed && (
          <>
            <p>{task.notes}</p>
            <div className="task-meta">
              <span>{itemDurationMinutes(task)} min</span>
              <span>{task.setting}</span>
              <span>Dogs: {dogsInvolvedLabel(task.dogIds ?? [], dogs)}</span>
              {task.assignedTo && (
                <span>
                  <PersonName id={task.assignedTo} />
                </span>
              )}
            </div>
            <div className="checklist">
              {task.checklist.map((item) => (
                <label key={item.itemName} className={checked[item.itemName] ? "checked" : ""}>
                  <input type="checkbox" checked={!!checked[item.itemName]} onChange={() => toggleItem(item.itemName)} />
                  {item.itemName}
                </label>
              ))}
            </div>
            <div className="rating-label">
              <span>{isDone ? "Logged — how did it go?" : "How did it go?"}</span>
              {isDone && occurrence?.rating && (
                <strong>
                  <Check size={14} aria-hidden /> Rated {occurrence.rating}/5
                </strong>
              )}
            </div>
            {failed && <p className="form-error">That didn't save — check the browser console and try again.</p>}
            <div className="rating-row" aria-label={`Complete ${task.title}`}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={occurrence?.rating === rating ? "selected" : ""}
                  aria-pressed={occurrence?.rating === rating}
                  onClick={() => handleRate(rating)}
                >
                  {rating}
                </button>
              ))}
            </div>
            {quickLogKind && onQuickLog && (
              <button className="text-button" type="button" onClick={() => onQuickLog(task)}>
                <Plus size={14} aria-hidden /> Log {quickLogSpec(quickLogKind).label.toLowerCase()} details
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

/** One checklist row at completion time: its value, its own notes, and its own 1-5
 * score. Per-row scoring is Andrew's call (2026-07-25) — a session can go fine
 * overall while one specific step went badly, and only per-row scores make that
 * visible to the weekly ingest pass. The item still gets an overall score too. */
function ChecklistItemEditor({ item, onChange }: { item: ChecklistItemValue; onChange: (next: ChecklistItemValue) => void }) {
  return (
    <div className="checklist-item-editor">
      <div className="row between">
        <strong>{item.itemName}</strong>
        {item.dataType === "boolean" && (
          <input type="checkbox" checked={!!item.value} onChange={(event) => onChange({ ...item, value: event.target.checked })} />
        )}
        {(item.dataType === "counter" || item.dataType === "duration_minutes") && (
          <input
            type="number"
            min={0}
            value={typeof item.value === "number" ? item.value : 0}
            onChange={(event) => onChange({ ...item, value: Number(event.target.value) })}
            style={{ width: 70 }}
          />
        )}
      </div>
      {item.dataType === "free_text" ? (
        <textarea
          rows={2}
          value={typeof item.value === "string" ? item.value : ""}
          onChange={(event) => onChange({ ...item, value: event.target.value })}
          placeholder="Notes…"
        />
      ) : (
        <input
          className="checklist-item-note"
          placeholder="Commentary (optional)"
          value={item.notes}
          onChange={(event) => onChange({ ...item, notes: event.target.value })}
        />
      )}
      <div className="rating-row compact" aria-label={`How did "${item.itemName}" go?`}>
        <span className="small">How did it go?</span>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            className={item.rating === rating ? "selected" : ""}
            onClick={() => onChange({ ...item, rating: item.rating === rating ? undefined : rating })}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Free-text plus whatever structured fields the item declares. Both are optional —
 * a log entry with only text is still useful to the ingest pass, and forcing every
 * numeric field would just train people to type zeros. */
function LogEntryPanel({
  item,
  occurrenceDate,
  onClose,
}: {
  item: Item;
  occurrenceDate?: string;
  onClose: () => void;
}) {
  const { addItemLog, logsForItem, people } = useStore();
  const [text, setText] = useState("");
  const [values, setValues] = useState<LogFieldValue[]>(() => emptyLogValues(item.logFields));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const existing = logsForItem(item.id, occurrenceDate);

  async function save() {
    if (submitting) return;
    if (!text.trim() && values.every((value) => value.value === null || value.value === "")) {
      setError(true);
      return;
    }
    setSubmitting(true);
    setError(false);
    const ok = await addItemLog({
      itemId: item.id,
      occurrenceDate,
      loggedBy: people.items[0]?.id ?? "",
      text: text.trim(),
      values: values.filter((value) => value.value !== null && value.value !== ""),
      dogIds: item.dogIds ?? [],
    });
    if (!ok) setError(true);
    else {
      setText("");
      setValues(emptyLogValues(item.logFields));
      onClose();
    }
    setSubmitting(false);
  }

  return (
    <div className="log-panel">
      <p className="eyebrow">Log an entry</p>
      {item.logFields.length > 0 && (
        <div className="form-grid">
          {item.logFields.map((field, index) => (
            <label key={field.fieldName}>
              {field.fieldName}
              {field.unit ? ` (${field.unit})` : ""}
              <input
                type={field.dataType === "number" ? "number" : field.dataType === "date" ? "date" : "text"}
                step="any"
                value={values[index]?.value ?? ""}
                onChange={(event) =>
                  setValues((prev) =>
                    prev.map((entry, i) =>
                      i === index
                        ? { ...entry, value: field.dataType === "number" ? Number(event.target.value) : event.target.value }
                        : entry,
                    ),
                  )
                }
              />
            </label>
          ))}
        </div>
      )}
      <label>
        Notes
        <textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder="What happened?" />
      </label>
      {error && <p className="form-error">Add a note or at least one value before saving.</p>}
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button className="primary-button" type="button" onClick={save} disabled={submitting}>
          {submitting ? "Saving…" : "Save log"}
        </button>
      </div>
      {existing.length > 0 && (
        <div className="log-history">
          <p className="eyebrow">Previous entries</p>
          {existing.map((log) => (
            <article key={log.id} className="log-entry">
              <p className="small">{new Date(log.loggedAt).toLocaleString()}</p>
              {log.values.length > 0 && (
                <p className="small">
                  {log.values.map((value) => `${value.fieldName}: ${value.value}${value.unit ? ` ${value.unit}` : ""}`).join(" · ")}
                </p>
              )}
              {log.text && <p>{log.text}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const ALONE_TIME_PINNED_OPTION = { id: ALONE_TIME_TRAINING_ID, label: "Alone time" };

/** Picks the training type for a Quick log — a thin wrapper around the shared
 * [[MilestonePicker]] that adds "Alone time" as a pinned option alongside the
 * grouped milestones, since alone time is loggable the same way but isn't a
 * milestone. See milestonePicker.tsx for the picker itself. */
function TrainingTypePicker({
  milestones,
  dogIds,
  dogs,
  value,
  onChange,
}: {
  milestones: Milestone[];
  /** Whose progress to show next to each training type. */
  dogIds: string[];
  dogs: Dog[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <MilestonePicker
      milestones={milestones}
      dogIds={dogIds}
      dogs={dogs}
      value={value}
      onChange={onChange}
      pinnedOptions={[ALONE_TIME_PINNED_OPTION]}
      emptyLabel="No training type picked"
    />
  );
}

/** Icon per Quick log kind. Also used by the Dashboard's Log feed so an entry reads
 * the same in both places. */
export const QUICK_LOG_ICONS: Record<QuickLogKind, typeof Droplet> = {
  potty: Droplet,
  play: Dumbbell,
  training: GraduationCap,
  food: Utensils,
  water: GlassWater,
};

/** The Dashboard's Quick log. Every kind follows the same four beats — pick the one
 * predetermined selection, fill the sub-fields it reveals, score it 1-5, add a note —
 * so the flow is muscle memory regardless of what you're recording.
 *
 * Training is the one kind whose primary selection is live data rather than a fixed
 * list: you pick a milestone, tick the steps you actually worked through, and each tick
 * advances that step's session count. That's the "logging the session *is* the training
 * progress" rule from the unified-item work, reached from the Dashboard instead of
 * requiring a scheduled calendar item to exist first. */
export function QuickLogForm({
  date,
  initialKind = "potty",
  initialTrainingType,
  initialDogIds,
  attachTo,
  editingLog,
  onClose,
}: {
  date: string;
  /** Which of the five to open on. Lets a tally chip or the alone-time readiness
   * panel jump straight to the right kind instead of making you re-pick. */
  initialKind?: QuickLogKind;
  initialTrainingType?: string;
  /** Pre-selects which dog(s) the entry is for. Set when arriving from a per-dog
   * recommendation, where the dog is already unambiguous. */
  initialDogIds?: string[];
  /** Present = this entry is being recorded against a scheduled item, so the kind is
   * already decided by that item's category and the strip would only offer ways to
   * contradict it. Purely presentational for now; the stored link lands with the
   * schema change. */
  attachTo?: { itemId: string; occurrenceDate: string; itemTitle: string };
  /** Present = editing this entry instead of creating a new one. Kind and (for
   * training) which milestone it's against are fixed once an entry exists — those
   * aren't mistakes an edit fixes, they're what delete-and-relog is for. Everything
   * else (dogs, sub-fields, ticked steps, rating, notes) stays editable. */
  editingLog?: ItemLog;
  onClose: () => void;
}) {
  const { dogs, milestones, items, itemOccurrences, addQuickLog, editQuickLog } = useStore();
  const { timezone } = useNavigation();
  const [kind, setKind] = useState<QuickLogKind>(editingLog?.quickLogKind ?? initialKind);
  const [dogIds, setDogIds] = useState<string[]>(() => editingLog?.dogIds ?? initialDogIds ?? []);
  const [selections, setSelections] = useState<Record<string, string | number | null>>(() =>
    editingLog
      ? Object.fromEntries(editingLog.values.filter((value) => value.fieldName !== "Training type").map((value) => [value.fieldName, value.value]))
      : {},
  );
  const [trainingType, setTrainingType] = useState(() => {
    if (!editingLog) return initialTrainingType ?? "";
    if (editingLog.milestoneId) return editingLog.milestoneId;
    const isAlone = editingLog.values.some((value) => value.fieldName === "Training type" && value.value === "Alone time");
    return isAlone ? ALONE_TIME_TRAINING_ID : "";
  });
  const [stepTitles, setStepTitles] = useState<string[]>(() => editingLog?.advancedStepTitles ?? []);
  const [rating, setRating] = useState<number | undefined>(editingLog?.rating);
  const [notes, setNotes] = useState(editingLog?.text ?? "");
  // When it actually happened, defaulted to now. Separate from when the row gets
  // written: you log the 7:18 break when you get back inside, or at 9pm catching up.
  const [happenedClock, setHappenedClock] = useState(() =>
    isoToZonedParts(editingLog?.happenedAt ?? editingLog?.loggedAt ?? new Date().toISOString(), timezone).time,
  );
  // Which scheduled slot this entry says happened. `undefined` = not answered yet,
  // `null` = explicitly unscheduled. Never inferred silently: the app proposes and the
  // person confirms, because with breaks every couple of hours something is always
  // "nearest" and being confidently wrong is worse than asking.
  const [slotChoice, setSlotChoice] = useState<string | null | undefined>(editingLog?.itemId ?? undefined);
  const [changingSlot, setChangingSlot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuickLogResult | null>(null);

  const spec = quickLogSpec(kind);
  const isAloneTime = trainingType === ALONE_TIME_TRAINING_ID;
  const selectedMilestone = milestones.items.find((entry) => entry.id === trainingType);

  // Only milestones that involve a selected dog — picking Mara shouldn't make you
  // scroll past work that's only Griz's. Milestones with no dogs listed apply to the
  // household and always show. Before a dog is picked nothing is narrowed, since an
  // empty list would look broken rather than like a prompt to choose a dog.
  const relevantMilestones =
    dogIds.length === 0
      ? milestones.items
      : milestones.items.filter((entry) => entry.dogIds.length === 0 || entry.dogIds.some((id) => dogIds.includes(id)));

  function resetKind(next: QuickLogKind) {
    setKind(next);
    setSelections({});
    setTrainingType("");
    setStepTitles([]);
    setRating(undefined);
    setError("");
  }

  function resetAll() {
    setSelections({});
    setTrainingType(initialTrainingType ?? "");
    setStepTitles([]);
    setRating(undefined);
    setNotes("");
    setError("");
    setResult(null);
  }

  function toggleDog(id: string) {
    setDogIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  }

  function setField(name: string, value: string | number | null) {
    setSelections((prev) => ({ ...prev, [name]: prev[name] === value ? null : value }));
  }

  const visibleFields = spec.fields.filter((field) => quickLogFieldVisible(field, selections));

  // The attached item's category may cover more than one kind (a meal is a candidate
  // for both Food and Water) — when it does, the kind strip stays live instead of
  // collapsing to a locked label, restricted to just those kinds.
  const attachedItem = attachTo ? items.items.find((entry) => entry.id === attachTo.itemId) : undefined;
  const attachedKinds = attachedItem ? quickLogKindsForCategory(attachedItem.category) : [];

  // Arriving from an item already decides the slot, so there's nothing to ask about.
  const [clockHours, clockMinutes] = happenedClock.split(":").map(Number);
  const candidates = attachTo
    ? []
    : scheduledSlotCandidates(
        kind,
        date,
        (clockHours || 0) * 60 + (clockMinutes || 0),
        dogIds,
        items.items,
        itemOccurrences.items,
      );
  const chosenSlot = slotChoice ? (candidates.find((entry) => entry.item.id === slotChoice) ?? null) : null;
  const chosenSlotTitle = chosenSlot?.item.title ?? (slotChoice ? items.items.find((item) => item.id === slotChoice)?.title : undefined);
  const slotAnswered = slotChoice !== undefined;

  async function submit() {
    if (submitting) return;
    if (dogIds.length === 0) return setError("Pick at least one dog.");
    if (kind === "training" && !trainingType) return setError("Pick what you worked on.");
    if (kind !== "training" && !selections[spec.primary.name]) return setError(`Answer "${spec.primary.label}" first.`);
    if (isAloneTime && !selections.Duration) return setError("Enter how long they were alone.");
    if (!rating) return setError("Give it a 1-5 score.");

    setSubmitting(true);
    setError("");

    // The primary selection for training is the milestone itself, which has no entry
    // in the spec's option list — write it in by title so the log stays readable
    // without a join.
    const values: LogFieldValue[] = [];
    if (kind === "training") {
      values.push({
        fieldName: "Training type",
        dataType: "text",
        value: isAloneTime ? "Alone time" : (selectedMilestone?.title ?? trainingType),
      });
    }
    [spec.primary, ...visibleFields].forEach((field) => {
      if (kind === "training" && field === spec.primary) return;
      const value = selections[field.name];
      if (value === null || value === undefined || value === "") return;
      values.push({ fieldName: field.name, dataType: field.input === "number" ? "number" : "text", unit: field.unit, value });
    });

    const input = {
      kind,
      date,
      // Arriving from an item decides the slot outright; otherwise it's whatever was
      // confirmed below, and an unanswered prompt means unscheduled — the safe reading,
      // since the expectation stays open and can be attached from the timeline later.
      itemId: attachTo?.itemId ?? slotChoice ?? undefined,
      occurrenceDate: attachTo?.occurrenceDate ?? chosenSlot?.occurrenceDate ?? (slotChoice ? editingLog?.occurrenceDate : undefined),
      happenedAt: zonedTimeToUtcIso(date, happenedClock, timezone),
      dogIds,
      values,
      rating,
      notes: notes.trim(),
      milestoneId: kind === "training" && !isAloneTime ? trainingType : undefined,
      completedStepTitles: kind === "training" && !isAloneTime ? stepTitles : [],
      aloneTimeMinutes: isAloneTime ? Number(selections.Duration) : undefined,
    };

    // Editing closes straight back to the feed rather than showing the "logged"
    // summary screen — that screen exists to celebrate a new session (progress,
    // unlocks, what's next), which is the wrong tone for "I fixed a typo in the notes".
    if (editingLog) {
      const outcome = await editQuickLog(editingLog.id, input);
      setSubmitting(false);
      if (!outcome) return setError("Couldn't save that. Try again.");
      onClose();
      return;
    }

    const outcome = await addQuickLog(input);
    setSubmitting(false);
    if (!outcome) return setError("Couldn't save that. Try again.");
    setResult(outcome);
  }

  if (result) {
    // One block per dog: progress is per-dog now, so a session logged for both dogs
    // genuinely has two different outcomes to report. The dog's name is only shown
    // when there's more than one — a single-dog session reads better without it.
    const showDogNames = result.perDog.length > 1;
    return (
      <div className="quick-log-result">
        <p className="quick-log-result-headline">
          <Check size={18} aria-hidden /> Logged.
        </p>
        {result.perDog.map((entry) => {
          const dogName = dogs.items.find((dog) => dog.id === entry.dogId)?.name ?? "";
          return (
            <div className="quick-log-dog-result" key={entry.dogId}>
              {showDogNames && <p className="eyebrow">{dogName}</p>}
              {entry.milestone && (
                <div className="quick-log-progress">
                  <div className="row between">
                    <strong>{entry.milestone.title}</strong>
                    <span className="small">{entry.milestone.progress}%</span>
                  </div>
                  <ProgressBar value={entry.milestone.progress} />
                  <ul className="quick-log-step-progress">
                    {entry.milestone.advancedSteps.map((step) => (
                      <li key={step.title}>
                        {step.title} — <strong>{step.completedSessions}/{step.sessionsRequired}</strong> sessions
                        {step.completedSessions >= step.sessionsRequired && " ✓"}
                      </li>
                    ))}
                  </ul>
                  {entry.milestone.completed && (
                    <p className="quick-log-unlock">
                      <Trophy size={16} aria-hidden /> Milestone complete{showDogNames ? ` for ${dogName}` : ""}.
                    </p>
                  )}
                </div>
              )}
              {entry.unlocked.length > 0 && (
                <p className="quick-log-unlock">
                  <Unlock size={16} aria-hidden /> Unlocked: {entry.unlocked.map((item) => item.title).join(", ")}
                </p>
              )}
              {entry.nextFocus && (
                <div className="quick-log-next">
                  <div>
                    <p className="eyebrow">{showDogNames ? `Next for ${dogName}` : "Work on next"}</p>
                    <strong>{entry.nextFocus.stepTitle}</strong>
                    <p className="small">
                      {entry.nextFocus.milestoneTitle} · {entry.nextFocus.completedSessions}/{entry.nextFocus.sessionsRequired} sessions
                    </p>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      // Straight into logging the thing it just recommended, rather than
                      // making you re-pick the milestone you were literally just told
                      // about — and scoped to this dog, since that's whose next step it is.
                      setResult(null);
                      setKind("training");
                      setTrainingType(entry.nextFocus!.milestoneId);
                      setDogIds([entry.dogId]);
                      setStepTitles([]);
                      setSelections({});
                      setRating(undefined);
                      setNotes("");
                    }}
                  >
                    Log it
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div className="form-actions">
          <button className="text-button" type="button" onClick={resetAll}>
            Log another
          </button>
          <button className="primary-button" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const Icon = QUICK_LOG_ICONS[kind];

  return (
    <div className="quick-log-form">
      {editingLog ? (
        <p className="eyebrow quick-log-editing-label">
          <Icon size={16} aria-hidden /> Editing this {spec.label.toLowerCase()} entry
        </p>
      ) : attachTo && attachedKinds.length > 1 ? (
        // A meal's Log button opens here defaulted to Food (its primary kind), but the
        // slot itself is a candidate for more than one kind — so unlike a single-kind
        // attachment, the kind choice stays live rather than collapsing to a locked
        // label. `.subtabs` (the same pattern the dog toggles below use), not the
        // 5-column `.quick-log-kinds` grid — that one's sized for exactly 5 buttons and
        // would leave empty columns here. Switching still clears sub-fields via the
        // existing `resetKind`.
        <div>
          <p className="eyebrow quick-log-editing-label">
            <Icon size={16} aria-hidden /> {attachTo.itemTitle}
          </p>
          <div className="subtabs" role="group" aria-label="What are you logging?">
            {QUICK_LOG_SPECS.filter((entry) => attachedKinds.includes(entry.kind)).map((entry) => {
              const KindIcon = QUICK_LOG_ICONS[entry.kind];
              return (
                <button
                  key={entry.kind}
                  type="button"
                  className={kind === entry.kind ? "active" : ""}
                  onClick={() => resetKind(entry.kind)}
                >
                  <span className="row" style={{ gap: 6 }}>
                    <KindIcon size={14} aria-hidden /> {entry.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : attachTo ? (
        <p className="eyebrow quick-log-editing-label">
          <Icon size={16} aria-hidden /> {attachTo.itemTitle}
        </p>
      ) : (
        <div className="quick-log-kinds" role="tablist" aria-label="What are you logging?">
          {QUICK_LOG_SPECS.map((entry) => {
            const KindIcon = QUICK_LOG_ICONS[entry.kind];
            return (
              <button
                key={entry.kind}
                type="button"
                role="tab"
                aria-selected={kind === entry.kind}
                className={kind === entry.kind ? "active" : ""}
                onClick={() => resetKind(entry.kind)}
              >
                <KindIcon size={18} aria-hidden />
                {entry.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="form-field">
        Which dog(s)?
        <div className="subtabs" role="group" aria-label="Dogs">
          {dogs.items.map((dog) => (
            <button key={dog.id} type="button" className={dogIds.includes(dog.id) ? "active" : ""} onClick={() => toggleDog(dog.id)}>
              {dog.name}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        When did it happen?
        <input
          className="quick-log-time"
          type="time"
          value={happenedClock}
          onChange={(event) => setHappenedClock(event.target.value)}
          aria-label="When did it happen?"
        />
      </div>

      {kind === "training" ? (
        <>
          {editingLog ? (
            // Which milestone this counts toward isn't editable — that's what
            // delete-and-relog is for. Only which of its steps got ticked, plus the
            // shared fields below, can change.
            <div className="form-field">
              {spec.primary.label}
              <p className="quick-log-locked-value">{isAloneTime ? "Alone time" : (selectedMilestone?.title ?? trainingType)}</p>
            </div>
          ) : (
            <div className="form-field">
              {spec.primary.label}
              <TrainingTypePicker
                milestones={relevantMilestones}
                dogIds={dogIds}
                dogs={dogs.items}
                value={trainingType}
                onChange={(id) => {
                  setTrainingType(id);
                  setStepTitles([]);
                }}
              />
            </div>
          )}
          {selectedMilestone && (
            <div className="form-field">
              Which steps did you work through?
              <p className="small">Each one you tick counts a session toward that step, for each dog selected above.</p>
              <div className="quick-log-steps">
                {selectedMilestone.steps.map((step) => (
                  <label key={step.title} className="quick-log-step">
                    <input
                      type="checkbox"
                      checked={stepTitles.includes(step.title)}
                      onChange={() =>
                        setStepTitles((prev) =>
                          prev.includes(step.title) ? prev.filter((entry) => entry !== step.title) : [...prev, step.title],
                        )
                      }
                    />
                    <span>
                      <strong>{step.title}</strong>
                      <small>
                        {/* Counts are per dog, so show each selected dog's own tally rather
                            than one number that would be true for neither of them. */}
                        {(dogIds.length > 0 ? dogIds : selectedMilestone.dogIds)
                          .map((dogId) => {
                            const name = dogs.items.find((dog) => dog.id === dogId)?.name ?? "";
                            return `${name} ${stepSessions(step, dogId)}/${step.sessionsRequired}`;
                          })
                          .join(" · ")}
                      </small>
                      <small>{step.successCriteria}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="form-field">
          {spec.primary.label}
          <div className="subtabs" role="group" aria-label={spec.primary.label}>
            {spec.primary.options?.map((option) => (
              <button
                key={option.value}
                type="button"
                className={selections[spec.primary.name] === option.value ? "active" : ""}
                onClick={() => setField(spec.primary.name, option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {visibleFields.map((field) =>
        field.input === "choice" ? (
          <div className="form-field" key={field.name}>
            {field.label}
            <div className="subtabs" role="group" aria-label={field.label}>
              {field.options?.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={selections[field.name] === option.value ? "active" : ""}
                  onClick={() => setField(field.name, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="form-field" key={field.name}>
            {field.label}
            {field.unit ? ` (${field.unit})` : ""}
            <div className="quick-log-number">
              {field.presets?.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={selections[field.name] === preset ? "active" : ""}
                  onClick={() => setField(field.name, preset)}
                >
                  {preset}
                </button>
              ))}
              <input
                type="number"
                min={0}
                step="any"
                placeholder={field.unit ?? "Amount"}
                value={typeof selections[field.name] === "number" ? String(selections[field.name]) : ""}
                onChange={(event) =>
                  setSelections((prev) => ({ ...prev, [field.name]: event.target.value === "" ? null : Number(event.target.value) }))
                }
              />
            </div>
          </div>
        ),
      )}

      <div className="form-field">
        {spec.ratingLabel}
        <div className="rating-row" aria-label={spec.ratingLabel}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={rating === value ? "selected" : ""}
              aria-pressed={rating === value}
              onClick={() => setRating(rating === value ? undefined : value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        Notes
        <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={spec.notesPlaceholder} />
      </div>

      {/* Propose, then ask. Sits inline right above Save so it reads as the last thing
          to confirm, never as a modal you have to clear before you can carry on — and
          leaving it alone is a valid answer (see `itemId` in submit). */}
      {!attachTo && (candidates.length > 0 || slotAnswered) && (
        <div className="quick-log-slot">
          {slotAnswered && !changingSlot ? (
            <div className="row between">
              <p className="small">
                {slotChoice && chosenSlotTitle ? (
                  <>
                    Counts as <strong>{chosenSlotTitle}</strong>
                    {chosenSlot?.timeLabel ? ` (${chosenSlot.timeLabel})` : ""}.
                  </>
                ) : (
                  "Logging this on its own — nothing scheduled."
                )}
              </p>
              {candidates.length > 0 && (
                <button className="text-button" type="button" onClick={() => setChangingSlot(true)}>
                  Change
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="small">
                {candidates.length === 1 ? (
                  <>
                    Looks like this is <strong>{candidates[0].item.title}</strong>
                    {candidates[0].timeLabel ? ` (${candidates[0].timeLabel})` : ""}, which hasn't been completed yet. Is it?
                  </>
                ) : (
                  `Is this one of these scheduled ${spec.label.toLowerCase()} items?`
                )}
              </p>
              <div className="subtabs" role="group" aria-label="Which scheduled item is this?">
                {candidates.map((entry) => (
                  <button
                    key={entry.item.id}
                    type="button"
                    className={slotChoice === entry.item.id ? "active" : ""}
                    onClick={() => {
                      setSlotChoice(entry.item.id);
                      setChangingSlot(false);
                    }}
                  >
                    {candidates.length === 1 ? "Yes" : entry.timeLabel ? `${entry.item.title} · ${entry.timeLabel}` : entry.item.title}
                  </button>
                ))}
                <button
                  type="button"
                  className={slotChoice === null ? "active" : ""}
                  onClick={() => {
                    setSlotChoice(null);
                    setChangingSlot(false);
                  }}
                >
                  No, log separately
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button className="primary-button" type="button" onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : editingLog ? "Save changes" : `Log ${spec.label.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}

export function ItemDetailModal({
  task,
  date,
  onClose,
  onEdit,
}: {
  task: Item;
  date: string;
  onClose: () => void;
  /** Opens the item's edit form. Without this the detail modal is a dead end — you
   * can run the item but never change what it is. */
  onEdit?: (item: Item) => void;
}) {
  const { dogs, milestones, locations, people, getInstance, startTask, endTask, reopenTask, unstartTask, rescheduleTask, skipTask, delegateTask, deleteItem } = useStore();
  const { navigate, timezone } = useNavigation();
  const [activePanel, setActivePanel] = useState<null | "start" | "end" | "reopen" | "unstart" | "reschedule" | "skip" | "delegate" | "log">(null);
  const [error, setError] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const instance = getInstance(task.id, date);
  const state = instance?.state ?? "not_started";
  // Guards every lifecycle confirm below against a slow network response +
  // an impatient re-tap creating a duplicate task_instance for the same slot.
  const [submitting, setSubmitting] = useState(false);

  const involvedDogs = dogs.items.filter((dog) => (task.dogIds ?? []).includes(dog.id));
  const dogName = (id: string) => dogs.items.find((dog) => dog.id === id)?.name ?? id;
  const location = locations.find((loc) => loc.id === task.location);
  const relatedMilestone = task.relatedMilestoneId ? milestones.items.find((item) => item.id === task.relatedMilestoneId) : undefined;
  // Set = this item is one of the five things Quick log already captures properly, so
  // it gets that form instead of the generic text-and-fields panel.
  const quickLogKind = quickLogKindForCategory(task.category);

  const [startManual, setStartManual] = useState(false);
  const [startDate, setStartDate] = useState(date);
  const [startClock, setStartClock] = useState("12:00");
  const [startZone, setStartZone] = useState(timezone);

  function openStart() {
    setError(false);
    setActivePanel("start");
    setStartManual(false);
    setStartDate(date);
    setStartClock(new Date().toTimeString().slice(0, 5));
    setStartZone(timezone);
  }

  async function confirmStartNow() {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    const ok = await startTask(task, date, new Date().toISOString(), timezone);
    if (!ok) setError(true);
    else setActivePanel(null);
    setSubmitting(false);
  }

  async function confirmStartManual() {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    const iso = zonedTimeToUtcIso(startDate, startClock, startZone);
    const ok = await startTask(task, date, iso, startZone);
    if (!ok) setError(true);
    else setActivePanel(null);
    setSubmitting(false);
  }

  const [endManual, setEndManual] = useState(false);
  const [endDate, setEndDate] = useState(date);
  const [endClock, setEndClock] = useState("12:00");
  const [endZone, setEndZone] = useState(timezone);
  const [checklistDraft, setChecklistDraft] = useState<ChecklistItemValue[]>([]);
  const [ratingDraft, setRatingDraft] = useState<number | undefined>(undefined);
  const [ratingNotesDraft, setRatingNotesDraft] = useState("");

  function openEnd() {
    setError(false);
    setActivePanel("end");
    setEndManual(false);
    setEndDate(date);
    setEndClock(new Date().toTimeString().slice(0, 5));
    setEndZone(instance?.startTimeZone ?? timezone);
    setChecklistDraft(
      instance?.checklist && instance.checklist.length > 0 ? instance.checklist : buildDefaultChecklist(task, milestones.items),
    );
    setRatingDraft(instance?.rating);
    setRatingNotesDraft(instance?.ratingNotes ?? "");
  }

  async function finishEnd(endIso: string, endTz: string) {
    if (submitting || !instance) return;
    setSubmitting(true);
    setError(false);
    const ok = await endTask(instance.id, endIso, endTz, checklistDraft, ratingDraft, ratingNotesDraft.trim());
    if (!ok) setError(true);
    else setActivePanel(null);
    setSubmitting(false);
  }

  async function quickComplete(rating: number) {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    const nowIso = new Date().toISOString();
    const started = await startTask(task, date, nowIso, timezone);
    if (!started) {
      setError(true);
      setSubmitting(false);
      return;
    }
    const fresh = getInstance(task.id, date);
    if (!fresh) {
      setError(true);
      setSubmitting(false);
      return;
    }
    const ok = await endTask(fresh.id, nowIso, timezone, buildDefaultChecklist(task, milestones.items), rating);
    if (!ok) setError(true);
    setSubmitting(false);
  }

  const [reopenReason, setReopenReason] = useState("");

  function openReopen() {
    setError(false);
    setActivePanel("reopen");
    setReopenReason("");
  }

  async function confirmReopen() {
    if (submitting || !instance) return;
    if (!reopenReason.trim()) {
      setError(true);
      return;
    }
    setSubmitting(true);
    setError(false);
    const ok = await reopenTask(instance.id, reopenReason.trim());
    if (!ok) setError(true);
    else setActivePanel(null);
    setSubmitting(false);
  }

  function openUnstart() {
    setError(false);
    setActivePanel("unstart");
  }

  async function confirmUnstart() {
    if (submitting || !instance) return;
    setSubmitting(true);
    setError(false);
    const ok = await unstartTask(instance.id);
    if (!ok) setError(true);
    else setActivePanel(null);
    setSubmitting(false);
  }

  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState(date);
  const [rescheduleClock, setRescheduleClock] = useState("12:00");

  function openReschedule() {
    setError(false);
    setActivePanel("reschedule");
    setRescheduleReason("");
    setRescheduleDate(date);
    setRescheduleClock("12:00");
  }

  async function confirmReschedule() {
    if (submitting) return;
    if (!rescheduleReason.trim()) {
      setError(true);
      return;
    }
    setSubmitting(true);
    setError(false);
    const ok = await rescheduleTask(task, date, rescheduleDate, to12Hour(rescheduleClock), rescheduleReason.trim());
    if (!ok) setError(true);
    else {
      setActivePanel(null);
      onClose();
    }
    setSubmitting(false);
  }

  const [skipReason, setSkipReason] = useState("");

  function openSkip() {
    setError(false);
    setActivePanel("skip");
    setSkipReason("");
  }

  async function confirmSkip() {
    if (submitting) return;
    if (!skipReason.trim()) {
      setError(true);
      return;
    }
    setSubmitting(true);
    setError(false);
    const ok = await skipTask(task, date, skipReason.trim());
    if (!ok) setError(true);
    else {
      setActivePanel(null);
      onClose();
    }
    setSubmitting(false);
  }

  const [delegateTo, setDelegateTo] = useState("");

  function openDelegate() {
    setError(false);
    setActivePanel("delegate");
    setDelegateTo("");
  }

  async function confirmDelegate() {
    if (submitting) return;
    if (!delegateTo) {
      setError(true);
      return;
    }
    setSubmitting(true);
    setError(false);
    const fromId = instance?.assignedTo ?? task.assignedTo;
    const ok = await delegateTask(task, date, fromId, delegateTo);
    if (!ok) setError(true);
    else {
      setActivePanel(null);
      onClose();
    }
    setSubmitting(false);
  }

  if (deleteModalOpen) {
    return (
      <DeleteTaskModal
        task={task}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={(scope, note) => deleteItem(task, scope, date, note)}
        onDone={onClose}
      />
    );
  }

  const durationMinutes = itemDurationMinutes(task);

  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="task-detail">
        <div className="task-detail-meta">
          <span className={`priority ${task.priority}`}>{task.priority}</span>
          <span>{task.category}</span>
          <span>
            {instance?.scheduledTime || task.startTime || "No set time"}
            {durationMinutes > 0 ? ` · ${durationMinutes} min` : ""}
          </span>
          {task.assignedTo && (
            <span>
              <PersonName id={instance?.assignedTo ?? task.assignedTo} />
            </span>
          )}
          {task.requiresCompletion && <span className={`state-tag ${state}`}>{itemStateLabels[state]}</span>}
          {task.requiresLog && <span className="capability-tag">Logs data</span>}
        </div>

        <div className="task-detail-dogs">
          <p className="eyebrow">Dogs involved</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {involvedDogs.map((dog) => (
              <button
                key={dog.id}
                type="button"
                className="dog-chip"
                onClick={() => {
                  onClose();
                  navigate("profile", { dogId: dog.id });
                }}
              >
                {dog.name} <ChevronRight size={12} aria-hidden />
              </button>
            ))}
            {involvedDogs.length === 0 && <span className="small">No dogs tagged</span>}
          </div>
          <p className="small">
            Formation: {task.formation ? formationLabels[task.formation] : "Not specified"}
            {location ? ` · Location: ${location.name}` : ""}
          </p>
          {location?.availability && <p className="small">{location.availability}</p>}
        </div>

        <p>{task.notes}</p>

        {relatedMilestone && (
          <div className="task-detail-milestone">
            <p className="eyebrow">Training focus</p>
            <div className="row between">
              <div>
                <strong>{relatedMilestone.title}</strong>
                <p className="small">
                  {/* Per dog — this item's dogs if it names any, otherwise everyone the
                      milestone covers. One blended number would describe neither. */}
                  {(task.dogIds && task.dogIds.length > 0 ? task.dogIds : relatedMilestone.dogIds)
                    .map((dogId) => {
                      const name = dogs.items.find((dog) => dog.id === dogId)?.name ?? "";
                      return `${name} ${milestoneProgress(relatedMilestone, dogId)}% · ${milestoneStatusFor(relatedMilestone, milestones.items, dogId)}`;
                    })
                    .join(" — ")}
                </p>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  onClose();
                  navigate("milestones", { milestoneId: relatedMilestone.id });
                }}
              >
                Full milestone <ChevronRight size={14} aria-hidden />
              </button>
            </div>
            <p className="small">{relatedMilestone.why}</p>
            {relatedMilestone.sources.length > 0 && (
              <div className="source-list">
                {relatedMilestone.sources.map((source) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                    {source.publisher}: {source.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="form-error">That didn't save — check any required fields (and the browser console) and try again.</p>}

        {/* Logging is available regardless of completion state — a vet visit gets
            logged after the fact, and a routine can accumulate several entries.

            A mapped category offers logging even when `requiresLog` is off. For a potty
            break or a meal, recording what happened isn't an extra capability you opt
            into — it *is* how you say the thing happened, and the seeds ship those
            routines with the flag false. Unmapped categories still respect the toggle. */}
        {activePanel === null && (task.requiresLog || quickLogKind) && (
          <div className="task-lifecycle-actions">
            <button className="primary-button" type="button" onClick={() => setActivePanel("log")}>
              {quickLogKind ? `Log ${quickLogSpec(quickLogKind).label.toLowerCase()}` : "Log an entry"}
            </button>
          </div>
        )}

        {activePanel === "log" &&
          (quickLogKind ? (
            <QuickLogForm
              date={date}
              initialKind={quickLogKind}
              initialDogIds={task.dogIds}
              // A training item usually already names the milestone it's for; making you
              // re-pick it in the form would be asking a question the item answered.
              initialTrainingType={task.checklistSourceMilestoneId ?? task.relatedMilestoneId}
              attachTo={{ itemId: task.id, occurrenceDate: date, itemTitle: task.title }}
              onClose={() => setActivePanel(null)}
            />
          ) : (
            <LogEntryPanel item={task} occurrenceDate={date} onClose={() => setActivePanel(null)} />
          ))}

        {activePanel === null && task.requiresCompletion && (state === "not_started" || state === "reassigned" || state === "rescheduled") && (
          <div className="task-lifecycle-actions">
            <button className="primary-button" type="button" onClick={openStart}>
              Start
            </button>
            <button className="text-button" type="button" onClick={openDelegate}>
              Ask someone else to complete this
            </button>
            <button className="text-button" type="button" onClick={openReschedule}>
              Reschedule
            </button>
            <button className="text-button" type="button" onClick={openSkip}>
              Skip
            </button>
          </div>
        )}

        {activePanel === null && task.requiresCompletion && state === "in_progress" && (
          <div className="task-lifecycle-actions">
            <p className="small">
              Started{" "}
              {instance?.startTime && instance.startTimeZone ? formatInZone(instance.startTime, instance.startTimeZone) : "—"}
            </p>
            <button className="primary-button" type="button" onClick={openEnd}>
              Finish
            </button>
            <button className="text-button" type="button" onClick={openReschedule}>
              Reschedule
            </button>
            <button className="text-button" type="button" onClick={openSkip}>
              Skip
            </button>
            <button className="text-button danger" type="button" onClick={openUnstart}>
              Mark not as started
            </button>
          </div>
        )}

        {state === "assigned_pending" && (
          <p className="small">
            Waiting for <PersonName id={instance?.assignedTo ?? task.assignedTo} /> to accept or decline.
          </p>
        )}

        {state === "completed" && instance && (
          <div className="task-lifecycle-summary">
            <p className="small">
              {instance.startTime && instance.startTimeZone ? formatInZone(instance.startTime, instance.startTimeZone) : "—"}
              {" → "}
              {instance.endTime && instance.endTimeZone ? formatInZone(instance.endTime, instance.endTimeZone) : "—"}
              {instance.rating ? ` · Rated ${instance.rating}/5` : ""}
            </p>
            {instance.ratingNotes && <p className="small">{instance.ratingNotes}</p>}
            {instance.milestoneAdvanced && <p className="small">Counted toward its linked milestone.</p>}
            <div className="checklist">
              {instance.checklist.map((item) => (
                <div key={`${item.dogId ?? "all"}-${item.itemName}`} className="checklist-summary-item">
                  {item.dogId && <em className="checklist-dog-tag">{dogName(item.dogId)}</em>}
                  <strong>{item.itemName}:</strong> {item.dataType === "boolean" ? (item.value ? "Yes" : "No") : String(item.value)}
                  {item.rating ? ` · ${item.rating}/5` : ""}
                  {item.notes ? ` — ${item.notes}` : ""}
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 12 }}>
              <button className="text-button" type="button" onClick={openEnd}>
                Edit this completion
              </button>
              <button className="text-button danger" type="button" onClick={openReopen}>
                Mark as not done
              </button>
            </div>
          </div>
        )}

        {activePanel === "reopen" && (
          <div className="task-lifecycle-panel">
            <p className="small">
              This goes back to not started. The checklist and scores you recorded are kept, so finishing again picks up
              where you left off.
              {instance?.milestoneAdvanced ? " The milestone progress it counted for will be rolled back." : ""}
            </p>
            <label>
              Why? (required)
              <textarea rows={2} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
            </label>
            <div className="form-actions">
              <button className="text-button" type="button" onClick={() => setActivePanel(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={confirmReopen} disabled={submitting}>
                Confirm
              </button>
            </div>
          </div>
        )}

        {activePanel === "unstart" && (
          <div className="task-lifecycle-panel">
            <p className="small">This goes back to not started. The start time you set will be cleared.</p>
            <div className="form-actions">
              <button className="text-button" type="button" onClick={() => setActivePanel(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={confirmUnstart} disabled={submitting}>
                Confirm
              </button>
            </div>
          </div>
        )}

        {state === "skipped" && instance && (
          <p className="small">Skipped — {instance.history.filter((entry) => entry.type === "skip").slice(-1)[0]?.reason}</p>
        )}

        {activePanel === "start" && (
          <div className="task-lifecycle-panel">
            {!startManual ? (
              <>
                <p>Is now the correct time this task started?</p>
                <div className="form-actions">
                  <button className="text-button" type="button" onClick={() => setStartManual(true)} disabled={submitting}>
                    No, pick a time
                  </button>
                  <button className="primary-button" type="button" onClick={confirmStartNow} disabled={submitting}>
                    Yes, starting now
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    Start date
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </label>
                  <label>
                    Start time
                    <input type="time" value={startClock} onChange={(event) => setStartClock(event.target.value)} />
                  </label>
                  <label>
                    Time zone
                    <TimezonePicker value={startZone} onChange={setStartZone} />
                  </label>
                </div>
                <div className="form-actions">
                  <button className="text-button" type="button" onClick={() => setActivePanel(null)}>
                    Cancel
                  </button>
                  <button className="primary-button" type="button" onClick={confirmStartManual}>
                    Confirm start
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activePanel === "end" && (
          <div className="task-lifecycle-panel">
            {!endManual ? (
              <>
                <p>Is now the correct time this task ended?</p>
                <div className="form-actions">
                  <button className="text-button" type="button" onClick={() => setEndManual(true)} disabled={submitting}>
                    No, pick a time
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => finishEnd(new Date().toISOString(), timezone)}
                    disabled={submitting}
                  >
                    Yes, ending now
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    End date
                    <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </label>
                  <label>
                    End time
                    <input type="time" value={endClock} onChange={(event) => setEndClock(event.target.value)} />
                  </label>
                  <label>
                    Time zone
                    <TimezonePicker value={endZone} onChange={setEndZone} />
                  </label>
                </div>
                <div className="form-actions">
                  <button className="text-button" type="button" onClick={() => setActivePanel(null)}>
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => finishEnd(zonedTimeToUtcIso(endDate, endClock, endZone), endZone)}
                    disabled={submitting}
                  >
                    Confirm end
                  </button>
                </div>
              </>
            )}

            <p className="eyebrow" style={{ marginTop: 12 }}>
              Checklist review
            </p>
            {/* Grouped by dog when any step is dog-specific, so a session running
                different work for each dog reads as two short lists rather than one
                interleaved one. Falls back to a single unlabelled list otherwise. */}
            {groupChecklistByDog(checklistDraft).map((group) => (
              <div className="checklist-editor-list" key={group.dogId ?? "all"}>
                {group.dogId && <p className="checklist-dog-heading">{dogName(group.dogId)}</p>}
                {group.rows.map((row) => {
                  const index = checklistDraft.indexOf(row);
                  return (
                    <ChecklistItemEditor
                      key={`${row.dogId ?? "all"}-${row.itemName}`}
                      item={row}
                      onChange={(next) => setChecklistDraft((prev) => prev.map((existing, i) => (i === index ? next : existing)))}
                    />
                  );
                })}
              </div>
            ))}

            <p className="eyebrow" style={{ marginTop: 12 }}>
              Overall — how did the whole thing go?
            </p>
            <div className="rating-row">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={ratingDraft === rating ? "selected" : ""}
                  onClick={() => setRatingDraft(rating)}
                >
                  {rating}
                </button>
              ))}
            </div>
            <label>
              Overall notes
              <textarea
                rows={2}
                value={ratingNotesDraft}
                onChange={(event) => setRatingNotesDraft(event.target.value)}
                placeholder="Anything worth remembering about the session as a whole"
              />
            </label>
          </div>
        )}

        {activePanel === "reschedule" && (
          <div className="task-lifecycle-panel">
            <label>
              Reason (required)
              <textarea rows={2} value={rescheduleReason} onChange={(event) => setRescheduleReason(event.target.value)} />
            </label>
            <div className="form-grid">
              <label>
                New date
                <input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} />
              </label>
              <label>
                New time
                <input type="time" value={rescheduleClock} onChange={(event) => setRescheduleClock(event.target.value)} />
              </label>
            </div>
            <div className="form-actions">
              <button className="text-button" type="button" onClick={() => setActivePanel(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={confirmReschedule} disabled={submitting}>
                Confirm reschedule
              </button>
            </div>
          </div>
        )}

        {activePanel === "skip" && (
          <div className="task-lifecycle-panel">
            <label>
              Reason (required)
              <textarea rows={2} value={skipReason} onChange={(event) => setSkipReason(event.target.value)} />
            </label>
            <div className="form-actions">
              <button className="text-button" type="button" onClick={() => setActivePanel(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={confirmSkip} disabled={submitting}>
                Confirm skip
              </button>
            </div>
          </div>
        )}

        {activePanel === "delegate" && (
          <div className="task-lifecycle-panel">
            <label>
              Ask
              <select value={delegateTo} onChange={(event) => setDelegateTo(event.target.value)}>
                <option value="">Select a person…</option>
                {people.items
                  .filter((person) => person.id !== (instance?.assignedTo ?? task.assignedTo))
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-actions">
              <button className="text-button" type="button" onClick={() => setActivePanel(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={confirmDelegate} disabled={submitting}>
                Send request
              </button>
            </div>
          </div>
        )}

        {/* Quick-complete only survives for items with nothing to work through.
            Once an item has a checklist, skipping straight to a score would bypass
            the per-row scores and notes that are now the point (backlog item 11). */}
        {activePanel === null &&
          task.requiresCompletion &&
          resolveChecklistDefs(task, milestones.items).length === 0 &&
          (state === "not_started" || state === "in_progress") && (
            <div className="rating-row" aria-label={`Quick-complete ${task.title}`} style={{ marginTop: 12 }}>
              <span className="small" style={{ marginRight: 8 }}>
                Quick complete:
              </span>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button key={rating} type="button" onClick={() => quickComplete(rating)} disabled={submitting}>
                  {rating}
                </button>
              ))}
            </div>
          )}

        {activePanel === null && (
          <div className="row" style={{ marginTop: 12, gap: 12 }}>
            {onEdit && (
              <button className="text-button" type="button" onClick={() => onEdit(task)}>
                Edit item
              </button>
            )}
            <button className="text-button danger" type="button" onClick={() => setDeleteModalOpen(true)}>
              Delete
            </button>
          </div>
        )}

        {instance && instance.history.length > 0 && (
          <div className="task-history">
            <p className="eyebrow">History</p>
            <ul>
              {instance.history
                .slice()
                .reverse()
                .map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.type}</strong> — {new Date(entry.timestamp).toLocaleString()}
                    {entry.reason ? `: ${entry.reason}` : ""}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DeleteTaskModal({
  task,
  onCancel,
  onConfirm,
  onDone,
}: {
  task: Item;
  onCancel: () => void;
  onConfirm: (scope: ItemDeletionScope, note: string) => Promise<boolean>;
  onDone: () => void;
}) {
  const [scope, setScope] = useState<ItemDeletionScope>("instance");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function confirm() {
    if (!note.trim()) {
      setNoteError(true);
      return;
    }
    setSubmitting(true);
    setSaveError(false);
    const ok = await onConfirm(scope, note.trim());
    setSubmitting(false);
    if (ok) setDeleted(true);
    else setSaveError(true);
  }

  if (deleted) {
    return (
      <Modal title="Task deleted" onClose={onDone}>
        <p className="form-success">
          {scope === "instance" ? `Today's "${task.title}" was skipped.` : `"${task.title}" was removed from the routine.`}
        </p>
        <div className="form-actions">
          <button className="primary-button" type="button" onClick={onDone}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Delete "${task.title}"`} onClose={onCancel}>
      <div className="subtabs" role="radiogroup" aria-label="What to delete" style={{ marginBottom: 12 }}>
        <button type="button" className={scope === "instance" ? "active" : ""} onClick={() => setScope("instance")}>
          Just today
        </button>
        <button type="button" className={scope === "series" ? "active" : ""} onClick={() => setScope("series")}>
          Remove from the routine entirely
        </button>
      </div>
      <label>
        Why is this being deleted? (required)
        <textarea
          rows={2}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteError(false);
          }}
        />
        {noteError && <small className="form-error">A note is required to delete a task.</small>}
      </label>
      {saveError && <p className="form-error">That didn't save — check the browser console and try again.</p>}
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button className="primary-button" type="button" onClick={confirm} disabled={submitting}>
          {submitting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

export function WhyUnlocked({ milestone, allMilestones, dogId }: { milestone: Milestone; allMilestones: Milestone[]; dogId: string }) {
  const deps = resolveDependencies(milestone, allMilestones, dogId);
  if (deps.length === 0) {
    return <p className="why-line">No prerequisites — ready whenever the household is.</p>;
  }
  return (
    <ul className="why-list">
      {deps.map((dep) => (
        <li key={dep.id} className={dep.met ? "met" : "unmet"}>
          {dep.met ? <Check size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
          <span>{dep.title}</span>
          {!dep.met && <small>{dep.progress}% there</small>}
        </li>
      ))}
    </ul>
  );
}

/** A milestone as it stands for one dog. `dogId` is required rather than optional
 * because there is no honest dog-less answer any more: status, progress, which
 * prerequisites are met and whether a step is done all differ per dog. */
export function MilestoneCard({
  milestone,
  dogId,
  defaultCollapsed,
  onQuickLog,
}: {
  milestone: Milestone;
  dogId: string;
  /** Training page defaults every card to collapsed so the list of milestones for a
   * track fits on screen without scrolling past detail nobody asked to see yet. Other
   * callers (the Milestones roadmap) leave this unset and get the old always-open card. */
  defaultCollapsed?: boolean;
  /** Opens the full Quick log form pre-scoped to this milestone, so logging a rated
   * session doesn't require expanding the card and hunting for the per-step button. */
  onQuickLog?: () => void;
}) {
  const { milestones, dogs, logMilestoneSession } = useStore();
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const progress = milestoneProgress(milestone, dogId);
  const effectiveStatus = milestoneStatusFor(milestone, milestones.items, dogId);
  const dogName = dogs.items.find((dog) => dog.id === dogId)?.name ?? "";
  // Everyone else on this milestone, so you can see where the other dog sits without
  // switching the whole page over to them.
  const otherDogs = milestone.dogIds.filter((id) => id !== dogId);
  const doneSteps = milestone.steps.filter((step) => stepSessions(step, dogId) >= step.sessionsRequired).length;
  return (
    <article className="milestone-card">
      <div className="row between">
        <div>
          <p className="eyebrow">{milestone.track}</p>
          <h3>{milestone.title}</h3>
        </div>
        <div className="milestone-card-actions">
          {onQuickLog && (
            <button
              className="icon-button small"
              type="button"
              aria-label={`Quick log a session for ${milestone.title}`}
              onClick={onQuickLog}
            >
              <GraduationCap size={14} aria-hidden />
            </button>
          )}
          <span className={`status ${effectiveStatus}`}>
            {effectiveStatus === "locked" && <Lock size={14} aria-hidden />}
            {effectiveStatus}
          </span>
        </div>
      </div>
      <ProgressBar value={progress} />
      {otherDogs.length > 0 && (
        <p className="milestone-other-dogs">
          {dogName} {progress}%
          {otherDogs.map((id) => {
            const other = dogs.items.find((dog) => dog.id === id);
            if (!other) return null;
            return (
              <span key={id}>
                {" · "}
                {other.name} {milestoneProgress(milestone, id)}%
              </span>
            );
          })}
        </p>
      )}
      {collapsed ? (
        <p className="milestone-card-summary small">
          {doneSteps}/{milestone.steps.length} steps mastered
        </p>
      ) : (
        <>
          <p className="eyebrow">Why isn't this unlocked?</p>
          <WhyUnlocked milestone={milestone} allMilestones={milestones.items} dogId={dogId} />
          <p>{milestone.why}</p>
          <div className="steps">
            {milestone.steps.map((step) => {
              const sessions = stepSessions(step, dogId);
              const done = sessions >= step.sessionsRequired;
              return (
                <div className="step" key={step.title}>
                  <span className={done ? "dot done" : "dot"} />
                  <div>
                    <strong>{step.title}</strong>
                    <p>
                      {step.successCriteria} · {sessions}/{step.sessionsRequired} sessions
                    </p>
                  </div>
                  {!done && (
                    <button
                      className="icon-button small"
                      type="button"
                      aria-label={`Log a session for ${step.title} for ${dogName}`}
                      onClick={() => logMilestoneSession(milestone.id, step.title, dogId)}
                    >
                      <Play size={14} aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="source-list">
            {milestone.sources.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                {source.publisher}: {source.title}
              </a>
            ))}
          </div>
        </>
      )}
      <button
        className="text-button small milestone-card-toggle"
        type="button"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((prev) => !prev)}
      >
        {collapsed ? "Details" : "Collapse"}
        <ChevronDown size={14} aria-hidden className={collapsed ? "" : "rotated"} />
      </button>
    </article>
  );
}

export function DogProfile({ dog, onEdit, onDelete }: { dog: Dog; onEdit?: (dog: Dog) => void; onDelete?: (dog: Dog) => void }) {
  const { items } = useStore();
  const upcomingHealth = items.items.filter((entry) => isHealthItem(entry) && (entry.dogIds ?? []).includes(dog.id));
  const mastered = dog.masteredCommands.length ? dog.masteredCommands.join(", ") : "None yet";
  return (
    <article className="dog-card">
      <img src={dog.photo} alt="" />
      <div>
        <div className="row between">
          <p className="eyebrow">{dog.status}</p>
          <div className="row" style={{ gap: 8 }}>
            {onEdit && (
              <button className="text-button" type="button" onClick={() => onEdit(dog)}>
                Edit
              </button>
            )}
            {onDelete && (
              <button className="text-button" type="button" onClick={() => onDelete(dog)}>
                Remove
              </button>
            )}
          </div>
        </div>
        <h3>{dog.name}</h3>
        <p>
          {dog.breed} · {dog.weight} lb
        </p>
        <div className="profile-facts">
          <span>Sex: {dog.sex}</span>
          <span>Expected adult: {dog.expectedAdultWeight} lb</span>
          <span>Microchip: {dog.microchip}</span>
          <span>Vet: {dog.veterinarian}</span>
          <span>Insurance: {dog.insurance}</span>
          <span>Breeder: {dog.breeder}</span>
        </div>
        <div className="trait-grid">
          {[
            ["Confidence", dog.confidence],
            ["Energy", dog.energy],
            ["Dog social", dog.dogFriendliness],
            ["Noise comfort", 100 - dog.noiseSensitivity],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <ProgressBar value={Number(value)} />
            </div>
          ))}
        </div>
        <p>{dog.healthSummary}</p>
        <div className="profile-columns">
          <div>
            <strong>Health</strong>
            <ul>
              {dog.medicalHistory.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {upcomingHealth.map((event) => (
                <li key={event.id}>{event.title}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Medications, supplements & injections</strong>
            <ul>
              {(dog.medicationEntries ?? []).length === 0 && <li>None logged</li>}
              {(dog.medicationEntries ?? []).map((entry) => (
                <li key={entry.id}>
                  <span className={`priority ${entry.kind === "medication" ? "essential" : entry.kind === "injection" ? "essential" : "optional"}`}>
                    {entry.kind}
                  </span>{" "}
                  {entry.name} — {entry.dosage}, {entry.frequency}
                  {entry.notes ? ` (${entry.notes})` : ""}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Weight history</strong>
            <ul>
              {dog.weightHistory.map((entry) => (
                <li key={entry.date}>
                  {entry.date}: {entry.pounds} lb
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="small">Rewards: {dog.favoriteRewards.join(", ")}</p>
        <p className="small">Toys: {dog.favoriteToys.join(", ")}</p>
        <p className="small">Commands: {mastered}</p>
        <p className="small">Exercise: {dog.exerciseNeed}</p>
      </div>
    </article>
  );
}

export function HumanProfile({ person }: { person: Person }) {
  const { items } = useStore();
  const assignedTasks = items.items.filter((entry) => entry.requiresCompletion && entry.assignedTo === person.id);
  return (
    <article className="human-card">
      <span style={{ background: person.color }} />
      <div>
        <p className="eyebrow">Human</p>
        <h3>{person.name}</h3>
        <p>{assignedTasks.length} items assigned</p>
        <div className="assigned-list">
          {assignedTasks.map((entry) => (
            <small key={entry.id}>
              {entry.startTime ?? "—"} · {entry.title}
            </small>
          ))}
        </div>
      </div>
    </article>
  );
}

export function Sparkline({ values, width = 220, height = 56 }: { values: number[]; width?: number; height?: number }) {
  if (values.length === 0) return <svg width={width} height={height} aria-hidden />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((value, index) => `${index * step},${height - ((value - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trend across ${values.length} points`}>
      <polyline points={points} fill="none" stroke="var(--teal)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
