import { JINGLE } from "./flair";

/**
 * The jingle, synthesized with Web Audio (no file, no network). Created lazily on the first
 * tap of the speaker toggle, since browsers only allow audio after a user gesture.
 */
export class Jingle {
  private ctx: AudioContext | undefined;
  private out: GainNode | undefined;

  /** Call from a tap handler. */
  async unmute(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    await this.ctx.resume();
  }

  /** Silences anything playing right away. */
  mute(): void {
    this.out?.disconnect();
    this.out = undefined;
    void this.ctx?.suspend();
  }

  play(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    this.out?.disconnect();
    const out = ctx.createGain();
    out.gain.value = 0.18;
    out.connect(ctx.destination);
    this.out = out;
    const t0 = ctx.currentTime + 0.05;
    for (const n of JINGLE) {
      // A soft bell: a sine with a quiet octave above, quick attack, gentle decay.
      for (const [mult, level] of [[1, 1], [2, 0.25]] as const) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = n.hz * mult;
        const start = t0 + n.at;
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(level, start + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, start + n.len);
        osc.connect(env).connect(out);
        osc.start(start);
        osc.stop(start + n.len + 0.02);
      }
    }
  }
}
