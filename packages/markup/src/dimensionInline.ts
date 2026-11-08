// Added in the leojru/redcolumn fork. A Dimension's text inline, as Revu draws it: centred on the
// dimension line, which is broken around it (a real gap, so the drawing shows through, not a box
// painted over it).
import type { FontFamily } from './style';
import type { Markup, Point } from './model';
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
  return m.type === 'dimension' && m.style.dimText === 'inline' && !!m.text && !m.style.labelRotation;
}

/**
 * The gap the inline text needs along the line, centred on `center`: the text's width with a
 * little room either side.
 */
export function inlineGap(m: Pick<Markup, 'style' | 'text'>): number {
  const size = m.style.fontSize ?? 10;
  return approxTextWidth(m.text ?? '', size, m.style.fontFamily) + size * 0.5;
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
