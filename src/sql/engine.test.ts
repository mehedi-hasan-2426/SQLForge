import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { TASKS, TASK_COUNTS } from "../data/tasks";
import { SCENARIOS } from "../data/scenarios";
import { createSeededDatabase, executeReadOnly } from "./engine";
import { checkAnswer, resultsMatch } from "./check";

let SQL: SqlJsStatic;

beforeAll(async () => {
  const wasmPath = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
  const wasmBinary = new Uint8Array(readFileSync(wasmPath));
  SQL = await initSqlJs({ wasmBinary });
});

describe("Übungsdatenbank", () => {
  it("initialisiert beide vollständigen Szenarien mit den erwarteten Beispieldaten", () => {
    const fastfood = createSeededDatabase(SQL, "fastfood");
    const medicine = createSeededDatabase(SQL, "medicine");
    try {
      expect(fastfood.exec("SELECT COUNT(*) FROM F_CUSTOMERS")[0].values[0][0]).toBe(18);
      expect(fastfood.exec("SELECT COUNT(*) FROM F_ORDERS")[0].values[0][0]).toBe(30);
      expect(fastfood.exec("SELECT COUNT(*) FROM F_FOOD_ITEMS")[0].values[0][0]).toBe(20);
      expect(medicine.exec("SELECT COUNT(*) FROM ARZNEIMITTEL")[0].values[0][0]).toBe(20);
      expect(medicine.exec("SELECT COUNT(*) FROM ARZNEIMITTELWIRKSTOFFE")[0].values[0][0]).toBeGreaterThan(40);
      expect(SCENARIOS.fastfood.tables).toHaveLength(9);
      expect(SCENARIOS.medicine.tables).toHaveLength(4);
    } finally {
      fastfood.close();
      medicine.close();
    }
  });

  it("führt jede Musterlösung auf dem passenden Szenario aus", () => {
    const databases = {
      fastfood: createSeededDatabase(SQL, "fastfood"),
      medicine: createSeededDatabase(SQL, "medicine")
    };
    try {
      expect(TASKS).toHaveLength(120);
      expect(TASK_COUNTS).toMatchObject({
        selectWhere: 15,
        like: 15,
        aggregates: 20,
        having: 15,
        joins: 25,
        setOperators: 10,
        subqueries: 15,
        mixed: 5,
        total: 120
      });
      for (const task of TASKS) {
        expect(() => executeReadOnly(databases[task.scenario], task.solution), task.id).not.toThrow();
      }
    } finally {
      databases.fastfood.close();
      databases.medicine.close();
    }
  });

  it("führt SELECT aus und weist Änderungen an der Übungsdatenbank ab", () => {
    const database = createSeededDatabase(SQL, "fastfood");
    try {
      expect(executeReadOnly(database, "SELECT COUNT(*) FROM F_CUSTOMERS").rows[0][0]).toBe(18);
      expect(executeReadOnly(database, "-- Abfrage\nSELECT COUNT(*) FROM F_CUSTOMERS").rows[0][0]).toBe(18);
      expect(() => executeReadOnly(database, "DELETE FROM F_CUSTOMERS")).toThrow("Erlaubt sind SELECT-Abfragen");
      expect(() => executeReadOnly(database, "/* Hinweis */ DELETE FROM F_CUSTOMERS")).toThrow("Erlaubt sind SELECT-Abfragen");
      expect(() => executeReadOnly(database, "SELECT 1; DELETE FROM F_CUSTOMERS")).toThrow(/readonly database/i);
      expect(database.exec("SELECT COUNT(*) FROM F_CUSTOMERS")[0].values[0][0]).toBe(18);
    } finally {
      database.close();
    }
  });

  it("gibt SQL-Fehler aus und begrenzt übergroße Abfragen", () => {
    const database = createSeededDatabase(SQL, "fastfood");
    try {
      expect(() => executeReadOnly(database, "SELECT CustomerID FROM F_ORDERS")).toThrow(/no such column/i);
      expect(() => executeReadOnly(database, `SELECT '${"x".repeat(12_001)}'`)).toThrow(/zu lang/i);
    } finally {
      database.close();
    }
  });
});

describe("Ergebnisvergleich", () => {
  const result = (rows: unknown[][], columns = ["Wert"]) => ({ columns, rows, rowCount: rows.length });

  it("vergleicht numerische Ergebnisse mit 0,01 Toleranz", () => {
    expect(resultsMatch(result([[5.01]]), result([[5]]), true)).toBe(true);
    expect(resultsMatch(result([[5.02]]), result([[5]]), true)).toBe(false);
  });

  describe("Lösungsprüfung", () => {
    it("akzeptiert gleichwertiges INNER JOIN mit anderem Alias und Ausgabespaltennamen", () => {
      const task = TASKS.find((item) => item.templateId === "aggregate-ingredient-count")!;
      const database = createSeededDatabase(SQL, "medicine");
      try {
        const alternative = "SELECT a.AMID, a.BEZEICHNUNG, COUNT(aw.WIRKSTOFFID) AS MENGE FROM ARZNEIMITTEL a INNER JOIN ARZNEIMITTELWIRKSTOFFE aw ON a.AMID = aw.AMID GROUP BY a.AMID, a.BEZEICHNUNG ORDER BY MENGE DESC;";
        const actual = executeReadOnly(database, alternative);
        const expected = executeReadOnly(database, task.solution);
        expect(checkAnswer(alternative, task, actual, expected).status).toBe("richtig");
      } finally {
        database.close();
      }
    });
  });

  it("prüft Sortierung nur, wenn Aufgabe sie verlangt", () => {
    const expected = result([[1], [2]]);
    const reversed = result([[2], [1]]);
    expect(resultsMatch(reversed, expected, false)).toBe(true);
    expect(resultsMatch(reversed, expected, true)).toBe(false);
  });

  it("erhält Duplikate und NULL-Werte im ungeordneten Vergleich", () => {
    expect(resultsMatch(result([[null], [2], [2]]), result([[2], [null], [2]]), false)).toBe(true);
    expect(resultsMatch(result([[null], [2]]), result([[null], [2], [2]]), false)).toBe(false);
  });
});
