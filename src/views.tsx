import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  HeartPulse,
  Import,
  Info,
  Moon,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import { FormEvent, TouchEvent as ReactTouchEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AppMetric,
  DogProfile,
  formationLabels,
  HumanProfile,
  MilestoneCard,
  PersonName,
  ProgressBar,
  QuickLogForm,
  QUICK_LOG_ICONS,
  Sparkline,
  TaskCard,
  ItemDetailModal,
  TimezonePicker,
} from "./components";
import { Modal } from "./components";
import {
  DogForm,
  ExposureLogForm,
  ItemForm,
  JournalForm,
  PersonForm,
  RelationshipLogForm,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  dogFormValuesToDog,
  itemFormValuesToItem,
  journalFormValuesToEntry,
  relationshipLogFormValuesToLog,
} from "./forms";
import { makeId, useStore } from "./store";
import { useNavigation } from "./navigation";
import { setPassword as setAccountPassword, signOut, useSession } from "./auth";
import { isBackendConfigured } from "./supabaseClient";
import {
  AloneTimeLog,
  Category,
  Dog,
  ExposureCategory,
  ExposureItem,
  FeedbackLoopRule,
  InboxRequest,
  InventoryItem,
  Item,
  ItemDeletionScope,
  ItemIntent,
  ItemLog,
  ItemOccurrence,
  ItemState,
  Milestone,
  NotificationItem,
  QuickLogKind,
  Recurrence,
} from "./types";
import {
  ALONE_TIME_TRAINING_ID,
  QUICK_LOG_SPECS,
  TrainingFocus,
  nextTrainingFocus,
  quickLogSpec,
  quickLogsOn,
  summarizeQuickLog,
  addDays,
  addMonths,
  ageLabel,
  computeDogAloneTimeReadiness,
  computeEventCoverageNeeded,
  computeEventTimes,
  computeNotifications,
  dayLoadMinutes,
  dogsNeedingCoverage,
  formatDate,
  formatMinutes,
  generateGroceryList,
  generateOccurrences,
  heavyWeeks,
  isExpired,
  isExpiringSoon,
  isHeavyWeek,
  isSameDay,
  milestoneProgress,
  monthGridDays,
  parseLocalDate,
  parseTimeLabel,
  isHealthItem,
  itemDurationMinutes,
  itemStateLabels,
  ITEM_INTENT_PRESETS,
  readinessScore,
  toDateKey,
  useAdaptivePlan,
  weekDays,
  weekStart as weekStartKey,
  weekStartDate,
} from "./utils";

export function NotificationBell() {
  const { items, itemOccurrences, milestones, aloneTimeLogs, dogs } = useStore();
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const notifications = computeNotifications(items.items, itemOccurrences.items, milestones.items, dogs.items, aloneTimeLogs.items);

  function toggleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen((prev) => !prev);
  }

  return (
    <div className="notification-wrap">
      <button ref={buttonRef} className="icon-button" type="button" onClick={toggleOpen} aria-label="Notifications">
        <Bell size={18} aria-hidden />
        {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
      </button>
      {open &&
        panelPos &&
        createPortal(
          <div className="notification-panel" style={{ top: panelPos.top, right: panelPos.right }}>
            <p className="eyebrow">Notifications</p>
            {notifications.length === 0 && <p className="small">Nothing needs attention right now.</p>}
            {notifications.map((item: NotificationItem) => (
              <article key={item.id} className={`notification ${item.severity}`}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** "480" -> "8h", "30" -> "30m", "90" -> "1.5h" — precise enough to distinguish a
 * puppy's 30-minute record from an adult dog's 8-hour one, unlike rounding to hours. */
function formatAloneTimeMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

/** Per-dog alone-time readiness — each dog tracks its own proven record and its own
 * next coverage-needing event, since an adult dog and a puppy build tolerance at very
 * different paces. Shared between Dashboard and Training. */
function AloneTimeReadinessPanel({
  dogs,
  allDogIds,
  aloneTimeLogs,
  calendarEvents,
  onLog,
}: {
  dogs: Dog[];
  allDogIds: string[];
  aloneTimeLogs: AloneTimeLog[];
  calendarEvents: Item[];
  onLog: () => void;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Alone-time readiness</p>
          <h2 style={{ fontSize: "1.1rem" }}>How long can each dog be left alone?</h2>
        </div>
        <button className="text-button" type="button" onClick={onLog}>
          <Plus size={16} aria-hidden /> Log
        </button>
      </div>
      {dogs.map((dog) => {
        const readiness = computeDogAloneTimeReadiness(dog.id, allDogIds, aloneTimeLogs, calendarEvents);
        return (
          <div className="alone-time-readiness-row" key={dog.id}>
            <div className="row between">
              <strong>{dog.name}</strong>
              <span>{formatAloneTimeMinutes(readiness.maxAchievedMinutes)} proven</span>
            </div>
            {readiness.nextEvent ? (
              <p className={`readiness-note ${readiness.ready ? "ready" : "gap"}`}>
                {readiness.ready
                  ? `Already meets the ${formatAloneTimeMinutes(readiness.requiredMinutes)} needed for ${readiness.nextEvent.title}.`
                  : `${readiness.nextEvent.title} on ${
                      readiness.nextEvent.date ? formatDate(readiness.nextEvent.date) : "an upcoming date"
                    } needs ${formatAloneTimeMinutes(readiness.requiredMinutes)} — ${formatAloneTimeMinutes(readiness.gapMinutes)} gap to close.`}
              </p>
            ) : (
              <p className="small">Nothing upcoming leaves {dog.name} needing coverage.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** One entry in the Dashboard's Log feed. Reads the option labels back off the Quick
 * log spec so a row says "Poo · Inside (accident)" rather than echoing raw values.
 *
 * Delete is the undo: a Quick log takes seconds to re-enter, so there's no edit flow,
 * but a mis-ticked training step would otherwise inflate a milestone permanently. The
 * confirm step names what will be rolled back, since that consequence isn't obvious
 * from a feed row. */
function QuickLogRow({ log, dogs }: { log: ItemLog; dogs: Dog[] }) {
  const { deleteQuickLog, milestones } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const Icon = QUICK_LOG_ICONS[log.quickLogKind ?? "potty"];
  const label = quickLogSpec(log.quickLogKind ?? "potty").label;
  const names = log.dogIds
    .map((id) => dogs.find((dog) => dog.id === id)?.name)
    .filter(Boolean)
    .join(" & ");
  const time = new Date(log.loggedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const summary = summarizeQuickLog(log);
  const milestoneTitle = milestones.items.find((entry) => entry.id === log.milestoneId)?.title;
  const rollback = log.advancedStepTitles ?? [];

  async function confirmDelete() {
    setDeleting(true);
    const ok = await deleteQuickLog(log.id);
    if (!ok) setDeleting(false);
  }

  return (
    <article className="quick-log-row">
      <span className="quick-log-row-icon">
        <Icon size={16} aria-hidden />
      </span>
      <div className="quick-log-row-body">
        <div className="row between">
          <strong>{summary || label}</strong>
          <span className="small">{time}</span>
        </div>
        <p className="small">
          {names}
          {log.rating ? ` · ${log.rating}/5` : ""}
        </p>
        {log.text && <p className="quick-log-row-note">{log.text}</p>}
        {confirming && (
          <div className="quick-log-row-confirm">
            <p className="small">
              {rollback.length > 0 && milestoneTitle
                ? `Deletes this entry and takes one session back off ${rollback.join(", ")} in ${milestoneTitle}.`
                : "Deletes this entry."}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="text-button" type="button" onClick={() => setConfirming(false)} disabled={deleting}>
                Keep
              </button>
              <button className="text-button danger" type="button" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="quick-log-row-actions">
        <button
          className="icon-button small"
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit this ${label.toLowerCase()} entry`}
        >
          <Pencil size={13} aria-hidden />
        </button>
        <button
          className="icon-button small"
          type="button"
          onClick={() => setConfirming((prev) => !prev)}
          aria-label={`Delete this ${label.toLowerCase()} entry`}
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
      {editing && (
        <Modal title="Edit entry" onClose={() => setEditing(false)}>
          <QuickLogForm date={log.occurrenceDate ?? ""} editingLog={log} onClose={() => setEditing(false)} />
        </Modal>
      )}
    </article>
  );
}

export function DashboardView() {
  const { items, itemOccurrences, milestones, dogs, completeTask, occurrenceFor, aloneTimeLogs, itemLogs } = useStore();
  const todayKey = toDateKey(new Date());
  const adaptive = useAdaptivePlan(items.items, itemOccurrences.items, todayKey);
  const [detailTask, setDetailTask] = useState<Item | null>(null);
  const [quickLog, setQuickLog] = useState<null | { kind: QuickLogKind; trainingType?: string; dogId?: string }>(null);
  const todayLogs = quickLogsOn(itemLogs.items, todayKey);
  // One recommendation per dog — they're on different steps, so a single "next" would
  // be wrong for at least one of them.
  const nextFocuses = dogs.items
    .map((dog) => ({ dog, focus: nextTrainingFocus(milestones.items, dog.id) }))
    .filter((entry): entry is { dog: Dog; focus: TrainingFocus } => entry.focus !== null);
  const puppy = dogs.items.find((dog) => dog.status === "puppy") ?? dogs.items[0];
  // The focus milestone follows the same per-dog recommendation rather than a global
  // "first incomplete" guess, so the card on the Dashboard is the one you'd actually
  // work on next for that dog.
  const focusMilestones = nextFocuses
    .map((entry) => ({ dog: entry.dog, milestone: milestones.items.find((item) => item.id === entry.focus.milestoneId) }))
    .filter((entry): entry is { dog: Dog; milestone: Milestone } => !!entry.milestone);
  const allDogIds = dogs.items.map((dog) => dog.id);

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const toolbar = document.querySelector(".dashboard-toolbar");
    const stickyTop = toolbar ? parseFloat(getComputedStyle(toolbar).top) || 0 : 0;
    const clearance = toolbar ? stickyTop + toolbar.getBoundingClientRect().height + 8 : 0;
    const targetY = el.getBoundingClientRect().top + window.scrollY - clearance;
    window.scrollTo({ top: Math.max(targetY, 0), behavior: "smooth" });
  }

  return (
    <div className="dashboard">
      <section className="dashboard-toolbar">
        <button className="primary-button small" type="button" onClick={() => setQuickLog({ kind: "potty" })}>
          <Plus size={16} aria-hidden /> Quick log
        </button>
        <nav className="dashboard-jump-nav" aria-label="Jump to dashboard section">
          <button type="button" onClick={() => jumpTo("today-section")}>
            Today
          </button>
          <button type="button" onClick={() => jumpTo("log-section")}>
            Log
          </button>
          {focusMilestones.length > 0 && (
            <button type="button" onClick={() => jumpTo("focus-milestone-section")}>
              Milestone
            </button>
          )}
          <button type="button" onClick={() => jumpTo("readiness-section")}>
            Readiness
          </button>
        </nav>
      </section>

      <section className="split">
        <div className="panel" id="today-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Today</p>
              <h2>Agenda</h2>
            </div>
          </div>
          <div className="task-list">
            {adaptive.visibleTasks.length === 0 && (
              <p className="small">Nothing scheduled to complete today. Anything you add for today shows up here.</p>
            )}
            {adaptive.visibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                occurrence={occurrenceFor(task.id, todayKey)}
                dogs={dogs.items}
                onComplete={(target, rating) => completeTask(target, rating, todayKey)}
                onOpenDetail={setDetailTask}
              />
            ))}
          </div>
          {detailTask && <ItemDetailModal task={detailTask} date={todayKey} onClose={() => setDetailTask(null)} />}
        </div>

        <div className="stack">
          <section className="panel" id="log-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Log</p>
                <h2 style={{ fontSize: "1.1rem" }}>What happened today</h2>
              </div>
              <button className="text-button" type="button" onClick={() => setQuickLog({ kind: "potty" })}>
                <Plus size={16} aria-hidden /> Quick log
              </button>
            </div>
            <div className="quick-log-tallies">
              {QUICK_LOG_SPECS.map((spec) => {
                const Icon = QUICK_LOG_ICONS[spec.kind];
                const count = todayLogs.filter((log) => log.quickLogKind === spec.kind).length;
                return (
                  <button
                    key={spec.kind}
                    type="button"
                    className={`quick-log-tally ${count > 0 ? "has-entries" : ""}`}
                    onClick={() => setQuickLog({ kind: spec.kind })}
                    aria-label={`Log ${spec.label.toLowerCase()} — ${count} today`}
                  >
                    <Icon size={16} aria-hidden />
                    <strong>{count}</strong>
                    <span>{spec.label}</span>
                  </button>
                );
              })}
            </div>
            {nextFocuses.map(({ dog, focus }) => (
              <div className="quick-log-next" key={dog.id}>
                <div>
                  <p className="eyebrow">{dogs.items.length > 1 ? `Next for ${dog.name}` : "Work on next"}</p>
                  <strong>{focus.stepTitle}</strong>
                  <p className="small">
                    {focus.milestoneTitle} · {focus.completedSessions}/{focus.sessionsRequired} sessions ·{" "}
                    {focus.successCriteria}
                  </p>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setQuickLog({ kind: "training", trainingType: focus.milestoneId, dogId: dog.id })}
                >
                  Log it
                </button>
              </div>
            ))}
            {todayLogs.length === 0 ? (
              <p className="small">
                Nothing logged yet today. Tap any of the five above to record a potty break, play session, training rep,
                meal, or water check.
              </p>
            ) : (
              <div className="quick-log-feed">
                {todayLogs.map((log) => (
                  <QuickLogRow key={log.id} log={log} dogs={dogs.items} />
                ))}
              </div>
            )}
          </section>

          {focusMilestones.length > 0 && (
            <section className="panel" id="focus-milestone-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Focus milestone</p>
                  <h2>{dogs.items.length > 1 ? "Where each dog is" : focusMilestones[0].milestone.title}</h2>
                </div>
              </div>
              <div className="stack">
                {focusMilestones.map(({ dog, milestone }) => (
                  <MilestoneCard key={dog.id} milestone={milestone} dogId={dog.id} />
                ))}
              </div>
            </section>
          )}
          <div className="readiness-group" id="readiness-section">
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
            <AloneTimeReadinessPanel
              dogs={dogs.items}
              allDogIds={allDogIds}
              aloneTimeLogs={aloneTimeLogs.items}
              calendarEvents={items.items}
              onLog={() => setQuickLog({ kind: "training", trainingType: ALONE_TIME_TRAINING_ID })}
            />
          </div>
        </div>
      </section>

      {quickLog && (
        <Modal title="Quick log" onClose={() => setQuickLog(null)}>
          <QuickLogForm
            date={todayKey}
            initialKind={quickLog.kind}
            initialTrainingType={quickLog.trainingType}
            initialDogIds={quickLog.dogId ? [quickLog.dogId] : undefined}
            onClose={() => setQuickLog(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function describeRecurrence(rec: Recurrence): string {
  const unit = rec.frequency === "daily" ? "day" : rec.frequency === "weekly" ? "week" : rec.frequency === "monthly" ? "month" : "year";
  const every = rec.interval > 1 ? `Every ${rec.interval} ${unit}s` : `Every ${unit}`;
  if (rec.frequency === "weekly" && rec.daysOfWeek && rec.daysOfWeek.length > 0) {
    return `${every} on ${rec.daysOfWeek.map((d) => dayLabels[d]).join(", ")}`;
  }
  return every;
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
  item: Item;
  /** The date (YYYY-MM-DD) this is being rendered for — needed to resolve the right
   * ItemOccurrence, since a recurring item has no date of its own. */
  date: string;
  /** Only meaningful when item.requiresCompletion. */
  state?: ItemState;
  /** True when this needs more coverage than the dogs have proven they can handle
   * and it hasn't been confirmed arranged yet — see computeEventCoverageNeeded. */
  coverageNeeded: boolean;
};

// One loop now, where there used to be four: tasks, rescheduled task instances,
// health events, and calendar events each had their own block producing subtly
// different agenda rows. Unifying the type collapsed all of that into a single
// occurrence expansion, which is most of why recurrence and completion finally
// work on the same object.
function buildAgendaForDate(
  date: Date,
  items: Item[],
  dogs: Dog[],
  occurrences: ItemOccurrence[],
  aloneTimeLogs: AloneTimeLog[],
): AgendaItem[] {
  const dateKey = toDateKey(date);
  const allDogIds = dogs.map((dog) => dog.id);
  const dogName = (id: string) => dogs.find((dog) => dog.id === id)?.name ?? id;
  const agenda: AgendaItem[] = [];

  function push(item: Item, occurrence: ItemOccurrence | undefined, rescheduled: boolean) {
    agenda.push({
      id: `item-${item.id}-${dateKey}${rescheduled ? "-rescheduled" : ""}`,
      title: rescheduled ? `${item.title} (rescheduled)` : item.title,
      category: item.category,
      startMinutes: parseTimeLabel(occurrence?.scheduledTime || item.startTime || ""),
      durationMinutes: itemDurationMinutes(item) || 60,
      assignedTo: occurrence?.assignedTo ?? item.assignedTo,
      dogNames: (item.dogIds ?? []).map(dogName).join(" & "),
      priority: item.priority,
      placeholder: item.status === "placeholder",
      item,
      date: dateKey,
      state: item.requiresCompletion ? (occurrence?.state ?? "not_started") : undefined,
      coverageNeeded: computeEventCoverageNeeded(item, allDogIds, aloneTimeLogs) && !item.coverageConfirmed,
    });
  }

  items.forEach((item) => {
    if (generateOccurrences(item, date, date).length === 0) return;
    const natural = occurrences.find((entry) => entry.itemId === item.id && entry.originalDate === dateKey);
    if (natural && natural.date !== dateKey) return; // rescheduled away from this date
    push(item, natural, false);
  });

  occurrences
    .filter((entry) => entry.date === dateKey && entry.originalDate !== dateKey)
    .forEach((entry) => {
      const item = items.find((candidate) => candidate.id === entry.itemId);
      if (!item) return;
      push(item, entry, true);
    });

  return agenda;
}

function monthDaySummary(
  day: Date,
  items: Item[],
  heavyWeekSet: Set<string>,
  allDogIds: string[],
  aloneTimeLogs: AloneTimeLog[],
): { count: number; heavy: boolean; needsCoverage: boolean } {
  const key = toDateKey(day);
  let count = 0;
  let needsCoverage = false;
  items.forEach((item) => {
    if (generateOccurrences(item, day, day).length === 0) return;
    count++;
    if (computeEventCoverageNeeded(item, allDogIds, aloneTimeLogs) && !item.coverageConfirmed) needsCoverage = true;
  });
  return { count, heavy: heavyWeekSet.has(weekStartKey(key)), needsCoverage };
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
  items,
  heavyWeekSet,
  allDogIds,
  aloneTimeLogs,
  onSelectDay,
}: {
  cursor: Date;
  today: Date;
  items: Item[];
  heavyWeekSet: Set<string>;
  allDogIds: string[];
  aloneTimeLogs: AloneTimeLog[];
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
        const info = monthDaySummary(day, items, heavyWeekSet, allDogIds, aloneTimeLogs);
        const inMonth = day.getMonth() === cursor.getMonth();
        return (
          <button
            key={index}
            type="button"
            className={`month-cell ${inMonth ? "" : "outside"} ${isSameDay(day, today) ? "is-today" : ""} ${info.heavy ? "heavy-week" : ""} ${info.needsCoverage ? "needs-coverage" : ""}`}
            onClick={() => onSelectDay(day)}
          >
            <span className="month-cell-date">{day.getDate()}</span>
            {info.count > 0 && (
              <span className="month-cell-dots">
                {Array.from({ length: Math.min(info.count, 5) }).map((_, dotIndex) => (
                  <span key={dotIndex} className="month-dot" />
                ))}
                {info.needsCoverage && <span className="month-dot coverage-dot" aria-label="Needs coverage arranged" />}
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
  onOpenItem,
}: {
  cursor: Date;
  today: Date;
  agendaByDay: { day: Date; items: AgendaItem[] }[];
  onSelectDay: (date: Date) => void;
  onOpenItem: (item: Item, date: string) => void;
}) {
  function openItem(entry: AgendaItem) {
    onOpenItem(entry.item, entry.date);
  }

  return (
    <div className="week-strip">
      {agendaByDay.map(({ day, items }) => {
        const scheduled = items.filter((item) => item.startMinutes !== null).sort((a, b) => a.startMinutes! - b.startMinutes!);
        return (
          <div key={toDateKey(day)} className={`week-day ${isSameDay(day, today) ? "is-today" : ""}`}>
            <button
              type="button"
              className="week-day-label-button"
              onClick={() => onSelectDay(day)}
              aria-label={`Open ${day.toLocaleDateString(undefined, { weekday: "long", day: "numeric" })}`}
            >
              <span className="week-day-label">{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span>
            </button>
            <div className="week-day-items">
              {scheduled.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`week-day-item ${item.placeholder ? "placeholder" : ""} ${item.coverageNeeded ? "needs-coverage" : ""}`}
                  onClick={() => openItem(item)}
                >
                  {formatMinutes(item.startMinutes!)} · {item.title}
                </button>
              ))}
              {items.length > 4 && (
                <button type="button" className="week-day-more" onClick={() => onSelectDay(day)}>
                  +{items.length - 4} more
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarDayAgenda({
  items,
  shouldDim,
  onOpenItem,
}: {
  items: AgendaItem[];
  shouldDim: (item: AgendaItem) => boolean;
  onOpenItem: (item: Item, date: string) => void;
}) {
  const isMobile = useIsMobile();
  const hourHeight = isMobile ? MOBILE_HOUR_HEIGHT : HOUR_HEIGHT;
  const unscheduled = items.filter((item) => item.startMinutes === null);
  const scheduled = assignTracks(items.filter((item) => item.startMinutes !== null));
  const totalHours = (DAY_END_MIN - DAY_START_MIN) / 60;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => DAY_START_MIN + i * 60);

  function openItem(entry: AgendaItem) {
    onOpenItem(entry.item, entry.date);
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
              className={`day-block ${item.item.requiresCompletion ? "completable" : "informational"} ${item.placeholder ? "placeholder" : ""} ${shouldDim(item) ? "dimmed" : ""} ${item.coverageNeeded ? "needs-coverage" : ""} state-${item.state ?? ""}`}
              style={{ top, height, width: `calc(${width}% - 6px)`, left: `${left}%` }}
              onClick={() => openItem(item)}
            >
              <strong>{item.title}</strong>
              <span>{formatMinutes(item.startMinutes!)}</span>
              {item.priority && <span className={`priority ${item.priority}`}>{item.priority}</span>}
              {item.dogNames && <span className="day-block-dogs">{item.dogNames}</span>}
              {item.state && item.state !== "not_started" && <span className={`state-tag ${item.state}`}>{itemStateLabels[item.state]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DeleteEventModal({
  event,
  occurrenceDate,
  onCancel,
  onConfirm,
  onDone,
}: {
  event: Item;
  occurrenceDate?: string;
  onCancel: () => void;
  onConfirm: (scope: ItemDeletionScope, note: string) => Promise<boolean>;
  onDone: () => void;
}) {
  const [scope, setScope] = useState<ItemDeletionScope>(occurrenceDate ? "instance" : "series");
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
      <Modal title="Event deleted" onClose={onDone}>
        <p className="form-success">
          {scope === "instance" ? `That occurrence of "${event.title}" was removed.` : `"${event.title}" was deleted.`}
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
    <Modal title={`Delete "${event.title}"`} onClose={onCancel}>
      {event.kind === "recurring" && (
        <div className="subtabs" role="radiogroup" aria-label="What to delete" style={{ marginBottom: 12 }}>
          {occurrenceDate && (
            <button type="button" className={scope === "instance" ? "active" : ""} onClick={() => setScope("instance")}>
              Just this occurrence
            </button>
          )}
          <button type="button" className={scope === "series" ? "active" : ""} onClick={() => setScope("series")}>
            The whole series
          </button>
        </div>
      )}
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
        {noteError && <small className="form-error">A note is required to delete an event.</small>}
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

/** "+ Add" entry point shared by Calendar's grid views and Upcoming list.
 *
 * The old version asked "Task, Event, or Health?" — three data types, with no hint
 * that picking one silently decided whether you would ever be asked to check
 * anything off or record anything. These presets instead describe what the item
 * *does*, and each one states its consequence directly on the button, so the
 * difference between "I have to do this", "just be aware of this", and "record data
 * from this" is visible at the moment you choose. All five open the same form. */
function AddItemMenu({
  onPick,
  buttonClassName = "primary-button small",
  iconSize = 14,
  label = "Add",
}: {
  onPick: (intent: ItemIntent) => void;
  buttonClassName?: string;
  iconSize?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="add-item-menu">
      <button className={buttonClassName} type="button" onClick={() => setOpen((prev) => !prev)}>
        <Plus size={iconSize} aria-hidden /> {label}
      </button>
      {open && (
        <div className="add-item-menu-panel wide">
          {ITEM_INTENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="add-item-preset"
              onClick={() => {
                setOpen(false);
                onPick(preset.id);
              }}
            >
              <strong>{preset.label}</strong>
              <small>{preset.blurb}</small>
              <span className="add-item-preset-tags">
                {preset.requiresCompletion && <em className="capability-tag">Checklist</em>}
                {preset.requiresLog && <em className="capability-tag">Logs data</em>}
                {!preset.requiresCompletion && !preset.requiresLog && <em className="capability-tag muted">Calendar only</em>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryFilterPicker({ selected, onChange }: { selected: Set<Category>; onChange: (next: Set<Category>) => void }) {
  const [open, setOpen] = useState(false);

  function toggle(category: Category) {
    const next = new Set(selected);
    next.has(category) ? next.delete(category) : next.add(category);
    onChange(next);
  }

  const label = selected.size === 0 ? "All categories" : `${selected.size} categor${selected.size === 1 ? "y" : "ies"}`;

  return (
    <div className="category-filter">
      <button type="button" className="text-button" onClick={() => setOpen((prev) => !prev)}>
        {label}
      </button>
      {open && (
        <div className="category-filter-panel">
          <div className="category-filter-list">
            {CATEGORY_OPTIONS.map((option) => (
              <label key={option} className="category-filter-row">
                <input type="checkbox" checked={selected.has(option)} onChange={() => toggle(option)} />
                {CATEGORY_LABELS[option]}
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="text-button" onClick={() => onChange(new Set())} disabled={selected.size === 0}>
              Clear
            </button>
            <button type="button" className="primary-button small" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
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
  const { items, milestones, dogs, itemOccurrences, people, aloneTimeLogs, deleteItem } = useStore();
  const { navigate } = useNavigation();
  const attendeeNames = (ids?: string[]) =>
    !ids || ids.length === 0 ? "" : ids.map((id) => people.items.find((person) => person.id === id)?.name ?? id).join(" & ");
  // "new" carries the preset the user picked in the Add menu, so the form opens with
  // the right capability toggles already ticked.
  const [eventModal, setEventModal] = useState<{ intent: ItemIntent } | { event: Item; occurrenceDate?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ event: Item; occurrenceDate?: string } | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "upcoming" | "milestones">("day");
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [viewerId, setViewerId] = useState<string>(() => loadViewerId(people.items[0]?.id ?? ""));
  const [filterMode, setFilterMode] = useState<"all" | "mine" | "other">("all");
  const [categoryFilter, setCategoryFilter] = useState<Set<Category>>(new Set());
  const [detailTask, setDetailTask] = useState<{ task: Item; date: string } | null>(null);
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
  function handlePickDate(dateKey: string) {
    if (!dateKey) return;
    setCursorDate(parseLocalDate(dateKey));
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

  // Health records now share the Category taxonomy (vet/vaccine/medication/grooming
  // are real categories), so category filtering applies uniformly — no more special
  // case where health rows ignored the filter because they lived on another type.
  const filteredItems = categoryFilter.size === 0 ? items.items : items.items.filter((item) => categoryFilter.has(item.category));

  const allDogIds = dogs.items.map((dog) => dog.id);
  const dogName = (id: string) => dogs.items.find((dog) => dog.id === id)?.name ?? id;
  const dayAgenda = buildAgendaForDate(cursorDate, filteredItems, dogs.items, itemOccurrences.items, aloneTimeLogs.items);
  const weekAgenda = weekDays(cursorDate).map((day) => ({
    day,
    items: buildAgendaForDate(day, filteredItems, dogs.items, itemOccurrences.items, aloneTimeLogs.items),
  }));

  const isGridMode = viewMode === "day" || viewMode === "week" || viewMode === "month";

  const headingLabel =
    viewMode === "day"
      ? cursorDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      : viewMode === "week"
        ? `Week of ${weekStartDate(cursorDate).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
        : viewMode === "month"
          ? cursorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
          : viewMode === "upcoming"
            ? "Upcoming events"
            : "Milestones";

  const recurring = filteredItems.filter((item) => item.kind === "recurring");
  const upcoming = filteredItems
    .filter((item) => item.kind === "one-off")
    .slice()
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const weeks = heavyWeeks(items.items, aloneTimeLogs.items, allDogIds, addDays(today, -7), addDays(today, 365));

  return (
    <section className="panel">
      <div className={`section-heading calendar-heading ${viewMode === "day" ? "is-frozen" : ""}`}>
        <div className="calendar-title-row">
          <p className="eyebrow">Calendar</p>
        </div>
        {isGridMode && (
          <div className="calendar-date-row">
            <button className="today-button" type="button" onClick={goToday}>
              Today
            </button>
            <button className="icon-button" type="button" onClick={goPrev} aria-label="Previous">
              <ChevronLeft size={18} aria-hidden />
            </button>
            <h2>{headingLabel}</h2>
            <button className="icon-button" type="button" onClick={goNext} aria-label="Next">
              <ChevronRight size={18} aria-hidden />
            </button>
            <div className="calendar-date-picker">
              <span className="icon-button" aria-hidden>
                <CalendarIcon size={18} aria-hidden />
              </span>
              <input
                className="calendar-date-input"
                type="date"
                value={toDateKey(cursorDate)}
                onChange={(event) => handlePickDate(event.target.value)}
                aria-label="Choose date"
              />
            </div>
          </div>
        )}
        {isGridMode && (
          <div className="calendar-add-event-row">
            <AddItemMenu onPick={(intent) => setEventModal({ intent })} />
          </div>
        )}
        {!isGridMode && <h2>{headingLabel}</h2>}
        <div className="calendar-controls">
          <select
            className="calendar-view-select"
            aria-label="Calendar view"
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value as typeof viewMode)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="upcoming">Upcoming</option>
            <option value="milestones">Milestones</option>
          </select>
          {viewMode !== "milestones" && <CategoryFilterPicker selected={categoryFilter} onChange={setCategoryFilter} />}
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
              onOpenItem={(item, date) => setDetailTask({ task: item, date })}
            />
          )}
          {viewMode === "week" && (
            <CalendarWeekStrip
              cursor={cursorDate}
              today={today}
              agendaByDay={weekAgenda}
              onSelectDay={selectDay}
              onOpenItem={(item, date) => setDetailTask({ task: item, date })}
            />
          )}
          {viewMode === "month" && (
            <CalendarMonthGrid
              cursor={cursorDate}
              today={today}
              items={filteredItems}
              heavyWeekSet={weeks}
              allDogIds={allDogIds}
              aloneTimeLogs={aloneTimeLogs.items}
              onSelectDay={selectDay}
            />
          )}
        </div>
      )}

      {detailTask && (
        <ItemDetailModal
          task={detailTask.task}
          date={detailTask.date}
          onClose={() => setDetailTask(null)}
          onEdit={(item) => {
            setDetailTask(null);
            setEventModal({ event: item, occurrenceDate: detailTask.date });
          }}
        />
      )}

      {viewMode === "upcoming" && (
        <>
          <div className="row between">
            <div>
              <p className="eyebrow">Recurring commitments</p>
              <h3 style={{ margin: 0 }}>Weekly household schedule</h3>
            </div>
            <AddItemMenu buttonClassName="primary-button" iconSize={16} onPick={(intent) => setEventModal({ intent })} />
          </div>
          <div className="calendar-grid">
            {recurring.map((event) => (
              <article
                className={`event commitment ${event.category === "downtime" ? "downtime" : ""} ${event.status === "placeholder" ? "placeholder" : ""}`}
                key={event.id}
                onClick={() => setEventModal({ event })}
              >
                <span>{event.recurrence ? describeRecurrence(event.recurrence) : ""}</span>
                <strong>{event.title}</strong>
                <p>
                  {event.startTime ?? ""}
                  {event.recurrence?.endDate ? ` · through ${formatDate(event.recurrence.endDate)}` : ""}
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
                onClick={() => setEventModal({ event })}
              >
                <span>{event.date ? formatDate(event.date) : event.windowLabel || "Date TBD"}</span>
                <strong>{event.title}</strong>
                <p>{event.startTime ?? ""}</p>
                {event.status === "placeholder" && <small className="tbd-tag">TBD</small>}
                {isHeavyWeek(event, weeks) && <small className="heavy-tag">Heavy week</small>}
                {event.roverVisits !== undefined && (
                  <small className="rover-tag">
                    Rover × {event.roverVisits} visit{event.roverVisits === 1 ? "" : "s"}
                  </small>
                )}
                {computeEventCoverageNeeded(event, allDogIds, aloneTimeLogs.items) && (
                  <small className="rover-tag">
                    Needs coverage arranged{" "}
                    {dogsNeedingCoverage(event, allDogIds).map((id) => dogName(id)).join(" & ")}
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

      {viewMode === "milestones" && (
        <CalendarMilestonesPanel
          milestonesList={milestones.items}
          dogId={dogs.items[0]?.id ?? ""}
          onNavigate={() => navigate("training")}
        />
      )}

      {eventModal && (
        <Modal
          title={"intent" in eventModal ? `Add — ${ITEM_INTENT_PRESETS.find((p) => p.id === eventModal.intent)?.label}` : "Edit item"}
          onClose={() => setEventModal(null)}
        >
          <ItemForm
            initial={"intent" in eventModal ? undefined : eventModal.event}
            presetIntent={"intent" in eventModal ? eventModal.intent : undefined}
            peopleOptions={people.items.map((person) => ({ id: person.id, name: person.name }))}
            dogOptions={dogs.items.map((dog) => ({ id: dog.id, name: dog.name }))}
            milestoneOptions={milestones.items}
            aloneTimeLogs={aloneTimeLogs.items}
            onCancel={() => setEventModal(null)}
            onSubmit={(values) =>
              "intent" in eventModal
                ? items.add(itemFormValuesToItem(values, makeId("item")))
                : items.update(
                    eventModal.event.id,
                    itemFormValuesToItem(values, eventModal.event.id, {
                      excludedDates: eventModal.event.excludedDates,
                      roverVisits: eventModal.event.roverVisits,
                      prepSteps: eventModal.event.prepSteps,
                      roverInstructions: eventModal.event.roverInstructions,
                      postSteps: eventModal.event.postSteps,
                    }),
                  )
            }
            onDelete={
              "intent" in eventModal
                ? undefined
                : () => {
                    setDeleteTarget(eventModal);
                    setEventModal(null);
                  }
            }
          />
        </Modal>
      )}

      {deleteTarget && (
        <DeleteEventModal
          event={deleteTarget.event}
          occurrenceDate={deleteTarget.occurrenceDate}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={(scope, note) => deleteItem(deleteTarget.event, scope, deleteTarget.occurrenceDate, note)}
          onDone={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}

function CalendarMilestonesPanel({
  milestonesList,
  dogId,
  onNavigate,
}: {
  milestonesList: Milestone[];
  /** Whose progress the expanded cards show. Grouping still uses the milestone's
   * overall status, since this panel is a roadmap for the household. */
  dogId: string;
  onNavigate: () => void;
}) {
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
              <MilestoneCard key={item.id} milestone={item} dogId={dogId} />
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

/** Page-level dog switcher. Chosen over a per-card selector (2026-07-27): you train
 * one dog at a time, so the whole page — which milestones are unlocked, what's next,
 * how far along each step is — should be in that dog's world at once. Repeating a
 * selector on all 36 cards would also make comparing the two dogs a 36-click job.
 * Cards still show the other dog's percentage inline, so comparison doesn't need a
 * switch at all. */
function DogSwitcher({ dogs, value, onChange }: { dogs: Dog[]; value: string; onChange: (dogId: string) => void }) {
  if (dogs.length < 2) return null;
  return (
    <div className="dog-switcher">
      <span className="eyebrow">Viewing</span>
      <div className="subtabs" role="group" aria-label="Which dog">
        {dogs.map((dog) => (
          <button key={dog.id} type="button" className={value === dog.id ? "active" : ""} onClick={() => onChange(dog.id)}>
            {dog.name}
          </button>
        ))}
      </div>
    </div>
  );
}

type TrainingTab = "obedience" | ExposureCategory | "health" | "alone-time";

export function TrainingView() {
  const { milestones, dogs, aloneTimeLogs, items } = useStore();
  const [tab, setTab] = useState<TrainingTab>("obedience");
  const [dogId, setDogId] = useState("");
  const [query, setQuery] = useState("");
  const [aloneTimeModal, setAloneTimeModal] = useState(false);
  const allDogIds = dogs.items.map((dog) => dog.id);
  // Falls back rather than seeding state from `dogs.items`, which is empty on the
  // first render when the collection loads from Supabase.
  const activeDogId = dogId || dogs.items[0]?.id || "";
  const tabs: { id: TrainingTab; label: string }[] = [
    { id: "obedience", label: "Obedience" },
    { id: "socialization", label: "Socialization" },
    { id: "confidence", label: "Confidence" },
    { id: "handling", label: "Handling" },
    { id: "health", label: "Health" },
    { id: "alone-time", label: "Alone Time" },
  ];

  // Only this dog's milestones, in the current track. Every track now renders its
  // milestones — before, only obedience did, which left the socialization, confidence,
  // handling and health milestones reachable from the Quick log picker but nowhere on
  // the page they belong to.
  const trackMilestones = milestones.items.filter(
    (milestone) =>
      milestone.track === tab &&
      (milestone.dogIds.length === 0 || milestone.dogIds.includes(activeDogId)) &&
      (query.trim() === "" || milestone.title.toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <div className="stack">
      <div className="subtabs" role="tablist">
        {tabs.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? "active" : ""} type="button" onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {tab !== "alone-time" && (
        <div className="training-toolbar">
          <DogSwitcher dogs={dogs.items} value={activeDogId} onChange={setDogId} />
          <input
            className="training-search"
            type="search"
            placeholder="Search training types…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search training types"
          />
        </div>
      )}
      {tab !== "alone-time" && (
        <section className="milestone-grid">
          {trackMilestones.length === 0 && (
            <p className="small">
              {query.trim() ? `Nothing in ${tab} matches "${query.trim()}".` : `No ${tab} training assigned to this dog yet.`}
            </p>
          )}
          {trackMilestones.map((milestone) => (
            <div id={`milestone-${milestone.id}`} key={milestone.id}>
              <MilestoneCard milestone={milestone} dogId={activeDogId} />
            </div>
          ))}
        </section>
      )}
      {tab === "alone-time" && (
        <AloneTimeReadinessPanel
          dogs={dogs.items}
          allDogIds={allDogIds}
          aloneTimeLogs={aloneTimeLogs.items}
          calendarEvents={items.items}
          onLog={() => setAloneTimeModal(true)}
        />
      )}
      {tab !== "obedience" && tab !== "alone-time" && tab !== "health" && <ExposureGrid category={tab} />}
      {aloneTimeModal && (
        <Modal title="Quick log" onClose={() => setAloneTimeModal(false)}>
          <QuickLogForm
            date={toDateKey(new Date())}
            initialKind="training"
            initialTrainingType={ALONE_TIME_TRAINING_ID}
            onClose={() => setAloneTimeModal(false)}
          />
        </Modal>
      )}
    </div>
  );
}

export function MilestonesView() {
  const { milestones, dogs } = useStore();
  const { focus, clearFocus } = useNavigation();
  const [dogId, setDogId] = useState("");
  const activeDogId = dogId || dogs.items[0]?.id || "";

  useEffect(() => {
    if (!focus?.milestoneId) return;
    const el = document.getElementById(`milestone-${focus.milestoneId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(clearFocus, 2500);
    return () => clearTimeout(timeout);
  }, [focus?.milestoneId]);

  return (
    <div className="stack">
      <DogSwitcher dogs={dogs.items} value={activeDogId} onChange={setDogId} />
      <section className="roadmap">
        {milestones.items
          .filter((milestone) => milestone.dogIds.length === 0 || milestone.dogIds.includes(activeDogId))
          .map((milestone) => (
            <div id={`milestone-${milestone.id}`} className={focus?.milestoneId === milestone.id ? "focus-target" : ""} key={milestone.id}>
              <MilestoneCard milestone={milestone} dogId={activeDogId} />
            </div>
          ))}
      </section>
    </div>
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

// Health is now a lens over items rather than its own type: everything in a health
// category, newest first, with its logged entries inline. Same data the calendar
// shows, filtered — so a vet visit added from the calendar shows up here for free.
export function HealthView() {
  const { dogs, items, itemLogs, milestones, people, aloneTimeLogs } = useStore();
  const [modal, setModal] = useState<"new" | Item | null>(null);
  const dogName = (id: string) => dogs.items.find((dog) => dog.id === id)?.name ?? id;
  const sortedEvents = items.items
    .filter(isHealthItem)
    .slice()
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Health</p>
            <h2>Growth charts and upcoming care</h2>
          </div>
          <button className="primary-button" type="button" onClick={() => setModal("new")}>
            <Plus size={16} aria-hidden /> Add health record
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
          {sortedEvents.map((event) => {
            const logs = itemLogs.items.filter((log) => log.itemId === event.id);
            return (
              <article className="event health-event-row" key={event.id} onClick={() => setModal(event)}>
                <span>
                  {event.date ? formatDate(event.date) : "No date"} · {(event.dogIds ?? []).map(dogName).join(" & ") || "No dog tagged"}
                </span>
                <strong>{event.title}</strong>
                <p className="small">{CATEGORY_LABELS[event.category]}</p>
                {event.notes && <small>{event.notes}</small>}
                {logs.map((log) => (
                  <small key={log.id} className="health-log-line">
                    {new Date(log.loggedAt).toLocaleDateString()}
                    {log.values.length > 0
                      ? ` — ${log.values.map((value) => `${value.fieldName}: ${value.value}${value.unit ? ` ${value.unit}` : ""}`).join(", ")}`
                      : ""}
                    {log.text ? ` — ${log.text}` : ""}
                  </small>
                ))}
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
            );
          })}
        </div>
      </section>
      {modal && (
        <Modal title={modal === "new" ? "Add health record" : "Edit health record"} onClose={() => setModal(null)}>
          <ItemForm
            initial={modal === "new" ? undefined : modal}
            presetIntent={modal === "new" ? "health-record" : undefined}
            peopleOptions={people.items.map((person) => ({ id: person.id, name: person.name }))}
            dogOptions={dogs.items.map((dog) => ({ id: dog.id, name: dog.name }))}
            milestoneOptions={milestones.items}
            aloneTimeLogs={aloneTimeLogs.items}
            onCancel={() => setModal(null)}
            onSubmit={(values) =>
              modal === "new"
                ? items.add(itemFormValuesToItem(values, makeId("item")))
                : items.update(modal.id, itemFormValuesToItem(values, modal.id))
            }
          />
        </Modal>
      )}
    </div>
  );
}

// Tasks is a lens too: every item that has to be checked off, regardless of where
// it was created. Items that only log data, or only sit on the calendar, don't
// belong here — that filter is the whole definition of the view now.
export function TasksView() {
  const { items, people, dogs, milestones, aloneTimeLogs, completeTask, occurrenceFor } = useStore();
  const [formTarget, setFormTarget] = useState<"new" | Item | null>(null);
  const [detailTask, setDetailTask] = useState<Item | null>(null);
  const todayKey = toDateKey(new Date());
  const completable = items.items.filter((item) => item.requiresCompletion);
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Needs completing</p>
          <h2>Everything you have to check off</h2>
        </div>
        <button className="primary-button" type="button" onClick={() => setFormTarget("new")}>
          <Plus size={16} aria-hidden /> Add
        </button>
      </div>
      <div className="task-list">
        {completable.length === 0 && <p className="small">Nothing needs completing right now.</p>}
        {completable.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            occurrence={occurrenceFor(task.id, todayKey)}
            dogs={dogs.items}
            onComplete={(target, rating) => completeTask(target, rating, todayKey)}
            onDelete={(target) => items.remove(target.id)}
            onOpenDetail={setDetailTask}
          />
        ))}
      </div>
      {formTarget && (
        <Modal title={formTarget === "new" ? "Add — Routine or to-do" : "Edit item"} onClose={() => setFormTarget(null)}>
          <ItemForm
            initial={formTarget === "new" ? undefined : formTarget}
            presetIntent={formTarget === "new" ? "routine" : undefined}
            peopleOptions={people.items.map((person) => ({ id: person.id, name: person.name }))}
            dogOptions={dogs.items.map((dog) => ({ id: dog.id, name: dog.name }))}
            milestoneOptions={milestones.items}
            aloneTimeLogs={aloneTimeLogs.items}
            onCancel={() => setFormTarget(null)}
            onSubmit={(values) =>
              formTarget === "new"
                ? items.add(itemFormValuesToItem(values, makeId("item")))
                : items.update(
                    formTarget.id,
                    itemFormValuesToItem(values, formTarget.id, {
                      excludedDates: formTarget.excludedDates,
                      roverVisits: formTarget.roverVisits,
                      prepSteps: formTarget.prepSteps,
                      roverInstructions: formTarget.roverInstructions,
                      postSteps: formTarget.postSteps,
                    }),
                  )
            }
          />
        </Modal>
      )}
      {detailTask && (
        <ItemDetailModal
          task={detailTask}
          date={todayKey}
          onClose={() => setDetailTask(null)}
          onEdit={(item) => {
            setDetailTask(null);
            setFormTarget(item);
          }}
        />
      )}
    </section>
  );
}

export function InboxView() {
  const { inboxRequests, itemOccurrences, items, people, respondToDelegation } = useStore();
  const [error, setError] = useState<string | null>(null);

  const pending = inboxRequests.items
    .filter((request) => request.status === "pending")
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const resolved = inboxRequests.items
    .filter((request) => request.status !== "pending")
    .slice()
    .sort((a, b) => (b.respondedAt ?? "").localeCompare(a.respondedAt ?? ""));

  function taskTitleFor(itemOccurrenceId: string) {
    const occurrence = itemOccurrences.items.find((entry) => entry.id === itemOccurrenceId);
    const item = occurrence ? items.items.find((entry) => entry.id === occurrence.itemId) : undefined;
    return { title: item?.title ?? "Unknown item", date: occurrence?.date };
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
          const { title, date } = taskTitleFor(request.itemOccurrenceId);
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
              const { title } = taskTitleFor(request.itemOccurrenceId);
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
  const { itemOccurrences, journalEntries, itemLogs, dogs } = useStore();
  // Sourced from real completions now. The old version read DailyFeedback, whose
  // `accident` flag was never observed — it was derived as
  // `category === "potty" && rating <= 2`, i.e. a low score on a potty break got
  // charted as an accident.
  const completedOccurrences = itemOccurrences.items.filter((entry) => entry.state === "completed");
  const rated = completedOccurrences.filter((entry) => entry.rating !== undefined);
  const completed = completedOccurrences.length;
  // Two sources, because the Quick log rework (2026-07-26) changed where an accident
  // gets recorded: it's now a potty log whose "Where" is indoors, rather than a
  // journal entry tagged "accident". Counting both keeps entries made before that
  // change in the total instead of silently dropping them off the chart.
  const legacyAccidents = journalEntries.items.filter((entry) => entry.tags.includes("accident")).length;
  const loggedAccidents = itemLogs.items.filter(
    (log) =>
      log.quickLogKind === "potty" &&
      log.values.some((value) => value.fieldName === "Where" && (value.value === "inside" || value.value === "crate")),
  ).length;
  const accidents = legacyAccidents + loggedAccidents;
  const avgRating = rated.length ? (rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length).toFixed(1) : "0.0";
  const ratingTrend = rated
    .slice()
    .sort((a, b) => (a.endTime ?? "").localeCompare(b.endTime ?? ""))
    .map((entry) => entry.rating ?? 0);
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
  const { meals, recipeIngredients, inventory, groceryList, items } = useStore();
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
            const load = dayLoadMinutes(dateKey, items.items);
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
