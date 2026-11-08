import { useEffect, useState } from "react";
import { shuffleFrames, TIMING } from "./flair";

/**
 * The four Household cards shuffling around a 2x2 grid laid over the Pairings list. Purely
 * decorative (aria-hidden): the real Pairings are in the list underneath the whole time.
 */
export function Shuffle({ labels }: { labels: readonly string[] }) {
  const [frames] = useState(() => shuffleFrames(labels.length, TIMING.shuffleSteps, Math.random));
  const [step, setStep] = useState(-1); // -1: dealt in order

  useEffect(() => {
    let n = -1;
    let timer = 0;
    const tick = () => {
      n += 1;
      setStep(n);
      if (n < frames.length - 1) timer = window.setTimeout(tick, TIMING.stepMs);
    };
    timer = window.setTimeout(tick, TIMING.dealMs);
    return () => window.clearTimeout(timer);
  }, [frames]);

  return (
    <div className="deck" aria-hidden="true">
      {labels.map((label, card) => {
        const slot = step < 0 ? card : frames[step][card];
        const col = slot % 2;
        const row = Math.floor(slot / 2);
        const tilt = step < 0 ? 0 : (((card + step) % 3) - 1) * 4;
        return (
          <div
            key={label}
            className="deck-card"
            style={{
              transform: `translate(calc(${col} * (100% + var(--gap))), calc(${row} * (100% + var(--gap)))) rotate(${tilt}deg)`,
              transitionDuration: `${TIMING.stepMs - 40}ms`,
            }}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <rect x="3.5" y="9" width="17" height="11.5" rx="1.5" />
              <path d="M2.5 9h19M12 9v11.5" />
              <path d="M12 9c-1.5-3.5-5.5-4.5-5.5-2 0 1.6 3 2 5.5 2zM12 9c1.5-3.5 5.5-4.5 5.5-2 0 1.6-3 2-5.5 2z" />
            </svg>
            {label}
          </div>
        );
      })}
    </div>
  );
}
