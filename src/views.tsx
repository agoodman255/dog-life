import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
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
import { FormEvent, useState } from "react";
import {
  AppMetric,
  DogProfile,
  HumanProfile,
  MilestoneCard,
  ProgressBar,
  Sparkline,
  TaskCard,
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
import { setPassword as setAccountPassword, signOut, useSession } from "./auth";
import { isBackendConfigured } from "./supabaseClient";
import { Dog, ExposureCategory, ExposureItem, FeedbackLoopRule, NotificationItem, Task } from "./types";
import {
  ageLabel,
  computeAloneTimeReadiness,
  computeNotifications,
  formatDate,
  heavyWeeks,
  isHeavyWeek,
  milestoneProgress,
  parseLocalDate,
  readinessScore,
  useAdaptivePlan,
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
  const { tasks, feedback, healthEvents, milestones, dogs, completeTask } = useStore();
  const adaptive = useAdaptivePlan(tasks.items, feedback);
  const feedbackByTask = new Map(feedback.map((item) => [item.taskId, item]));
  const puppy = dogs.items.find((dog) => dog.status === "puppy") ?? dogs.items[0];
  const overdue = healthEvents.items.filter((event) => parseLocalDate(event.date) < new Date()).length;
  const currentMilestone =
    milestones.items.find((item) => item.status !== "completed" && item.dependencies.length > 0) ?? milestones.items[0];

  return (
    <div className="dashboard">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">{adaptive.mode}</p>
          <h2>Today shows only what the household can realistically carry.</h2>
          <p>{adaptive.coach}</p>
        </div>
        <div className="coach-card">
          <Sparkles size={20} aria-hidden />
          <strong>AI coach preview</strong>
          <p>Current plan protects potty, meals, relationship safety, and short wins. Optional work drops when hard logs stack up.</p>
          <p className="small">
            Target: {adaptive.targetTrainingMinutes[0]}-{adaptive.targetTrainingMinutes[1]} min structured training,{" "}
            {adaptive.targetExerciseMinutes[0]}-{adaptive.targetExerciseMinutes[1]} min age-appropriate exercise.
          </p>
        </div>
      </section>

      <section className="metric-grid">
        <AppMetric label="Current streak" value="5 days" icon={Check} />
        <AppMetric label="Structured training" value={`${adaptive.trainingMinutes} min`} icon={Target} />
        <AppMetric label="Upcoming health" value={`${healthEvents.items.length}`} icon={HeartPulse} />
        <AppMetric label="Overdue tasks" value={`${overdue}`} icon={AlertTriangle} />
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
              <TaskCard key={task.id} task={task} feedback={feedbackByTask.get(task.id)} onComplete={completeTask} />
            ))}
          </div>
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
        </div>
      </section>
    </div>
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

export function CalendarView() {
  const { healthEvents, milestones, tasks, dogs, calendarEvents, aloneTimeLogs } = useStore();
  const [eventModal, setEventModal] = useState<"new" | (typeof calendarEvents.items)[number] | null>(null);
  const [aloneTimeModal, setAloneTimeModal] = useState(false);

  const recurring = calendarEvents.items.filter((event) => event.kind === "recurring");
  const upcoming = calendarEvents.items
    .filter((event) => event.kind === "one-off")
    .slice()
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const weeks = heavyWeeks(calendarEvents.items);
  const readiness = computeAloneTimeReadiness(aloneTimeLogs.items, calendarEvents.items);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Three-layer calendar</p>
          <h2>Static, adaptive, and recurring plans</h2>
        </div>
      </div>
      <div className="calendar-grid">
        {healthEvents.items.map((event) => (
          <article className="event" key={event.id}>
            <span>{formatDate(event.date)}</span>
            <strong>{event.title}</strong>
            <p>
              {event.kind} · {dogs.items.find((dog) => dog.id === event.dogId)?.name}
            </p>
            <small>{event.notes}</small>
          </article>
        ))}
        {milestones.items
          .filter((milestone) => milestone.status !== "completed")
          .slice(0, 4)
          .map((milestone) => (
            <article className="event adaptive" key={milestone.id}>
              <span>{milestone.status}</span>
              <strong>{milestone.title}</strong>
              <p>Adaptive milestone · {milestoneProgress(milestone)}%</p>
              <small>{milestone.why}</small>
            </article>
          ))}
        {tasks.items
          .filter((task) => task.category === "care" || task.category === "exercise" || task.category === "health")
          .map((task) => (
            <article className="event recurring" key={task.id}>
              <span>Daily</span>
              <strong>{task.title}</strong>
              <p>recurring · {task.time}</p>
              <small>{task.notes}</small>
            </article>
          ))}
      </div>

      <div className="row between" style={{ marginTop: 24 }}>
        <div>
          <p className="eyebrow">Alone-time readiness</p>
          <h3 style={{ margin: 0 }}>
            {readiness.nextEvent ? `Next up: ${readiness.nextEvent.title}` : "No upcoming commitment needs coverage yet"}
          </h3>
        </div>
        <button className="text-button" type="button" onClick={() => setAloneTimeModal(true)}>
          <Plus size={16} aria-hidden /> Log alone time
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

      <div className="row between" style={{ marginTop: 24 }}>
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
            className={`event commitment ${event.status === "placeholder" ? "placeholder" : ""}`}
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
            <small>{event.notes}</small>
          </article>
        ))}
      </div>

      {eventModal && (
        <Modal title={eventModal === "new" ? "Add calendar event" : "Edit calendar event"} onClose={() => setEventModal(null)}>
          <CalendarEventForm
            initial={eventModal === "new" ? undefined : eventModal}
            onCancel={() => setEventModal(null)}
            onSubmit={(values) => {
              if (eventModal === "new") {
                calendarEvents.add(calendarEventFormValuesToEvent(values, makeId("event")));
              } else {
                calendarEvents.update(eventModal.id, calendarEventFormValuesToEvent(values, eventModal.id));
              }
              setEventModal(null);
            }}
          />
        </Modal>
      )}
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
    </section>
  );
}

export function ProfileView() {
  const { dogs, people } = useStore();
  const [dogModal, setDogModal] = useState<"new" | Dog | null>(null);
  const [personModal, setPersonModal] = useState(false);

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
            <DogProfile dog={dog} key={dog.id} onEdit={(target) => setDogModal(target)} onDelete={(target) => dogs.remove(target.id)} />
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
  return (
    <section className="roadmap">
      {milestones.items.map((milestone) => (
        <MilestoneCard key={milestone.id} milestone={milestone} />
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
  const [open, setOpen] = useState(false);
  return (
    <div className="stack">
      <CalendarView />
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Health</p>
            <h2>Growth charts and upcoming care</h2>
          </div>
          <button className="primary-button" type="button" onClick={() => setOpen(true)}>
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
      {open && (
        <Modal title="Add health event" onClose={() => setOpen(false)}>
          <HealthEventForm
            dogOptions={dogs.items.map((dog) => ({ id: dog.id, name: dog.name }))}
            onCancel={() => setOpen(false)}
            onSubmit={(values) => {
              healthEvents.add(healthEventFormValuesToEvent(values, makeId("health")));
              setOpen(false);
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
  const feedbackByTask = new Map(feedback.map((item) => [item.taskId, item]));
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
          <TaskCard key={task.id} task={task} feedback={feedbackByTask.get(task.id)} onComplete={completeTask} onDelete={(target) => tasks.remove(target.id)} />
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
