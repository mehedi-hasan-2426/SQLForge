import type { CheckStatus, Task } from "../domain";

export type ExamMode = "practice" | "simulation";

export function chooseExamTasks(
  tasks: Task[],
  count: number,
  topics: string[],
  difficulty: string,
  random: () => number = Math.random
): Task[] {
  const candidates = tasks.filter((task) =>
    (!topics.length || topics.includes(task.topic))
    && (difficulty === "Alle Stufen" || task.difficulty === difficulty)
  );
  if (!Number.isInteger(count) || count < 1 || candidates.length < count) {
    throw new Error("Zu wenige Aufgaben für diese Auswahl. Wähle weitere Themen oder Schwierigkeitsstufen.");
  }
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const position = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[position]] = [shuffled[position], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export function createExamTiming(mode: ExamMode, minutes: number, now: number): {
  startedAt: number;
  durationSeconds: number;
  endsAt: number;
} {
  const durationMinutes = mode === "simulation" ? 40 : minutes;
  if (mode === "practice" && ![20, 40, 60, 90].includes(durationMinutes)) {
    throw new Error("Zeitlimit muss 20, 40, 60 oder 90 Minuten sein.");
  }
  return {
    startedAt: now,
    durationSeconds: durationMinutes * 60,
    endsAt: now + durationMinutes * 60_000
  };
}

export function pointsForStatus(status: CheckStatus, mode: ExamMode, taskPoints: number): number {
  if (status === "richtig") return mode === "simulation" ? 5 : taskPoints;
  if (status === "technik") return mode === "simulation" ? 2.5 : taskPoints * 0.5;
  return 0;
}
