import { describe, expect, it } from "vitest";
import { yearToShow } from "./year";

const nov2026 = new Date(2026, 10, 8);

describe("yearToShow", () => {
  it("shows the calendar year when the URL has no year", () => {
    expect(yearToShow("", nov2026)).toBe(2026);
  });

  it("shows the year from ?year= when it is valid", () => {
    expect(yearToShow("?year=2030", nov2026)).toBe(2030);
    expect(yearToShow("?other=1&year=2027", nov2026)).toBe(2027);
  });

  it("ignores a ?year= that isn't a plain whole year", () => {
    for (const bad of ["?year=", "?year=abc", "?year=2027.5", "?year=1e4", "?year=%202027", "?year=-2027", "?year=0x7eb", "?year=99999"]) {
      expect(yearToShow(bad, nov2026), bad).toBe(2026);
    }
  });

  it("never goes before 2026, the first year with a Draw", () => {
    expect(yearToShow("?year=2025", nov2026)).toBe(2026);
    expect(yearToShow("?year=1999", new Date(2028, 0, 1))).toBe(2026);
    expect(yearToShow("", new Date(2025, 11, 31))).toBe(2026);
  });

  it("follows the calendar year in later years", () => {
    expect(yearToShow("", new Date(2027, 0, 1))).toBe(2027);
  });
});
