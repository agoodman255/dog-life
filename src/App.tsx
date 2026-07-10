import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  HeartPulse,
  Home,
  Import,
  Info,
  ListTodo,
  Lock,
  Moon,
  PawPrint,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Target,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { dogs, feedbackLoopRules, healthEvents, journalEntries, milestones, people, todayTasks } from "./data";
import { DailyFeedback, Dog, FeedbackLoopRule, Milestone, Person, Task } from "./types";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "profile", label: "Profile", icon: Users },
  { id: "training", label: "Training", icon: Target },
  { id: "health", label: "Health", icon: Stethoscope },
  { id: "journal", label: "Journal", icon: ClipboardList },
  { id: "milestones", label: "Milestones", icon: ShieldCheck },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const searchTargets: Record<string, string> = { Task: "tasks", Milestone: "milestones", Journal: "journal" };

const storageKey = "dog-life-os-feedback";
const themeKey = "dog-life-os-theme";

type Theme = "light" | "dark";

function loadTheme(): Theme {
  try {
    return localStorage.getItem(themeKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function loadFeedback(): DailyFeedback[] {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFeedback(feedback: DailyFeedback[]) {
  localStorage.setItem(storageKey, JSON.stringify(feedback));
}

function weeksOld(date: string) {
  const birthday = new Date(date).getTime();
  return Math.max(0, Math.floor((Date.now() - birthday) / (1000 * 60 * 60 * 24 * 7)));
}

function ageLabel(date: string) {
  const birth = new Date(date);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  const weeks = weeksOld(date);
  if (weeks < 24) return `${weeks} weeks old`;
  if (months < 24) return `${months} months old`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years} years, ${remainder} months old` : `${years} years old`;
}

function pct(value: number, max = 100) {
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function milestoneProgress(milestone: Milestone) {
  const total = milestone.steps.reduce((sum, step) => sum + step.sessionsRequired, 0);
  const done = milestone.steps.reduce((sum, step) => sum + Math.min(step.completedSessions, step.sessionsRequired), 0);
  return total === 0 ? 0 : pct(done, total);
}

function readinessScore(kind: "vet" | "walk" | "recall" | "hiking" | "dogPark", dog: Dog) {
  const vaccineBonus = kind === "dogPark" ? 8 : 18;
  const base =
    dog.confidence * 0.28 +
    dog.humanFriendliness * 0.14 +
    dog.dogFriendliness * 0.16 +
    (100 - dog.fearfulness) * 0.18 +
    (100 - dog.noiseSensitivity) * 0.1 +
    (100 - dog.resourceGuarding) * 0.08;
  const skillBonus = dog.masteredCommands.length * (kind === "recall" ? 5 : 3);
  const dampener = kind === "dogPark" ? 20 : kind === "hiking" ? 8 : 0;
  return Math.max(5, Math.min(98, Math.round(base + skillBonus + vaccineBonus - dampener)));
}

function useAdaptivePlan(feedback: DailyFeedback[]) {
  return useMemo(() => {
    const hardDays = feedback.slice(-6).filter((item) => item.rating <= 2 || item.fear || item.guarding).length;
    const optionalLimit = hardDays >= 3 ? 1 : 3;
    const completed = new Set(feedback.filter((item) => item.completed).map((item) => item.taskId));
    const visibleTasks = todayTasks.filter((task) => task.priority !== "optional" || optionalLimit > 1 || completed.has(task.id));
    const trainingMinutes = visibleTasks
      .filter((task) => task.category === "training" || task.category === "handling" || task.category === "relationship")
      .reduce((sum, task) => sum + task.duration, 0);
    return {
      hardDays,
      optionalLimit,
      visibleTasks,
      trainingMinutes,
      mode: hardDays >= 3 ? "Recovery workload" : "Balanced workload",
      coach:
        hardDays >= 3
          ? "Several difficult logs were detected, so tomorrow should protect essentials and reduce optional training."
          : "Today is balanced: short structured sessions, relationship care, and essential health routines stay visible.",
    };
  }, [feedback]);
}

function PersonName({ id }: { id: string }) {
  const person = people.find((item) => item.id === id);
  return <span style={{ color: person?.color }}>{person?.name ?? id}</span>;
}

function AppMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <div className="metric">
      <Icon size={18} aria-hidden />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TaskCard({
  task,
  feedback,
  onComplete,
}: {
  task: Task;
  feedback?: DailyFeedback;
  onComplete: (task: Task, rating: number) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  function toggleItem(item: string) {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
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
          <span className={`priority ${task.priority}`}>{task.priority}</span>
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
        <div className="rating-row" aria-label={`Complete ${task.title}`}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button key={rating} type="button" onClick={() => onComplete(task, rating)}>
              {rating}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="bar" aria-label={`${value}%`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const progress = milestoneProgress(milestone);
  return (
    <article className="milestone-card">
      <div className="row between">
        <div>
          <p className="eyebrow">{milestone.track}</p>
          <h3>{milestone.title}</h3>
        </div>
        <span className={`status ${milestone.status}`}>
          {milestone.status === "locked" && <Lock size={14} aria-hidden />}
          {milestone.status}
        </span>
      </div>
      <ProgressBar value={progress} />
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

function DogProfile({ dog }: { dog: Dog }) {
  const upcomingHealth = healthEvents.filter((event) => event.dogId === dog.id);
  const mastered = dog.masteredCommands.length ? dog.masteredCommands.join(", ") : "None yet";
  return (
    <article className="dog-card">
      <img src={dog.photo} alt="" />
      <div>
        <p className="eyebrow">{dog.status}</p>
        <h3>{dog.name}</h3>
        <p>
          {dog.breed} · {ageLabel(dog.birthday)} · {dog.weight} lb
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

function HumanProfile({ person }: { person: Person }) {
  const assignedTasks = todayTasks.filter((task) => person.taskIds.includes(task.id));
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

function ProfileView() {
  return (
    <section className="profile-page">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Profiles</p>
            <h2>Pets</h2>
          </div>
        </div>
        <div className="dog-grid">
          {dogs.map((dog) => (
            <DogProfile dog={dog} key={dog.id} />
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Household</p>
            <h2>Humans</h2>
          </div>
        </div>
        <div className="people-grid">
          {people.map((person) => (
            <HumanProfile key={person.id} person={person} />
          ))}
        </div>
        <div className="settings-row">
          <Info size={18} aria-hidden />
          <p>Humans stay lightweight: name, color, and task assignments. Permissions and notification preferences can live in auth later.</p>
        </div>
      </div>
    </section>
  );
}

function CalendarView() {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Three-layer calendar</p>
          <h2>Static, adaptive, and recurring plans</h2>
        </div>
      </div>
      <div className="calendar-grid">
        {healthEvents.map((event) => (
          <article className="event" key={event.id}>
            <span>{new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <strong>{event.title}</strong>
            <p>{event.kind} · {dogs.find((dog) => dog.id === event.dogId)?.name}</p>
            <small>{event.notes}</small>
          </article>
        ))}
        {milestones.slice(1, 5).map((milestone) => (
          <article className="event adaptive" key={milestone.id}>
            <span>{milestone.status}</span>
            <strong>{milestone.title}</strong>
            <p>Adaptive milestone · {milestoneProgress(milestone)}%</p>
            <small>{milestone.why}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function AnalyticsView({ feedback }: { feedback: DailyFeedback[] }) {
  const completed = feedback.filter((item) => item.completed).length;
  const accidents = feedback.filter((item) => item.accident).length;
  const avgRating = feedback.length
    ? (feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length).toFixed(1)
    : "0.0";
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
        <div className="analytics-list">
          {["Confidence", "Socialization exposure", "Emotional regulation", "Relationship with Griz", "Independence", "Impulse control"].map(
            (label, index) => (
              <div key={label}>
                <span>{label}</span>
                <ProgressBar value={[64, 42, 58, 71, 46, 39][index]} />
              </div>
            ),
          )}
        </div>
      </section>
      <FeedbackLoopView />
    </div>
  );
}

function FeedbackLoopView() {
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

function SettingsView({
  theme,
  onToggleTheme,
  onExport,
  onImportClick,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onExport: () => void;
  onImportClick: () => void;
}) {
  return (
    <div className="stack settings">
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
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Household</p>
            <h2>Members</h2>
          </div>
        </div>
        <div className="people-grid">
          {people.map((person) => (
            <HumanProfile key={person.id} person={person} />
          ))}
        </div>
        <div className="settings-row">
          <Info size={18} aria-hidden />
          <p>Roles, invitations, and notification preferences arrive with Supabase Auth in the planned backend path.</p>
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
          <p>Export all dogs, tasks, milestones, health events, journal entries, and logged feedback as JSON.</p>
          <button className="icon-button" type="button" onClick={onExport} aria-label="Export data">
            <Download size={18} aria-hidden />
          </button>
        </div>
        <div className="settings-row">
          <Import size={18} aria-hidden />
          <p>Import a previously exported JSON file to restore logged task feedback on this device.</p>
          <button className="icon-button" type="button" onClick={onImportClick} aria-label="Import data">
            <Import size={18} aria-hidden />
          </button>
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [active, setActive] = useState("dashboard");
  const [feedback, setFeedback] = useState<DailyFeedback[]>(loadFeedback);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const importInputRef = useRef<HTMLInputElement>(null);
  const adaptive = useAdaptivePlan(feedback);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeKey, theme);
  }, [theme]);

  const feedbackByTask = new Map(feedback.map((item) => [item.taskId, item]));
  const puppy = dogs[0];
  const overdue = healthEvents.filter((event) => new Date(event.date) < new Date()).length;
  const currentMilestone = milestones.find((item) => item.status === "current") ?? milestones[0];
  const searchResults = useMemo(() => {
    const haystack = [...todayTasks.map((item) => ({ type: "Task", title: item.title, detail: item.notes })), ...milestones.map((item) => ({ type: "Milestone", title: item.title, detail: item.why })), ...journalEntries.map((item) => ({ type: "Journal", title: item.title, detail: item.text }))];
    return query ? haystack.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase())) : [];
  }, [query]);

  function completeTask(task: Task, rating: number) {
    const entry: DailyFeedback = {
      taskId: task.id,
      completed: true,
      rating,
      mood: rating >= 4 ? "calm" : rating === 3 ? "tired" : "frustrated",
      successScore: rating * 20,
      notes: rating >= 4 ? "Went well." : "Needs an easier setup tomorrow.",
      accident: task.id === "morning-potty" && rating <= 2,
      barking: false,
      fear: rating <= 2 && task.category === "socialization",
      guarding: rating <= 2 && task.category === "relationship",
      completedAt: new Date().toISOString(),
    };
    const next = [...feedback.filter((item) => item.taskId !== task.id), entry];
    setFeedback(next);
    saveFeedback(next);
  }

  function exportData() {
    const payload = { dogs, people, tasks: todayTasks, milestones, healthEvents, journalEntries, feedback };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "dog-life-os-export.json";
    link.click();
  }

  async function importData(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const imported = Array.isArray(parsed.feedback) ? (parsed.feedback as DailyFeedback[]) : [];
      setFeedback(imported);
      saveFeedback(imported);
    } catch {
      window.alert("That file could not be read as a Dog Life OS export.");
    }
  }

  function selectResult(result: { type: string; title: string }) {
    setActive(searchTargets[result.type] ?? "dashboard");
    setQuery("");
  }

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <PawPrint size={26} aria-hidden />
          <div>
            <strong>Dog Life OS</strong>
            <span>Andrew + Bree</span>
          </div>
        </div>
        <nav>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button className={active === id ? "active" : ""} key={id} type="button" onClick={() => setActive(id)}>
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Adaptive puppy raising & household planning</p>
            <h1>Lifelong dog companion system</h1>
          </div>
          <div className="top-actions">
            <label className="search">
              <Search size={17} aria-hidden />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, vaccines, walks" />
            </label>
            <button className="icon-button" type="button" onClick={exportData} aria-label="Export data">
              <Download size={18} aria-hidden />
            </button>
            <button className="icon-button" type="button" onClick={() => importInputRef.current?.click()} aria-label="Import data">
              <Import size={18} aria-hidden />
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importData(file);
                event.target.value = "";
              }}
            />
            <button
              className="icon-button"
              type="button"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
          </div>
        </header>

        {query && (
          <section className="search-results">
            {searchResults.map((result) => (
              <button key={`${result.type}-${result.title}`} type="button" onClick={() => selectResult(result)}>
                <span>{result.type}</span>
                <strong>{result.title}</strong>
                <ChevronRight size={16} aria-hidden />
              </button>
            ))}
            {searchResults.length === 0 && (
              <p className="search-empty">No matches for "{query}" in tasks, milestones, or journal entries.</p>
            )}
          </section>
        )}

        {active === "dashboard" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="dashboard">
            <section className="hero-panel">
              <div>
                <p className="eyebrow">{adaptive.mode}</p>
                <h2>Today shows only what the household can realistically carry.</h2>
                <p>{adaptive.coach}</p>
              </div>
              <div className="coach-card">
                <Sparkles size={20} aria-hidden />
                <strong>AI coach preview</strong>
                <p>
                  Current plan protects potty, meals, relationship safety, and short wins. Optional work drops when hard logs stack up.
                </p>
              </div>
            </section>

            <section className="metric-grid">
              <AppMetric label="Current streak" value="5 days" icon={Check} />
              <AppMetric label="Structured training" value={`${adaptive.trainingMinutes} min`} icon={Target} />
              <AppMetric label="Upcoming health" value={`${healthEvents.length}`} icon={HeartPulse} />
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
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Why isn't this unlocked?</p>
                      <h2>{currentMilestone.title}</h2>
                    </div>
                  </div>
                  <MilestoneCard milestone={currentMilestone} />
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Readiness</p>
                      <h2>{puppy.name}</h2>
                    </div>
                  </div>
                  {[
                    ["Vet visit", readinessScore("vet", puppy)],
                    ["Neighborhood walk", readinessScore("walk", puppy)],
                    ["Off-leash recall", readinessScore("recall", puppy)],
                    ["Hiking", readinessScore("hiking", puppy)],
                    ["Dog park", readinessScore("dogPark", puppy)],
                  ].map(([label, value]) => (
                    <div className="readiness" key={label}>
                      <span>{label}</span>
                      <strong>{value}%</strong>
                      <ProgressBar value={Number(value)} />
                    </div>
                  ))}
                </section>
              </div>
            </section>
          </motion.div>
        )}

        {active === "calendar" && <CalendarView />}
        {active === "profile" && <ProfileView />}
        {active === "training" && (
          <section className="milestone-grid">
            {milestones.map((milestone) => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </section>
        )}
        {active === "health" && <CalendarView />}
        {active === "journal" && (
          <section className="panel journal">
            {journalEntries.map((entry) => (
              <article key={entry.id}>
                <span>{entry.date}</span>
                <h3>{entry.title}</h3>
                <p>{entry.text}</p>
                <div>{entry.tags.map((tag) => <small key={tag}>{tag}</small>)}</div>
              </article>
            ))}
          </section>
        )}
        {active === "milestones" && (
          <section className="roadmap">
            {milestones.map((milestone) => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </section>
        )}
        {active === "tasks" && (
          <section className="panel">
            <div className="task-list">
              {todayTasks.map((task) => (
                <TaskCard key={task.id} task={task} feedback={feedbackByTask.get(task.id)} onComplete={completeTask} />
              ))}
            </div>
          </section>
        )}
        {active === "analytics" && <AnalyticsView feedback={feedback} />}
        {active === "settings" && (
          <SettingsView
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            onExport={exportData}
            onImportClick={() => importInputRef.current?.click()}
          />
        )}
      </main>
    </div>
  );
}
