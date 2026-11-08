import { useEffect, useRef } from "react";

interface Flake {
  x: number;
  y: number;
  r: number;
  speed: number;
  sway: number;
  phase: number;
}

/** Gentle continuous snowfall on a canvas behind the page. Pauses while the tab is hidden. */
export function Snow() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let flakes: Flake[] = [];
    let color = "#fff";
    let raf = 0;
    let last = 0;

    const newFlake = (y: number): Flake => ({
      x: Math.random() * w,
      y,
      r: 1 + Math.random() * 2.4,
      speed: 18 + Math.random() * 40,
      sway: 6 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
    });

    const readColor = () => {
      color = getComputedStyle(document.documentElement).getPropertyValue("--snow").trim() || "#fff";
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(140, Math.round((w * h) / 9000));
      flakes = flakes.slice(0, count);
      while (flakes.length < count) flakes.push(newFlake(Math.random() * h));
    };

    const frame = (t: number) => {
      const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const f of flakes) {
        f.y += f.speed * dt;
        f.phase += dt;
        if (f.y - f.r > h) Object.assign(f, newFlake(-f.r));
        const x = f.x + Math.sin(f.phase) * f.sway;
        ctx.moveTo(x + f.r, f.y);
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    readColor();
    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    scheme.addEventListener("change", readColor);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      scheme.removeEventListener("change", readColor);
    };
  }, []);

  return <canvas ref={ref} className="snow" aria-hidden="true" />;
}
