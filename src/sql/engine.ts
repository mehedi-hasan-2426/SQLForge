import type { Database, SqlJsStatic } from "sql.js";
import { makeTableSql, SCENARIOS } from "../data/scenarios";
import type { ScenarioId } from "../domain";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

export const MAX_QUERY_LENGTH = 12_000;

export function createSeededDatabase(SQL: SqlJsStatic, scenario: ScenarioId): Database {
  const database = new SQL.Database();
  database.run("PRAGMA foreign_keys = OFF");

  const tables = SCENARIOS[scenario].tables;
  for (const table of tables) database.run(makeTableSql(table));

  for (const table of tables) {
    if (!table.rows.length) continue;

    const columns = Object.keys(table.rows[0]);
    const placeholders = columns.map(() => "?").join(", ");
    const statement = database.prepare(
      `INSERT INTO "${table.name}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${placeholders})`
    );
    try {
      for (const row of table.rows) {
        statement.run(columns.map((column) => row[column]));
      }
    } finally {
      statement.free();
    }
  }
  database.run("PRAGMA foreign_keys = ON");

  return database;
}

export function executeReadOnly(database: Database, query: string): QueryResult {
  const normalized = query.trim();
  if (!normalized) throw new Error("Gib zuerst eine SQL-Abfrage ein.");
  if (normalized.length > MAX_QUERY_LENGTH) {
    throw new Error(`Abfrage ist zu lang. Erlaubt sind höchstens ${MAX_QUERY_LENGTH} Zeichen.`);
  }
  const withoutLeadingComments = normalized.replace(
    /^(?:(?:\s+)|(?:--[^\r\n]*(?:\r?\n|$))|(?:\/\*[\s\S]*?\*\/))*/,
    ""
  );
  if (!/^(SELECT|WITH)\b/i.test(withoutLeadingComments)) {
    throw new Error("Erlaubt sind SELECT-Abfragen. Änderungen an der Übungsdatenbank sind gesperrt.");
  }

  database.run("PRAGMA query_only = ON");
  const results = database.exec(normalized);
  const first = results[0];
  if (!first) return { columns: [], rows: [], rowCount: 0 };

  const rows = first.values.slice(0, 500);
  return { columns: first.columns, rows, rowCount: first.values.length };
}
