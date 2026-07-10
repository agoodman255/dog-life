import { Activity, Check, Lock, Play, X } from "lucide-react";
import { ReactNode, useState } from "react";
import { useStore } from "./store";
import { DailyFeedback, Dog, Milestone, Person, Task } from "./types";
import { computeMilestoneStatus, milestoneProgress, resolveDependencies } from "./utils";

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
}: {
  task: Task;
  feedback?: DailyFeedback;
  onComplete: (task: Task, rating: number) => void;
  onDelete?: (task: Task) => void;
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
          <div className="row" style={{ gap: 8 }}>
            <span className={`priority ${task.priority}`}>{task.priority}</span>
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
  const assignedTasks = tasks.items.filter((task) => person.taskIds.includes(task.id));
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
