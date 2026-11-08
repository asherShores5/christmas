/**
 * The Household List config: the one file Asher edits. Each version starts a new Cycle in its
 * start year; earlier years keep the list they were drawn with. Draws use ids, so changing a
 * label never changes a Draw. Validation runs in the tests and in vite.config.ts (build).
 */

export interface Household {
  /** Stable id used by the Draw. Never change it once 2026 is live. */
  readonly id: string;
  readonly label: string;
}

export interface HouseholdList {
  readonly startYear: number;
  readonly households: readonly Household[];
}

export const householdLists: readonly HouseholdList[] = [
  {
    startYear: 2026,
    households: [
      { id: "eliana", label: "Eliana" },
      { id: "shores", label: "The Shores" },
      { id: "janz", label: "The Janz" },
      { id: "wruks", label: "The Wruks" },
    ],
  },
];

/** Notes shown under a year's Draw (gift budget, exchange date, rules). */
export const notes: Readonly<Record<number, string>> = {};

export const HOUSEHOLDS_PER_LIST = 4;

/** Throws if the config could break the schedule. */
export function validateHouseholdLists(lists: readonly HouseholdList[]): void {
  if (lists.length === 0) throw new Error("Household List config needs at least one list version");
  lists.forEach((list, i) => {
    if (!Number.isInteger(list.startYear)) throw new Error(`Household List ${i}: start year must be a whole year`);
    if (i > 0 && list.startYear <= lists[i - 1].startYear) {
      throw new Error(`Household List ${i}: start years must be in increasing order (${lists[i - 1].startYear} then ${list.startYear})`);
    }
    if (list.households.length !== HOUSEHOLDS_PER_LIST) {
      throw new Error(`Household List ${i} (${list.startYear}): needs exactly ${HOUSEHOLDS_PER_LIST} Households, has ${list.households.length}`);
    }
    const ids = new Set<string>();
    for (const h of list.households) {
      if (ids.has(h.id)) throw new Error(`Household List ${i} (${list.startYear}): duplicate Household id "${h.id}"`);
      ids.add(h.id);
    }
  });
}
