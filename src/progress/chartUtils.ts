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
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  // Halo-ringed markers: a white ring keeps the dot crisp against gridlines/fills.
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
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
  // Right-aligned: data series generally start near their baseline at the
  // left edge, so anchoring labels to the right avoids sitting on top of it.
  const textWidth = ctx.measureText(label).width;
  ctx.fillText(label, xEnd - textWidth - 4, y - 2);
  ctx.restore();
}

/** Light horizontal gridlines with left-aligned value labels, drawn behind the
 * data so the y-axis has a readable scale instead of a bare line. */
export function drawYGrid(
  ctx: CanvasRenderingContext2D,
  margin: ChartMargin,
  width: number,
  ticks: { y: number; label: string }[],
): void {
  ctx.save();
  ctx.font = '10px system-ui';
  ctx.textBaseline = 'middle';
  for (const { y, label } of ticks) {
    ctx.strokeStyle = '#F3F4F6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(label, 2, y);
  }
  ctx.restore();
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Draws up to `count` evenly time-spaced date labels along a chart's x-axis.
 * Used once real dates (not array index) determine point spacing, so a
 * "first/last date" footer alone would misrepresent irregular gaps. */
export function drawDateTicks(
  ctx: CanvasRenderingContext2D,
  domain: [number, number],
  range: [number, number],
  y: number,
  count = 4,
): void {
  const [d0, d1] = domain;
  ctx.save();
  ctx.fillStyle = '#6B7280';
  ctx.font = '10px system-ui';
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const value = d0 + t * (d1 - d0);
    const x = scaleLinear(value, domain, range);
    const label = formatShortDate(new Date(value).toISOString());
    const textWidth = ctx.measureText(label).width;
    const clampedX = Math.min(Math.max(x - textWidth / 2, range[0]), range[1] - textWidth);
    ctx.fillText(label, clampedX, y);
  }
  ctx.restore();
}

/** Calendar-day key (local date) for grouping sessions by day. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** [min, max] timestamp (ms) spanned by a set of ISO date strings, for scaling
 * chart x-axes by real elapsed time instead of by array index. */
export function dateDomain(dates: string[]): [number, number] {
  const times = dates.map((d) => new Date(d).getTime());
  return [Math.min(...times), Math.max(...times)];
}

/** Sums durationSeconds (as minutes) per calendar day, keyed by dayKey(). */
export function minutesByDay(sessions: { timestamp: string; durationSeconds: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(new Date(s.timestamp));
    map.set(key, (map.get(key) ?? 0) + s.durationSeconds / 60);
  }
  return map;
}

/** Consecutive-day count ending at `from` (default today) with any logged minutes. */
export function computeStreak(minutesPerDay: Map<string, number>, from: Date = new Date()): number {
  let count = 0;
  const cursor = new Date(from);
  for (;;) {
    const key = dayKey(cursor);
    if ((minutesPerDay.get(key) ?? 0) > 0) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

/** "1h 05m" / "12m" — total duration rendered compactly for summary badges. */
export function formatDurationCompact(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}
