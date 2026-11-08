/**
 * Pure helpers for the page's flair (shuffle, reveal, jingle). Nothing here touches the Draw:
 * the animation's randomness is for show only and never changes who gives to whom.
 */

/** Animation timing, in milliseconds. */
export const TIMING = {
  /** Cards sit dealt in order before the first move. */
  dealMs: 300,
  shuffleSteps: 6,
  stepMs: 340,
  /** Gap between one row sliding in and the next. */
  rowStaggerMs: 110,
  rowMs: 420,
} as const;

/** From the start of a run until the cards give way to the rows. */
export const SHUFFLE_MS = TIMING.dealMs + TIMING.shuffleSteps * TIMING.stepMs + 250;

/** From the rows starting until the last one has landed (confetti time). */
export const revealMs = (rows: number) => Math.max(0, rows - 1) * TIMING.rowStaggerMs + TIMING.rowMs;

/**
 * Slots for each card across a shuffle: frame[i][card] is the slot card `card` sits in. Cards
 * start dealt in order (card i in slot i); every frame differs from the one before it.
 */
export function shuffleFrames(cards: number, steps: number, rng: () => number): number[][] {
  const frames: number[][] = [];
  let prev = Array.from({ length: cards }, (_, i) => i);
  for (let s = 0; s < steps; s++) {
    const next = [...prev];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    // A shuffle can land where it started; swap two cards so something always moves.
    if (cards > 1 && next.every((v, i) => v === prev[i])) {
      const a = Math.floor(rng() * cards);
      const b = (a + 1 + Math.floor(rng() * (cards - 1))) % cards;
      [next[a], next[b]] = [next[b], next[a]];
    }
    frames.push(next);
    prev = next;
  }
  return frames;
}

export interface Note {
  /** Pitch in hertz. */
  readonly hz: number;
  /** Start, in seconds from the first note. */
  readonly at: number;
  /** Length in seconds. */
  readonly len: number;
}

const BEAT = 0.2;
const [E, G, C, D] = [659.25, 783.99, 523.25, 587.33];

/** The jingle, as [pitch, beats]. Generated with Web Audio, so there's no file to fetch. */
const TUNE: readonly (readonly [number, number])[] = [
  [E, 1], [E, 1], [E, 2],
  [E, 1], [E, 1], [E, 2],
  [E, 1], [G, 1], [C, 1], [D, 1], [E, 2.5],
];

/** The opening of Jingle Bells, slightly detached so repeated notes are heard as separate. */
export const JINGLE: readonly Note[] = (() => {
  let at = 0;
  return TUNE.map(([hz, beats]) => {
    const note = { hz, at: Math.round(at * 1000) / 1000, len: beats * BEAT * 0.85 };
    at += beats * BEAT;
    return note;
  });
})();
