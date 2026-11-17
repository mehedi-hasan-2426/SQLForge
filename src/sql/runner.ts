import { MAX_QUERY_LENGTH, type QueryResult } from "./engine";
import type { ScenarioId } from "../domain";

const EXECUTION_TIMEOUT_MS = 3500;

export function executeInWorker(query: string, scenario: ScenarioId): Promise<QueryResult> {
  if (query.length > MAX_QUERY_LENGTH) {
    return Promise.reject(new Error(`Abfrage ist zu lang. Erlaubt sind höchstens ${MAX_QUERY_LENGTH} Zeichen.`));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./db.worker.ts", import.meta.url), { type: "module" });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("Abfrage hat zu lange gedauert. Vereinfache sie und versuche es erneut."));
    }, EXECUTION_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: QueryResult; error?: string }>) => {
      window.clearTimeout(timeout);
      worker.terminate();
      if (event.data.ok && event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? "SQL-Abfrage fehlgeschlagen."));
    };

    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || "SQL-Arbeitsbereich konnte nicht gestartet werden."));
    };

    worker.postMessage({ query, scenario });
  });
}
