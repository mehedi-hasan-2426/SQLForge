import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { createSeededDatabase, executeReadOnly } from "./engine";
import type { ScenarioId } from "../domain";

interface WorkerRequest {
  query: string;
  scenario: ScenarioId;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  let database: ReturnType<typeof createSeededDatabase> | undefined;
  try {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    database = createSeededDatabase(SQL, event.data.scenario);
    const result = executeReadOnly(database, event.data.query);
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : "SQL-Abfrage fehlgeschlagen." });
  } finally {
    database?.close();
  }
};

export {};
