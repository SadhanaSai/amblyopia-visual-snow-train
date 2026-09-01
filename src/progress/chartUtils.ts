/** Small shared canvas chart helpers — no charting library, per spec. */

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGIN: ChartMargin = { top: 16, right: 16, bottom: 24, left: 44 };

export function scaleLinear(value: number, domain: [number, number], range: [number, number]): number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 === d0) return (r0 + r1) / 2;
  const t = (value - d0) / (d1 - d0);
  return r0 + t * (r1 - r0);
}

export function drawAxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: ChartMargin,
): void {
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, height - margin.bottom);
  ctx.lineTo(width - margin.right, height - margin.bottom);
  ctx.stroke();
}

export interface Point {
  x: number;
  y: number;
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  dashed = false,
): void {
  if (points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.restore();
}

export function drawShadedArea(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  baselineY: number,
  color: string,
): void {
  if (points.length === 0) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0].x, baselineY);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, baselineY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawGapArea(
  ctx: CanvasRenderingContext2D,
  upper: Point[],
  lower: Point[],
  color: string,
): void {
  if (upper.length === 0 || lower.length === 0 || upper.length !== lower.length) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  upper.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i].x, lower[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  xStart: number,
  xEnd: number,
  color: string,
  label: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(xStart, y);
  ctx.lineTo(xEnd, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = '10px system-ui';
  ctx.fillText(label, xStart + 4, y - 2);
  ctx.restore();
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
