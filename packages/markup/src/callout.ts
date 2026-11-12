// Modified in the leojru/redcolumn fork: a callout's leader keeps its place on the box as the box changes (refitCalloutKnees) and turns to face its tip as the box is dragged past it (kneesFacingTips).
import type { Point, Rect } from './model';

export type CalloutSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * How a leader lands on the text box: it always meets a left or right side head-on (horizontal) or the
 * top or bottom head-on (vertical), never at an angle. The side is the one the knee sits furthest
 * beyond; `knee` is the knee slid along that side's line so the final stretch is straight, and
 * `attach` is where it touches the box. A knee inside the box lands on the top or bottom middle.
 */
export function calloutLanding(knee: Point, box: Rect): { side: CalloutSide; knee: Point; attach: Point } {
  const right = box.x + box.w;
  const bottom = box.y + box.h;
  const dx = Math.max(box.x - knee[0], knee[0] - right, 0);
  const dy = Math.max(box.y - knee[1], knee[1] - bottom, 0);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  if (dx > 0 && dx >= dy) {
    const y = clamp(knee[1], box.y, bottom);
    const side = knee[0] < box.x ? 'left' : 'right';
    return { side, knee: [knee[0], y], attach: [side === 'left' ? box.x : right, y] };
  }
  if (dy > 0) {
    const x = clamp(knee[0], box.x, right);
    const side = knee[1] < box.y ? 'top' : 'bottom';
    return { side, knee: [x, knee[1]], attach: [x, side === 'top' ? box.y : bottom] };
  }
  // A knee on the box's own edge (a two-point leader that ends there, as Bluebeam writes) lands where it is.
  const eps = 0.01;
  if (knee[0] >= box.x - eps && knee[0] <= right + eps && knee[1] >= box.y - eps && knee[1] <= bottom + eps) {
    const onLeft = Math.abs(knee[0] - box.x) <= eps;
    const onRight = Math.abs(knee[0] - right) <= eps;
    const onTop = Math.abs(knee[1] - box.y) <= eps;
    const onBottom = Math.abs(knee[1] - bottom) <= eps;
    if (onLeft || onRight) {
      const y = clamp(knee[1], box.y, bottom);
      return { side: onLeft ? 'left' : 'right', knee: [knee[0], y], attach: [onLeft ? box.x : right, y] };
    }
    if (onTop || onBottom) {
      const x = clamp(knee[0], box.x, right);
      return { side: onTop ? 'top' : 'bottom', knee: [x, knee[1]], attach: [x, onTop ? box.y : bottom] };
    }
  }
  const cx = box.x + box.w / 2;
  const top = knee[1] < box.y + box.h / 2;
  return { side: top ? 'top' : 'bottom', knee: [cx, knee[1]], attach: [cx, top ? box.y : bottom] };
}

/** Where a callout's leader meets its box (see `calloutLanding`). */
export function calloutAttach(knee: Point, box: Rect): Point {
  return calloutLanding(knee, box).attach;
}

/**
 * A callout's points for an arrow at `tip` and a box of `w` × `h` whose near side sits at `at`:
 * [tip, knee, box corner, opposite box corner]. The knee makes a short horizontal landing of
 * `landing` points before the box, on the side facing the tip.
 */
export function calloutPoints(tip: Point, at: Point, w: number, h: number, landing: number): Point[] {
  const right = at[0] >= tip[0];
  const knee: Point = [at[0] + (right ? -landing : landing), at[1]];
  const x0 = right ? at[0] : at[0] - w;
  return [tip, knee, [x0, at[1] - h / 2], [x0 + w, at[1] + h / 2]];
}

/**
 * Fork (leojru/redcolumn): a callout's `points` with its knees carried along as its box goes from
 * `from` to `to`: each stays at the same share along the side it lands on (a centred leader stays
 * centred) with its landing the same length. Tips stay put; a knee beyond the side's ends is left.
 */
export function refitCalloutKnees(points: readonly Point[], from: Rect, to: Rect): Point[] {
  const along = (v: number, a0: number, len0: number, a1: number, len1: number) => (len0 > 0 && v >= a0 && v <= a0 + len0 ? a1 + ((v - a0) / len0) * len1 : v);
  return points.map((p, i): Point => {
    if (i !== 1 && (i < 5 || i % 2 === 0)) return p;
    const side = calloutLanding(p, from).side;
    if (side === 'left') return [p[0] + to.x - from.x, along(p[1], from.y, from.h, to.y, to.h)];
    if (side === 'right') return [p[0] + to.x + to.w - from.x - from.w, along(p[1], from.y, from.h, to.y, to.h)];
    if (side === 'top') return [along(p[0], from.x, from.w, to.x, to.w), p[1] + to.y - from.y];
    return [along(p[0], from.x, from.w, to.x, to.w), p[1] + to.y + to.h - from.y - from.h];
  });
}

/**
 * Fork (leojru/redcolumn): a callout's `points` with each leader landing on the side of the box that
 * faces its tip (left or right when the tip is more to the side, top or bottom when it is more above or
 * below), once the tip is far enough past that side to leave room for the landing. The landing keeps
 * its length; it keeps its place along the side when it stays on the same pair of sides, and otherwise
 * lines up with the tip. A tip over the box leaves the leader alone.
 */
export function kneesFacingTips(points: readonly Point[]): Point[] {
  if (points.length < 4) return [...points];
  const [a, b] = [points[2]!, points[3]!];
  const box: Rect = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
  const right = box.x + box.w;
  const bottom = box.y + box.h;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return points.map((knee, i): Point => {
    if (i !== 1 && (i < 5 || i % 2 === 0)) return knee;
    const tip = points[i - 1]!;
    const dx = Math.max(box.x - tip[0], tip[0] - right, 0);
    const dy = Math.max(box.y - tip[1], tip[1] - bottom, 0);
    if (dx === 0 && dy === 0) return knee;
    const want: CalloutSide = dx >= dy ? (tip[0] < box.x ? 'left' : 'right') : tip[1] < box.y ? 'top' : 'bottom';
    const { side, attach } = calloutLanding(knee, box);
    if (side === want) return knee;
    // How far out the landing runs, and whether the tip leaves room for it on the facing side.
    const landing = Math.hypot(knee[0] - attach[0], knee[1] - attach[1]);
    const gap = want === 'left' ? box.x - tip[0] : want === 'right' ? tip[0] - right : want === 'top' ? box.y - tip[1] : tip[1] - bottom;
    if (gap < landing) return knee;
    const sideways = (v: CalloutSide) => v === 'left' || v === 'right';
    if (sideways(want)) {
      const y = clamp(sideways(side) ? knee[1] : tip[1], box.y, bottom);
      return [want === 'left' ? box.x - landing : right + landing, y];
    }
    const x = clamp(sideways(side) ? tip[0] : knee[0], box.x, right);
    return [x, want === 'top' ? box.y - landing : bottom + landing];
  });
}

/**
 * A callout's leaders as [tip, knee] pairs. The first leader is points 0-1; any others follow the
 * box corners (points 2-3) as further tip and knee points.
 */
export function calloutLeaders(points: readonly Point[]): [Point, Point][] {
  const out: [Point, Point][] = points.length >= 2 ? [[points[0]!, points[1]!]] : [];
  for (let i = 4; i + 1 < points.length; i += 2) out.push([points[i]!, points[i + 1]!]);
  return out;
}

/** True for the points of a callout that are an arrow tip (they stay put when the text box moves). */
export function isCalloutTip(index: number): boolean {
  return index === 0 || (index >= 4 && index % 2 === 0);
}

/**
 * Fork (leojru/redcolumn): the point on a cloud's outline nearest `from`. `cloud` is the cloud's points:
 * two corners of a box, or the corners of a polygon. A Cloud+'s leader tip stays on this outline.
 */
export function nearestOnOutline(cloud: readonly Point[], from: Point): Point {
  const corners: Point[] =
    cloud.length === 2
      ? (() => {
          const [a, b] = [cloud[0]!, cloud[1]!];
          const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
          const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
          return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        })()
      : cloud.map((p): Point => [p[0], p[1]]);
  let best: Point = corners[0] ?? from;
  let bestD = Infinity;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.min(1, Math.max(0, ((from[0] - a[0]) * dx + (from[1] - a[1]) * dy) / len2)) : 0;
    const q: Point = [a[0] + t * dx, a[1] + t * dy];
    const d = Math.hypot(q[0] - from[0], q[1] - from[1]);
    if (d < bestD) {
      best = q;
      bestD = d;
    }
  }
  return best;
}
