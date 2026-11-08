/**
 * The Draw module: a pure function from year to Draw. No DOM, clock or outside randomness.
 *
 * FROZEN once a Draw is in use: the PRNG, seed derivation and schedule below decide every past
 * and future Draw. Changing any of them rewrites Draws people rely on; the pinned tests catch it.
 *
 * Schedule (see ADR 0001): every Draw is a Loop, so no two Households ever give to each other.
 * From each Household List's start year, years group into six-year Cycles that use each of the
 * six possible Loops once, in the fixed order of CYCLE_LOOPS. Over a Cycle every Giver gives to
 * each other Household twice. With four Households a Loop-only schedule can't avoid every
 * back-to-back repeat; this order has the minimum (three per Cycle, each on a different Giver)
 * and none across the boundary into the next Cycle. A seeded shuffle per Cycle decides which
 * Household sits in which slot, so who gets which year changes from Cycle to Cycle.
 */
import { householdLists as configuredLists, type Household, type HouseholdList } from "./households";

export interface Pairing {
  readonly giver: Household;
  readonly recipient: Household;
}

export interface Draw {
  readonly year: number;
  /** 1-based Cycle number counted from the Household List's start year. */
  readonly cycle: number;
  /** 1 to 6: the year's place in its Cycle. */
  readonly position: CyclePosition;
  /** Start year of the Household List this Draw was made with. */
  readonly listStartYear: number;
  /** One Pairing per Giver, in the Household List's order. */
  readonly pairings: readonly Pairing[];
}

export type CyclePosition = 1 | 2 | 3 | 4 | 5 | 6;

export interface Draws {
  drawFor(year: number): Draw | undefined;
}

/**
 * The six Loops in Cycle order, over abstract slots 0-3: entry [s] is the slot that slot s gives
 * to. Chosen by brute force over all orders: no mutual Pairings, the fewest back-to-back repeats
 * (years 1-2 slot 2, 3-4 slot 1, 5-6 slot 0) and none from year 6 into the next year 1. Frozen.
 */
const CYCLE_LOOPS: readonly (readonly number[])[] = [
  [1, 2, 3, 0],
  [2, 0, 3, 1],
  [1, 3, 0, 2],
  [2, 3, 1, 0],
  [3, 2, 0, 1],
  [3, 0, 1, 2],
];
export const CYCLE_YEARS = CYCLE_LOOPS.length;
const MAX_SEED_ATTEMPTS = 1000;

/** Builds a drawFor over a given Household List config (the app uses the shipped config). */
export function createDraws(lists: readonly HouseholdList[]): Draws {
  /** Per (list index, Cycle index): the Household index (into the list) sitting in each slot. */
  const cycles = new Map<string, number[]>();

  function listIndexFor(year: number): number {
    for (let i = lists.length - 1; i >= 0; i--) if (lists[i].startYear <= year) return i;
    return -1;
  }

  /** Recipient index (into the list) for each Giver index, for one year of a Cycle. */
  function recipientsFor(slots: number[], indexInCycle: number): number[] {
    const loop = CYCLE_LOOPS[indexInCycle];
    const recipientOf = new Array<number>(slots.length);
    slots.forEach((giver, slot) => {
      recipientOf[giver] = slots[loop[slot]];
    });
    return recipientOf;
  }

  /** Where a year falls: its Household List, Cycle and 0-based position in that Cycle. */
  function placeOf(year: number) {
    const listIndex = listIndexFor(year);
    if (listIndex < 0) return undefined;
    const sinceStart = year - lists[listIndex].startYear;
    return { listIndex, cycleIndex: Math.floor(sinceStart / CYCLE_YEARS), indexInCycle: sinceStart % CYCLE_YEARS };
  }

  const keyOf = (listIndex: number, cycleIndex: number) => `${listIndex}:${cycleIndex}`;

  /**
   * A Cycle depends on the Draw just before it, which lives in an earlier Cycle. Walk back to the
   * first Cycle not yet cached, then fill forward, so far-off years don't recurse.
   */
  function cycleFor(listIndex: number, cycleIndex: number) {
    const pending = [{ listIndex, cycleIndex }];
    for (;;) {
      const { listIndex: l, cycleIndex: c } = pending[pending.length - 1];
      const before = placeOf(lists[l].startYear + c * CYCLE_YEARS - 1);
      if (!before || cycles.has(keyOf(before.listIndex, before.cycleIndex))) break;
      pending.push({ listIndex: before.listIndex, cycleIndex: before.cycleIndex });
    }
    for (let i = pending.length - 1; i >= 0; i--) {
      const { listIndex: l, cycleIndex: c } = pending[i];
      if (!cycles.has(keyOf(l, c))) cycles.set(keyOf(l, c), computeCycle(l, c));
    }
    return cycles.get(keyOf(listIndex, cycleIndex))!;
  }

  /** Picks one Cycle's slot order; the Cycle before it must already be cached. */
  function computeCycle(listIndex: number, cycleIndex: number) {
    const list = lists[listIndex];
    const firstYear = list.startYear + cycleIndex * CYCLE_YEARS;
    const previous = draw(firstYear - 1);
    for (let attempt = 0; attempt < MAX_SEED_ATTEMPTS; attempt++) {
      const slots = shuffle([0, 1, 2, 3], mulberry32(seedFor(list.startYear, cycleIndex, attempt)));
      if (previous && repeatsAny(previous, list, recipientsFor(slots, 0))) continue;
      return slots;
    }
    throw new Error(`no seed attempt avoids a repeat for Cycle ${cycleIndex + 1} of the ${list.startYear} list`);
  }

  function draw(year: number): Draw | undefined {
    if (!Number.isInteger(year)) return undefined;
    const place = placeOf(year);
    if (!place) return undefined;
    const { listIndex, cycleIndex, indexInCycle } = place;
    const list = lists[listIndex];
    const recipients = recipientsFor(cycleFor(listIndex, cycleIndex), indexInCycle);
    return {
      year,
      cycle: cycleIndex + 1,
      position: (indexInCycle + 1) as CyclePosition,
      listStartYear: list.startYear,
      pairings: list.households.map((giver, i) => ({ giver, recipient: list.households[recipients[i]] })),
    };
  }

  return { drawFor: draw };
}

/** True if any Giver would have the same Recipient (by id) as in the previous Draw. */
function repeatsAny(previous: Draw, list: HouseholdList, recipients: number[]): boolean {
  const before = new Map(previous.pairings.map((p) => [p.giver.id, p.recipient.id]));
  return list.households.some((giver, i) => before.get(giver.id) === list.households[recipients[i]].id);
}

/** FNV-1a over the seed parts. Frozen. */
function seedFor(listStartYear: number, cycleIndex: number, attempt: number): number {
  const text = `christmas-swap-loops:${listStartYear}:${cycleIndex}:${attempt}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** mulberry32: small 32-bit PRNG returning floats in [0, 1). Frozen. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, in place. Frozen. */
function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const shipped = createDraws(configuredLists);

/** The Draw for a year under the shipped Household List config; undefined before 2026. */
export function drawFor(year: number): Draw | undefined {
  return shipped.drawFor(year);
}

