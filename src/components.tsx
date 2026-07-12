import { Activity, Check, ChevronRight, Lock, Play, X } from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";
import { useSession } from "./auth";
import { useNavigation } from "./navigation";
import { makeId, useStore } from "./store";
import { ChecklistItemValue, DailyFeedback, Dog, DogFormation, FeedbackType, Milestone, Person, Task } from "./types";
import { formatInZone, isoToZonedParts, searchTimezones, zonedTimeToUtcIso, zoneLabel } from "./timezones";
import { buildDefaultChecklist, computeMilestoneStatus, formatMinutes, milestoneProgress, resolveDependencies, taskStateLabels } from "./utils";

function to12Hour(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  return formatMinutes(hours * 60 + minutes);
}

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

export function TaskCard({
  task,
  feedback,
  onComplete,
  onDelete,
  onOpenDetail,
}: {
  task: Task;
  feedback?: DailyFeedback;
  onComplete: (task: Task, rating: number) => Promise<boolean> | boolean | void;
  onDelete?: (task: Task) => void;
  onOpenDetail?: (task: Task) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState(false);

  function toggleItem(item: string) {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  }

  async function handleRate(rating: number) {
    setFailed(false);
    const ok = await onComplete(task, rating);
    if (ok === false) setFailed(true);
  }

  return (
    <article className={`task-card ${feedback?.completed ? "is-done" : ""}`}>
      <div className="task-time">{task.time}</div>
      <div className="task-main">
        <div className="row between">
          <div>
            <p className="eyebrow">{task.category}</p>
            <h3>{task.title}</h3>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className={`priority ${task.priority}`}>{task.priority}</span>
            {onOpenDetail && (
              <button className="text-button" type="button" onClick={() => onOpenDetail(task)}>
                Manage
              </button>
            )}
            {onDelete && (
              <button className="text-button" type="button" onClick={() => onDelete(task)} aria-label={`Delete ${task.title}`}>
                Remove
              </button>
            )}
          </div>
        </div>
        <p>{task.notes}</p>
        <div className="task-meta">
          <span>{task.duration} min</span>
          <span>{task.setting}</span>
          <span>Difficulty {task.difficulty}/5</span>
          <span>Griz: {task.grizParticipation}</span>
          <span>
            <PersonName id={task.assignedTo} />
          </span>
        </div>
        <div className="checklist">
          {task.checklist.map((item) => (
            <label key={item} className={checked[item] ? "checked" : ""}>
              <input type="checkbox" checked={!!checked[item]} onChange={() => toggleItem(item)} />
              {item}
            </label>
          ))}
        </div>
        <div className="rating-label">
          <span>{feedback?.completed ? "Logged — how did it go?" : "How did it go?"}</span>
          {feedback?.completed && (
            <strong>
              <Check size={14} aria-hidden /> Rated {feedback.rating}/5
            </strong>
          )}
        </div>
        {failed && <p className="form-error">That didn't save — check the browser console and try again.</p>}
        <div className="rating-row" aria-label={`Complete ${task.title}`}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              className={feedback?.rating === rating ? "selected" : ""}
              aria-pressed={feedback?.rating === rating}
              onClick={() => handleRate(rating)}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

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
    </div>
  );
}

export function TaskDetailModal({ task, date, onClose }: { task: Task; date: string; onClose: () => void }) {
  const { dogs, milestones, locations, people, getInstance, startTask, endTask, rescheduleTask, skipTask, delegateTask } = useStore();
  const { navigate, timezone } = useNavigation();
  const [activePanel, setActivePanel] = useState<null | "start" | "end" | "reschedule" | "skip" | "delegate">(null);
  const [error, setError] = useState(false);

  const instance = getInstance(task.id, date);
  const state = instance?.state ?? "not_started";

  const involvedDogs = dogs.items.filter((dog) => task.dogIds.includes(dog.id));
  const location = locations.find((loc) => loc.id === task.location);
  const relatedMilestone = task.relatedMilestoneId ? milestones.items.find((item) => item.id === task.relatedMilestoneId) : undefined;

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
    setError(false);
    const ok = await startTask(task, date, new Date().toISOString(), timezone);
    if (!ok) setError(true);
    else setActivePanel(null);
  }

  async function confirmStartManual() {
    setError(false);
    const iso = zonedTimeToUtcIso(startDate, startClock, startZone);
    const ok = await startTask(task, date, iso, startZone);
    if (!ok) setError(true);
    else setActivePanel(null);
  }

  const [endManual, setEndManual] = useState(false);
  const [endDate, setEndDate] = useState(date);
  const [endClock, setEndClock] = useState("12:00");
  const [endZone, setEndZone] = useState(timezone);
  const [checklistDraft, setChecklistDraft] = useState<ChecklistItemValue[]>([]);
  const [ratingDraft, setRatingDraft] = useState<number | undefined>(undefined);

  function openEnd() {
    setError(false);
    setActivePanel("end");
    setEndManual(false);
    setEndDate(date);
    setEndClock(new Date().toTimeString().slice(0, 5));
    setEndZone(instance?.startTimeZone ?? timezone);
    setChecklistDraft(instance?.checklist ?? buildDefaultChecklist(task));
    setRatingDraft(instance?.rating);
  }

  async function finishEnd(endIso: string, endTz: string) {
    if (!instance) return;
    setError(false);
    const ok = await endTask(instance.id, endIso, endTz, checklistDraft, ratingDraft);
    if (!ok) setError(true);
    else setActivePanel(null);
  }

  async function quickComplete(rating: number) {
    setError(false);
    const nowIso = new Date().toISOString();
    const started = await startTask(task, date, nowIso, timezone);
    if (!started) {
      setError(true);
      return;
    }
    const fresh = getInstance(task.id, date);
    if (!fresh) {
      setError(true);
      return;
    }
    const ok = await endTask(fresh.id, nowIso, timezone, buildDefaultChecklist(task), rating);
    if (!ok) setError(true);
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
    if (!rescheduleReason.trim()) {
      setError(true);
      return;
    }
    setError(false);
    const ok = await rescheduleTask(task, date, rescheduleDate, to12Hour(rescheduleClock), rescheduleReason.trim());
    if (!ok) setError(true);
    else {
      setActivePanel(null);
      onClose();
    }
  }

  const [skipReason, setSkipReason] = useState("");

  function openSkip() {
    setError(false);
    setActivePanel("skip");
    setSkipReason("");
  }

  async function confirmSkip() {
    if (!skipReason.trim()) {
      setError(true);
      return;
    }
    setError(false);
    const ok = await skipTask(task, date, skipReason.trim());
    if (!ok) setError(true);
    else {
      setActivePanel(null);
      onClose();
    }
  }

  const [delegateTo, setDelegateTo] = useState("");

  function openDelegate() {
    setError(false);
    setActivePanel("delegate");
    setDelegateTo("");
  }

  async function confirmDelegate() {
    if (!delegateTo) {
      setError(true);
      return;
    }
    setError(false);
    const fromId = instance?.assignedTo ?? task.assignedTo;
    const ok = await delegateTask(task, date, fromId, delegateTo);
    if (!ok) setError(true);
    else {
      setActivePanel(null);
      onClose();
    }
  }

  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="task-detail">
        <div className="task-detail-meta">
          <span className={`priority ${task.priority}`}>{task.priority}</span>
          <span>{task.category}</span>
          <span>
            {instance?.scheduledTime ?? task.time} · {task.duration} min
          </span>
          <span>{task.setting}</span>
          <span>Difficulty {task.difficulty}/5</span>
          <span>
            <PersonName id={instance?.assignedTo ?? task.assignedTo} />
          </span>
          <span className={`state-tag ${state}`}>{taskStateLabels[state]}</span>
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
                  {milestoneProgress(relatedMilestone)}% there · {computeMilestoneStatus(relatedMilestone, milestones.items)}
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

        {activePanel === null && (state === "not_started" || state === "reassigned" || state === "rescheduled") && (
          <div className="task-lifecycle-actions">
            <button className="primary-button" type="button" onClick={openStart}>
              Start Task
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

        {activePanel === null && state === "in_progress" && (
          <div className="task-lifecycle-actions">
            <p className="small">
              Started{" "}
              {instance?.startTime && instance.startTimeZone ? formatInZone(instance.startTime, instance.startTimeZone) : "—"}
            </p>
            <button className="primary-button" type="button" onClick={openEnd}>
              End Task
            </button>
            <button className="text-button" type="button" onClick={openReschedule}>
              Reschedule
            </button>
            <button className="text-button" type="button" onClick={openSkip}>
              Skip
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
            <div className="checklist">
              {instance.checklist.map((item) => (
                <div key={item.itemName} className="checklist-summary-item">
                  <strong>{item.itemName}:</strong> {item.dataType === "boolean" ? (item.value ? "Yes" : "No") : String(item.value)}
                  {item.notes ? ` — ${item.notes}` : ""}
                </div>
              ))}
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
                  <button className="text-button" type="button" onClick={() => setStartManual(true)}>
                    No, pick a time
                  </button>
                  <button className="primary-button" type="button" onClick={confirmStartNow}>
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
                  <button className="text-button" type="button" onClick={() => setEndManual(true)}>
                    No, pick a time
                  </button>
                  <button className="primary-button" type="button" onClick={() => finishEnd(new Date().toISOString(), timezone)}>
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
                  <button className="primary-button" type="button" onClick={() => finishEnd(zonedTimeToUtcIso(endDate, endClock, endZone), endZone)}>
                    Confirm end
                  </button>
                </div>
              </>
            )}

            <p className="eyebrow" style={{ marginTop: 12 }}>
              Checklist review
            </p>
            <div className="checklist-editor-list">
              {checklistDraft.map((item, index) => (
                <ChecklistItemEditor
                  key={item.itemName}
                  item={item}
                  onChange={(next) => setChecklistDraft((prev) => prev.map((existing, i) => (i === index ? next : existing)))}
                />
              ))}
            </div>

            <p className="eyebrow" style={{ marginTop: 12 }}>
              How did it go?
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
              <button className="primary-button" type="button" onClick={confirmReschedule}>
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
              <button className="primary-button" type="button" onClick={confirmSkip}>
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
              <button className="primary-button" type="button" onClick={confirmDelegate}>
                Send request
              </button>
            </div>
          </div>
        )}

        {activePanel === null && (state === "not_started" || state === "in_progress") && (
          <div className="rating-row" aria-label={`Quick-complete ${task.title}`} style={{ marginTop: 12 }}>
            <span className="small" style={{ marginRight: 8 }}>
              Quick complete:
            </span>
            {[1, 2, 3, 4, 5].map((rating) => (
              <button key={rating} type="button" onClick={() => quickComplete(rating)}>
                {rating}
              </button>
            ))}
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

export function WhyUnlocked({ milestone, allMilestones }: { milestone: Milestone; allMilestones: Milestone[] }) {
  const deps = resolveDependencies(milestone, allMilestones);
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

export function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const { milestones, logMilestoneSession } = useStore();
  const progress = milestoneProgress(milestone);
  const effectiveStatus = computeMilestoneStatus(milestone, milestones.items);
  return (
    <article className="milestone-card">
      <div className="row between">
        <div>
          <p className="eyebrow">{milestone.track}</p>
          <h3>{milestone.title}</h3>
        </div>
        <span className={`status ${effectiveStatus}`}>
          {effectiveStatus === "locked" && <Lock size={14} aria-hidden />}
          {effectiveStatus}
        </span>
      </div>
      <ProgressBar value={progress} />
      <p className="eyebrow">Why isn't this unlocked?</p>
      <WhyUnlocked milestone={milestone} allMilestones={milestones.items} />
      <p>{milestone.why}</p>
      <div className="steps">
        {milestone.steps.map((step) => {
          const done = step.completedSessions >= step.sessionsRequired;
          return (
            <div className="step" key={step.title}>
              <span className={done ? "dot done" : "dot"} />
              <div>
                <strong>{step.title}</strong>
                <p>
                  {step.successCriteria} · {step.completedSessions}/{step.sessionsRequired} sessions
                </p>
              </div>
              {!done && (
                <button
                  className="icon-button small"
                  type="button"
                  aria-label={`Log a session for ${step.title}`}
                  onClick={() => logMilestoneSession(milestone.id, step.title)}
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
    </article>
  );
}

export function DogProfile({ dog, onEdit, onDelete }: { dog: Dog; onEdit?: (dog: Dog) => void; onDelete?: (dog: Dog) => void }) {
  const { healthEvents } = useStore();
  const upcomingHealth = healthEvents.items.filter((event) => event.dogId === dog.id);
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
            <strong>Medications</strong>
            <ul>
              {(dog.medications.length ? dog.medications : ["None logged"]).map((item) => (
                <li key={item}>{item}</li>
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
  const { tasks } = useStore();
  const assignedTasks = tasks.items.filter((task) => task.assignedTo === person.id);
  return (
    <article className="human-card">
      <span style={{ background: person.color }} />
      <div>
        <p className="eyebrow">Human</p>
        <h3>{person.name}</h3>
        <p>{assignedTasks.length} tasks assigned today</p>
        <div className="assigned-list">
          {assignedTasks.map((task) => (
            <small key={task.id}>
              {task.time} · {task.title}
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
