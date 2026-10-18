import { useEffect, useState } from "react";

// Anima un número de 0 al valor final; respeta prefers-reduced-motion.
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (!Number.isFinite(target) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}
