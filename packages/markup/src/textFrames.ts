// Added in the leojru/redcolumn fork. Shapes drawn around text, as Revu offers them: a box, a circle,
// a triangle or a hexagon. Text boxes and callouts use them as their border (`boxShape`), and a
// Dimension around its text (`dimFrame`, the line breaking where it meets the shape).
import type { PathCmd } from './geometry';
import type { Point, Rect } from './model';

export type TextFrame = 'rect' | 'circle' | 'triangle' | 'hexagon';

export const TEXT_FRAMES: { value: TextFrame; label: string }[] = [
  { value: 'rect', label: 'Box' },
  { value: 'circle', label: 'Circle' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'hexagon', label: 'Hexagon' },
];

/**
 * Where the text fits inside the shape, as fractions of its box: left, right, top, bottom. A circle
 * holds its text in the square inside it; a hexagon (pointed left and right) between its slants; a
 * triangle low down, where it is widest.
 */
const INNER: Record<TextFrame, [number, number, number, number]> = {
  rect: [0, 1, 0, 1],
  circle: [0.146, 0.854, 0.146, 0.854],
  hexagon: [0.2, 0.8, 0.06, 0.94],
  triangle: [0.27, 0.73, 0.48, 0.93],
};

/** The part of a shape's box `b` that text sits in. */
export function frameInner(kind: TextFrame, b: Rect): Rect {
  const [x0, x1, y0, y1] = INNER[kind];
  return { x: b.x + b.w * x0, y: b.y + b.h * y0, w: b.w * (x1 - x0), h: b.h * (y1 - y0) };
}

/** The shape's box that holds text `w` by `h`; a circle stays round. */
export function frameAround(kind: TextFrame, w: number, h: number): { w: number; h: number } {
  const [x0, x1, y0, y1] = INNER[kind];
  if (kind === 'circle') {
    const d = Math.max(w, h) / (x1 - x0);
    return { w: d, h: d };
  }
  return { w: w / (x1 - x0), h: h / (y1 - y0) };
}

/** Where the text's middle sits in the shape's box, as fractions (across, down). */
export function frameTextCentre(kind: TextFrame): [number, number] {
  const [x0, x1, y0, y1] = INNER[kind];
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

/** How wide the shape is `down` (a fraction of its height) from its top: where a line through it meets its sides. */
export function frameWidthAt(kind: TextFrame, w: number, down: number): number {
  const t = Math.min(1, Math.max(0, down));
  switch (kind) {
    case 'rect':
      return w;
    case 'circle':
      return w * 2 * Math.sqrt(Math.max(0, t * (1 - t)));
    case 'hexagon':
      return w * (0.5 + Math.min(t, 1 - t));
    case 'triangle':
      return w * t;
  }
}

const K = 0.5522847498;

/** The shape's outline in box `b`, closed. */
export function framePath(kind: TextFrame, b: Rect): PathCmd[] {
  const { x, y, w, h } = b;
  switch (kind) {
    case 'rect':
      return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
    case 'triangle':
      return [['M', x + w / 2, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
    case 'hexagon':
      return [['M', x + w * 0.25, y], ['L', x + w * 0.75, y], ['L', x + w, y + h / 2], ['L', x + w * 0.75, y + h], ['L', x + w * 0.25, y + h], ['L', x, y + h / 2], ['Z']];
    case 'circle': {
      const [cx, cy, rx, ry] = [x + w / 2, y + h / 2, w / 2, h / 2];
      return [
        ['M', cx + rx, cy],
        ['C', cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry],
        ['C', cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy],
        ['C', cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry],
        ['C', cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy],
        ['Z'],
      ];
    }
  }
}

/** `path` with every point taken through `to` (a turn and move: Béziers stay Béziers). */
export function mapPath(path: readonly PathCmd[], to: (p: Point) => Point): PathCmd[] {
  return path.map((c): PathCmd => {
    if (c[0] === 'Z') return c;
    if (c[0] === 'C') {
      const [a, b, d] = [to([c[1], c[2]]), to([c[3], c[4]]), to([c[5], c[6]])];
      return ['C', a[0], a[1], b[0], b[1], d[0], d[1]];
    }
    const p = to([c[1], c[2]]);
    return [c[0], p[0], p[1]];
  });
}
