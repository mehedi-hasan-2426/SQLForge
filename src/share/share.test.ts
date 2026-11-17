import { describe, expect, it } from "vitest";
import { createSharePayload, createWhatsAppLink } from "./share";

describe("Teilen", () => {
  it("baut einen WhatsApp-Link mit vollständig kodiertem Text", () => {
    const link = createWhatsAppLink("Aufgabe: „pro Kunde“\nSQL: SELECT *");
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(
      createSharePayload("Aufgabe: „pro Kunde“\nSQL: SELECT *")
    );
  });
});
