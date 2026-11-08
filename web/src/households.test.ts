import { describe, expect, it } from "vitest";
import { householdLists, validateHouseholdLists, type HouseholdList } from "./households";

const four = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
  { id: "d", label: "D" },
];

describe("Household List config", () => {
  it("ships one valid list from 2026 with the four family Households", () => {
    expect(() => validateHouseholdLists(householdLists)).not.toThrow();
    expect(householdLists[0].startYear).toBe(2026);
    expect(householdLists[0].households.map((h) => h.label)).toEqual(["Eliana", "The Shores", "The Janz", "The Wruks"]);
  });

  it("rejects a list with three Households", () => {
    expect(() => validateHouseholdLists([{ startYear: 2026, households: four.slice(0, 3) }])).toThrow(/exactly 4/);
  });

  it("rejects a list with five Households", () => {
    expect(() => validateHouseholdLists([{ startYear: 2026, households: [...four, { id: "e", label: "E" }] }])).toThrow(/exactly 4/);
  });

  it("rejects duplicate Household ids", () => {
    const dup = [...four.slice(0, 3), { id: "a", label: "Other A" }];
    expect(() => validateHouseholdLists([{ startYear: 2026, households: dup }])).toThrow(/duplicate/i);
  });

  it("rejects start years that are not in increasing order", () => {
    const lists: HouseholdList[] = [
      { startYear: 2030, households: four },
      { startYear: 2028, households: four },
    ];
    expect(() => validateHouseholdLists(lists)).toThrow(/order/i);
    expect(() => validateHouseholdLists([lists[0], { startYear: 2030, households: four }])).toThrow(/order/i);
  });

  it("rejects an empty config", () => {
    expect(() => validateHouseholdLists([])).toThrow();
  });
});
