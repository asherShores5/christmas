import { useEffect, useState, type MouseEvent } from "react";
import { currentYear, drawFor, type Draw } from "./draw";
import { notes } from "./households";
import { FIRST_YEAR, yearToShow } from "./year";

interface AppProps {
  /** location.search at load. */
  readonly search: string;
  readonly now: Date;
}

const hrefFor = (year: number) => `?year=${year}`;

/**
 * The year view. Static rendering only: this is exactly what reduced-motion users get, so it
 * must stand on its own. All Draw logic lives in the draw module; year parsing in year.ts.
 */
export function App({ search, now }: AppProps) {
  const [year, setYear] = useState(() => yearToShow(search, now));
  const thisYear = Math.max(FIRST_YEAR, currentYear(now));

  useEffect(() => {
    document.title = `Christmas Swap ${year}`;
  }, [year]);

  useEffect(() => {
    const onPop = () => setYear(yearToShow(window.location.search, new Date()));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** Same-page navigation: keep the URL in step without a reload. */
  const go = (to: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    window.history.pushState(null, "", to === thisYear ? "/" : hrefFor(to));
    setYear(to);
  };

  const draw = drawFor(year);
  const note = notes[year];
  const atFirst = year <= FIRST_YEAR;

  return (
    <main>
      <h1>
        Christmas Swap <span className="year">{year}</span>
      </h1>

      <nav className="years" aria-label="Years">
        {atFirst ? (
          <span className="arrow" aria-disabled="true" role="link" aria-label="Previous year (none before 2026)">
            ←
          </span>
        ) : (
          <a className="arrow" href={hrefFor(year - 1)} onClick={go(year - 1)} aria-label={`Previous year, ${year - 1}`}>
            ←
          </a>
        )}
        {year !== thisYear ? (
          <a className="this-year" href="/" onClick={go(thisYear)}>
            This year
          </a>
        ) : (
          <span className="this-year placeholder" aria-hidden="true">This year</span>
        )}
        <a className="arrow" href={hrefFor(year + 1)} onClick={go(year + 1)} aria-label={`Next year, ${year + 1}`}>
          →
        </a>
      </nav>

      {draw && <Pairings draw={draw} />}

      {note && (
        <section className="notes" aria-labelledby="notes-heading">
          <h2 id="notes-heading">Notes</h2>
          <p>{note}</p>
        </section>
      )}
    </main>
  );
}

function Pairings({ draw }: { draw: Draw }) {
  return (
    <section aria-labelledby="pairings-heading">
      <h2 id="pairings-heading" className="kind">
        {draw.kind === "swap" ? "Swap year" : "Loop year"}
        <span className="cycle">
          {" "}
          · Cycle {draw.cycle}, year {draw.position} of 3
        </span>
      </h2>
      <ol className="pairings">
        {draw.pairings.map((p) => (
          <li key={p.giver.id}>
            <span className="giver">{p.giver.label}</span>
            <span className="gives" aria-hidden="true">
              →
            </span>
            <span className="visually-hidden"> gives to </span>
            <span className="recipient">{p.recipient.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
