import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const matches = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

/** True when the visitor asked for reduced motion; follows the setting if it changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
