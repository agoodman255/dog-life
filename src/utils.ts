import { useMemo } from "react";
import { DailyFeedback, HealthEvent, Milestone, NotificationItem, Task } from "./types";

export function weeksOld(date: string) {
  const birthday = new Date(date).getTime();
  return Math.max(0, Math.floor((Date.now() - birthday) / (1000 * 60 * 60 * 24 * 7)));
}

export function ageLabel(date: string) {
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

export function pct(value: number, max = 100) {
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

export function milestoneProgress(milestone: Milestone) {
  const total = milestone.steps.reduce((sum, step) => sum + step.sessionsRequired, 0);
  const done = milestone.steps.reduce((sum, step) => sum + Math.min(step.completedSessions, step.sessionsRequired), 0);
  return total === 0 ? 0 : pct(done, total);
}

export function isMilestoneComplete(milestone: Milestone) {
  return milestone.steps.every((step) => step.completedSessions >= step.sessionsRequired);
}

export type DependencyStatus = {
  id: string;
  title: string;
  met: boolean;
  progress: number;
};

export function resolveDependencies(milestone: Milestone, allMilestones: Milestone[]): DependencyStatus[] {
  return milestone.dependencies.map((depId) => {
    const dep = allMilestones.find((item) => item.id === depId);
    if (!dep) {
      return { id: depId, title: depId, met: false, progress: 0 };
    }
    return { id: dep.id, title: dep.title, met: isMilestoneComplete(dep) || dep.status === "completed", progress: milestoneProgress(dep) };
  });
}

export function computeMilestoneStatus(milestone: Milestone, allMilestones: Milestone[]): Milestone["status"] {
  if (milestone.status === "skipped" || milestone.status === "delayed") return milestone.status;
  if (isMilestoneComplete(milestone)) return "completed";
  const hasLoggedProgress = milestone.steps.some((step) => step.completedSessions > 0);
  if (hasLoggedProgress) return "current";
  const deps = resolveDependencies(milestone, allMilestones);
  const allDepsMet = deps.every((dep) => dep.met);
  return allDepsMet ? "current" : "locked";
}

export function readinessScore(
  kind: "vet" | "walk" | "recall" | "hiking" | "dogPark",
  dog: { confidence: number; humanFriendliness: number; dogFriendliness: number; fearfulness: number; noiseSensitivity: number; resourceGuarding: number; masteredCommands: string[] },
) {
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

export function useAdaptivePlan(tasks: Task[], feedback: DailyFeedback[]) {
  return useMemo(() => {
    const hardDays = feedback.slice(-6).filter((item) => item.rating <= 2 || item.fear || item.guarding).length;
    const optionalLimit = hardDays >= 3 ? 1 : 3;
    const completed = new Set(feedback.filter((item) => item.completed).map((item) => item.taskId));
    const visibleTasks = tasks.filter((task) => task.priority !== "optional" || optionalLimit > 1 || completed.has(task.id));
    const trainingMinutes = visibleTasks
      .filter((task) => task.category === "training" || task.category === "handling" || task.category === "relationship")
      .reduce((sum, task) => sum + task.duration, 0);
    return {
      hardDays,
      optionalLimit,
      visibleTasks,
      trainingMinutes,
      targetTrainingMinutes: [20, 30] as [number, number],
      targetExerciseMinutes: [30, 60] as [number, number],
      mode: hardDays >= 3 ? "Recovery workload" : "Balanced workload",
      coach:
        hardDays >= 3
          ? "Several difficult logs were detected, so tomorrow should protect essentials and reduce optional training."
          : "Today is balanced: short structured sessions, relationship care, and essential health routines stay visible.",
    };
  }, [tasks, feedback]);
}

export function computeNotifications(
  tasks: Task[],
  feedback: DailyFeedback[],
  healthEvents: HealthEvent[],
  milestones: Milestone[],
): NotificationItem[] {
  const notifications: NotificationItem[] = [];
  const now = new Date();
  const completedTaskIds = new Set(feedback.filter((item) => item.completed).map((item) => item.taskId));

  tasks.forEach((task) => {
    if (task.priority === "essential" && !completedTaskIds.has(task.id)) {
      notifications.push({
        id: `overdue-${task.id}`,
        kind: "overdue-task",
        title: `${task.title} is not logged yet`,
        detail: `Essential task assigned at ${task.time}.`,
        date: now.toISOString(),
        severity: "warning",
      });
    }
  });

  healthEvents.forEach((event) => {
    const eventDate = new Date(event.date);
    const daysAway = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAway < 0) {
      notifications.push({
        id: `overdue-health-${event.id}`,
        kind: "upcoming-health",
        title: `${event.title} is overdue`,
        detail: `${event.kind} was due ${eventDate.toLocaleDateString()}.`,
        date: event.date,
        severity: "critical",
      });
    } else if (daysAway <= 3) {
      notifications.push({
        id: `upcoming-health-${event.id}`,
        kind: "upcoming-health",
        title: `${event.title} coming up`,
        detail: `${event.kind} scheduled ${eventDate.toLocaleDateString()}.`,
        date: event.date,
        severity: "info",
      });
    }
  });

  milestones.forEach((milestone) => {
    const status = computeMilestoneStatus(milestone, milestones);
    if (status === "current" && milestone.status === "locked") {
      notifications.push({
        id: `unlocked-${milestone.id}`,
        kind: "milestone-unlocked",
        title: `${milestone.title} just unlocked`,
        detail: "All prerequisites are now met.",
        date: now.toISOString(),
        severity: "info",
      });
    }
  });

  return notifications.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}
