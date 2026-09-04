import { useState, type MouseEvent, type RefObject } from 'react';

export interface TooltipPoint {
  /** Logical CSS-pixel coordinates (the chart's current `width`/`height`, not the DPR-scaled buffer). */
  x: number;
  y: number;
  label: string;
  value: string;
}

/** Finds the nearest chart point to the mouse (by x) on hover, for a
 * lightweight canvas tooltip. `logicalWidth` must match the CSS width the
 * chart is currently rendered at (from useResponsiveChartCanvas) so mouse
 * coordinates map onto the same space the points were computed in. */
export function useChartTooltip(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  points: TooltipPoint[],
  logicalWidth: number,
) {
  const [hover, setHover] = useState<TooltipPoint | null>(null);

  function handleMouseMove(e: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * logicalWidth;
    let nearest = points[0];
    let minDist = Math.abs(points[0].x - mouseX);
    for (const p of points) {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    setHover(nearest);
  }

  function handleMouseLeave() {
    setHover(null);
  }

  return { hover, handleMouseMove, handleMouseLeave };
}
