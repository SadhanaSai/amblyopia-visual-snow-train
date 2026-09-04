import { useEffect, useRef, useState } from 'react';

/**
 * Measures a container's real CSS-px width. Stimuli whose on-screen offset
 * comes from useViewingCalibration's degToPx (a real calibrated CSS-px
 * value, not a fraction of some abstract drawing-surface size) must be
 * positioned inside a coordinate space that actually equals the container's
 * real pixel width — otherwise a large-eccentricity offset silently lands
 * outside a smaller, unrelated viewBox and never appears.
 *
 * Deliberately re-measures only on window `resize` (not via ResizeObserver
 * on the container itself): this component's own conditional content (e.g.
 * a fitting-eccentricity list vs. a "window too narrow" message) changes
 * height depending on the very width value being measured, and observing
 * the container directly turned that into a permanent feedback loop
 * (width flipping between two values on every layout pass). `resize` only
 * fires for genuine window/viewport changes, which is what real screen
 * fit needs to react to anyway.
 */
export function useResponsiveWidth(minPx = 240) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(minPx);

  useEffect(() => {
    function measure() {
      const el = containerRef.current;
      if (!el) return;
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.max(minPx, Math.round(w)));
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [minPx]);

  return { containerRef, width };
}
