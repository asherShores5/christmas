import { currentYear } from "./draw";
import { householdLists } from "./households";

/** The first year with a Draw (the first Household List's start year); ← stops here. */
export const FIRST_YEAR = householdLists[0].startYear;

/**
 * The year the page shows: a plain four-digit `?year=` if present, else the calendar year.
 * Never earlier than FIRST_YEAR.
 */
export function yearToShow(search: string, now: Date): number {
  const raw = new URLSearchParams(search).get("year");
  const year = raw !== null && /^\d{4}$/.test(raw) ? Number(raw) : currentYear(now);
  return Math.max(FIRST_YEAR, year);
}
