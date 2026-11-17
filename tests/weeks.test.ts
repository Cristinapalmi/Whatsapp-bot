import { describe, expect, it } from "vitest";
import { nextWeekKey, previousWeekKey, weekDays, weekKey, weekRange } from "@/domain/money/weeks";

describe("Semanas do passe (hora de Luanda)", () => {
  it("segunda-feira 00:30 em Luanda já pertence à nova semana", () => {
    // 2026-11-16 é segunda-feira. 23:30 UTC de domingo = 00:30 de segunda em Luanda.
    expect(weekKey(new Date("2026-11-15T23:30:00Z"))).toBe("2026-W47");
    expect(weekKey(new Date("2026-11-15T22:30:00Z"))).toBe("2026-W46");
  });
  it("início e fim da semana", () => {
    const r = weekRange("2026-W47");
    expect(r.start.toISOString()).toBe("2026-11-15T23:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-22T23:00:00.000Z");
    expect(weekDays("2026-W47").from.toISOString().slice(0, 10)).toBe("2026-11-16");
  });
  it("passagem de ano", () => {
    expect(nextWeekKey("2026-W53")).toBe("2027-W01");
    expect(previousWeekKey("2027-W01")).toBe("2026-W53");
  });
});
