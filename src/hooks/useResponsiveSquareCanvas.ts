import { useEffect, useRef, useState } from 'react';

/**
 * Sizes a square canvas to exactly match a measured wrapper element's
 * rendered width, so the canvas's pixel buffer (its width/height attributes)
 * and its displayed CSS size are always identical. Any mismatch between the
 * two forces the browser to resample the bitmap to fit, which for a
 * hard-edged red/cyan anaglyph image shows up as visible color bleeding
 * across pixel boundaries — hence measuring rather than guessing.
 *
 * Bind `containerRef` to a wrapper with `relative aspect-square w-full` (the
 * `aspect-square` is load-bearing: it forces the wrapper's height from pure
 * CSS, independent of the canvas's own width/height attributes, so there's
 * no circular sizing dependency to get stuck on) and render the canvas
 * inside it with `absolute inset-0 h-full w-full`, width={size} height={size}.
 *
 * Stimuli drawn onto the canvas stay sized in real degrees via
 * useViewingCalibration's degToPx — a bigger canvas just reveals more of
 * that calibrated field, it doesn't change how big anything drawn onto it
 * really is.
 */
export function useResponsiveSquareCanvas(minPx = 240, maxPx = 640) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(minPx);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (!width) return;
      setSize(Math.round(Math.min(maxPx, Math.max(minPx, width))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minPx, maxPx]);

  return { containerRef, size };
}
