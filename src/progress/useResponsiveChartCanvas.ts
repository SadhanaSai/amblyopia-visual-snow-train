import { useEffect, useRef, useState } from 'react';

/** Sizes a chart's canvas backing buffer to its actual rendered CSS width
 * (via ResizeObserver) times devicePixelRatio, instead of a fixed pixel
 * constant stretched by CSS — otherwise the browser upscales a low-res
 * bitmap to fill the container, which is what made these charts look
 * blurry/pixelated on anything wider or higher-DPI than the original fixed
 * canvas size. `height` stays fixed (only width needs to track layout);
 * draw effects should use the returned `width`/`height` in CSS-pixel
 * coordinates — the transform applied here handles the DPR scaling. */
export function useResponsiveChartCanvas(height: number, initialWidth = 640) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [width, height]);

  return { containerRef, canvasRef, width, height };
}
