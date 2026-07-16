import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  HeartPulse,
  Import,
  Info,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Target,
  Type as TypeIcon,
} from "lucide-react";
import { FormEvent, TouchEvent as ReactTouchEvent, useEffect, useRef, useState } from "react";
import {
  AppMetric,
  DogProfile,
  formationLabels,
  HumanProfile,
  MilestoneCard,
  PersonName,
  ProgressBar,
  Sparkline,
  TaskCard,
  TaskDetailModal,
  TimezonePicker,
} from "./components";
import { Modal } from "./components";
import {
  AloneTimeLogForm,
  CalendarEventForm,
  DogForm,
  ExposureLogForm,
  HealthEventForm,
  JournalForm,
  PersonForm,
  RelationshipLogForm,
  TaskForm,
  aloneTimeLogFormValuesToLog,
  calendarEventFormValuesToEvent,
  dogFormValuesToDog,
  healthEventFormValuesToEvent,
  journalFormValuesToEntry,
  relationshipLogFormValuesToLog,
  taskFormValuesToTask,
} from "./forms";
import { makeId, useStore } from "./store";
import { useNavigation } from "./navigation";
import { setPassword as setAccountPassword, signOut, useSession } from "./auth";
import { isBackendConfigured } from "./supabaseClient";
import { CalendarEvent, Dog, ExposureCategory, ExposureItem, FeedbackLoopRule, HealthEvent, InboxRequest, InventoryItem, Milestone, NotificationItem, Task, TaskInstance, TaskState } from "./types";
import {
  addDays,
  addMonths,
  ageLabel,
  computeAloneTimeReadiness,
  computeNotifications,
  dayLoadMinutes,
  dayOfWeekName,
  formatDate,
  formatMinutes,
  generateGroceryList,
  heavyWeeks,
  isExpired,
  isExpiringSoon,
  isHeavyWeek,
  isSameDay,
  milestoneProgress,
  monthGridDays,
  parseLocalDate,
  parseTimeLabel,
  readinessScore,
  taskStateLabels,
  toDateKey,
  useAdaptivePlan,
  weekDays,
  weekStartDate,
} from "./utils";

export function NotificationBell() {
  const { tasks, feedback, healthEvents, milestones } = useStore();
  const [open, setOpen] = useState(false);
  const notifications = computeNotifications(tasks.items, feedback, healthEvents.items, milestones.items);
  return (
    <div className="notification-wrap">
      <button className="icon-button" type="button" onClick={() => setOpen((prev) => !prev)} aria-label="Notifications">
        <Bell size={18} aria-hidden />
        {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
      </button>
      {open && (
        <div className="notification-panel">
          <p className="eyebrow">Notifications</p>
          {notifications.length === 0 && <p className="small">Nothing needs attention right now.</p>}
          {notifications.map((item: NotificationItem) => (
            <article key={item.id} className={`notification ${item.severity}`}>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardView() {
  const { tasks, feedback, milestones, dogs, completeTask, aloneTimeLogs, calendarEvents, journalEntries } = useStore();
  const adaptive = useAdaptivePlan(tasks.items, feedback);
  const feedbackByTask = new Map(feedback.map((item) => [item.taskId, item]));
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [aloneTimeModal, setAloneTimeModal] = useState(false);
  const [quickLogModal, setQuickLogModal] = useState(false);
  const todayKey = toDateKey(new Date());
  const puppy = dogs.items.find((dog) => dog.status === "puppy") ?? dogs.items[0];
  const currentMilestone =
    milestones.items.find((item) => item.status !== "completed" && item.dependencies.length > 0) ?? milestones.items[0];
  const readiness = computeAloneTimeReadiness(aloneTimeLogs.items, calendarEvents.items);

  return (
    <div className="dashboard">
      <section className="row between quick-log-row">
        <p className="small">Just happened? Log it in one tap — no need to open a task.</p>
        <button className="primary-button" type="button" onClick={() => setQuickLogModal(true)}>
          <Plus size={16} aria-hidden /> Quick log
        </button>
      </section>

      <section className="split">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Today</p>
              <h2>Agenda</h2>
            </div>
          </div>
          <div className="task-list">
            {adaptive.visibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                feedback={feedbackByTask.get(task.id)}
                onComplete={completeTask}
                onOpenDetail={setDetailTask}
              />
            ))}
          </div>
          {detailTask && <TaskDetailModal task={detailTask} date={todayKey} onClose={() => setDetailTask(null)} />}
        </div>

        <div className="stack">
          {currentMilestone && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Focus milestone</p>
                  <h2>{currentMilestone.title}</h2>
                </div>
              </div>
              <MilestoneCard milestone={currentMilestone} />
            </section>
          )}
          {puppy && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Readiness</p>
                  <h2>{puppy.name}</h2>
                </div>
              </div>
              {(["vet", "walk", "recall", "hiking", "dogPark"] as const).map((kind) => (
                <div className="readiness" key={kind}>
                  <span>
                    {{ vet: "Vet visit", walk: "Neighborhood walk", recall: "Off-leash recall", hiking: "Hiking", dogPark: "Dog park" }[kind]}
                  </span>
                  <strong>{readinessScore(kind, puppy)}%</strong>
                  <ProgressBar value={readinessScore(kind, puppy)} />
                </div>
              ))}
            </section>
          )}
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Alone-time readiness</p>
                <h2 style={{ fontSize: "1.1rem" }}>
                  {readiness.nextEvent ? readiness.nextEvent.title : "Nothing upcoming needs coverage"}
                </h2>
              </div>
              <button className="text-button" type="button" onClick={() => setAloneTimeModal(true)}>
                <Plus size={16} aria-hidden /> Log
              </button>
            </div>
            {readiness.nextEvent && (
              <p className={`readiness-note ${readiness.ready ? "ready" : "gap"}`}>
                {readiness.ready
                  ? `Logged max of ${Math.round(readiness.maxAchievedMinutes / 60)}h already meets the ${readiness.requiredMinutes / 60}h needed for ${readiness.nextEvent.title}.`
                  : `Best logged so far is ${Math.round(readiness.maxAchievedMinutes / 60)}h, but ${readiness.nextEvent.title} on ${
                      readiness.nextEvent.date ? formatDate(readiness.nextEvent.date) : "an upcoming date"
                    } needs ${readiness.requiredMinutes / 60}h — ${Math.round(readiness.gapMinutes / 60)}h gap to close.`}
              </p>
            )}
          </section>
        </div>
      </section>

      {aloneTimeModal && (
        <Modal title="Log alone time" onClose={() => setAloneTimeModal(false)}>
          <AloneTimeLogForm
            onCancel={() => setAloneTimeModal(false)}
            onSubmit={(values) => {
              aloneTimeLogs.add(aloneTimeLogFormValuesToLog(values, makeId("alone")));
              setAloneTimeModal(false);
            }}
          />
        </Modal>
      )}
      {quickLogModal && (
        <Modal title="Quick log" onClose={() => setQuickLogModal(false)}>
          <QuickLogForm
            dogOptions={dogs.items.map((dog) => ({ id: dog.id, name: dog.name }))}
            onCancel={() => setQuickLogModal(false)}
            onSubmit={({ kind, dogIds, note }) => {
              journalEntries.add({
                id: makeId("entry"),
                dogIds,
                date: todayKey,
                title: kind === "accident" ? "Accident" : kind === "potty-win" ? "Good potty break" : "Quick log",
                text: note,
                tags: ["quick-log", kind],
                mood: kind === "accident" ? "hard" : kind === "potty-win" ? "great" : "steady",
              });
              setQuickLogModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function QuickLogForm({
  dogOptions,
  onSubmit,
  onCancel,
}: {
  dogOptions: { id: string; name: string }[];
  onSubmit: (values: { kind: "accident" | "potty-win" | "other"; dogIds: string[]; note: string }) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<"accident" | "potty-win" | "other">("potty-win");
  const [dogIds, setDogIds] = useState<string[]>(dogOptions.map((dog) => dog.id));
  const [note, setNote] = useState("");

  function toggleDog(id: string) {
    setDogIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ kind, dogIds, note });
      }}
    >
      <div className="subtabs" role="group" aria-label="What happened">
        {(["accident", "potty-win", "other"] as const).map((option) => (
          <button key={option} type="button" className={kind === option ? "active" : ""} onClick={() => setKind(option)}>
            {option === "accident" ? "Accident" : option === "potty-win" ? "Good potty break" : "Other"}
          </button>
        ))}
      </div>
      <label>
        Dog(s)
        <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 6 }}>
          {dogOptions.map((dog) => (
            <label key={dog.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={dogIds.includes(dog.id)} onChange={() => toggleDog(dog.id)} />
              {dog.name}
            </label>
          ))}
        </div>
      </label>
      <label>
        Note (optional)
        <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Log it
        </button>
      </div>
    </form>
  );
}

const dayLabels: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

type AgendaItem = {
  id: string;
  title: string;
  category: string;
  startMinutes: number | null;
  durationMinutes: number;
  assignedTo?: string;
  dogNames: string;
  priority?: string;
  placeholder: boolean;
  source: "task" | "health" | "calendar";
  task?: Task;
  /** The date (YYYY-MM-DD) this task item is being rendered for — needed to
   * resolve the right TaskInstance, since a template has no date of its own. */
  date?: string;
  state?: TaskState;
  healthEvent?: HealthEvent;
  calendarEvent?: CalendarEvent;
};

function buildAgendaForDate(
  date: Date,
  tasks: Task[],
  healthEvents: HealthEvent[],
  calendarEvents: CalendarEvent[],
  dogs: Dog[],
  instances: TaskInstance[],
): AgendaItem[] {
  const dateKey = toDateKey(date);
  const dow = dayOfWeekName(date);
  const dogName = (id: string) => dogs.find((dog) => dog.id === id)?.name ?? id;
  const items: AgendaItem[] = [];

  tasks.forEach((task) => {
    const natural = instances.find((instance) => instance.templateId === task.id && instance.originalDate === dateKey);
    if (natural && natural.date !== dateKey) return; // rescheduled away from this date
    items.push({
      id: `task-${task.id}-${dateKey}`,
      title: task.title,
      category: task.category,
      startMinutes: parseTimeLabel(natural?.scheduledTime ?? task.time),
      durationMinutes: task.duration,
      assignedTo: natural?.assignedTo ?? task.assignedTo,
      dogNames: task.dogIds.map(dogName).join(" & "),
      priority: task.priority,
      placeholder: false,
      source: "task",
      task,
      date: dateKey,
      state: natural?.state ?? "not_started",
    });
  });

  instances
    .filter((instance) => instance.date === dateKey && instance.originalDate !== dateKey)
    .forEach((instance) => {
      const template = tasks.find((item) => item.id === instance.templateId);
      if (!template) return;
      items.push({
        id: `task-${template.id}-${dateKey}-rescheduled`,
        title: `${template.title} (rescheduled)`,
        category: template.category,
        startMinutes: parseTimeLabel(instance.scheduledTime),
        durationMinutes: template.duration,
        assignedTo: instance.assignedTo,
        dogNames: template.dogIds.map(dogName).join(" & "),
        priority: template.priority,
        placeholder: false,
        source: "task",
        task: template,
        date: dateKey,
        state: instance.state,
      });
    });

  healthEvents.forEach((event) => {
    if (event.date !== dateKey) return;
    items.push({
      id: `health-${event.id}`,
      title: event.title,
      category: event.kind,
      startMinutes: parseTimeLabel(event.notes),
      durationMinutes: 60,
      dogNames: dogName(event.dogId),
      placeholder: false,
      source: "health",
      healthEvent: event,
    });
  });

  calendarEvents.forEach((event) => {
    const isOneOffToday = event.kind === "one-off" && event.date === dateKey;
    const activeFromOk = !event.activeFrom || event.activeFrom <= dateKey;
    const activeToOk = !event.activeTo || event.activeTo >= dateKey;
    const isRecurringToday = event.kind === "recurring" && event.dayOfWeek === dow && activeFromOk && activeToOk;
    if (!isOneOffToday && !isRecurringToday) return;
    items.push({
      id: `event-${event.id}`,
      title: event.title,
      category: event.category,
      startMinutes: parseTimeLabel(event.timeLabel),
      durationMinutes: (event.durationHours ?? 1) * 60,
      dogNames: "",
      placeholder: event.status === "placeholder",
      source: "calendar",
      calendarEvent: event,
    });
  });

  return items;
}

function monthDaySummary(day: Date, healthEvents: HealthEvent[], calendarEvents: CalendarEvent[]): { count: number; heavy: boolean } {
  const key = toDateKey(day);
  const dow = dayOfWeekName(day);
  let count = 0;
  let heavy = false;
  healthEvents.forEach((event) => {
    if (event.date === key) count++;
  });
  calendarEvents.forEach((event) => {
    const isOneOff = event.kind === "one-off" && event.date === key;
    const activeFromOk = !event.activeFrom || event.activeFrom <= key;
    const activeToOk = !event.activeTo || event.activeTo >= key;
    const isRecurring = event.kind === "recurring" && event.dayOfWeek === dow && activeFromOk && activeToOk;
    if (isOneOff || isRecurring) {
      count++;
      if (event.importance === "marquee") heavy = true;
    }
  });
  return { count, heavy };
}

// Assigns each item a track (column) and a trackCount scoped to its own cluster
// of mutually-overlapping items, so unrelated non-overlapping items elsewhere in
// the day stay full-width instead of shrinking to match the busiest moment.
function assignTracks(items: AgendaItem[]): (AgendaItem & { track: number; trackCount: number })[] {
  const sorted = [...items].sort((a, b) => a.startMinutes! - b.startMinutes!);
  const result: (AgendaItem & { track: number; trackCount: number })[] = [];
  let cluster: (AgendaItem & { track: number })[] = [];
  let clusterEnd = -Infinity;
  let trackEnds: number[] = [];

  function flushCluster() {
    if (cluster.length === 0) return;
    const trackCount = Math.max(...cluster.map((item) => item.track)) + 1;
    cluster.forEach((item) => result.push({ ...item, trackCount }));
    cluster = [];
  }

  sorted.forEach((item) => {
    const start = item.startMinutes!;
    const end = start + item.durationMinutes;
    if (start >= clusterEnd) {
      flushCluster();
      trackEnds = [];
      clusterEnd = -Infinity;
    }
    let track = trackEnds.findIndex((trackEnd) => trackEnd <= start);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(end);
    } else {
      trackEnds[track] = end;
    }
    clusterEnd = Math.max(clusterEnd, end);
    cluster.push({ ...item, track });
  });
  flushCluster();

  return result;
}

const DAY_START_MIN = 6 * 60;
const DAY_END_MIN = 22 * 60;
const HOUR_HEIGHT = 48;
const MOBILE_HOUR_HEIGHT = 96;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 760);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function CalendarMonthGrid({
  cursor,
  today,
  healthEvents,
  calendarEvents,
  onSelectDay,
}: {
  cursor: Date;
  today: Date;
  healthEvents: HealthEvent[];
  calendarEvents: CalendarEvent[];
  onSelectDay: (date: Date) => void;
}) {
  const days = monthGridDays(cursor);
  return (
    <div className="month-grid">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
        <div key={label} className="month-grid-heading">
          {label}
        </div>
      ))}
      {days.map((day, index) => {
        const info = monthDaySummary(day, healthEvents, calendarEvents);
        const inMonth = day.getMonth() === cursor.getMonth();
        return (
          <button
            key={index}
            type="button"
            className={`month-cell ${inMonth ? "" : "outside"} ${isSameDay(day, today) ? "is-today" : ""} ${info.heavy ? "heavy-week" : ""}`}
            onClick={() => onSelectDay(day)}
          >
            <span className="month-cell-date">{day.getDate()}</span>
            {info.count > 0 && (
              <span className="month-cell-dots">
                {Array.from({ length: Math.min(info.count, 5) }).map((_, dotIndex) => (
                  <span key={dotIndex} className="month-dot" />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CalendarWeekStrip({
  cursor,
  today,
  agendaByDay,
  onSelectDay,
}: {
  cursor: Date;
  today: Date;
  agendaByDay: { day: Date; items: AgendaItem[] }[];
  onSelectDay: (date: Date) => void;
}) {
  return (
    <div className="week-strip">
      {agendaByDay.map(({ day, items }) => {
        const scheduled = items.filter((item) => item.startMinutes !== null).sort((a, b) => a.startMinutes! - b.startMinutes!);
        return (
          <button
            key={toDateKey(day)}
            type="button"
            className={`week-day ${isSameDay(day, today) ? "is-today" : ""}`}
            onClick={() => onSelectDay(day)}
          >
            <span className="week-day-label">{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span>
            <div className="week-day-items">
              {scheduled.slice(0, 4).map((item) => (
                <small key={item.id} className={item.placeholder ? "placeholder" : ""}>
                  {formatMinutes(item.startMinutes!)} · {item.title}
                </small>
              ))}
              {items.length > 4 && <small className="week-day-more">+{items.length - 4} more</small>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CalendarDayAgenda({
  items,
  shouldDim,
  onOpenTask,
  onOpenEvent,
  onOpenDog,
}: {
  items: AgendaItem[];
  shouldDim: (item: AgendaItem) => boolean;
  onOpenTask: (task: Task, date: string) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenDog: (dogId: string) => void;
}) {
  const isMobile = useIsMobile();
  const hourHeight = isMobile ? MOBILE_HOUR_HEIGHT : HOUR_HEIGHT;
  const unscheduled = items.filter((item) => item.startMinutes === null);
  const scheduled = assignTracks(items.filter((item) => item.startMinutes !== null));
  const totalHours = (DAY_END_MIN - DAY_START_MIN) / 60;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => DAY_START_MIN + i * 60);

  function openItem(item: AgendaItem) {
    if (item.task) onOpenTask(item.task, item.date ?? toDateKey(new Date()));
    else if (item.calendarEvent) onOpenEvent(item.calendarEvent);
    else if (item.healthEvent) onOpenDog(item.healthEvent.dogId);
  }

  return (
    <div className="day-agenda">
      {unscheduled.length > 0 && (
        <div className="day-agenda-unscheduled">
          {unscheduled.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`agenda-chip ${item.placeholder ? "placeholder" : ""} ${shouldDim(item) ? "dimmed" : ""}`}
              onClick={() => openItem(item)}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}
      <div className="day-timeline" style={{ height: totalHours * hourHeight }}>
        {hours.map((minute) => (
          <div key={minute} className="day-hour-row" style={{ top: ((minute - DAY_START_MIN) / 60) * hourHeight }}>
            <span className="day-hour-label">{formatMinutes(minute)}</span>
          </div>
        ))}
        {scheduled.map((item) => {
          const top = Math.max(0, ((item.startMinutes! - DAY_START_MIN) / 60) * hourHeight);
          const height = Math.max(isMobile ? 46 : 26, (item.durationMinutes / 60) * hourHeight);
          const width = 100 / item.trackCount;
          const left = width * item.track;
          return (
            <button
              key={item.id}
              type="button"
              className={`day-block ${item.source} ${item.placeholder ? "placeholder" : ""} ${shouldDim(item) ? "dimmed" : ""} state-${item.state ?? ""}`}
              style={{ top, height, width: `calc(${width}% - 6px)`, left: `${left}%` }}
              onClick={() => openItem(item)}
            >
              <strong>{item.title}</strong>
              <span>{formatMinutes(item.startMinutes!)}</span>
              {item.priority && <span className={`priority ${item.priority}`}>{item.priority}</span>}
              {item.dogNames && <span className="day-block-dogs">{item.dogNames}</span>}
              {item.state && item.state !== "not_started" && <span className={`state-tag ${item.state}`}>{taskStateLabels[item.state]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const viewerStorageKey = "dog-life-os-viewer";

function loadViewerId(fallback: string): string {
  try {
    return localStorage.getItem(viewerStorageKey) || fallback;
  } catch {
    return fallback;
  }
}

export function CalendarView() {
  const { healthEvents, milestones, tasks, dogs, calendarEvents, taskInstances, people } = useStore();
  const { navigate } = useNavigation();
  const attendeeNames = (ids?: string[]) =>
    !ids || ids.length === 0 ? "" : ids.map((id) => people.items.find((person) => person.id === id)?.name ?? id).join(" & ");
  const [eventModal, setEventModal] = useState<"new" | (typeof calendarEvents.items)[number] | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "upcoming" | "milestones">("day");
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [viewerId, setViewerId] = useState<string>(() => loadViewerId(people.items[0]?.id ?? ""));
  const [filterMode, setFilterMode] = useState<"all" | "mine" | "other">("all");
  const [detailTask, setDetailTask] = useState<{ task: Task; date: string } | null>(null);
  const touchStartX = useRef<number | null>(null);
  const today = new Date();

  useEffect(() => {
    try {
      localStorage.setItem(viewerStorageKey, viewerId);
    } catch {
      // ignore
    }
  }, [viewerId]);

  function shouldDim(item: AgendaItem): boolean {
    if (filterMode === "all" || !item.assignedTo) return false;
    if (filterMode === "mine") return item.assignedTo !== viewerId;
    return item.assignedTo === viewerId;
  }

  function goPrev() {
    setCursorDate((d) => (viewMode === "day" ? addDays(d, -1) : viewMode === "week" ? addDays(d, -7) : addMonths(d, -1)));
  }
  function goNext() {
    setCursorDate((d) => (viewMode === "day" ? addDays(d, 1) : viewMode === "week" ? addDays(d, 7) : addMonths(d, 1)));
  }
  function goToday() {
    setCursorDate(new Date());
  }
  function selectDay(day: Date) {
    setCursorDate(day);
    setViewMode("day");
  }

  function handleTouchStart(event: ReactTouchEvent) {
    touchStartX.current = event.touches[0].clientX;
  }
  function handleTouchEnd(event: ReactTouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    if (deltaX > 60) goPrev();
    else if (deltaX < -60) goNext();
    touchStartX.current = null;
  }

  function openDog(dogId: string) {
    setDetailTask(null);
    navigate("profile", { dogId });
  }

  const dayAgenda = buildAgendaForDate(cursorDate, tasks.items, healthEvents.items, calendarEvents.items, dogs.items, taskInstances.items);
  const weekAgenda = weekDays(cursorDate).map((day) => ({
    day,
    items: buildAgendaForDate(day, tasks.items, healthEvents.items, calendarEvents.items, dogs.items, taskInstances.items),
  }));

  const isGridMode = viewMode === "day" || viewMode === "week" || viewMode === "month";

  const headingLabel =
    viewMode === "day"
      ? cursorDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : viewMode === "week"
        ? `Week of ${weekStartDate(cursorDate).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
        : viewMode === "month"
          ? cursorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
          : viewMode === "upcoming"
            ? "Upcoming events"
            : "Milestones";

  const recurring = calendarEvents.items.filter((event) => event.kind === "recurring");
  const upcoming = calendarEvents.items
    .filter((event) => event.kind === "one-off")
    .slice()
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const weeks = heavyWeeks(calendarEvents.items);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Household calendar</p>
          <h2>{headingLabel}</h2>
        </div>
        <div className="calendar-controls">
          <div className="subtabs" role="tablist">
            {(["day", "week", "month", "upcoming", "milestones"] as const).map((mode) => (
              <button key={mode} role="tab" aria-selected={viewMode === mode} className={viewMode === mode ? "active" : ""} type="button" onClick={() => setViewMode(mode)}>
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          {isGridMode && (
            <div className="calendar-nav">
              <button className="icon-button" type="button" onClick={goPrev} aria-label="Previous">
                <ChevronLeft size={18} aria-hidden />
              </button>
              <button className="text-button" type="button" onClick={goToday}>
                Today
              </button>
              <button className="icon-button" type="button" onClick={goNext} aria-label="Next">
                <ChevronRight size={18} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>

      {isGridMode && (
        <div className="row between calendar-filter-row">
          <div className="viewer-select" role="group" aria-label="Viewing as">
            <span className="small">Viewing as</span>
            {people.items.map((person) => (
              <button
                key={person.id}
                type="button"
                className={viewerId === person.id ? "active" : ""}
                style={viewerId === person.id ? { borderColor: person.color, color: person.color } : undefined}
                onClick={() => setViewerId(person.id)}
              >
                {person.name}
              </button>
            ))}
          </div>
          <div className="subtabs" role="group" aria-label="Filter tasks">
            {(["all", "mine", "other"] as const).map((mode) => (
              <button key={mode} className={filterMode === mode ? "active" : ""} type="button" onClick={() => setFilterMode(mode)}>
                {mode === "all" ? "All" : mode === "mine" ? "Mine" : "Assigned to other"}
              </button>
            ))}
          </div>
        </div>
      )}

      {isGridMode && (
        <div className="calendar-swipe-area" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {viewMode === "day" && (
            <CalendarDayAgenda
              items={dayAgenda}
              shouldDim={shouldDim}
              onOpenTask={(task, date) => setDetailTask({ task, date })}
              onOpenEvent={(event) => setEventModal(event)}
              onOpenDog={openDog}
            />
          )}
          {viewMode === "week" && <CalendarWeekStrip cursor={cursorDate} today={today} agendaByDay={weekAgenda} onSelectDay={selectDay} />}
          {viewMode === "month" && (
            <CalendarMonthGrid
              cursor={cursorDate}
              today={today}
              healthEvents={healthEvents.items}
              calendarEvents={calendarEvents.items}
              onSelectDay={selectDay}
            />
          )}
        </div>
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask.task}
          date={detailTask.date}
          onClose={() => setDetailTask(null)}
        />
      )}

      {viewMode === "upcoming" && (
        <>
          <div className="row between">
            <div>
              <p className="eyebrow">Recurring commitments</p>
              <h3 style={{ margin: 0 }}>Weekly household schedule</h3>
            </div>
            <button className="primary-button" type="button" onClick={() => setEventModal("new")}>
              <Plus size={16} aria-hidden /> Add calendar event
            </button>
          </div>
          <div className="calendar-grid">
            {recurring.map((event) => (
              <article
                className={`event commitment ${event.category === "downtime" ? "downtime" : ""} ${event.status === "placeholder" ? "placeholder" : ""}`}
                key={event.id}
                onClick={() => setEventModal(event)}
              >
                <span>{event.dayOfWeek ? dayLabels[event.dayOfWeek] : ""}</span>
                <strong>{event.title}</strong>
                <p>
                  {event.timeLabel}
                  {event.activeTo ? ` · through ${formatDate(event.activeTo)}` : ""}
                </p>
                {event.status === "placeholder" && <small className="tbd-tag">TBD</small>}
                {event.attendees && event.attendees.length > 0 && <small>Attendees: {attendeeNames(event.attendees)}</small>}
                <small>{event.notes}</small>
              </article>
            ))}
          </div>

          <div className="row between" style={{ marginTop: 24 }}>
            <div>
              <p className="eyebrow">Upcoming events & football</p>
              <h3 style={{ margin: 0 }}>Concerts, tailgates, and the season</h3>
            </div>
          </div>
          <div className="calendar-grid">
            {upcoming.map((event) => (
              <article
                className={`event one-off ${event.status === "placeholder" ? "placeholder" : ""} ${isHeavyWeek(event, weeks) ? "heavy-week" : ""}`}
                key={event.id}
                onClick={() => setEventModal(event)}
              >
                <span>{event.date ? formatDate(event.date) : event.windowLabel || "Date TBD"}</span>
                <strong>{event.title}</strong>
                <p>{event.timeLabel}</p>
                {event.status === "placeholder" && <small className="tbd-tag">TBD</small>}
                {isHeavyWeek(event, weeks) && <small className="heavy-tag">Heavy week</small>}
                {event.coverageNeeded === "rover" && (
                  <small className="rover-tag">
                    {event.roverVisits === undefined
                      ? "Rover — varies by trip length"
                      : `Rover × ${event.roverVisits} visit${event.roverVisits === 1 ? "" : "s"}`}
                  </small>
                )}
                <small>{event.notes}</small>
                {(event.prepSteps?.length || event.roverInstructions?.length || event.postSteps?.length) && (
                  <div className="rover-plan">
                    {!!event.prepSteps?.length && (
                      <>
                        <small className="rover-plan-heading">Before leaving</small>
                        <ul>
                          {event.prepSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {!!event.roverInstructions?.length && (
                      <>
                        <small className="rover-plan-heading">Rover visit(s)</small>
                        <ul>
                          {event.roverInstructions.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {!!event.postSteps?.length && (
                      <>
                        <small className="rover-plan-heading">On return</small>
                        <ul>
                          {event.postSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {viewMode === "milestones" && <CalendarMilestonesPanel milestonesList={milestones.items} onNavigate={() => navigate("training")} />}

      {eventModal && (
        <Modal title={eventModal === "new" ? "Add calendar event" : "Edit calendar event"} onClose={() => setEventModal(null)}>
          <CalendarEventForm
            initial={eventModal === "new" ? undefined : eventModal}
            onCancel={() => setEventModal(null)}
            onSubmit={(values) => {
              if (eventModal === "new") {
                calendarEvents.add(calendarEventFormValuesToEvent(values, makeId("event")));
              } else {
                calendarEvents.update(
                  eventModal.id,
                  calendarEventFormValuesToEvent(values, eventModal.id, {
                    attendees: eventModal.attendees,
                    roverVisits: eventModal.roverVisits,
                    prepSteps: eventModal.prepSteps,
                    roverInstructions: eventModal.roverInstructions,
                    postSteps: eventModal.postSteps,
                  }),
                );
              }
              setEventModal(null);
            }}
          />
        </Modal>
      )}
    </section>
  );
}

function CalendarMilestonesPanel({ milestonesList, onNavigate }: { milestonesList: Milestone[]; onNavigate: () => void }) {
  const current = milestonesList.filter((item) => item.status === "current");
  const delayed = milestonesList.filter((item) => item.status === "delayed");
  const upNext = milestonesList.filter((item) => item.status === "locked");
  const skipped = milestonesList.filter((item) => item.status === "skipped");
  const completed = milestonesList.filter((item) => item.status === "completed");

  return (
    <div>
      {current.length > 0 && (
        <>
          <p className="eyebrow">Current focus</p>
          <div className="stack" style={{ marginBottom: 24 }}>
            {current.map((item) => (
              <MilestoneCard key={item.id} milestone={item} />
            ))}
          </div>
        </>
      )}
      {delayed.length > 0 && (
        <>
          <p className="eyebrow">Delayed — needs attention</p>
          <div className="calendar-grid" style={{ marginBottom: 24 }}>
            {delayed.map((item) => (
              <article className="event milestone-row status-delayed" key={item.id} onClick={onNavigate}>
                <span>{item.track}</span>
                <strong>{item.title}</strong>
                <p>{item.why}</p>
              </article>
            ))}
          </div>
        </>
      )}
      <p className="eyebrow">Up next ({upNext.length})</p>
      <div className="calendar-grid" style={{ marginBottom: 24 }}>
        {upNext.map((item) => (
          <article className="event milestone-row" key={item.id} onClick={onNavigate}>
            <span>{item.track}</span>
            <strong>{item.title}</strong>
            <p>{item.dependencies.length ? `Waiting on: ${item.dependencies.join(", ")}` : "Ready to start"}</p>
          </article>
        ))}
        {upNext.length === 0 && <p className="small">Nothing queued.</p>}
      </div>
      {skipped.length > 0 && (
        <>
          <p className="eyebrow">Skipped</p>
          <div className="calendar-grid" style={{ marginBottom: 24 }}>
            {skipped.map((item) => (
              <article className="event milestone-row status-skipped" key={item.id} onClick={onNavigate}>
                <span>{item.track}</span>
                <strong>{item.title}</strong>
              </article>
            ))}
          </div>
        </>
      )}
      <p className="eyebrow">Completed ({completed.length})</p>
      <div className="calendar-grid">
        {completed.map((item) => (
          <article className="event milestone-row status-completed" key={item.id} onClick={onNavigate}>
            <span>{item.track}</span>
            <strong>{item.title}</strong>
          </article>
        ))}
        {completed.length === 0 && <p className="small">None yet.</p>}
      </div>
    </div>
  );
}

export function ProfileView() {
  const { dogs, people } = useStore();
  const [dogModal, setDogModal] = useState<"new" | Dog | null>(null);
  const [personModal, setPersonModal] = useState(false);
  const { focus, clearFocus } = useNavigation();

  useEffect(() => {
    if (!focus?.dogId) return;
    const el = document.getElementById(`dog-profile-${focus.dogId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(clearFocus, 2500);
    return () => clearTimeout(timeout);
  }, [focus?.dogId]);

  return (
    <section className="profile-page">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Profiles</p>
            <h2>Pets</h2>
          </div>
          <button className="primary-button" type="button" onClick={() => setDogModal("new")}>
            <Plus size={16} aria-hidden /> Add dog
          </button>
        </div>
        <div className="dog-grid">
          {dogs.items.map((dog) => (
            <div id={`dog-profile-${dog.id}`} className={focus?.dogId === dog.id ? "focus-target" : ""} key={dog.id}>
              <DogProfile dog={dog} onEdit={(target) => setDogModal(target)} onDelete={(target) => dogs.remove(target.id)} />
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Household</p>
            <h2>Humans</h2>
          </div>
          <button className="primary-button" type="button" onClick={() => setPersonModal(true)}>
            <Plus size={16} aria-hidden /> Add person
          </button>
        </div>
        <div className="people-grid">
          {people.items.map((person) => (
            <HumanProfile key={person.id} person={person} />
          ))}
        </div>
        <div className="settings-row">
          <Info size={18} aria-hidden />
          <p>Humans stay lightweight: name, color, and task assignments. Permissions and notification preferences can live in auth later.</p>
        </div>
      </div>

      {dogModal && (
        <Modal title={dogModal === "new" ? "Add dog" : `Edit ${dogModal.name}`} onClose={() => setDogModal(null)}>
          <DogForm
            initial={dogModal === "new" ? undefined : dogModal}
            onCancel={() => setDogModal(null)}
            onSubmit={(values) => {
              if (dogModal === "new") {
                dogs.add(dogFormValuesToDog(values, { id: makeId("dog"), householdId: "andrew-bree", weightHistory: [{ date: values.birthday, pounds: values.weight, notes: "Starting weight" }] }));
              } else {
                dogs.update(dogModal.id, dogFormValuesToDog(values, { id: dogModal.id, householdId: dogModal.householdId, weightHistory: dogModal.weightHistory }));
              }
              setDogModal(null);
            }}
          />
        </Modal>
      )}
      {personModal && (
        <Modal title="Add person" onClose={() => setPersonModal(false)}>
          <PersonForm
            onCancel={() => setPersonModal(false)}
            onSubmit={(values) => {
              people.add({ id: makeId("person"), householdId: "andrew-bree", ...values });
              setPersonModal(false);
            }}
          />
        </Modal>
      )}
    </section>
  );
}

const exposureCategoryCopy: Record<ExposureCategory, { title: string; blurb: string }> = {
  socialization: { title: "Socialization library", blurb: "Log calm, short exposures. Watch body language and stop before your puppy tips into fear." },
  confidence: { title: "Confidence building", blurb: "Novel surfaces and objects build resilience. Let the puppy choose to investigate." },
  handling: { title: "Cooperative handling", blurb: "Daily consent-based handling reps build a dog who accepts vet and grooming care." },
};

function ExposureGrid({ category }: { category: ExposureCategory }) {
  const { exposureItems, logExposure } = useStore();
  const [logging, setLogging] = useState<ExposureItem | null>(null);
  const items = exposureItems.items.filter((item) => item.category === category);
  const comfortable = items.filter((item) => item.status === "comfortable").length;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{exposureCategoryCopy[category].title}</p>
          <h2>
            {comfortable}/{items.length} comfortable
          </h2>
        </div>
      </div>
      <p className="small">{exposureCategoryCopy[category].blurb}</p>
      <div className="exposure-grid">
        {items.map((item) => (
          <article key={item.id} className={`exposure-card ${item.status}`}>
            <span className={`status ${item.status}`}>{item.status.replace("-", " ")}</span>
            <strong>{item.title}</strong>
            {item.log.length > 0 && (
              <small>
                Last: {item.log[item.log.length - 1].reaction} on {item.log[item.log.length - 1].date}
              </small>
            )}
            <button className="text-button" type="button" onClick={() => setLogging(item)}>
              Log exposure
            </button>
          </article>
        ))}
      </div>
      {logging && (
        <Modal title={`Log: ${logging.title}`} onClose={() => setLogging(null)}>
          <ExposureLogForm
            item={logging}
            onCancel={() => setLogging(null)}
            onSubmit={(values) => {
              logExposure(logging.id, { date: new Date().toISOString().slice(0, 10), reaction: values.reaction, notes: values.notes }, values.status);
              setLogging(null);
            }}
          />
        </Modal>
      )}
    </section>
  );
}

export function TrainingView() {
  const { milestones } = useStore();
  const [tab, setTab] = useState<"obedience" | ExposureCategory>("obedience");
  const tabs: { id: typeof tab; label: string }[] = [
    { id: "obedience", label: "Obedience" },
    { id: "socialization", label: "Socialization" },
    { id: "confidence", label: "Confidence" },
    { id: "handling", label: "Handling" },
  ];
  return (
    <div className="stack">
      <div className="subtabs" role="tablist">
        {tabs.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? "active" : ""} type="button" onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "obedience" && (
        <section className="milestone-grid">
          {milestones.items
            .filter((milestone) => milestone.track === "obedience")
            .map((milestone) => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
        </section>
      )}
      {tab !== "obedience" && <ExposureGrid category={tab} />}
    </div>
  );
}

export function MilestonesView() {
  const { milestones } = useStore();
  const { focus, clearFocus } = useNavigation();

  useEffect(() => {
    if (!focus?.milestoneId) return;
    const el = document.getElementById(`milestone-${focus.milestoneId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(clearFocus, 2500);
    return () => clearTimeout(timeout);
  }, [focus?.milestoneId]);

  return (
    <section className="roadmap">
      {milestones.items.map((milestone) => (
        <div id={`milestone-${milestone.id}`} className={focus?.milestoneId === milestone.id ? "focus-target" : ""} key={milestone.id}>
          <MilestoneCard milestone={milestone} />
        </div>
      ))}
    </section>
  );
}

export function JournalView() {
  const { journalEntries, dogs } = useStore();
  const [open, setOpen] = useState(false);
  const sorted = [...journalEntries.items].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <section className="panel journal">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Journal</p>
          <h2>Memories, growth, and health notes</h2>
        </div>
        <button className="primary-button" type="button" onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden /> Add entry
        </button>
      </div>
      {sorted.map((entry) => (
        <article key={entry.id}>
          <span>{entry.date}</span>
          <h3>{entry.title}</h3>
          <p>{entry.text}</p>
          <div>{entry.tags.map((tag) => <small key={tag}>{tag}</small>)}</div>
        </article>
      ))}
      {open && (
        <Modal title="Add journal entry" onClose={() => setOpen(false)}>
          <JournalForm
            dogOptions={dogs.items.map((dog) => ({ id: dog.id, name: dog.name }))}
            onCancel={() => setOpen(false)}
            onSubmit={(values) => {
              journalEntries.add(journalFormValuesToEntry(values, makeId("entry")));
              setOpen(false);
            }}
          />
        </Modal>
      )}
    </section>
  );
}

export function HealthView() {
  const { dogs, healthEvents } = useStore();
  const [modal, setModal] = useState<"new" | HealthEvent | null>(null);
  const dogName = (id: string) => dogs.items.find((dog) => dog.id === id)?.name ?? id;
  const sortedEvents = healthEvents.items.slice().sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="stack">
      <CalendarView />
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Health</p>
            <h2>Growth charts and upcoming care</h2>
          </div>
          <button className="primary-button" type="button" onClick={() => setModal("new")}>
            <Plus size={16} aria-hidden /> Add health event
          </button>
        </div>
        <div className="growth-grid">
          {dogs.items.map((dog) => (
            <article className="growth-card" key={dog.id}>
              <strong>{dog.name}</strong>
              <p className="small">{ageLabel(dog.birthday)}</p>
              <Sparkline values={dog.weightHistory.map((entry) => entry.pounds)} />
              <p className="small">{dog.weightHistory[dog.weightHistory.length - 1]?.pounds ?? dog.weight} lb latest</p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h2>Vet visits, vaccines & records</h2>
          </div>
        </div>
        <div className="task-list">
          {sortedEvents.length === 0 && <p className="small">Nothing logged yet.</p>}
          {sortedEvents.map((event) => (
            <article className="event health-event-row" key={event.id} onClick={() => setModal(event)}>
              <span>
                {formatDate(event.date)} · {dogName(event.dogId)}
              </span>
              <strong>{event.title}</strong>
              <p className="small">{event.kind}</p>
              {event.notes && <small>{event.notes}</small>}
              {event.documentUrl && (
                <a
                  href={event.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(clickEvent) => clickEvent.stopPropagation()}
                >
                  View record / receipt
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
      {modal && (
        <Modal title={modal === "new" ? "Add health event" : "Edit health event"} onClose={() => setModal(null)}>
          <HealthEventForm
            initial={modal === "new" ? undefined : modal}
            dogOptions={dogs.items.map((dog) => ({ id: dog.id, name: dog.name }))}
            onCancel={() => setModal(null)}
            onSubmit={(values) => {
              if (modal === "new") {
                healthEvents.add(healthEventFormValuesToEvent(values, makeId("health")));
              } else {
                healthEvents.update(modal.id, healthEventFormValuesToEvent(values, modal.id));
              }
              setModal(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export function TasksView() {
  const { tasks, feedback, people, dogs, completeTask } = useStore();
  const [open, setOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const feedbackByTask = new Map(feedback.map((item) => [item.taskId, item]));
  const todayKey = toDateKey(new Date());
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">All tasks</p>
          <h2>Full task list</h2>
        </div>
        <button className="primary-button" type="button" onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden /> Add task
        </button>
      </div>
      <div className="task-list">
        {tasks.items.map((task: Task) => (
          <TaskCard
            key={task.id}
            task={task}
            feedback={feedbackByTask.get(task.id)}
            onComplete={completeTask}
            onDelete={(target) => tasks.remove(target.id)}
            onOpenDetail={setDetailTask}
          />
        ))}
      </div>
      {open && (
        <Modal title="Add task" onClose={() => setOpen(false)}>
          <TaskForm
            peopleOptions={people.items.map((person) => ({ id: person.id, name: person.name }))}
            dogOptions={dogs.items.map((dog) => ({ id: dog.id, name: dog.name }))}
            onCancel={() => setOpen(false)}
            onSubmit={(values) => {
              tasks.add(taskFormValuesToTask(values, makeId("task")));
              setOpen(false);
            }}
          />
        </Modal>
      )}
      {detailTask && <TaskDetailModal task={detailTask} date={todayKey} onClose={() => setDetailTask(null)} />}
    </section>
  );
}

export function InboxView() {
  const { inboxRequests, taskInstances, tasks, people, respondToDelegation } = useStore();
  const [error, setError] = useState<string | null>(null);

  const pending = inboxRequests.items
    .filter((request) => request.status === "pending")
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const resolved = inboxRequests.items
    .filter((request) => request.status !== "pending")
    .slice()
    .sort((a, b) => (b.respondedAt ?? "").localeCompare(a.respondedAt ?? ""));

  function taskTitleFor(taskInstanceId: string) {
    const instance = taskInstances.items.find((item) => item.id === taskInstanceId);
    const template = instance ? tasks.items.find((item) => item.id === instance.templateId) : undefined;
    return { title: template?.title ?? "Unknown task", date: instance?.date };
  }

  async function respond(requestId: string, accept: boolean) {
    setError(null);
    const ok = await respondToDelegation(requestId, accept);
    if (!ok) setError("That didn't save — check the browser console and try again.");
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>Delegation requests</h2>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="inbox-list">
        {pending.length === 0 && <p className="small">Nothing pending.</p>}
        {pending.map((request) => {
          const { title, date } = taskTitleFor(request.taskInstanceId);
          return (
            <article className="inbox-card" key={request.id}>
              <div>
                <strong>{title}</strong>
                <p className="small">
                  <PersonName id={request.fromPersonId} /> asked <PersonName id={request.toPersonId} /> to take this
                  {date ? ` (${date})` : ""}.
                </p>
              </div>
              <div className="row">
                <button className="text-button" type="button" onClick={() => respond(request.id, false)}>
                  Decline
                </button>
                <button className="primary-button" type="button" onClick={() => respond(request.id, true)}>
                  Accept
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {resolved.length > 0 && (
        <>
          <div className="section-heading" style={{ marginTop: 24 }}>
            <div>
              <p className="eyebrow">Resolved</p>
              <h2>History</h2>
            </div>
          </div>
          <div className="inbox-list">
            {resolved.map((request) => {
              const { title } = taskTitleFor(request.taskInstanceId);
              return (
                <article className="inbox-card" key={request.id}>
                  <div>
                    <strong>{title}</strong>
                    <p className="small">
                      <PersonName id={request.fromPersonId} /> → <PersonName id={request.toPersonId} />:{" "}
                      <span className={`state-tag ${request.status}`}>{request.status}</span>
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

export function RelationshipTracker() {
  const { relationshipLogs, dogs } = useStore();
  const [open, setOpen] = useState(false);
  const sorted = [...relationshipLogs.items].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = sorted[0];
  const dimensions: { key: keyof typeof latest; label: string }[] = [
    { key: "comfort", label: "Comfort" },
    { key: "sharedToys", label: "Shared toys" },
    { key: "sharedBeds", label: "Shared beds" },
    { key: "sharedWalks", label: "Shared walks" },
    { key: "bodyLanguage", label: "Body language" },
    { key: "playQuality", label: "Play quality" },
  ];
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Relationship tracker</p>
          <h2>Puppy &amp; Griz household bond</h2>
        </div>
        <button className="primary-button" type="button" onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden /> Log check-in
        </button>
      </div>
      {latest ? (
        <>
          <div className="analytics-list">
            {dimensions.map((dimension) => (
              <div key={dimension.key}>
                <span>{dimension.label}</span>
                <ProgressBar value={Number(latest[dimension.key])} />
              </div>
            ))}
          </div>
          <div className="metric-grid">
            <AppMetric label="Resource guarding" value={`${latest.resourceGuarding}%`} icon={AlertTriangle} />
            <AppMetric label="Corrections needed" value={`${latest.corrections}`} icon={Activity} />
            <AppMetric label="Recovery time" value={`${latest.recoveryMinutes} min`} icon={HeartPulse} />
          </div>
          <p className="small">{latest.notes}</p>
          <Sparkline values={sorted.map((log) => log.comfort).reverse()} />
        </>
      ) : (
        <p className="small">No relationship check-ins logged yet.</p>
      )}
      {open && (
        <Modal title="Log relationship check-in" onClose={() => setOpen(false)}>
          <RelationshipLogForm
            onCancel={() => setOpen(false)}
            onSubmit={(values) => {
              const ids = dogs.items.slice(0, 2).map((dog) => dog.id) as [string, string];
              relationshipLogs.add(relationshipLogFormValuesToLog(values, makeId("relationship"), ids));
              setOpen(false);
            }}
          />
        </Modal>
      )}
    </section>
  );
}

export function AnalyticsView() {
  const { feedback, journalEntries, dogs } = useStore();
  const completed = feedback.filter((item) => item.completed).length;
  const accidents = feedback.filter((item) => item.accident).length;
  const avgRating = feedback.length ? (feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length).toFixed(1) : "0.0";
  const ratingTrend = feedback.map((item) => item.rating);
  const puppy = dogs.items.find((dog) => dog.status === "puppy") ?? dogs.items[0];
  const moodScore = { great: 90, steady: 60, hard: 30 };
  const journalTrend = [...journalEntries.items].sort((a, b) => (a.date < b.date ? -1 : 1)).map((entry) => moodScore[entry.mood]);

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Longitudinal tracking</p>
            <h2>Confidence, relationship, health, and training</h2>
          </div>
        </div>
        <div className="metric-grid">
          <AppMetric label="Completed logs" value={`${completed}`} icon={Check} />
          <AppMetric label="Average rating" value={avgRating} icon={Sparkles} />
          <AppMetric label="Potty accidents" value={`${accidents}`} icon={AlertTriangle} />
          <AppMetric label="Training minutes" value="26/day" icon={Activity} />
        </div>
        <div className="chart-row">
          <div>
            <p className="eyebrow">Task rating trend</p>
            <Sparkline values={ratingTrend.length ? ratingTrend : [0]} />
          </div>
          <div>
            <p className="eyebrow">Journal mood trend</p>
            <Sparkline values={journalTrend.length ? journalTrend : [0]} />
          </div>
          {puppy && (
            <div>
              <p className="eyebrow">Weight growth</p>
              <Sparkline values={puppy.weightHistory.map((entry) => entry.pounds)} />
            </div>
          )}
        </div>
        {puppy && (
          <div className="analytics-list">
            {[
              ["Confidence", puppy.confidence],
              ["Socialization exposure", 100 - puppy.fearfulness],
              ["Emotional regulation", 100 - puppy.resourceGuarding],
              ["Independence", puppy.humanFriendliness],
              ["Impulse control", puppy.masteredCommands.length * 8],
            ].map(([label, value]) => (
              <div key={label as string}>
                <span>{label}</span>
                <ProgressBar value={Number(value)} />
              </div>
            ))}
          </div>
        )}
      </section>
      <RelationshipTracker />
      <FeedbackLoopView />
    </div>
  );
}

function FeedbackLoopView() {
  const { feedbackLoopRules } = useStore();
  const routeLabels: Record<FeedbackLoopRule["route"], string> = {
    algorithm: "Algorithm",
    genAI: "GenAI",
    "human-review": "Human review",
  };
  return (
    <section className="panel feedback-loop">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Feedback loop</p>
          <h2>Rules first, AI only where it earns its keep</h2>
        </div>
      </div>
      <div className="loop-summary">
        <article>
          <strong>Algorithm updates</strong>
          <p>Use for structured facts: ratings, checkboxes, weight, vaccines, medication, age gates, and milestone session counts.</p>
        </article>
        <article>
          <strong>GenAI updates</strong>
          <p>Use for language: notes, vet instructions, weekly summaries, ambiguous behavior patterns, and optional future video review.</p>
        </article>
        <article>
          <strong>Human review</strong>
          <p>Use for safety: injuries, medication reactions, repeated guarding, severe fear, or anything that should involve a vet or trainer.</p>
        </article>
      </div>
      <div className="loop-grid">
        {feedbackLoopRules.map((rule) => (
          <article key={rule.id} className={`loop-card ${rule.route}`}>
            <div className="row between">
              <span>{routeLabels[rule.route]}</span>
              <small>{rule.cadence}</small>
            </div>
            <h3>{rule.trigger}</h3>
            <ul>
              {rule.updates.map((update) => (
                <li key={update}>{update}</li>
              ))}
            </ul>
            <p>{rule.costControl}</p>
          </article>
        ))}
      </div>
      <div className="cost-notes">
        <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer">
          OpenAI API pricing
        </a>
        <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer">
          Gemini API pricing
        </a>
        <a href="https://platform.claude.com/docs/en/about-claude/pricing" target="_blank" rel="noreferrer">
          Claude API pricing
        </a>
      </div>
    </section>
  );
}

function AccountSection() {
  const { session } = useSession();
  const [password, setPasswordValue] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "success" | "error"; message?: string }>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);

  if (!isBackendConfigured()) return null;

  async function handleSetPassword(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await setAccountPassword(password);
      setStatus({ kind: "success", message: "Password updated." });
      setPasswordValue("");
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not update password." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h2>{session?.user.email}</h2>
        </div>
        <button className="text-button" type="button" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
      <form className="entity-form" onSubmit={handleSetPassword}>
        <label>
          Set or update password (optional — magic link always works without one)
          <input type="password" value={password} onChange={(event) => setPasswordValue(event.target.value)} minLength={6} />
        </label>
        {status.kind === "success" && <p className="form-success">{status.message}</p>}
        {status.kind === "error" && <p className="form-error">{status.message}</p>}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={submitting || password.length < 6}>
            Update password
          </button>
        </div>
      </form>
    </section>
  );
}

const inventoryLocationLabels: Record<string, string> = { fridge: "Fridge", freezer: "Freezer", pantry: "Pantry" };
const inventoryCategoryOptions = [
  "produce",
  "dairy",
  "meat",
  "seafood",
  "eggs",
  "bread",
  "frozen",
  "pantry-staple",
  "leftovers",
  "other",
] as const;

function MealForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (values: { name: string; description: string; prepMinutes: number; cookMinutes: number; ingredients: { name: string; quantity: number; unit: string }[] }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prepMinutes, setPrepMinutes] = useState(15);
  const [cookMinutes, setCookMinutes] = useState(30);
  const [ingredientsText, setIngredientsText] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const ingredients = ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [ingName, qty, unit] = line.split(",").map((part) => part.trim());
        return { name: ingName ?? line, quantity: Number(qty) || 1, unit: unit ?? "" };
      });
    onSubmit({ name: name.trim(), description: description.trim(), prepMinutes, cookMinutes, ingredients });
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <label>
        Meal name
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        Description
        <textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="form-grid">
        <label>
          Prep minutes
          <input type="number" min={0} value={prepMinutes} onChange={(event) => setPrepMinutes(Number(event.target.value))} />
        </label>
        <label>
          Cook minutes
          <input type="number" min={0} value={cookMinutes} onChange={(event) => setCookMinutes(Number(event.target.value))} />
        </label>
      </div>
      <label>
        Ingredients — one per line: name, quantity, unit
        <textarea rows={4} value={ingredientsText} onChange={(event) => setIngredientsText(event.target.value)} placeholder={"chicken breast, 2, lb\nrice, 1, cup"} />
      </label>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Save meal
        </button>
      </div>
    </form>
  );
}

function InventoryItemForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (values: { itemName: string; category: string; location: string; quantity: number; unit: string; purchaseDate: string; estimatedExpirationDate: string }) => void;
}) {
  const { shelfLifeDefaultsDays } = useStore();
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<(typeof inventoryCategoryOptions)[number]>("produce");
  const [location, setLocation] = useState("fridge");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(toDateKey(new Date()));
  const [expiration, setExpiration] = useState(() => toDateKey(addDays(new Date(), shelfLifeDefaultsDays.produce)));
  const [expirationTouched, setExpirationTouched] = useState(false);

  function handleCategoryChange(next: (typeof inventoryCategoryOptions)[number]) {
    setCategory(next);
    if (!expirationTouched) {
      setExpiration(toDateKey(addDays(parseLocalDate(purchaseDate), shelfLifeDefaultsDays[next])));
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!itemName.trim()) return;
    onSubmit({ itemName: itemName.trim(), category, location, quantity, unit: unit.trim(), purchaseDate, estimatedExpirationDate: expiration });
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <label>
        Item name
        <input value={itemName} onChange={(event) => setItemName(event.target.value)} required />
      </label>
      <div className="form-grid">
        <label>
          Category
          <select value={category} onChange={(event) => handleCategoryChange(event.target.value as (typeof inventoryCategoryOptions)[number])}>
            {inventoryCategoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Location
          <select value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="fridge">Fridge</option>
            <option value="freezer">Freezer</option>
            <option value="pantry">Pantry</option>
          </select>
        </label>
        <label>
          Quantity
          <input type="number" min={0} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
        </label>
        <label>
          Unit
          <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="lb, cup, each…" />
        </label>
        <label>
          Purchase date
          <input
            type="date"
            value={purchaseDate}
            onChange={(event) => {
              setPurchaseDate(event.target.value);
              if (!expirationTouched) setExpiration(toDateKey(addDays(parseLocalDate(event.target.value), shelfLifeDefaultsDays[category])));
            }}
          />
        </label>
        <label>
          Estimated expiration
          <input
            type="date"
            value={expiration}
            onChange={(event) => {
              setExpiration(event.target.value);
              setExpirationTouched(true);
            }}
          />
        </label>
      </div>
      <div className="form-actions">
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-button" type="submit">
          Add to inventory
        </button>
      </div>
    </form>
  );
}

export function MealsView() {
  const { meals, recipeIngredients, inventory, groceryList, tasks, calendarEvents } = useStore();
  const [mealModal, setMealModal] = useState(false);
  const [inventoryModal, setInventoryModal] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => weekStartDate(new Date()));
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const week = weekDays(weekStart);
  const weekKeys = week.map((day) => toDateKey(day));
  const unassignedMeals = meals.items.filter((meal) => !meal.plannedDate);

  function assignMeal(mealId: string, dateKey: string) {
    meals.update(mealId, { plannedDate: dateKey });
  }

  function unassignMeal(mealId: string) {
    meals.update(mealId, { plannedDate: undefined });
  }

  function addMeal(values: { name: string; description: string; prepMinutes: number; cookMinutes: number; ingredients: { name: string; quantity: number; unit: string }[] }) {
    const id = makeId("meal");
    meals.add({ id, name: values.name, description: values.description, source: "manual_entry", prepMinutes: values.prepMinutes, cookMinutes: values.cookMinutes });
    values.ingredients.forEach((ingredient) => {
      recipeIngredients.add({ id: makeId("ingredient"), mealId: id, ingredientName: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit });
    });
    setMealModal(false);
  }

  function addInventoryItem(values: { itemName: string; category: string; location: string; quantity: number; unit: string; purchaseDate: string; estimatedExpirationDate: string }) {
    inventory.add({
      id: makeId("inventory"),
      itemName: values.itemName,
      category: values.category as InventoryItem["category"],
      location: values.location as InventoryItem["location"],
      quantity: values.quantity,
      unit: values.unit,
      purchaseDate: values.purchaseDate,
      estimatedExpirationDate: values.estimatedExpirationDate,
    });
    setInventoryModal(false);
  }

  function handleGenerateGroceryList() {
    const generated = generateGroceryList(weekKeys, meals.items, recipeIngredients.items, inventory.items, makeId);
    groceryList.setItems(generated);
  }

  function toggleGroceryStatus(item: (typeof groceryList.items)[number]) {
    const next = item.status === "needed" ? "ordered" : item.status === "ordered" ? "already_have" : "needed";
    groceryList.update(item.id, { status: next });
  }

  async function copyGroceryList() {
    const lines = groceryList.items
      .filter((item) => item.status === "needed")
      .map((item) => `${item.itemName} x${item.quantityNeeded}${item.unit ? ` ${item.unit}` : ""}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      setCopyStatus("Copied — paste into your Walmart order.");
    } catch {
      setCopyStatus("Couldn't copy automatically — select and copy the list manually.");
    }
    setTimeout(() => setCopyStatus(null), 3000);
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Weekly plan</p>
            <h2>Week of {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })}</h2>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="icon-button" type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button className="icon-button" type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
              <ChevronRight size={18} aria-hidden />
            </button>
            <button className="primary-button" type="button" onClick={() => setMealModal(true)}>
              <Plus size={16} aria-hidden /> Add meal idea
            </button>
          </div>
        </div>

        <div className="week-strip">
          {week.map((day) => {
            const dateKey = toDateKey(day);
            const dayMeals = meals.items.filter((meal) => meal.plannedDate === dateKey);
            const load = dayLoadMinutes(dateKey, tasks.items, calendarEvents.items);
            const busy = load >= 120;
            return (
              <div key={dateKey} className="week-day meal-day">
                <span className="week-day-label">{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span>
                {busy && <small className="tbd-tag">Busy night — {Math.round(load / 60)}h already scheduled</small>}
                <div className="week-day-items">
                  {dayMeals.map((meal) => (
                    <div key={meal.id} className="meal-chip">
                      <strong>{meal.name}</strong>
                      <span className="small">
                        {meal.prepMinutes + meal.cookMinutes} min total
                        {busy && meal.prepMinutes + meal.cookMinutes > 45 ? " · consider a shorter meal tonight" : ""}
                      </span>
                      <button className="text-button" type="button" onClick={() => unassignMeal(meal.id)}>
                        Unassign
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {unassignedMeals.length > 0 && (
          <>
            <p className="eyebrow" style={{ marginTop: 16 }}>
              Unassigned meal ideas
            </p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {unassignedMeals.map((meal) => (
                <div key={meal.id} className="meal-chip">
                  <strong>{meal.name}</strong>
                  <select defaultValue="" onChange={(event) => event.target.value && assignMeal(meal.id, event.target.value)}>
                    <option value="">Assign to day…</option>
                    {week.map((day) => (
                      <option key={toDateKey(day)} value={toDateKey(day)}>
                        {day.toLocaleDateString(undefined, { weekday: "short" })}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>Fridge, freezer, pantry</h2>
          </div>
          <button className="primary-button" type="button" onClick={() => setInventoryModal(true)}>
            <Plus size={16} aria-hidden /> Add item
          </button>
        </div>
        <div className="calendar-grid">
          {(["fridge", "freezer", "pantry"] as const).map((loc) => (
            <div key={loc}>
              <p className="eyebrow">{inventoryLocationLabels[loc]}</p>
              {inventory.items
                .filter((item) => item.location === loc)
                .map((item) => (
                  <article key={item.id} className={`event ${isExpired(item) ? "heavy-week" : isExpiringSoon(item) ? "placeholder" : ""}`}>
                    <strong>{item.itemName}</strong>
                    <p>
                      {item.quantity} {item.unit}
                    </p>
                    <small>
                      {isExpired(item) ? "Expired" : isExpiringSoon(item) ? "Expiring soon" : "Fresh"} — est. {formatDate(item.estimatedExpirationDate)}
                    </small>
                  </article>
                ))}
              {inventory.items.filter((item) => item.location === loc).length === 0 && <p className="small">Nothing logged.</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Grocery list</p>
            <h2>This week's shopping</h2>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="text-button" type="button" onClick={handleGenerateGroceryList}>
              Generate from this week's meals
            </button>
            <button className="primary-button" type="button" onClick={copyGroceryList}>
              Copy needed items
            </button>
          </div>
        </div>
        {copyStatus && <p className="small">{copyStatus}</p>}
        {groceryList.items.length === 0 && <p className="small">Nothing generated yet — plan some meals for the week, then generate.</p>}
        <div className="task-list">
          {groceryList.items.map((item) => (
            <article key={item.id} className={`event ${item.status === "already_have" ? "" : item.status === "ordered" ? "placeholder" : "recurring"}`} onClick={() => toggleGroceryStatus(item)} style={{ cursor: "pointer" }}>
              <span>{item.status}</span>
              <strong>
                {item.itemName} × {item.quantityNeeded} {item.unit}
              </strong>
              <small>Tap to cycle: needed → ordered → already have</small>
            </article>
          ))}
        </div>
      </section>

      {mealModal && (
        <Modal title="Add meal idea" onClose={() => setMealModal(false)}>
          <MealForm onCancel={() => setMealModal(false)} onSubmit={addMeal} />
        </Modal>
      )}
      {inventoryModal && (
        <Modal title="Add inventory item" onClose={() => setInventoryModal(false)}>
          <InventoryItemForm onCancel={() => setInventoryModal(false)} onSubmit={addInventoryItem} />
        </Modal>
      )}
    </div>
  );
}

export function SettingsView({
  theme,
  onToggleTheme,
  largeText,
  onToggleLargeText,
  onExport,
  onImportClick,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  largeText: boolean;
  onToggleLargeText: () => void;
  onExport: () => void;
  onImportClick: () => void;
}) {
  const { people } = useStore();
  const { timezone, setTimezone } = useNavigation();
  const [personModal, setPersonModal] = useState(false);
  return (
    <div className="stack settings">
      <AccountSection />
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Appearance</p>
            <h2>Display</h2>
          </div>
        </div>
        <div className="settings-row">
          {theme === "dark" ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />}
          <p>Currently using {theme === "dark" ? "dark" : "light"} mode.</p>
          <button className="icon-button" type="button" onClick={onToggleTheme} aria-label="Toggle dark mode">
            {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
        </div>
        <div className="settings-row">
          <TypeIcon size={18} aria-hidden />
          <p>{largeText ? "Large text is on." : "Standard text size."}</p>
          <button className="icon-button" type="button" onClick={onToggleLargeText} aria-label="Toggle large text">
            <TypeIcon size={largeText ? 22 : 16} aria-hidden />
          </button>
        </div>
        <div className="settings-row">
          <Clock size={18} aria-hidden />
          <p>App-wide time zone (used for task start/end logging).</p>
          <TimezonePicker value={timezone} onChange={setTimezone} />
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Household</p>
            <h2>Members</h2>
          </div>
          <button className="primary-button" type="button" onClick={() => setPersonModal(true)}>
            <Plus size={16} aria-hidden /> Add person
          </button>
        </div>
        <div className="people-grid">
          {people.items.map((person) => (
            <HumanProfile key={person.id} person={person} />
          ))}
        </div>
        <div className="settings-row">
          <Info size={18} aria-hidden />
          <p>
            {isBackendConfigured()
              ? "Signed-in accounts now sync in real time across devices. Notification preferences per person can layer on top later."
              : "Roles, invitations, and notification preferences arrive with Supabase Auth in the planned backend path."}
          </p>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Data</p>
            <h2>Backup and restore</h2>
          </div>
        </div>
        <div className="settings-row">
          <Download size={18} aria-hidden />
          <p>Export all households, dogs, people, tasks, milestones, health events, journal entries, exposure logs, relationship logs, and feedback as JSON.</p>
          <button className="icon-button" type="button" onClick={onExport} aria-label="Export data">
            <Download size={18} aria-hidden />
          </button>
        </div>
        <div className="settings-row">
          <Import size={18} aria-hidden />
          <p>Import a previously exported JSON file to fully restore this device's data.</p>
          <button className="icon-button" type="button" onClick={onImportClick} aria-label="Import data">
            <Import size={18} aria-hidden />
          </button>
        </div>
      </section>
      {personModal && (
        <Modal title="Add person" onClose={() => setPersonModal(false)}>
          <PersonForm
            onCancel={() => setPersonModal(false)}
            onSubmit={(values) => {
              people.add({ id: makeId("person"), householdId: "andrew-bree", ...values });
              setPersonModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
