import { describe, expect, it } from "vitest";
import { createDraws, drawFor, type Draw } from "./draw";
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
  it("every Draw is a Loop or a Swap year, and each full Cycle has two Loops and one Swap year", () => {
    for (let start = FIRST_YEAR; start + 2 <= LAST_TESTED_YEAR; start += 3) {
      const cycle = [start, start + 1, start + 2].map(mustDraw);
      expect(cycle.map((d) => d.position)).toEqual([1, 2, 3]);
      expect(new Set(cycle.map((d) => d.cycle)).size).toBe(1);
      for (const d of cycle) {
        expect(isLoop(d) ? "loop" : isSwap(d) ? "swap" : "neither", `${d.year}`).toBe(d.kind);
      }
      expect(cycle.filter((d) => d.kind === "loop")).toHaveLength(2);
      expect(cycle.filter((d) => d.kind === "swap")).toHaveLength(1);
    }
  });

  it("within each full Cycle, each Giver gives to each other Household exactly once", () => {
    for (let start = FIRST_YEAR; start + 2 <= LAST_TESTED_YEAR; start += 3) {
      const given = new Map<string, string[]>();
      for (const d of [start, start + 1, start + 2].map(mustDraw)) {
        for (const p of d.pairings) given.set(p.giver.id, [...(given.get(p.giver.id) ?? []), p.recipient.id]);
      }
      for (const [giver, recipients] of given) {
        expect(new Set(recipients).size, `${start} ${giver}`).toBe(3);
        expect(recipients).not.toContain(giver);
      }
    }
  });

  it("no Giver has the same Recipient two years running, including across Cycle boundaries", () => {
    expect(consecutiveRepeats(drawFor, FIRST_YEAR, LAST_TESTED_YEAR)).toEqual([]);
  });

  it("the same year always gives the same Draw, from a fresh instance or the shared one", () => {
    for (const year of years) {
      expect(drawFor(year), `${year}`).toEqual(drawFor(year));
      expect(createDraws(householdLists).drawFor(year), `${year} fresh`).toEqual(drawFor(year));
    }
  });
});

describe("pinned Draws (frozen: never update these casually, see CLAUDE.md)", () => {
  // Generated once from the finished implementation on 2026-11-08, then hardcoded.
  const pinned: Record<number, [kind: string, cyclePosition: string, pairings: string]> = {
    2026: ["swap", "1/1", "eliana>shores shores>eliana janz>wruks wruks>janz"],
    2027: ["loop", "1/2", "eliana>janz shores>wruks janz>shores wruks>eliana"],
    2028: ["loop", "1/3", "eliana>wruks shores>janz janz>eliana wruks>shores"],
    2029: ["swap", "2/1", "eliana>shores shores>eliana janz>wruks wruks>janz"],
    2030: ["loop", "2/2", "eliana>wruks shores>janz janz>eliana wruks>shores"],
    2031: ["loop", "2/3", "eliana>janz shores>wruks janz>shores wruks>eliana"],
  };

  for (const [year, [kind, cyclePosition, pairings]] of Object.entries(pinned)) {
    it(`${year}`, () => {
      const d = mustDraw(Number(year));
      expect(d.kind).toBe(kind);
      expect(`${d.cycle}/${d.position}`).toBe(cyclePosition);
      expect(d.pairings.map((p) => `${p.giver.id}>${p.recipient.id}`).join(" ")).toBe(pairings);
    });
  }

  it("uses the configured labels", () => {
    expect(mustDraw(2026).pairings.map((p) => `${p.giver.label} -> ${p.recipient.label}`)).toEqual([
      "Eliana -> The Shores",
      "The Shores -> Eliana",
      "The Janz -> The Wruks",
      "The Wruks -> The Janz",
    ]);
  });
});

describe("Household List change", () => {
  // Change year 2034 cuts the 2032-2034 Cycle short, the harder case for the boundary rule.
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
        for (let start = CHANGE_YEAR; start + 2 <= LAST_TESTED_YEAR; start += 3) {
          const kinds = [start, start + 1, start + 2].map((y) => changed.drawFor(y)!.kind).sort();
          expect(kinds, `${start}`).toEqual(["loop", "loop", "swap"]);
        }
      });

      it("never repeats a Recipient two years running across the change", () => {
        expect(consecutiveRepeats(changed.drawFor, FIRST_YEAR, LAST_TESTED_YEAR)).toEqual([]);
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

/** Two mutual Pairings. */
function isSwap(d: Draw): boolean {
  const next = new Map(d.pairings.map((p) => [p.giver.id, p.recipient.id]));
  return d.pairings.every((p) => next.get(p.recipient.id) === p.giver.id);
}

function consecutiveRepeats(draw: (y: number) => Draw | undefined, from: number, to: number): string[] {
  const out: string[] = [];
  for (let y = from + 1; y <= to; y++) {
    const before = new Map(draw(y - 1)!.pairings.map((p) => [p.giver.id, p.recipient.id]));
    for (const p of draw(y)!.pairings) if (before.get(p.giver.id) === p.recipient.id) out.push(`${y}: ${p.giver.id} -> ${p.recipient.id}`);
  }
  return out;
}
