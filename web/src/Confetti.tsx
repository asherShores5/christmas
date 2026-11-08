import { useEffect, useRef } from "react";
import { fitToWindow } from "./canvas";

const COLORS = ["#d62828", "#2a9d5c", "#f4c430", "#ffffff", "#e76f51", "#4ea8de"];
const DURATION = 3.2;
const FADE = 0.9;
const GRAVITY = 520;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  angle: number;
  spin: number;
  color: string;
}

/** One confetti burst over the page each time `burst` changes to a new non-zero value. */
export function Confetti({ burst }: { burst: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!burst || !canvas || !ctx) return;

    const { w, h } = fitToWindow(canvas, ctx);

    // Two cannons low on either side of the content column, aimed up and in.
    const spread = Math.min(w * 0.42, 340);
    const pieces: Piece[] = Array.from({ length: 140 }, (_, i) => {
      const left = i % 2 === 0;
      const tilt = 0.2 + Math.random() * 0.5; // radians off vertical, toward the middle
      const angle = -Math.PI / 2 + (left ? tilt : -tilt);
      const speed = 1.2 * h * (0.55 + Math.random() * 0.45);
      return {
        x: w / 2 + (left ? -spread : spread),
        y: h * 0.85,
        vx: Math.cos(angle) * speed * 0.6,
        vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 5,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 12,
        color: COLORS[Math.floor(i / 2) % COLORS.length],
      };
    });

    let raf = 0;
    let start = 0;
    let last = 0;
    const frame = (t: number) => {
      if (!start) start = last = t;
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const age = (t - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      if (age > DURATION) return;
      ctx.globalAlpha = Math.min(1, (DURATION - age) / FADE);
      for (const p of pieces) {
        p.vy += GRAVITY * dt;
        p.vx *= 1 - 0.9 * dt;
        p.vy *= 1 - 0.4 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.angle * 1.7)) + 1);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, [burst]);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
