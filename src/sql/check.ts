import type { CheckResult, Task } from "../domain";
import type { QueryResult } from "./engine";

const numericValuesMatch = (left: unknown, right: unknown): boolean => {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) <= 0.01;
  }
  return left === right;
};

const rowsMatch = (left: unknown[], right: unknown[]): boolean =>
  left.length === right.length && left.every((value, index) => numericValuesMatch(value, right[index]));

export function resultsMatch(
  actual: QueryResult,
  expected: QueryResult,
  ordered: boolean
): boolean {
  if (actual.columns.length !== expected.columns.length || actual.rowCount !== expected.rowCount) return false;
  if (ordered) return actual.rows.length === expected.rows.length && actual.rows.every((row, index) => rowsMatch(row, expected.rows[index]));

  const unmatched = [...expected.rows];
  for (const row of actual.rows) {
    const index = unmatched.findIndex((expectedRow) => rowsMatch(row, expectedRow));
    if (index < 0) return false;
    unmatched.splice(index, 1);
  }
  return unmatched.length === 0;
}

function hasRequiredTechnique(query: string, required: string): boolean {
  const text = query.toUpperCase().replace(/\s+/g, " ");
  if (required === "SUBQUERY") return /\(\s*SELECT\b/i.test(query);
  if (required === "LEFT JOIN") return /\bLEFT\s+(?:OUTER\s+)?JOIN\b/i.test(query);
  return text.includes(required.toUpperCase());
}

function diagnose(query: string, task: Task, actual: QueryResult, expected: QueryResult): string[] {
  const notes: string[] = [];
  const normalized = query.toUpperCase();
  if (/FORM\b/.test(normalized)) notes.push("Tippfehler: Schreibe FROM statt FORM.");
  if (/WHERE\s+COUNT\s*\(/.test(normalized)) notes.push("COUNT filtert Gruppen. Verwende dafür HAVING statt WHERE.");
  if (task.requires.includes("LEFT JOIN") && !/\bLEFT\s+(?:OUTER\s+)?JOIN\b/i.test(query)) notes.push("Die Aufgabe verlangt LEFT JOIN, damit auch Zeilen ohne Zuordnung erscheinen.");
  if (task.requires.includes("HAVING") && !/\bHAVING\b/i.test(query)) notes.push("Die Aufgabe verlangt HAVING für Bedingungen auf Gruppen.");
  if (task.requires.includes("SUBQUERY") && !/\(\s*SELECT\b/i.test(query)) notes.push("Die Aufgabe verlangt eine Unterabfrage in Klammern.");
  if (expected.columns.length !== actual.columns.length) notes.push("Die Anzahl der Ergebnisspalten stimmt nicht.");
  if (expected.rowCount !== actual.rowCount) notes.push(`Erwartet: ${expected.rowCount} Zeilen. Deine Abfrage liefert: ${actual.rowCount}.`);
  if (/\bGROUP BY\b/i.test(query) === false && /\bHAVING\b/i.test(query)) notes.push("Bei HAVING fehlt meistens die passende GROUP BY-Klausel.");
  if (expected.columns.length === actual.columns.length && expected.rowCount === actual.rowCount) {
    notes.push("Ergebnisform stimmt. Prüfe Spalten, Filter und Sortierung.");
  }
  return notes.length ? notes : ["Vergleiche Tabellen, Verknüpfungsbedingungen und Filter mit dem Schema."];
}

export function checkAnswer(
  query: string,
  task: Task,
  actual: QueryResult,
  expected: QueryResult
): CheckResult {
  const matches = resultsMatch(actual, expected, task.ordered);
  const missing = task.requires.filter((required) => !hasRequiredTechnique(query, required));
  if (matches && missing.length === 0) {
    return { status: "richtig", message: "Richtig. Ergebnis und geforderte Technik stimmen.", details: [] };
  }
  if (matches) {
    return {
      status: "technik",
      message: "Ergebnis richtig, aber geforderte Technik fehlt.",
      details: [`Noch erforderlich: ${missing.join(", ")}.`]
    };
  }
  const sameShape = actual.columns.length === expected.columns.length;
  const status = sameShape && Math.abs(actual.rowCount - expected.rowCount) <= Math.max(1, expected.rowCount * 0.25)
    ? "fast"
    : "falsch";
  return {
    status,
    message: status === "fast" ? "Fast richtig. Prüfe Details deiner Abfrage." : "Noch nicht richtig. Vergleiche dein Ergebnis mit der Aufgabenstellung.",
    details: diagnose(query, task, actual, expected)
  };
}
