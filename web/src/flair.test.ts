import { describe, expect, it } from "vitest";
import { JINGLE, shuffleFrames } from "./flair";

/** A fixed sequence standing in for Math.random, so frames are repeatable in tests. */
const fixedRng = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("JINGLE", () => {
  it("plays the Jingle Bells opening: E E E, E E E, E G C D E", () => {
    const E = 659.25, G = 783.99, C = 523.25, D = 587.33;
    expect(JINGLE.map((n) => n.hz)).toEqual([E, E, E, E, E, E, E, G, C, D, E]);
  });

  it("plays one note at a time and is over within three seconds", () => {
    for (let i = 1; i < JINGLE.length; i++) {
      expect(JINGLE[i].at).toBeGreaterThanOrEqual(JINGLE[i - 1].at + JINGLE[i - 1].len);
    }
    const last = JINGLE[JINGLE.length - 1];
    expect(last.at + last.len).toBeLessThanOrEqual(3);
  });
});

describe("shuffleFrames", () => {
  it("gives each card a distinct slot in every frame", () => {
    const frames = shuffleFrames(4, 6, Math.random);
    expect(frames).toHaveLength(6);
    for (const f of frames) expect([...f].sort()).toEqual([0, 1, 2, 3]);
  });

  it("moves at least one card between consecutive frames, starting from the dealt order", () => {
    const frames = shuffleFrames(4, 8, fixedRng([0]));
    let prev = [0, 1, 2, 3];
    for (const f of frames) {
      expect(f).not.toEqual(prev);
      prev = [...f];
    }
  });
});
