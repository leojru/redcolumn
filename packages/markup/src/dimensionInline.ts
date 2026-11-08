// Added in the leojru/redcolumn fork. A Dimension's text inline, as Revu draws it: centred on the
// dimension line, which is broken around it (a real gap, so the drawing shows through, not a box
// painted over it).
import type { FontFamily } from './style';
import { dimensionLine, type Markup, type Point } from './model';
import type { PathCmd } from './geometry';

// Helvetica's advance widths (thousandths of an em) for printable ASCII, from its AFM.
// prettier-ignore
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** The width of `text` at `size` points in the PDF standard font for `family` (close enough to break a line around). */
export function approxTextWidth(text: string, size: number, family: FontFamily = 'sans'): number {
  if (family === 'mono') return text.length * 0.6 * size;
  let units = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    units += c >= 32 && c <= 126 ? HELVETICA[c - 32]! : 556;
  }
  // Times runs a little narrower than Helvetica.
  return (units / 1000) * size * (family === 'serif' ? 0.9 : 1);
}

/** Whether a Dimension's text sits inline (on the line, which breaks around it) rather than above it. */
export function dimensionInline(m: Pick<Markup, 'type' | 'style' | 'text'>): boolean {
  return m.type === 'dimension' && m.style.dimText === 'inline' && !!m.text && !m.style.labelRotation && !m.style.labelLift;
}

/**
 * A Length's or Dimension's reading frame: along its line kept reading left to right (`r`), and up
 * the text (`u`, its left-hand normal); `foot`, where its text sits on the line.
 */
export function readingFrame(m: Markup): { r: Point; u: Point; foot: Point } | null {
  const line = dimensionLine(m);
  if (!line) return null;
  const flip = line.dir[0] < 0 ? -1 : 1;
  const r: Point = [line.dir[0] * flip, line.dir[1] * flip];
  return { r, u: [r[1], -r[0]], foot: line.text };
}

/**
 * Where text dragged off a Length's or Dimension's line is centred: `labelLift` up the text from its
 * foot on the line and `labelShift` along it. Null while it sits on the line.
 */
export function liftedCenter(m: Markup): Point | null {
  const lift = m.style.labelLift ?? 0;
  const f = Math.abs(lift) > 1e-6 ? readingFrame(m) : null;
  if (!f) return null;
  const shift = m.style.labelShift ?? 0;
  return [f.foot[0] + f.u[0] * lift + f.r[0] * shift, f.foot[1] + f.u[1] * lift + f.r[1] * shift];
}

/**
 * The leader to text off the line (`w` by `h`, centred at `center`), as Revu draws it: square off the
 * line from the foot, then along to the text's near end at its middle; with the text over the foot,
 * straight up (or down) to its edge.
 */
export function liftLeader(m: Markup, center: Point, w: number, h: number): Point[] | null {
  const f = readingFrame(m);
  const lift = m.style.labelLift ?? 0;
  if (!f || !lift) return null;
  const size = m.style.fontSize ?? 10;
  const shift = m.style.labelShift ?? 0;
  const up = (d: number): Point => [f.foot[0] + f.u[0] * d, f.foot[1] + f.u[1] * d];
  const sign = Math.sign(lift);
  if (Math.abs(shift) <= w / 2) {
    const reach = lift - sign * (h / 2 + size * 0.15);
    return Math.sign(reach) === sign ? [f.foot, up(reach)] : null;
  }
  const end = center;
  const side = Math.sign(shift);
  const near: Point = [end[0] - f.r[0] * side * (w / 2 + size * 0.2), end[1] - f.r[1] * side * (w / 2 + size * 0.2)];
  return [f.foot, up(lift), near];
}

/** Line spacing of a Dimension's text, as a multiple of its size. */
export const DIM_LINE_HEIGHT = 1.2;

/**
 * Where a Dimension's text goes, one or more lines (Shift+Enter): each line's baseline point (its
 * centre, or with `align` left its start), turned `angle` radians (clockwise in page space).
 * - Inline: the lines centred on the dimension line, which breaks `gap` long around them.
 * - Above: the last line's baseline just above the line (turned by any text turn about there).
 * - Lifted (`labelLift`, dragged off the line): a leader runs square off the line to the text, which
 *   starts just past its elbow, as Revu draws it.
 * `knob` is where the text is dragged from; `box` the text's extent (centre, width, height).
 */
export interface DimensionLayout {
  lines: { text: string; at: Point }[];
  align: 'center' | 'left';
  angle: number;
  size: number;
  inline: boolean;
  gap: number | null;
  leader: Point[] | null;
  knob: Point;
  box: { center: Point; w: number; h: number };
}

export function dimensionLayout(m: Markup): DimensionLayout | null {
  if (m.type !== 'dimension' || !m.text || m.points.length < 2) return null;
  const line = dimensionLine(m);
  if (!line) return null;
  const [a, b] = [m.points[0]!, m.points[m.points.length - 1]!];
  let base = Math.atan2(b[1] - a[1], b[0] - a[0]);
  if (base > Math.PI / 2) base -= Math.PI;
  else if (base < -Math.PI / 2) base += Math.PI;
  const size = m.style.fontSize ?? 10;
  const lh = size * DIM_LINE_HEIGHT;
  const texts = m.text.split('\n');
  const n = texts.length;
  const w = Math.max(...texts.map((t) => approxTextWidth(t, size, m.style.fontFamily)));
  const h = n * lh;
  const lift = m.style.labelLift ?? 0;
  const lifted = Math.abs(lift) > 1e-6;
  const inline = dimensionInline(m);
  const angle = inline || lifted ? base : base + ((m.style.labelRotation ?? 0) * Math.PI) / 180;
  // Along the text and up it (its left-hand normal), in page space; and the same unturned.
  const r: Point = [Math.cos(angle), Math.sin(angle)];
  const u: Point = [Math.sin(angle), -Math.cos(angle)];
  const u0: Point = [Math.sin(base), -Math.cos(base)];
  const at = (o: Point, along: number, up: number): Point => [o[0] + r[0] * along + u[0] * up, o[1] + r[1] * along + u[1] * up];
  const p = line.text;
  // A baseline half a capital below a line's middle centres the capitals on it.
  const cap = size * 0.36;
  const middle = (i: number) => h / 2 - lh * (i + 0.5) - cap;
  if (lifted) {
    // Centred where it was dragged to, the leader from the foot (on the line) grows to it.
    const center = liftedCenter(m)!;
    return {
      lines: texts.map((text, i) => ({ text, at: at(center, 0, middle(i)) })),
      align: 'center',
      angle,
      size,
      inline: false,
      gap: null,
      leader: liftLeader(m, center, w, h),
      // Just off the text on the line's side, so it covers none of it.
      knob: at(center, 0, -Math.sign(lift) * (h / 2 + size * 0.45)),
      box: { center, w, h },
    };
  }
  if (inline) {
    // The knob at the text's start, in the gap, so it does not cover the text.
    return { lines: texts.map((text, i) => ({ text, at: at(p, 0, middle(i)) })), align: 'center', angle, size, inline: true, gap: w + size * 0.5, leader: null, knob: at(p, -(w / 2 + size * 0.25), 0), box: { center: p, w, h } };
  }
  // Above: as before, the text's foot just over the line (a turned text turns about there).
  const off = size * 0.35 + m.style.width;
  const foot: Point = [p[0] + u0[0] * off, p[1] + u0[1] * off];
  const descent = size * 0.2;
  return {
    lines: texts.map((text, i) => ({ text, at: at(foot, 0, descent + lh * (n - 1 - i)) })),
    align: 'center',
    angle,
    size,
    inline: false,
    gap: null,
    leader: null,
    knob: at(foot, 0, size * 0.4),
    box: { center: at(foot, 0, h / 2), w, h },
  };
}

/**
 * A straight segment (a path of one move and one line) with the stretch `gap` long centred on
 * `center` (measured along `dir`) taken out: zero, one or two segments.
 */
export function cutSegment(path: readonly PathCmd[], center: Point, dir: Point, gap: number): PathCmd[][] | null {
  const [m0, l1] = path;
  if (path.length !== 2 || m0?.[0] !== 'M' || l1?.[0] !== 'L') return null;
  const p: Point = [m0[1], m0[2]];
  const q: Point = [l1[1], l1[2]];
  const along = (r: Point) => (r[0] - center[0]) * dir[0] + (r[1] - center[1]) * dir[1];
  const [sp, sq] = [along(p), along(q)];
  const half = gap / 2;
  const lo = Math.min(sp, sq);
  const hi = Math.max(sp, sq);
  if (hi <= -half || lo >= half) return [[...path]];
  const at = (s: number): Point => {
    const t = (s - sp) / (sq - sp || 1);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
  const out: PathCmd[][] = [];
  const keep = (s0: number, s1: number) => {
    if (s1 - s0 <= 1e-6) return;
    const [a, b] = [at(s0), at(s1)];
    out.push([['M', a[0], a[1]], ['L', b[0], b[1]]]);
  };
  keep(lo, Math.min(hi, -half));
  keep(Math.max(lo, half), hi);
  return out;
}

/**
 * A Length's label box when its line breaks around the label instead of a white box being painted
 * behind it: with the label background left at its default. `label` is from `measurementLabel`.
 */
export function lengthLabelBox(m: Markup, label: { lines: readonly string[]; at: Point; angle: number } | null): { center: Point; w: number; h: number; angle: number } | null {
  if (m.type !== 'length' || !label || m.style.labelBackground !== undefined) return null;
  const size = m.style.fontSize ?? 10;
  // Labels are bold: a little wider than the regular widths.
  const w = Math.max(...label.lines.map((l) => approxTextWidth(l, size, m.style.fontFamily) * 1.05)) + size * 0.6;
  const h = label.lines.length * size * 1.2 + size * 0.2;
  return { center: label.at, w, h, angle: label.angle };
}

/** Fork: the leader to a Length's label dragged off its line (its box estimated as `lengthLabelBox` does). */
export function lengthLeader(m: Markup, label: { lines: readonly string[]; at: Point } | null): Point[] | null {
  if (m.type !== 'length' || !label || !m.style.labelLift) return null;
  const size = m.style.fontSize ?? 10;
  const w = Math.max(...label.lines.map((l) => approxTextWidth(l, size, m.style.fontFamily) * 1.05)) + size * 0.6;
  const h = label.lines.length * size * 1.2 + size * 0.2;
  return liftLeader(m, label.at, w, h);
}

/** The straight, undecorated strokes of `parts` with what lies inside the box (turned `angle`) taken out. */
export function breakAroundBox<T extends { path: PathCmd[]; stroke: boolean; fill: string | null; decoration?: boolean }>(parts: T[], box: { center: Point; w: number; h: number; angle: number }): T[] {
  const [cos, sin] = [Math.cos(box.angle), Math.sin(box.angle)];
  // Into the box's own frame: x along it, y across, from its centre.
  const local = (x: number, y: number): Point => {
    const [dx, dy] = [x - box.center[0], y - box.center[1]];
    return [dx * cos + dy * sin, -dx * sin + dy * cos];
  };
  return parts.flatMap((part) => {
    const [m0, l1] = part.path;
    if (part.decoration || !part.stroke || part.fill || part.path.length !== 2 || m0?.[0] !== 'M' || l1?.[0] !== 'L') return [part];
    const p = local(m0[1], m0[2]);
    const q = local(l1[1], l1[2]);
    // The stretch of the segment (0..1) inside the box (Liang-Barsky).
    let t0 = 0;
    let t1 = 1;
    const d: Point = [q[0] - p[0], q[1] - p[1]];
    for (const [pk, qk] of [
      [-d[0], p[0] + box.w / 2],
      [d[0], box.w / 2 - p[0]],
      [-d[1], p[1] + box.h / 2],
      [d[1], box.h / 2 - p[1]],
    ] as const) {
      if (pk === 0) {
        if (qk < 0) return [part];
        continue;
      }
      const r = qk / pk;
      if (pk < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
    if (t0 >= t1) return [part];
    const at = (t: number): Point => [m0[1] + (l1[1] - m0[1]) * t, m0[2] + (l1[2] - m0[2]) * t];
    const out: T[] = [];
    for (const [a, b] of [
      [0, t0],
      [t1, 1],
    ] as const) {
      if (b - a <= 1e-6) continue;
      const [s, e] = [at(a), at(b)];
      out.push({ ...part, path: [['M', s[0], s[1]], ['L', e[0], e[1]]] });
    }
    return out;
  });
}

/** A leader as a shape part: a plain solid line (never dashed). */
export function leaderPart(points: readonly Point[]): { path: PathCmd[]; stroke: boolean; fill: null; decoration: boolean } {
  return { path: points.map((p, i): PathCmd => [i ? 'L' : 'M', p[0], p[1]]), stroke: true, fill: null, decoration: true };
}
