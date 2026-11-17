import { describe, expect, it } from "vitest";
import { TASKS } from "../data/tasks";
import { chooseExamTasks, createExamTiming, pointsForStatus } from "./session";

describe("Prüfungsmodus", () => {
  it("wählt passende, nicht doppelte Aufgaben aus", () => {
    const selected = chooseExamTasks(TASKS, 10, ["HAVING"], "mittel", () => 0.5);
    expect(selected).toHaveLength(10);
    expect(new Set(selected.map((task) => task.id)).size).toBe(10);
    expect(selected.every((task) => task.topic === "HAVING" && task.difficulty === "mittel")).toBe(true);
  });

  it("weist Auswahl mit zu wenigen Aufgaben klar zurück", () => {
    expect(() => chooseExamTasks(TASKS, 20, ["JOINs: Self Join"], "schwer")).toThrow(/Zu wenige Aufgaben/i);
  });

  it("setzt Klausursimulation auf 40 Minuten und 50 Punkte", () => {
    expect(createExamTiming("simulation", 90, 1_000)).toEqual({
      startedAt: 1_000,
      durationSeconds: 2_400,
      endsAt: 2_401_000
    });
    expect(pointsForStatus("richtig", "simulation", 2)).toBe(5);
    expect(pointsForStatus("technik", "simulation", 2)).toBe(2.5);
  });

  it("begrenzt Zeitlimits eigener Prüfungen auf angebotene Werte", () => {
    expect(createExamTiming("practice", 20, 0).durationSeconds).toBe(1_200);
    expect(() => createExamTiming("practice", 15, 0)).toThrow(/Zeitlimit/i);
  });
});
