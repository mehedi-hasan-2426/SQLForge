import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { SCENARIOS } from "../data/scenarios";
import { TASK_COUNTS, TASKS, createVariant } from "../data/tasks";
import { EMPTY_PROGRESS, type Attempt, type CheckResult, type PageId, type ScenarioId, type Task, type UserProgress } from "../domain";
import { checkAnswer, resultsMatch } from "../sql/check";
import { MAX_QUERY_LENGTH } from "../sql/engine";
import { executeInWorker } from "../sql/runner";
import { createSharePayload, createWhatsAppLink } from "../share/share";
import { importProgress, readProgress, saveProgress } from "../progress/store";
import { chooseExamTasks, createExamTiming, pointsForStatus, type ExamMode } from "../exam/session";
import { ERROR_TASKS, MEMORY_RULES, SIGNAL_PHRASES } from "./content";

interface ExamRun {
  mode: ExamMode;
  hintsEnabled: boolean;
  tasks: Task[];
  index: number;
  answers: Record<string, string>;
  startedAt: number;
  durationSeconds: number;
  endsAt: number;
  status: "active" | "graded";
  results: { taskId: string; outcome: CheckResult | null; points: number }[];
  score: number;
  maxPoints: number;
}

function findErrorLine(query: string, message: string): number | null {
  const token = message.match(/(?:no such column|no such table):\s*([^\s,]+)/i)?.[1]
    ?? message.match(/near ["']([^"']+)["']/i)?.[1];
  if (!token) return null;
  const index = query.split(/\r?\n/).findIndex((line) => line.toLowerCase().includes(token.toLowerCase()));
  return index < 0 ? null : index + 1;
}

const NAV: { id: PageId; label: string; number: string }[] = [
  { id: "start", label: "Start", number: "01" },
  { id: "ueben", label: "Üben", number: "02" },
  { id: "pruefung", label: "Prüfung", number: "03" },
  { id: "schema", label: "Schema", number: "04" },
  { id: "merksaetze", label: "Merksätze", number: "05" },
  { id: "fehler", label: "Fehlertraining", number: "06" },
  { id: "fortschritt", label: "Fortschritt", number: "07" },
  { id: "einstellungen", label: "Einstellungen", number: "08" }
];

const STARTER_SQL = "-- Schreibe deine Abfrage hier\nSELECT ";
const EXAM_STORAGE_KEY = "sql-pruefungstrainer-exam-v1";

function initialProgress(): { value: UserProgress; warning: string | null } {
  try {
    const stored = readProgress(window.localStorage);
    return { value: stored.progress, warning: stored.error };
  } catch {
    return { value: structuredClone(EMPTY_PROGRESS), warning: "Lokaler Speicher ist nicht verfügbar. Fortschritt wird nicht gespeichert." };
  }
}

function readExamRun(): ExamRun | null {
  try {
    const raw = window.localStorage.getItem(EXAM_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.status !== "active" || !["practice", "simulation"].includes(String(value.mode))) return null;
    if (!Array.isArray(value.tasks) || value.tasks.length < 1 || value.tasks.length > 20) return null;
    const tasks = value.tasks.map((candidate) => {
      if (!candidate || typeof candidate !== "object" || !("id" in candidate)) return undefined;
      return TASKS.find((item) => item.id === candidate.id);
    });
    if (tasks.some((item) => !item)) return null;
    const savedTasks = tasks as Task[];
    if (!Number.isInteger(value.index) || Number(value.index) < 0 || Number(value.index) >= savedTasks.length) return null;
    if (typeof value.endsAt !== "number" || typeof value.startedAt !== "number" || typeof value.durationSeconds !== "number") return null;
    const savedAnswers: Record<string, string> = {};
    if (value.answers && typeof value.answers === "object" && !Array.isArray(value.answers)) {
      for (const [taskId, answer] of Object.entries(value.answers as Record<string, unknown>)) {
        if (savedTasks.some((item) => item.id === taskId) && typeof answer === "string" && answer.length <= MAX_QUERY_LENGTH) {
          savedAnswers[taskId] = answer;
        }
      }
    }
    return {
      mode: value.mode as ExamMode,
      hintsEnabled: value.mode === "practice" && value.hintsEnabled === true,
      tasks: savedTasks,
      index: Number(value.index),
      answers: savedAnswers,
      startedAt: value.startedAt,
      durationSeconds: value.durationSeconds,
      endsAt: value.endsAt,
      status: "active",
      results: [],
      score: 0,
      maxPoints: value.mode === "simulation" ? 50 : savedTasks.reduce((sum, item) => sum + item.points, 0)
    };
  } catch {
    return null;
  }
}

function explainSqlError(message: string): string {
  if (/no such column:\s*CustomerID/i.test(message)) return "Die Spalte CustomerID existiert nicht. Prüfe im Schema, wie der Fremdschlüssel in F_ORDERS heißt.";
  if (/no such column/i.test(message)) return "Eine Spalte existiert nicht. Prüfe Schreibweise und Tabelle in der Schema-Ansicht.";
  if (/no such table:\s*F_Orders_Lines/i.test(message)) return "Prüfe den Tabellennamen. Im Schema heißt die Tabelle F_ORDER_LINES.";
  if (/no such table/i.test(message)) return "Diese Tabelle gibt es im gewählten Datenbankszenario nicht. Prüfe das Schema.";
  if (/near ["']?FORM/i.test(message)) return "Meintest du FROM statt FORM?";
  if (/syntax error/i.test(message)) return "Prüfe SQL-Schlüsselwörter, Klammern und Kommas. Die Meldung oben zeigt meist die Stelle.";
  if (/query_only/i.test(message)) return "Die Übungsdatenbank ist schreibgeschützt. Verwende nur SELECT-Abfragen.";
  return "Prüfe zuerst die betroffene Spalte oder das SQL-Schlüsselwort. Die genaue SQLite-Meldung steht oben.";
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = Math.max(0, seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function nextDayStreak(progress: UserProgress, date: string): number {
  if (progress.lastStudyDate === date) return progress.streak;
  const yesterday = new Date(`${date}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  return progress.lastStudyDate === yesterday.toISOString().slice(0, 10) ? progress.streak + 1 : 1;
}

function gradeForTopic(attempts: Attempt[], topic: string): number {
  const relevant = attempts.filter((attempt) => attempt.topic === topic);
  if (!relevant.length) return 0;
  return Math.round((relevant.reduce((sum, attempt) => sum + (attempt.status === "richtig" ? 1 : attempt.status === "technik" ? 0.5 : 0), 0) / relevant.length) * 100);
}

function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] ?? character);
}

function App() {
  const [loaded] = useState(initialProgress);
  const storageWritable = useRef(loaded.warning === null);
  const [page, setPage] = useState<PageId>("start");
  const [progress, setProgress] = useState<UserProgress>(loaded.value);
  const [storageWarning, setStorageWarning] = useState<string | null>(loaded.warning);
  const [theme, setTheme] = useState<UserProgress["theme"]>(loaded.value.theme);
  const [task, setTask] = useState<Task>(TASKS[0]);
  const [query, setQuery] = useState(STARTER_SQL);
  const [scenario, setScenario] = useState<ScenarioId>(TASKS[0].scenario);
  const [output, setOutput] = useState<{ columns: string[]; rows: unknown[][]; rowCount: number } | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [solutionVisible, setSolutionVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [filterTopic, setFilterTopic] = useState("Alle Themen");
  const [filterDifficulty, setFilterDifficulty] = useState("Alle Stufen");
  const [exam, setExam] = useState<ExamRun | null>(readExamRun);
  const [examLength, setExamLength] = useState("10");
  const [examMinutes, setExamMinutes] = useState("40");
  const [examHintsEnabled, setExamHintsEnabled] = useState(true);
  const [examTopics, setExamTopics] = useState<string[]>([]);
  const [examDifficulty, setExamDifficulty] = useState("Alle Stufen");
  const [examTimeLeft, setExamTimeLeft] = useState(0);
  const [errorIndex, setErrorIndex] = useState(0);
  const [errorQuery, setErrorQuery] = useState(ERROR_TASKS[0].broken);
  const [errorExplanation, setErrorExplanation] = useState("");
  const [errorOutcome, setErrorOutcome] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const topics = useMemo(() => [...new Set(TASKS.map((item) => item.topic))].sort(), []);
  const filteredTasks = useMemo(() => TASKS.filter((item) =>
    (filterTopic === "Alle Themen" || item.topic === filterTopic)
    && (filterDifficulty === "Alle Stufen" || item.difficulty === filterDifficulty)
    && (!search.trim() || `${item.title} ${item.prompt} ${item.topic}`.toLowerCase().includes(search.toLowerCase()))
  ), [filterTopic, filterDifficulty, search]);
  const activeError = ERROR_TASKS[errorIndex];
  const currentExamTask = exam?.tasks[exam.index] ?? null;
  const examAnswer = currentExamTask ? exam?.answers[currentExamTask.id] ?? "" : "";

  useEffect(() => {
    const showPwaError = () => setNotice("Offline-Modus konnte nicht aktiviert werden. Nutze localhost oder HTTPS und lade neu.");
    window.addEventListener("trainer-pwa-error", showPwaError);
    return () => window.removeEventListener("trainer-pwa-error", showPwaError);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!storageWritable.current) return;
    try {
      saveProgress(window.localStorage, { ...progress, theme });
    } catch {
      storageWritable.current = false;
      setStorageWarning("Lernstand konnte nicht gespeichert werden. Prüfe den freien Speicherplatz im Browser.");
    }
  }, [progress, theme]);

  useEffect(() => {
    if (!exam || exam.status !== "active") {
      try {
        window.localStorage.removeItem(EXAM_STORAGE_KEY);
      } catch {
        setStorageWarning("Prüfungsstand konnte nicht aus dem Browser-Speicher entfernt werden.");
      }
      return;
    }
    try {
      window.localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(exam));
    } catch {
      storageWritable.current = false;
      setStorageWarning("Prüfungsstand konnte nicht gespeichert werden. Lass diese Seite geöffnet.");
    }
  }, [exam]);

  useEffect(() => {
    if (!exam || exam.status !== "active") return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((exam.endsAt - Date.now()) / 1000));
      setExamTimeLeft(left);
      if (left === 0) void finishExam();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", warnBeforeLeave);
    };
  }, [exam]);

  function persistProgress(next: UserProgress): void {
    setProgress(next);
    if (!storageWritable.current) return;
    try {
      saveProgress(window.localStorage, next);
      setStorageWarning(null);
    } catch {
      storageWritable.current = false;
      setStorageWarning("Lernstand konnte nicht gespeichert werden. Browser-Speicher ist eventuell voll.");
    }
  }

  function recordAttempt(item: Task, outcome: CheckResult, elapsed: number): void {
    const createdAt = new Date().toISOString();
    const today = createdAt.slice(0, 10);
    const attempt: Attempt = {
      taskId: item.id,
      topic: item.topic,
      status: outcome.status,
      points: outcome.status === "richtig" ? item.points : outcome.status === "technik" ? item.points * 0.5 : 0,
      elapsedSeconds: elapsed,
      createdAt
    };
    const previousCorrect = progress.attempts.filter((entry) => entry.taskId === item.id && entry.status === "richtig").length;
    let taskState: UserProgress["taskStates"][string];
    if (outcome.status === "falsch") taskState = "Lernen";
    else if (outcome.status === "fast" || outcome.status === "technik") taskState = "Wiederholen";
    else taskState = previousCorrect >= 2 ? "Sicher" : "Lernen";
    persistProgress({
      ...progress,
      attempts: [...progress.attempts, attempt].slice(-5_000),
      streak: nextDayStreak(progress, today),
      lastStudyDate: today,
      taskStates: { ...progress.taskStates, [item.id]: taskState }
    });
  }

  function selectTask(item: Task): void {
    setTask(item);
    setScenario(item.scenario);
    setQuery(STARTER_SQL);
    setOutput(null);
    setCheck(null);
    setSqlError(null);
    setHintLevel(0);
    setSolutionVisible(false);
    setPage("ueben");
  }

  async function runQuery(answer = query, selectedScenario = scenario): Promise<void> {
    setBusy(true);
    setSqlError(null);
    setCheck(null);
    try {
      const result = await executeInWorker(answer, selectedScenario);
      setOutput(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "SQL-Abfrage fehlgeschlagen.";
      setSqlError(message);
      setNotice(explainSqlError(message));
    } finally {
      setBusy(false);
    }
  }

  async function checkQuery(): Promise<void> {
    if (scenario !== task.scenario) {
      setNotice(`Diese Aufgabe nutzt ${SCENARIOS[task.scenario].label}. Wähle dieses Szenario, bevor du die Lösung prüfst.`);
      return;
    }
    setBusy(true);
    setSqlError(null);
    setNotice(null);
    try {
      const [actual, expected] = await Promise.all([
        executeInWorker(query, task.scenario),
        executeInWorker(task.solution, task.scenario)
      ]);
      const outcome = checkAnswer(query, task, actual, expected);
      setOutput(actual);
      setCheck(outcome);
      recordAttempt(task, outcome, Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lösung konnte nicht geprüft werden.";
      setSqlError(message);
      setNotice(explainSqlError(message));
    } finally {
      setBusy(false);
    }
  }

  const startedAt = useRef(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
  }, [task.id]);

  async function share(text: string): Promise<void> {
    const payload = createSharePayload(text);
    setShareLink(createWhatsAppLink(text));
    try {
      if (navigator.share) {
        await navigator.share({ title: "SQLForge", text: payload });
        setNotice("Inhalt wurde geteilt.");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
        setNotice("Text kopiert. Öffne WhatsApp über den Link.");
      } else {
        setNotice("Nutze den WhatsApp-Link. Keine lokalen Datenbankdaten werden geteilt.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setNotice("Teilen war nicht möglich. Der WhatsApp-Link bleibt verfügbar.");
    }
  }

  function newVariant(): void {
    const replacement = createVariant(task);
    selectTask(replacement);
  }

  function startExam(mode: ExamMode): void {
    const requested = mode === "simulation" ? 10 : Number(examLength);
    let pool: Task[];
    try {
      pool = chooseExamTasks(TASKS, requested, mode === "simulation" ? [] : examTopics, mode === "simulation" ? "Alle Stufen" : examDifficulty);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Prüfung konnte nicht gestartet werden.");
      return;
    }
    const timing = createExamTiming(mode, Number(examMinutes), Date.now());
    const nextExam: ExamRun = {
      mode,
      hintsEnabled: mode === "practice" && examHintsEnabled,
      tasks: pool,
      index: 0,
      answers: {},
      ...timing,
      status: "active",
      results: [],
      score: 0,
      maxPoints: mode === "simulation" ? 50 : pool.reduce((sum, item) => sum + item.points, 0)
    };
    setHintLevel(0);
    setExam(nextExam);
    setExamTimeLeft(timing.durationSeconds);
    setPage("pruefung");
    setNotice(mode === "simulation" ? "Klausursimulation gestartet: 40 Minuten, 50 Punkte." : "Prüfung gestartet. Lösungen bleiben bis zur Abgabe verborgen.");
  }

  async function finishExam(): Promise<void> {
    const activeExam = exam;
    if (!activeExam || activeExam.status !== "active") return;
    setExam({ ...activeExam, status: "graded" });
    const results: ExamRun["results"] = [];
    const attempts: Attempt[] = [];
    let score = 0;
    for (const item of activeExam.tasks) {
      const answer = activeExam.answers[item.id]?.trim() ?? "";
      if (!answer) {
        results.push({ taskId: item.id, outcome: null, points: 0 });
        continue;
      }
      try {
        const [actual, expected] = await Promise.all([
          executeInWorker(answer, item.scenario),
          executeInWorker(item.solution, item.scenario)
        ]);
        const outcome = checkAnswer(answer, item, actual, expected);
        const points = pointsForStatus(outcome.status, activeExam.mode, item.points);
        score += points;
        results.push({ taskId: item.id, outcome, points });
        attempts.push({
          taskId: item.id, topic: item.topic, status: outcome.status, points,
          elapsedSeconds: Math.max(1, Math.round((Date.now() - activeExam.startedAt) / 1000)),
          createdAt: new Date().toISOString()
        });
      } catch {
        results.push({ taskId: item.id, outcome: { status: "falsch", message: "Abfrage konnte nicht ausgeführt werden.", details: [] }, points: 0 });
      }
    }
    setExam({ ...activeExam, status: "graded", results, score });
    if (attempts.length) {
      const today = new Date().toISOString().slice(0, 10);
      persistProgress({
        ...progress,
        attempts: [...progress.attempts, ...attempts].slice(-5_000),
        streak: nextDayStreak(progress, today),
        lastStudyDate: today
      });
    }
  }

  async function checkErrorCorrection(): Promise<void> {
    setBusy(true);
    setErrorOutcome(null);
    try {
      const [actual, expected] = await Promise.all([
        executeInWorker(errorQuery, activeError.scenario),
        executeInWorker(activeError.expected, activeError.scenario)
      ]);
      setOutput(actual);
      if (!resultsMatch(actual, expected, false)) {
        setErrorOutcome("Noch nicht richtig. Prüfe SQL-Ergebnis und Erklärung.");
      } else if (!activeError.expectedWords.some((word) => errorExplanation.toUpperCase().includes(word.toUpperCase()))) {
        setErrorOutcome("Abfrage richtig. Markiere auch das fehlerhafte Schlüsselwort oder die Spalte.");
      } else {
        setErrorOutcome(`Richtig. ${activeError.explanation}`);
      }
      setSqlError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "SQL-Abfrage fehlgeschlagen.";
      setSqlError(message);
      setErrorOutcome(`${explainSqlError(message)} ${activeError.explanation}`);
    } finally {
      setBusy(false);
    }
  }

  function changeErrorTask(index: number): void {
    const nextIndex = (index + ERROR_TASKS.length) % ERROR_TASKS.length;
    setErrorIndex(nextIndex);
    setErrorQuery(ERROR_TASKS[nextIndex].broken);
    setErrorExplanation("");
    setErrorOutcome(null);
    setSqlError(null);
  }

  function exportLearningProgress(): void {
    downloadText("sql-lernstand.json", JSON.stringify(progress, null, 2), "application/json");
    setNotice("Lernstand als JSON gespeichert.");
  }

  async function importLearningProgress(file: File | undefined): Promise<void> {
    if (!file) return;
    if (file.size > 1_000_000) {
      setNotice("Datei ist größer als 1 MB.");
      return;
    }
    try {
      const imported = importProgress(await file.text());
      storageWritable.current = true;
      persistProgress(imported);
      setTheme(imported.theme);
      setNotice("Lernstand erfolgreich importiert.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Lernstand konnte nicht importiert werden.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function resetLearningProgress(): void {
    if (!window.confirm("Gesamten Lernstand auf diesem Gerät löschen?")) return;
    const fresh = structuredClone(EMPTY_PROGRESS);
    storageWritable.current = true;
    persistProgress(fresh);
    setTheme(fresh.theme);
    setNotice("Lernstand wurde auf diesem Gerät gelöscht.");
  }

  function printExamResult(): void {
    const score = exam?.score ?? 0;
    const max = exam?.maxPoints ?? 0;
    const rows = (exam?.results ?? []).map((item) => {
      const selected = exam?.tasks.find((candidate) => candidate.id === item.taskId);
      return `<tr><td>${escapeHtml(selected?.title ?? "")}</td><td>${item.points}</td><td>${escapeHtml(item.outcome?.message ?? "Keine Antwort")}</td><td><pre>${escapeHtml(selected?.solution ?? "")}</pre></td></tr>`;
    }).join("");
    const documentText = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SQLForge Klausurergebnis</title><style>body{font:16px system-ui;max-width:900px;margin:2rem auto;padding:0 1rem;color:#10283b}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccd7d3;padding:.6rem;text-align:left}pre{white-space:pre-wrap;background:#f2f6f3;padding:.5rem}</style><h1>SQL-Prüfungsergebnis</h1><p>${score} von ${max} Punkten · ${max ? Math.round(score / max * 100) : 0} %</p><p>Nutze das Browsermenü oder Strg+P zum Drucken und Speichern als PDF.</p><table><thead><tr><th>Aufgabe</th><th>Punkte</th><th>Ergebnis</th><th>Musterlösung</th></tr></thead><tbody>${rows}</tbody></table></html>`;
    const url = URL.createObjectURL(new Blob([documentText], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const attempts = progress.attempts;
  const correctCount = attempts.filter((item) => item.status === "richtig").length;
  const successPercent = attempts.length ? Math.round((correctCount + attempts.filter((item) => item.status === "technik").length * 0.5) / attempts.length * 100) : 0;
  const averageSeconds = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.elapsedSeconds, 0) / attempts.length) : 0;
  const topicGrades = [...new Set(attempts.map((item) => item.topic))]
    .map((topic) => ({ topic, score: gradeForTopic(attempts, topic) }))
    .sort((left, right) => left.score - right.score);
  const missedExamTopics = [...new Set((exam?.results ?? [])
    .filter((result) => !result.outcome || result.outcome.status !== "richtig")
    .map((result) => exam?.tasks.find((item) => item.id === result.taskId)?.topic)
    .filter((topic): topic is string => Boolean(topic)))];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("start"); }}>
          <span className="brand-mark" aria-hidden="true">SQL</span>
          <span className="brand-copy"><strong>SQLForge</strong><small>Klassenarbeit · lokal lernen</small></span>
        </a>
        <div className="top-meta">
          <span className="local-badge"><span /> Nur auf diesem Gerät</span>
          <button className="theme-toggle" onClick={() => setTheme(theme === "dunkel" ? "hell" : "dunkel")} aria-label="Darstellung wechseln">
            {theme === "dunkel" ? "Hell" : "Dunkel"}
          </button>
        </div>
      </header>

      <nav className="main-nav" aria-label="Hauptnavigation">
        {NAV.map((item) => (
          <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => setPage(item.id)} aria-current={page === item.id ? "page" : undefined}>
            <span className="nav-number">{item.number}</span>{item.label}
          </button>
        ))}
      </nav>

      {storageWarning && <div className="alert warning" role="status">{storageWarning}</div>}
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Meldung schließen" onClick={() => setNotice(null)}>Schließen</button></div>}
      {shareLink && <div className="share-strip"><span>Teilen:</span><a href={shareLink} target="_blank" rel="noreferrer">In WhatsApp öffnen</a><button onClick={() => setShareLink(null)}>Schließen</button></div>}

      <main className="page-content">
        {page === "start" && (
          <section className="home-page">
            <div className="hero">
              <div className="hero-copy">
                <p className="eyebrow">Dein lokaler Lernplatz</p>
                <h1>Aus Aufgaben<br />werden Abfragen.</h1>
                <p>SQL für die Klassenarbeit üben, direkt ausführen und verstehen. Ohne Konto. Ohne Cloud.</p>
                <div className="hero-actions">
                  <button className="button primary" onClick={() => selectTask(TASKS[0])}>Jetzt üben</button>
                  <button className="button secondary" onClick={() => setPage("pruefung")}>Prüfung starten</button>
                </div>
                <div className="hero-count"><strong>{TASK_COUNTS.total}</strong><span>Aufgabenvarianten<br />in zwei Szenarien</span></div>
              </div>
              <div className="hero-sheet" aria-label="SQL Klauselreihenfolge">
                <span className="sheet-label">Klauselreihenfolge</span>
                <ol>
                  {["SELECT", "FROM / JOIN", "WHERE", "GROUP BY", "HAVING", "ORDER BY"].map((clause, index) => <li key={clause}><span>{index + 1}</span><code>{clause}</code></li>)}
                </ol>
                <p>Auswählen → verbinden → filtern → gruppieren → sortieren</p>
              </div>
            </div>
            <div className="dashboard-strip">
              <Stat label="Bearbeitet" value={attempts.length.toString()} note="Aufgabenversuche" />
              <Stat label="Erfolgsquote" value={`${successPercent}%`} note="Richtig zählt voll, Technik halb" />
              <Stat label="Lernserie" value={`${progress.streak} Tage`} note="Tage mit Übung" />
              <Stat label="Noch offen" value={`${Math.max(0, TASKS.length - new Set(attempts.map((item) => item.taskId)).size)}`} note="verschiedene Aufgaben" />
            </div>
            <section className="topic-start">
              <div><p className="eyebrow">Der nächste Schritt</p><h2>Woran möchtest du arbeiten?</h2></div>
              <div className="topic-grid">
                {["SELECT und WHERE", "LIKE und Textsuche", "GROUP BY und SUM", "HAVING", "JOINs", "Unterabfragen"].map((topic, index) => {
                  const chosen = TASKS.find((item) => item.topic === topic || item.topic.startsWith(topic));
                  return <button key={topic} className="topic-tile" onClick={() => chosen && selectTask(chosen)}><span>0{index + 1}</span><strong>{topic}</strong><small>{TASKS.filter((item) => item.topic.startsWith(topic)).length || "Mehr"} Aufgaben</small></button>;
                })}
              </div>
            </section>
          </section>
        )}

        {page === "ueben" && (
          <section className="practice-page">
            <div className="page-heading"><div><p className="eyebrow">Freies Training</p><h1>Üben</h1><p>Schreibe Abfrage. Führe sie aus. Prüfe Ergebnis.</p></div><div className="heading-count"><strong>{TASKS.length}</strong><span>Aufgaben</span></div></div>
            <div className="practice-layout">
              <aside className="task-rail">
                <label className="field-label" htmlFor="task-search">Aufgabe suchen</label>
                <input id="task-search" className="text-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Thema oder Text" />
                <label className="field-label" htmlFor="topic-filter">Thema</label>
                <select id="topic-filter" className="select-input" value={filterTopic} onChange={(event) => setFilterTopic(event.target.value)}>
                  <option>Alle Themen</option>{topics.map((topic) => <option key={topic}>{topic}</option>)}
                </select>
                <label className="field-label" htmlFor="difficulty-filter">Schwierigkeit</label>
                <select id="difficulty-filter" className="select-input" value={filterDifficulty} onChange={(event) => setFilterDifficulty(event.target.value)}>
                  <option>Alle Stufen</option><option>leicht</option><option>mittel</option><option>schwer</option>
                </select>
                <div className="task-list" aria-label="Aufgaben">
                  {filteredTasks.slice(0, 50).map((item) => (
                    <button key={item.id} className={item.id === task.id ? "task-option active" : "task-option"} onClick={() => selectTask(item)}>
                      <span className="task-state">{progress.taskStates[item.id] ?? "Neu"}</span><strong>{item.title}</strong><small>{item.topic} · {item.difficulty}</small>
                    </button>
                  ))}
                  {!filteredTasks.length && <p className="muted-copy">Keine Aufgabe gefunden.</p>}
                </div>
              </aside>
              <div className="practice-workspace">
                <article className="question-paper">
                  <div className="question-meta"><span>{task.topic}</span><span className={`difficulty ${task.difficulty}`}>{task.difficulty}</span><span>{task.points} Punkte</span></div>
                  <h2>{task.title}</h2>
                  <p>{task.prompt}</p>
                  <div className="signal-words"><span>Signalwörter</span>{task.keywords.length ? task.keywords.map((word) => <code key={word}>{word}</code>) : <code>SELECT · FROM</code>}</div>
                  <button className="text-action" onClick={() => share(`Aufgabe: ${task.prompt}\nThema: ${task.topic}\nSchwierigkeit: ${task.difficulty}`)}>Aufgabe teilen</button>
                </article>
                <div className="editor-panel">
                  <div className="panel-title"><div><span className="panel-kicker">SQL-Editor</span><h3>{SCENARIOS[scenario].label}</h3></div><label className="scenario-select">Szenario<select aria-label="Datenbankszenario" value={scenario} onChange={(event) => { setScenario(event.target.value as ScenarioId); setOutput(null); }}><option value="fastfood">Global Fast Foods</option><option value="medicine">Arzneimittel</option></select></label></div>
                  <div className="editor-wrap" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void runQuery(); } }}>
                    <CodeMirror value={query} height="240px" theme={theme === "dunkel" ? "dark" : "light"} extensions={[sql()]} onChange={setQuery} basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true, tabSize: 2 }} aria-label="SQL-Abfrage" />
                  </div>
                  <div className="editor-actions">
                    <button className="button primary" onClick={() => void runQuery()} disabled={busy}>SQL ausführen <kbd>Ctrl ↵</kbd></button>
                    <button className="button check-button" onClick={() => void checkQuery()} disabled={busy}>Lösung prüfen</button>
                    <button className="button quiet" onClick={() => { setHintLevel((level) => Math.min(level + 1, task.hints.length)); setSolutionVisible(false); }}>Hinweis</button>
                    <button className="button quiet" onClick={newVariant}>Neue Variante</button>
                    <button className="button quiet" onClick={() => { setQuery(STARTER_SQL); setOutput(null); setCheck(null); setSqlError(null); }}>Zurücksetzen</button>
                  </div>
                  {hintLevel > 0 && <div className="hint-box"><strong>Hinweis {hintLevel} von {task.hints.length}</strong><p>{task.hints.slice(0, hintLevel).at(-1)}</p></div>}
                  {!exam && solutionVisible && <div className="solution-box"><div><strong>Musterlösung · SQLite</strong><button className="text-action" onClick={() => void share(`Musterlösung:\n${task.solution}`)}>Lösung teilen</button></div><pre>{task.solution}</pre>{task.examSolution !== task.solution && <p><strong>Prüfungssyntax:</strong> <code>{task.examSolution}</code><br />SQLite nutzt hier <code>strftime</code>, Prüfungen oft <code>EXTRACT</code>.</p>}</div>}
                  {check && <div className={`feedback ${check.status}`} role="status"><strong>{check.message}</strong>{check.details.length > 0 && <ul>{check.details.map((line) => <li key={line}>{line}</li>)}</ul>}{check.status === "richtig" && <p>{task.examTip}</p>}</div>}
                  {sqlError && <div className="feedback falsch" role="alert"><strong>SQLite: {sqlError}{findErrorLine(query, sqlError) ? ` · Zeile ${findErrorLine(query, sqlError)}` : ""}</strong><p>{explainSqlError(sqlError)}</p></div>}
                  {notice && <div className="notice inline-notice" role="status">{notice}</div>}
                  {output && <ResultTable result={output} />}
                  <div className="workspace-footer"><button className="text-action" onClick={() => { setSolutionVisible((visible) => !visible); setHintLevel(0); }}>{solutionVisible ? "Lösung verbergen" : "Lösung anzeigen"}</button><span>Datenbank wird nach jeder Abfrage neu aufgebaut.</span></div>
                </div>
              </div>
            </div>
          </section>
        )}

        {page === "pruefung" && (
          <section className="exam-page">
            <div className="page-heading"><div><p className="eyebrow">Training unter Zeit</p><h1>Prüfung</h1><p>Antworten werden erst nach Abgabe bewertet.</p></div></div>
            {!exam && <div className="exam-config">
              <section className="config-panel"><p className="eyebrow">Eigene Runde</p><h2>Stelle Prüfung zusammen</h2>
                <div className="config-row"><label>Aufgaben<select className="select-input" value={examLength} onChange={(event) => setExamLength(event.target.value)}><option value="10">10 Aufgaben</option><option value="15">15 Aufgaben</option><option value="20">20 Aufgaben</option></select></label>
                  <label>Zeitlimit<select className="select-input" value={examMinutes} onChange={(event) => setExamMinutes(event.target.value)}><option value="20">20 Minuten</option><option value="40">40 Minuten</option><option value="60">60 Minuten</option><option value="90">90 Minuten</option></select></label>
                  <label>Schwierigkeit<select className="select-input" value={examDifficulty} onChange={(event) => setExamDifficulty(event.target.value)}><option>Alle Stufen</option><option>leicht</option><option>mittel</option><option>schwer</option></select></label>
                </div>
                <fieldset className="topic-choices"><legend>Themen (leer = alle)</legend>{topics.map((topic) => <label key={topic}><input type="checkbox" checked={examTopics.includes(topic)} onChange={(event) => setExamTopics((selected) => event.target.checked ? [...selected, topic] : selected.filter((item) => item !== topic))} />{topic}</label>)}</fieldset>
                <label className="exam-hint-option"><input type="checkbox" checked={examHintsEnabled} onChange={(event) => setExamHintsEnabled(event.target.checked)} /> Hinweise erlauben (keine Lösungen)</label>
                <button className="button primary" onClick={() => startExam("practice")}>Prüfung starten</button>
              </section>
              <section className="simulation-panel"><p className="eyebrow">Feste Runde</p><h2>Klausursimulation</h2><p>10 gemischte Aufgaben · 40 Minuten · 50 Punkte</p><ul><li>Keine Hinweise oder Lösungen</li><li>Zwischenstand bleibt lokal gespeichert</li><li>Beim Verlassen fragt der Browser nach</li></ul><button className="button secondary" onClick={() => startExam("simulation")}>Simulation starten</button></section>
            </div>}
            {exam?.status === "active" && currentExamTask && <div className="exam-workspace">
              <div className="exam-bar"><strong>{exam.mode === "simulation" ? "Klausursimulation" : "Prüfungsrunde"}</strong><span>Aufgabe {exam.index + 1} / {exam.tasks.length}</span><span className={examTimeLeft < 300 ? "timer danger" : "timer"}>{formatTime(examTimeLeft)}</span></div>
              <article className="question-paper"><div className="question-meta"><span>{currentExamTask.topic}</span><span>{exam.mode === "simulation" ? 5 : currentExamTask.points} Punkte</span></div><h2>{currentExamTask.title}</h2><p>{currentExamTask.prompt}</p></article>
              {exam.hintsEnabled && <div className="exam-hint"><button className="text-action" onClick={() => setHintLevel((level) => Math.min(level + 1, currentExamTask.hints.length))}>Hinweis {hintLevel ? `(${hintLevel}/${currentExamTask.hints.length})` : "anzeigen"}</button>{hintLevel > 0 && <p>{currentExamTask.hints[hintLevel - 1]}</p>}</div>}
              <div className="exam-editor"><p className="panel-kicker">SQL-Antwort</p><div className="editor-wrap" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); setHintLevel(0); setExam((current) => current && ({ ...current, answers: { ...current.answers, [currentExamTask.id]: examAnswer }, index: Math.min(current.index + 1, current.tasks.length - 1) })); } }}><CodeMirror value={exam.answers[currentExamTask.id] ?? ""} height="250px" theme={theme === "dunkel" ? "dark" : "light"} extensions={[sql()]} onChange={(value) => setExam((current) => current && ({ ...current, answers: { ...current.answers, [currentExamTask.id]: value } }))} basicSetup={{ lineNumbers: true, foldGutter: false, tabSize: 2 }} aria-label="SQL-Prüfungsantwort" /></div>
                <div className="exam-controls"><button className="button quiet" disabled={exam.index === 0} onClick={() => { setHintLevel(0); setExam({ ...exam, index: exam.index - 1 }); }}>Zurück</button><span>Antwort bleibt beim Wechsel gespeichert.</span>{exam.index < exam.tasks.length - 1 ? <button className="button secondary" onClick={() => { setHintLevel(0); setExam({ ...exam, index: exam.index + 1 }); }}>Weiter</button> : <button className="button check-button" onClick={() => void finishExam()}>Abgeben und auswerten</button>}</div>
              </div>
            </div>}
            {exam?.status === "graded" && <div className="exam-report">
              <div className="report-score"><p className="eyebrow">Auswertung</p><h2>{exam.score} <small>/ {exam.maxPoints} Punkte</small></h2><p>{exam.maxPoints ? Math.round(exam.score / exam.maxPoints * 100) : 0}% · einfache Prognose aus diesem Versuch</p><p>Prognose basiert auf erreichten Punkten geteilt durch mögliche Punkte. Sie ist keine Garantie für eine echte Note.</p><p>{missedExamTopics.length ? `Nächste Runde: ${missedExamTopics.join(", ")} wiederholen.` : "Stark: Alle abgegebenen Aufgaben richtig. Wähle für die nächste Runde höhere Schwierigkeit."}</p></div>
              <div className="report-actions"><button className="button primary" onClick={printExamResult}>Drucken / PDF</button><button className="button secondary" onClick={() => void share(`Prüfung: ${exam.score} von ${exam.maxPoints} Punkten (${exam.maxPoints ? Math.round(exam.score / exam.maxPoints * 100) : 0} %).`)}>Ergebnis teilen</button><button className="button quiet" onClick={() => { setExam(null); setPage("pruefung"); }}>Neue Runde</button></div>
              <div className="report-list">{exam.tasks.map((item) => {
                const result = exam.results.find((entry) => entry.taskId === item.id);
                const possible = exam.mode === "simulation" ? 5 : item.points;
                return <article key={item.id} className="report-item"><div><span className={result?.outcome?.status ?? "falsch"}>{result?.outcome?.message ?? "Keine Antwort"}</span><h3>{item.title}</h3><p>{item.prompt}</p></div><div><strong>{result?.points ?? 0} / {possible}</strong><pre>{item.solution}</pre></div></article>;
              })}</div>
            </div>}
          </section>
        )}

        {page === "schema" && <section className="schema-page">
          <div className="page-heading"><div><p className="eyebrow">Daten verstehen</p><h1>Datenbankschema</h1><p>Tabellen aufklappen, Schlüssel prüfen und Beispieldaten ansehen.</p></div><select className="select-input" aria-label="Szenario wählen" value={scenario} onChange={(event) => setScenario(event.target.value as ScenarioId)}><option value="fastfood">Global Fast Foods</option><option value="medicine">Arzneimittel</option></select></div>
          <div className="schema-intro"><strong>{SCENARIOS[scenario].label}</strong><p>{SCENARIOS[scenario].description}</p><p>Beziehung erkennen: <code>F_CUSTOMERS.ID = F_ORDERS.CUST_ID</code> · <code>ARZNEIMITTEL.AMID = ARZNEIMITTELWIRKSTOFFE.AMID</code></p></div>
          <div className="schema-grid">{SCENARIOS[scenario].tables.map((table) => <details className="schema-table" key={table.name}><summary><span className="table-icon">▦</span><strong>{table.name}</strong><small>{table.rows.length} Beispieldatensätze</small></summary><div className="column-list">{table.columns.map((column) => <div className="column-row" key={column.name}><code>{column.name}</code><span>{column.type}</span>{column.key && <b className={column.key === "PK" ? "key-pk" : "key-fk"}>{column.key}</b>}<small>{column.description}{column.reference && ` · ${column.reference}`}</small></div>)}</div><div className="table-preview"><table><thead><tr>{table.columns.map((column) => <th key={column.name}>{column.name}</th>)}</tr></thead><tbody>{table.rows.slice(0, 5).map((row, index) => <tr key={index}>{table.columns.map((column) => <td key={column.name}>{row[column.name] == null ? <em>NULL</em> : String(row[column.name])}</td>)}</tr>)}</tbody></table></div><button className="text-action" onClick={() => { const related = TASKS.find((item) => item.scenario === scenario && item.prompt.toLowerCase().includes(table.name.toLowerCase().replace("f_", ""))); selectTask(related ?? TASKS.find((item) => item.scenario === scenario)!); }}>Passende Aufgabe öffnen</button></details>)}</div>
        </section>}

        {page === "merksaetze" && <section className="memory-page">
          <div className="page-heading"><div><p className="eyebrow">Signalwort → SQL-Struktur</p><h1>Merksätze</h1><p>Deutsche Aufgabenformulierungen in SQL übersetzen.</p></div></div>
          <div className="signal-board">{SIGNAL_PHRASES.map(([phrase, meaning]) => <div className="signal-row" key={phrase}><strong>{phrase}</strong><span>{meaning}</span></div>)}</div>
          <div className="memory-list">{MEMORY_RULES.map((rule) => <article className="memory-rule" key={rule.term}><div><span className="memory-term">{rule.term}</span><h2>{rule.rule}</h2></div><div className="memory-detail"><pre>{rule.example}</pre><p><strong>Prüfungsformulierung:</strong> {rule.signal}</p><p className="mistake-note"><strong>Häufiger Fehler:</strong> {rule.mistake}</p><button className="text-action" onClick={() => { const related = TASKS.find((item) => item.requires.some((required) => required.toLowerCase().includes(rule.term.toLowerCase().split(" ")[0]))); selectTask(related ?? TASKS[0]); }}>Dazu üben</button></div></article>)}</div>
        </section>}

        {page === "fehler" && <section className="error-page">
          <div className="page-heading"><div><p className="eyebrow">Fehler lesen lernen</p><h1>Finde den Fehler</h1><p>Korrigiere Abfrage. Prüfe sie gegen echte Beispieldaten.</p></div><span className="heading-count">{errorIndex + 1} / {ERROR_TASKS.length}</span></div>
          <div className="error-layout"><aside className="error-list">{ERROR_TASKS.map((item, index) => <button key={item.title} className={index === errorIndex ? "error-choice active" : "error-choice"} onClick={() => changeErrorTask(index)}><span>0{index + 1}</span><strong>{item.title}</strong></button>)}</aside>
            <div className="error-workspace"><article className="question-paper"><p className="eyebrow">{SCENARIOS[activeError.scenario].label}</p><h2>{activeError.title}</h2><p>{activeError.prompt}</p></article><div className="editor-panel"><p className="panel-kicker">Fehlerhafte Abfrage korrigieren</p><div className="editor-wrap"><CodeMirror value={errorQuery} height="240px" theme={theme === "dunkel" ? "dark" : "light"} extensions={[sql()]} onChange={setErrorQuery} basicSetup={{ lineNumbers: true, foldGutter: false, tabSize: 2 }} aria-label="Fehlerhafte SQL-Abfrage" /></div><label className="field-label" htmlFor="error-explanation">Markiere Fehlerstelle oder erkläre den Fehler</label><input id="error-explanation" className="text-input" value={errorExplanation} onChange={(event) => setErrorExplanation(event.target.value)} placeholder="z. B. FROM, LIKE, CUST_ID oder HAVING" /><div className="editor-actions"><button className="button check-button" disabled={busy} onClick={() => void checkErrorCorrection()}>Korrektur prüfen</button><button className="button quiet" onClick={() => { setErrorQuery(activeError.broken); setErrorExplanation(""); setErrorOutcome(null); setSqlError(null); }}>Zurücksetzen</button><button className="button quiet" onClick={() => { setErrorQuery(activeError.solution); setErrorExplanation(activeError.expectedWords[0]); setErrorOutcome(activeError.explanation); }}>Lösung anzeigen</button></div>{sqlError && <div className="feedback falsch"><strong>SQLite: {sqlError}{findErrorLine(errorQuery, sqlError) ? ` · Zeile ${findErrorLine(errorQuery, sqlError)}` : ""}</strong><p>{explainSqlError(sqlError)}</p></div>}{errorOutcome && <div className={`feedback ${errorOutcome.startsWith("Richtig") ? "richtig" : "fast"}`} role="status">{errorOutcome}</div>}{output && <ResultTable result={output} />}</div></div>
          </div>
        </section>}

        {page === "fortschritt" && <section className="progress-page">
          <div className="page-heading"><div><p className="eyebrow">Dein Lernstand bleibt lokal</p><h1>Fortschritt</h1><p>Übersicht aus deinen gespeicherten Versuchen.</p></div><button className="button secondary" onClick={() => void share(`Ich habe ${attempts.length} Aufgaben bearbeitet. Erfolgsquote: ${successPercent} %.`)}>Fortschritt teilen</button></div>
          <div className="dashboard-strip progress-stats"><Stat label="Versuche" value={attempts.length.toString()} note="alle gespeicherten Antworten" /><Stat label="Richtig" value={correctCount.toString()} note={`${successPercent}% gewichteter Erfolg`} /><Stat label="Lernserie" value={`${progress.streak} Tage`} note="aktuelle Serie" /><Stat label="Ø Bearbeitung" value={`${averageSeconds}s`} note="pro Aufgabe" /></div>
          <div className="progress-columns"><section className="progress-panel"><p className="eyebrow">Themenprofil</p><h2>Stärken und nächste Schritte</h2>{topicGrades.length ? topicGrades.map((item) => <div className="topic-grade" key={item.topic}><div><strong>{item.topic}</strong><span>{item.score}%</span></div><div className="meter"><i style={{ width: `${item.score}%` }} /></div></div>) : <p className="empty-note">Noch keine Versuche. Starte mit einer kurzen Übung.</p>}<p className="plain-note">Prüfungsprognose = gewichtete Erfolgsquote der letzten Versuche. Richtig zählt 1, Technik stimmt zählt 0,5, übrige Versuche zählen 0.</p></section>
            <section className="progress-panel"><p className="eyebrow">Wiederholung</p><h2>Was kommt als Nächstes?</h2><div className="state-legend"><p><b>Neu</b> Noch nicht versucht</p><p><b>Lernen</b> Falsch gelöst, bald wiederholen</p><p><b>Wiederholen</b> Fast richtig, nach wenigen Aufgaben erneut</p><p><b>Sicher</b> Dreimal richtig gelöst</p></div><h3>Häufige Fehler</h3>{attempts.length ? <ul className="error-summary">{Object.entries(attempts.reduce<Record<string, number>>((summary, item) => { if (item.status === "falsch" || item.status === "fast") summary[item.topic] = (summary[item.topic] ?? 0) + 1; return summary; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([topic, count]) => <li key={topic}>{topic} <strong>{count}</strong></li>)}</ul> : <p className="empty-note">Hier erscheinen Themen, bei denen du noch üben kannst.</p>}</section></div>
          <section className="recent-panel"><div className="panel-title"><div><p className="eyebrow">Zuletzt</p><h2>Letzte Versuche</h2></div><button className="text-action" onClick={exportLearningProgress}>JSON exportieren</button></div>{attempts.slice(-8).reverse().map((attempt, index) => <div className="attempt-row" key={`${attempt.createdAt}-${index}`}><span className={`status-dot ${attempt.status}`} /><strong>{TASKS.find((item) => item.id === attempt.taskId)?.title ?? attempt.taskId}</strong><span>{attempt.topic}</span><time>{new Date(attempt.createdAt).toLocaleDateString("de-DE")}</time><b>{attempt.points} P.</b></div>)}</section>
        </section>}

        {page === "einstellungen" && <section className="settings-page">
          <div className="page-heading"><div><p className="eyebrow">Dein Gerät, deine Daten</p><h1>Einstellungen</h1><p>Kein Konto. Keine Cloud. Daten bleiben im Browser.</p></div></div>
          <div className="settings-grid"><section className="settings-panel"><p className="eyebrow">Darstellung</p><h2>Lesen und lernen</h2><label className="setting-row"><span><strong>Farbschema</strong><small>Für diese App lokal gespeichert</small></span><select className="select-input" value={theme} onChange={(event) => setTheme(event.target.value as UserProgress["theme"])}><option value="system">System</option><option value="hell">Hell</option><option value="dunkel">Dunkel</option></select></label></section>
            <section className="settings-panel"><p className="eyebrow">Sicherung</p><h2>Lernstand übertragen</h2><p>Export enthält Aufgaben-IDs und deine eingegebenen SQL-Antworten. Teile diese Datei nur, wenn du das möchtest.</p><div className="setting-actions"><button className="button secondary" onClick={exportLearningProgress}>JSON exportieren</button><button className="button quiet" onClick={() => fileInput.current?.click()}>JSON importieren</button><input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importLearningProgress(event.target.files?.[0])} /></div><button className="danger-text" onClick={resetLearningProgress}>Lernstand auf diesem Gerät löschen</button></section>
            <section className="settings-panel full"><p className="eyebrow">Lokal starten</p><h2>Am Laptop und Smartphone</h2><p>Starte den Entwicklungsserver mit <code>npm run dev</code>. Für das Smartphone starte mit <code>npm run dev -- --host 0.0.0.0</code> und öffne die angezeigte Netzwerkadresse im selben WLAN.</p><p>Offline-Installation braucht einen sicheren Ursprung: <code>localhost</code> am Laptop oder HTTPS. Eine LAN-Adresse mit einfachem HTTP kann im Browser nicht als Offline-App installiert werden.</p><p>SQL wird in einem kurzlebigen Web Worker auf dem Gerät ausgeführt. Nur SELECT-Abfragen sind erlaubt. Lernstand liegt im Browser-Speicher.</p></section></div>
        </section>}
      </main>
      <footer className="app-footer"><span>SQLForge · lokal · keine Anmeldung</span><span>sql.js / SQLite · Fortschritt nur in diesem Browser</span></footer>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function ResultTable({ result }: { result: { columns: string[]; rows: unknown[][]; rowCount: number } }) {
  return <section className="result-panel" aria-live="polite"><div className="result-heading"><strong>Ergebnis</strong><span>{result.rowCount} Zeilen</span>{result.rowCount > result.rows.length && <span>Erste {result.rows.length} angezeigt</span>}</div>{!result.columns.length ? <p className="empty-note">Abfrage erfolgreich. Keine Ergebnisspalten.</p> : <div className="result-scroll"><table><thead><tr>{result.columns.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value == null ? <em>NULL</em> : String(value)}</td>)}</tr>)}</tbody></table></div>}</section>;
}

export default App;
