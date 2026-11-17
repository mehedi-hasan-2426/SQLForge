import { describe, expect, it } from "vitest";
import { EMPTY_PROGRESS } from "../domain";
import { importProgress, readProgress, saveProgress, validateProgress } from "./store";

describe("lokaler Lernstand", () => {
  it("speichert und liest Versuche aus dem Browser-Speicher", () => {
    const storage = window.localStorage;
    storage.clear();
    const progress = { ...structuredClone(EMPTY_PROGRESS), streak: 2, lastStudyDate: "2026-11-17" };
    saveProgress(storage, progress);
    expect(readProgress(storage).progress).toEqual(progress);
  });

  it("exportiert und importiert gültige JSON-Daten", () => {
    const progress = { ...structuredClone(EMPTY_PROGRESS), streak: 3 };
    expect(importProgress(JSON.stringify(progress))).toEqual(progress);
  });

  it("weist ungültige Einträge und unbekannte Formate ab", () => {
    expect(() => validateProgress({ version: 2, attempts: [] })).toThrow(/unbekanntes Format/i);
    expect(() => importProgress("{broken")).toThrow(/gültiges JSON/i);
    expect(() => importProgress(JSON.stringify({
      ...EMPTY_PROGRESS,
      attempts: [{ taskId: "x", status: "invalid" }]
    }))).toThrow(/Übungsversuch ist ungültig/i);
  });

  it("meldet beschädigte lokal gespeicherte Daten statt sie als gültig zu behandeln", () => {
    window.localStorage.setItem("sql-pruefungstrainer-progress-v1", "{");
    expect(readProgress(window.localStorage).error).toMatch(/konnte nicht gelesen werden/i);
  });
});
