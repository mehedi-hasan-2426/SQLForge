import { EMPTY_PROGRESS, type Attempt, type CheckStatus, type UserProgress } from "../domain";

export const PROGRESS_KEY = "sql-pruefungstrainer-progress-v1";
export const MAX_IMPORT_BYTES = 1_000_000;

const statuses: CheckStatus[] = ["richtig", "technik", "fast", "falsch"];

function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.taskId === "string"
    && typeof item.topic === "string"
    && statuses.includes(item.status as CheckStatus)
    && typeof item.points === "number"
    && typeof item.elapsedSeconds === "number"
    && typeof item.createdAt === "string"
    && item.taskId.length <= 120
    && item.topic.length <= 120
    && item.createdAt.length <= 40
    && Number.isFinite(item.points) && item.points >= 0
    && Number.isFinite(item.elapsedSeconds) && item.elapsedSeconds >= 0;
}

export function validateProgress(value: unknown): UserProgress {
  if (!value || typeof value !== "object") throw new Error("Datei enthält keinen gültigen Lernstand.");
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.attempts) || data.attempts.length > 5_000) {
    throw new Error("Lernstand hat ein unbekanntes Format oder zu viele Einträge.");
  }
  if (!data.attempts.every(isAttempt)) throw new Error("Mindestens ein Übungsversuch ist ungültig.");
  if (typeof data.streak !== "number" || data.streak < 0 || !Number.isInteger(data.streak)) {
    throw new Error("Lernserie im Import ist ungültig.");
  }
  if (data.lastStudyDate !== null && typeof data.lastStudyDate !== "string") {
    throw new Error("Datum im Import ist ungültig.");
  }
  if (!data.taskStates || typeof data.taskStates !== "object" || Array.isArray(data.taskStates)) {
    throw new Error("Aufgabenstatus im Import ist ungültig.");
  }
  const taskStates = data.taskStates as Record<string, unknown>;
  if (Object.keys(taskStates).length > 120 || Object.keys(taskStates).some((key) => key.length > 120)) {
    throw new Error("Zu viele Aufgabenstatus im Import.");
  }
  const stateValues = Object.values(taskStates);
  if (stateValues.some((state) => !["Neu", "Lernen", "Wiederholen", "Sicher"].includes(String(state)))) {
    throw new Error("Unbekannter Aufgabenstatus im Import.");
  }
  if (!["hell", "dunkel", "system"].includes(String(data.theme))) {
    throw new Error("Darstellung im Import ist ungültig.");
  }
  return {
    version: 1,
    attempts: data.attempts as Attempt[],
    streak: data.streak,
    lastStudyDate: data.lastStudyDate as string | null,
    taskStates: data.taskStates as UserProgress["taskStates"],
    theme: data.theme as UserProgress["theme"]
  };
}

export function readProgress(storage: Storage): { progress: UserProgress; error: string | null } {
  const raw = storage.getItem(PROGRESS_KEY);
  if (!raw) return { progress: structuredClone(EMPTY_PROGRESS), error: null };
  try {
    return { progress: validateProgress(JSON.parse(raw)), error: null };
  } catch (error) {
    return {
      progress: structuredClone(EMPTY_PROGRESS),
      error: error instanceof Error ? `Gespeicherter Lernstand konnte nicht gelesen werden: ${error.message}` : "Gespeicherter Lernstand ist ungültig."
    };
  }
}

export function saveProgress(storage: Storage, progress: UserProgress): void {
  storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function importProgress(text: string): UserProgress {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) throw new Error("Datei ist größer als 1 MB.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Datei enthält kein gültiges JSON.");
  }
  return validateProgress(parsed);
}
