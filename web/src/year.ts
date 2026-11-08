import { householdLists } from "./households";

/** The calendar year the page shows by default (local time; flips at midnight Jan 1). */
export function currentYear(now: Date): number {
  return now.getFullYear();
}

/** The first year with a Draw (the first Household List's start year); ← stops here. */
export const FIRST_YEAR = householdLists[0].startYear;

/** The last year the page can show (?year= takes four digits); → stops here. */
export const LAST_YEAR = 9999;

/**
 * The year the page shows: a plain four-digit `?year=` if present, else the calendar year.
 * Always within FIRST_YEAR..LAST_YEAR.
 */
export function yearToShow(search: string, now: Date): number {
  const raw = new URLSearchParams(search).get("year");
  const year = raw !== null && /^\d{4}$/.test(raw) ? Number(raw) : currentYear(now);
  return Math.min(LAST_YEAR, Math.max(FIRST_YEAR, year));
}

/**
 * The `location.search` to put in the address bar when `?year=` doesn't name the year shown
 * (invalid or clamped), so the URL matches the page; undefined when nothing needs changing.
 */
export function canonicalSearch(search: string, shown: number): string | undefined {
  const params = new URLSearchParams(search);
  const raw = params.get("year");
  if (raw === null || raw === String(shown)) return undefined;
  params.set("year", String(shown));
  return `?${params}`;
}
