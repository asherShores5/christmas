import { describe, expect, it } from "vitest";
import { createDraws, CYCLE_YEARS, drawFor, type Draw } from "./draw";
import { householdLists } from "./households";

const FIRST_YEAR = 2026;
const LAST_TESTED_YEAR = 2100;
const years = Array.from({ length: LAST_TESTED_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

function mustDraw(year: number): Draw {
  const d = drawFor(year);
  if (!d) throw new Error(`no Draw for ${year}`);
  return d;
}

describe("drawFor", () => {
  it("works for the last four-digit year on a cold cache", () => {
    const d = createDraws(householdLists).drawFor(9999);
    expect(d).toMatchObject({ year: 9999, listStartYear: 2026 });
    expect(d!.pairings).toHaveLength(4);
  });

  it("gives no Draw before 2026", () => {
    expect(drawFor(2025)).toBeUndefined();
    expect(drawFor(1990)).toBeUndefined();
  });

  it("every Draw from 2026 to 2100: four Pairings, each Household gives once and receives once, never to itself", () => {
    for (const year of years) {
      const { pairings } = mustDraw(year);
      expect(pairings).toHaveLength(4);
      const givers = new Set(pairings.map((p) => p.giver.id));
      const recipients = new Set(pairings.map((p) => p.recipient.id));
      expect(givers.size, `${year} givers`).toBe(4);
      expect(recipients).toEqual(givers);
      for (const p of pairings) expect(p.recipient.id, `${year} ${p.giver.id}`).not.toBe(p.giver.id);
    }
  });
});

describe("Cycles", () => {
  const fullCycles = (from: number) =>
    Array.from({ length: Math.floor((LAST_TESTED_YEAR - from + 1) / CYCLE_YEARS) }, (_, i) => from + i * CYCLE_YEARS);
  const cycleYears = (start: number) => Array.from({ length: CYCLE_YEARS }, (_, i) => start + i);

  it("every Draw is a Loop: no two Households ever give to each other", () => {
    for (const year of years) expect(isLoop(mustDraw(year)), `${year}`).toBe(true);
  });

  it("each full Cycle is six years, numbered 1 to 6", () => {
    for (const start of fullCycles(FIRST_YEAR)) {
      const cycle = cycleYears(start).map(mustDraw);
      expect(cycle.map((d) => d.position)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(new Set(cycle.map((d) => d.cycle)).size).toBe(1);
    }
  });

  it("within each full Cycle, each Giver gives to each other Household exactly twice", () => {
    for (const start of fullCycles(FIRST_YEAR)) {
      const given = new Map<string, string[]>();
      for (const d of cycleYears(start).map(mustDraw)) {
        for (const p of d.pairings) given.set(p.giver.id, [...(given.get(p.giver.id) ?? []), p.recipient.id]);
      }
      for (const [giver, recipients] of given) {
        const counts = new Map<string, number>();
        for (const r of recipients) counts.set(r, (counts.get(r) ?? 0) + 1);
        expect([...counts.values()], `${start} ${giver}`).toEqual([2, 2, 2]);
        expect(recipients).not.toContain(giver);
      }
    }
  });

  it("back-to-back repeats: exactly three per Cycle, on three different Givers, none across Cycle boundaries", () => {
    const repeats = consecutiveRepeats(drawFor, FIRST_YEAR, LAST_TESTED_YEAR);
    for (const start of fullCycles(FIRST_YEAR)) {
      const inCycle = repeats.filter((r) => r.year > start && r.year < start + CYCLE_YEARS);
      expect(inCycle.map((r) => r.year - start + 1), `${start}`).toEqual([2, 4, 6]);
      expect(new Set(inCycle.map((r) => r.giver)).size, `${start}`).toBe(3);
    }
    const boundaries = repeats.filter((r) => (r.year - FIRST_YEAR) % CYCLE_YEARS === 0);
    expect(boundaries).toEqual([]);
  });

  it("the same year always gives the same Draw, from a fresh instance or the shared one", () => {
    for (const year of years) {
      expect(drawFor(year), `${year}`).toEqual(drawFor(year));
      expect(createDraws(householdLists).drawFor(year), `${year} fresh`).toEqual(drawFor(year));
    }
  });
});

describe("pinned Draws (frozen: never update these casually, see CLAUDE.md)", () => {
  // Generated once from the Loop-only schedule on 2026-11-08, then hardcoded.
  const pinned: Record<number, [cyclePosition: string, pairings: string]> = {
    2026: ["1/1", "eliana>shores shores>janz janz>wruks wruks>eliana"],
    2027: ["1/2", "eliana>janz shores>wruks janz>shores wruks>eliana"],
    2028: ["1/3", "eliana>wruks shores>janz janz>eliana wruks>shores"],
    2029: ["1/4", "eliana>shores shores>wruks janz>eliana wruks>janz"],
    2030: ["1/5", "eliana>janz shores>eliana janz>wruks wruks>shores"],
    2031: ["1/6", "eliana>wruks shores>eliana janz>shores wruks>janz"],
  };

  for (const [year, [cyclePosition, pairings]] of Object.entries(pinned)) {
    it(`${year}`, () => {
      const d = mustDraw(Number(year));
      expect(`${d.cycle}/${d.position}`).toBe(cyclePosition);
      expect(d.pairings.map((p) => `${p.giver.id}>${p.recipient.id}`).join(" ")).toBe(pairings);
    });
  }

  it("uses the configured labels", () => {
    expect(mustDraw(2026).pairings.map((p) => `${p.giver.label} -> ${p.recipient.label}`)).toEqual([
      "Eliana -> The Shores",
      "The Shores -> The Janz",
      "The Janz -> The Wruks",
      "The Wruks -> Eliana",
    ]);
  });
});

describe("Household List change", () => {
  // Change year 2034 cuts the 2032-2037 Cycle short, the harder case for the boundary rule.
  const CHANGE_YEAR = 2034;
  const [eliana, shores, janz] = householdLists[0].households;
  const fixtures = {
    "one Household swapped": [eliana, shores, janz, { id: "newcomer", label: "Newcomer" }],
    "same Households, new order": [janz, eliana, householdLists[0].households[3], shores],
  };

  for (const [name, households] of Object.entries(fixtures)) {
    describe(name, () => {
      const changed = createDraws([...householdLists, { startYear: CHANGE_YEAR, households }]);

      it("leaves every Draw before the change year identical", () => {
        for (let y = FIRST_YEAR; y < CHANGE_YEAR; y++) expect(changed.drawFor(y), `${y}`).toEqual(drawFor(y));
      });

      it("starts a fresh Cycle with the new list in the change year", () => {
        const first = changed.drawFor(CHANGE_YEAR)!;
        expect(first).toMatchObject({ listStartYear: CHANGE_YEAR, cycle: 1, position: 1 });
        expect(first.pairings.map((p) => p.giver.id)).toEqual(households.map((h) => h.id));
        for (let y = CHANGE_YEAR; y <= LAST_TESTED_YEAR; y++) expect(isLoop(changed.drawFor(y)!), `${y}`).toBe(true);
      });

      it("no Giver repeats a Recipient from the year before the change", () => {
        expect(consecutiveRepeats(changed.drawFor, CHANGE_YEAR - 1, CHANGE_YEAR)).toEqual([]);
      });
    });
  }
});

/** Following Giver -> Recipient from the first Giver visits all four before returning. */
function isLoop(d: Draw): boolean {
  const next = new Map(d.pairings.map((p) => [p.giver.id, p.recipient.id]));
  const start = d.pairings[0].giver.id;
  let at = start;
  const seen = new Set<string>();
  while (!seen.has(at)) {
    seen.add(at);
    at = next.get(at)!;
  }
  return seen.size === 4 && at === start;
}

function consecutiveRepeats(draw: (y: number) => Draw | undefined, from: number, to: number) {
  const out: { year: number; giver: string; recipient: string }[] = [];
  for (let y = from + 1; y <= to; y++) {
    const before = new Map(draw(y - 1)!.pairings.map((p) => [p.giver.id, p.recipient.id]));
    for (const p of draw(y)!.pairings) if (before.get(p.giver.id) === p.recipient.id) out.push({ year: y, giver: p.giver.id, recipient: p.recipient.id });
  }
  return out;
}
