export type ScenarioId = "fastfood" | "medicine";
export type Difficulty = "leicht" | "mittel" | "schwer";
export type PageId =
  | "start"
  | "ueben"
  | "pruefung"
  | "schema"
  | "merksaetze"
  | "fehler"
  | "fortschritt"
  | "einstellungen";

export interface Task {
  id: string;
  templateId: string;
  variant: number;
  title: string;
  prompt: string;
  difficulty: Difficulty;
  topic: string;
  scenario: ScenarioId;
  solution: string;
  examSolution: string;
  alternatives: string[];
  explanation: string[];
  examTip: string;
  keywords: string[];
  hints: string[];
  commonMistakes: string[];
  points: number;
  requires: string[];
  ordered: boolean;
}

export type CheckStatus = "richtig" | "technik" | "fast" | "falsch";

export interface CheckResult {
  status: CheckStatus;
  message: string;
  details: string[];
}

export interface Attempt {
  taskId: string;
  topic: string;
  status: CheckStatus;
  points: number;
  elapsedSeconds: number;
  createdAt: string;
}

export interface UserProgress {
  version: 1;
  attempts: Attempt[];
  streak: number;
  lastStudyDate: string | null;
  taskStates: Record<string, "Neu" | "Lernen" | "Wiederholen" | "Sicher">;
  theme: "hell" | "dunkel" | "system";
}

export const EMPTY_PROGRESS: UserProgress = {
  version: 1,
  attempts: [],
  streak: 0,
  lastStudyDate: null,
  taskStates: {},
  theme: "system"
};
