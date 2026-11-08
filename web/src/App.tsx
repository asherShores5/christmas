import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Confetti } from "./Confetti";
import { CYCLE_YEARS, drawFor, type Draw } from "./draw";
import { revealMs, SHUFFLE_MS, TIMING } from "./flair";
import { notes } from "./households";
import { useReducedMotion } from "./motion";
import { Shuffle } from "./Shuffle";
import { Snow } from "./Snow";
import { Jingle } from "./sound";
import { canonicalSearch, currentYear, FIRST_YEAR, LAST_YEAR, yearToShow } from "./year";

interface AppProps {
  /** location.search at load. */
  readonly search: string;
  readonly now: Date;
}

/** shuffle: cards moving, rows hidden. reveal: rows sliding in. still: plain rows. */
type Phase = "shuffle" | "reveal" | "still";

const hrefFor = (year: number) => `?year=${year}`;

/** Makes the address bar name the year shown, without adding a history entry. */
function normalizeUrl(shown: number) {
  const { pathname, search, hash } = window.location;
  const fixed = canonicalSearch(search, shown);
  if (fixed !== undefined) window.history.replaceState(window.history.state, "", `${pathname}${fixed}${hash}`);
}

/**
 * The year view. The flair (snow, shuffle, confetti, sound) is layered over a static page that
 * stands on its own: that static page is exactly what reduced-motion users get. All Draw logic
 * lives in the draw module; year parsing in year.ts.
 */
export function App({ search, now }: AppProps) {
  const [year, setYear] = useState(() => yearToShow(search, now));
  const thisYear = Math.min(LAST_YEAR, Math.max(FIRST_YEAR, currentYear(now)));
  const reduced = useReducedMotion();

  // One run = shuffle -> rows -> confetti. A new year or "Shuffle again" starts a new run. The
  // phase is stored with the run it belongs to, so a new run starts shuffling on its very first
  // render instead of flashing the rows first.
  const [replays, setReplays] = useState(0);
  const runKey = `${year}-${replays}`;
  const [progress, setProgress] = useState<{ key: string; phase: Phase }>({ key: "", phase: "shuffle" });
  const draw = drawFor(year);
  const phase: Phase = reduced || !draw ? "still" : progress.key === runKey ? progress.phase : "shuffle";
  const [burst, setBurst] = useState(0);

  const [soundOn, setSoundOn] = useState(false);
  const jingle = useRef<Jingle | null>(null);
  const soundOnRef = useRef(false);
  soundOnRef.current = soundOn;

  useEffect(() => {
    document.title = `Christmas Swap ${year}`;
  }, [year]);

  // An invalid or clamped ?year= is rewritten in place to the year shown, at load and on Back.
  useEffect(() => {
    normalizeUrl(year);
    const onPop = () => {
      const shown = yearToShow(window.location.search, new Date());
      normalizeUrl(shown);
      setYear(shown);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const pairingCount = draw?.pairings.length ?? 0;
  useEffect(() => {
    if (reduced || pairingCount === 0) return;
    const timers = [
      window.setTimeout(() => setProgress({ key: runKey, phase: "reveal" }), SHUFFLE_MS),
      window.setTimeout(() => {
        setBurst((b) => b + 1);
        if (soundOnRef.current) jingle.current?.play();
      }, SHUFFLE_MS + revealMs(pairingCount)),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [runKey, reduced, pairingCount]);

  /** Sound starts muted; the first tap creates the audio (browsers require a gesture). */
  const toggleSound = async () => {
    jingle.current ??= new Jingle();
    if (soundOn) {
      jingle.current.mute();
      setSoundOn(false);
      return;
    }
    setSoundOn(true);
    await jingle.current.unmute();
    jingle.current.play();
  };

  /** Same-page navigation: keep the URL in step without a reload. */
  const navigateTo = (to: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    window.history.pushState(null, "", to === thisYear ? "/" : hrefFor(to));
    setYear(to);
  };

  const note = notes[year];
  const atFirst = year <= FIRST_YEAR;
  const atLast = year >= LAST_YEAR;

  return (
    <>
      {!reduced && <Snow />}
      {!reduced && <Confetti burst={burst} />}
      <main>
        <button
          type="button"
          className="sound"
          onClick={() => void toggleSound()}
          aria-pressed={soundOn}
          aria-label="Sound"
          title={soundOn ? "Sound on" : "Sound off"}
        >
          <SpeakerIcon on={soundOn} />
        </button>

        <h1>
          Christmas Swap <span className="year">{year}</span>
        </h1>

        <nav className="years" aria-label="Years">
          {atFirst ? (
            <span className="arrow" aria-disabled="true" role="link" aria-label="Previous year (none before 2026)">
              ←
            </span>
          ) : (
            <a className="arrow" href={hrefFor(year - 1)} onClick={navigateTo(year - 1)} aria-label={`Previous year, ${year - 1}`}>
              ←
            </a>
          )}
          {year !== thisYear ? (
            <a className="this-year" href="/" onClick={navigateTo(thisYear)}>
              This year
            </a>
          ) : (
            <span className="this-year placeholder" aria-hidden="true">This year</span>
          )}
          {atLast ? (
            <span className="arrow" aria-disabled="true" role="link" aria-label={`Next year (none after ${LAST_YEAR})`}>
              →
            </span>
          ) : (
            <a className="arrow" href={hrefFor(year + 1)} onClick={navigateTo(year + 1)} aria-label={`Next year, ${year + 1}`}>
              →
            </a>
          )}
        </nav>

        {draw && <Pairings key={runKey} draw={draw} phase={phase} />}

        {draw && !reduced && (
          <p className="again">
            <button type="button" onClick={() => setReplays((r) => r + 1)} disabled={phase === "shuffle"}>
              Shuffle again
            </button>
          </p>
        )}

        {note && (
          <section className="notes" aria-labelledby="notes-heading">
            <h2 id="notes-heading">Notes</h2>
            <p>{note}</p>
          </section>
        )}
      </main>
    </>
  );
}

function Pairings({ draw, phase }: { draw: Draw; phase: Phase }) {
  return (
    <section aria-labelledby="pairings-heading">
      <h2 id="pairings-heading" className="draw-heading">
        Who gives to whom
        <span className="cycle">
          {" "}
          · Cycle {draw.cycle}, year {draw.position} of {CYCLE_YEARS}
        </span>
      </h2>
      <div className="stage">
        {/* Always in the DOM for screen readers; only hidden from view while the cards shuffle. */}
        <ol className={`pairings ${phase}`}>
          {draw.pairings.map((p, i) => (
            <li
              key={p.giver.id}
              style={phase === "reveal" ? { animationDelay: `${i * TIMING.rowStaggerMs}ms`, animationDuration: `${TIMING.rowMs}ms` } : undefined}
            >
              <span className="giver">{p.giver.label}</span>
              <span className="gives" aria-hidden="true">
                →
              </span>
              <span className="visually-hidden"> gives to </span>
              <span className="recipient">{p.recipient.label}</span>
            </li>
          ))}
        </ol>
        {phase === "shuffle" && <Shuffle labels={draw.pairings.map((p) => p.giver.label)} />}
      </div>
    </section>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      {on ? (
        <>
          <path d="M16.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 6a8.5 8.5 0 0 1 0 12" />
        </>
      ) : (
        <path d="M17 9.5l4.5 5M21.5 9.5l-4.5 5" />
      )}
    </svg>
  );
}
