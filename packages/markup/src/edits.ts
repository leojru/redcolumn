// Modified in the leojru/redcolumn fork: auto-size fits a text box's border shape around its text, with even room on every side; resizing keeps the text showing (keepTextInBox).
import { frameAroundText } from './textFrames';
import { boundsOf, contentBox, flagTip, isTextType, type Markup, type MarkupStyle, type Point } from './model';
import { textLineHeight, textPadding } from './geometry';
import { TYPE_INFO } from './types';
import { refitCalloutKnees } from './callout';
import { fontKeyword } from './fonts';
import { TEXT_INK_METRICS } from './render';
import { layoutParagraphs } from './textLists';

// ---- Change Colours -------------------------------------------------------------------------------

/** The colours markups are drawn in (line, fill and text), each once, as lower-case hex. */
export function markupColours(ms: readonly Markup[]): string[] {
  const out = new Set<string>();
  for (const m of ms) for (const c of [m.style.stroke, m.style.fill, m.style.textColor]) if (c) out.add(c.toLowerCase());
  return [...out];
}

/** A style with each colour in `map` (lower-case hex → new colour) replaced, or null when none applies. */
export function recolouredStyle(style: MarkupStyle, map: Readonly<Record<string, string>>): MarkupStyle | null {
  const swap = (c: string | null | undefined) => (c ? map[c.toLowerCase()] : undefined);
  const stroke = swap(style.stroke);
  const fill = swap(style.fill);
  const text = swap(style.textColor);
  if (!stroke && !fill && !text) return null;
  return { ...style, ...(stroke ? { stroke } : {}), ...(fill ? { fill } : {}), ...(text ? { textColor: text } : {}) };
}

// ---- Round All Corners ----------------------------------------------------------------------------

/** Markups whose corners can be rounded. */
export function canRoundCorners(m: Pick<Markup, 'type'>): boolean {
  return m.type === 'rect' || m.type === 'polygon' || m.type === 'polyline';
}

/** A corner radius that suits a markup: a tenth of its smaller side, within 2 to 24 points. */
export function defaultCornerRadius(m: Pick<Markup, 'points'>): number {
  const b = boundsOf(m.points);
  return Math.round(Math.max(2, Math.min(24, Math.min(b.w, b.h) / 10)) * 10) / 10;
}

// ---- Auto-size Text Box ---------------------------------------------------------------------------

/** Text boxes that Auto-size can fit to their text. */
export function canAutoSize(m: Pick<Markup, 'type' | 'text'>): boolean {
  // A flowchart shape keeps its size: the text is laid out in it.
  return isTextType(m.type) && m.type !== 'typewriter' && m.type !== 'flowShape' && !!m.text;
}

/**
 * Fork (leojru/redcolumn): how tall `lines` of text are from the first line's capitals to the last
 * baseline with its padding, room left for the tails of large letters on the last line.
 */
function textBlockHeight(m: Pick<Markup, 'style'>, lines: readonly string[]): number {
  const size = m.style.fontSize ?? 12;
  const pad = textPadding(m.style);
  const fm = TEXT_INK_METRICS[fontKeyword(m.style.fontFamily)];
  const tails = /[gjpqyQ,;()[\]{}_|@$]/.test(lines[lines.length - 1] ?? '');
  const below = tails ? Math.max(pad, fm.descent * size + 1) : pad;
  return Math.max(0, lines.length - 1) * size * textLineHeight(m.style) + fm.cap * size + pad + below;
}

/**
 * Fork (leojru/redcolumn): the `points` a text box or callout was just resized to, grown as needed so
 * its text keeps showing: no narrower than its longest word, and tall enough for the text as it wraps
 * at that width. The edge that was not dragged stays put.
 */
export function keepTextInBox(m: Markup, points: Point[], measure: (s: string) => number): Point[] {
  if ((m.type !== 'text' && m.type !== 'callout') || !m.text) return points;
  const callout = m.type === 'callout';
  if (callout && points.length < 4) return points;
  const boxOf = (p: readonly Point[]) => boundsOf(callout ? p.slice(2, 4) : p);
  const from = boxOf(m.points);
  const b = boxOf(points);
  if (b.x === from.x && b.y === from.y && b.w === from.w && b.h === from.h) return points;
  // The share of the box its text may use (less inside a border shape).
  const share = contentBox({ type: 'text', points: [[0, 0], [1, 1]], style: m.style });
  const pad = textPadding(m.style);
  const word = Math.max(0, ...m.text.split(/\s+/).map((t) => measure(t)));
  const w = Math.max(b.w, (word + pad * 2 + 0.5) / share.w);
  const lines = layoutParagraphs(m.text, w * share.w - pad * 2, measure).map((l) => l.text);
  const h = Math.max(b.h, textBlockHeight(m, lines) / share.h);
  if (w === b.w && h === b.h) return points;
  const x = b.x !== from.x ? b.x + b.w - w : b.x;
  const y = b.y !== from.y ? b.y + b.h - h : b.y;
  const grown: [Point, Point] = [[x, y], [x + w, y + h]];
  return callout ? [...points.slice(0, 2), ...grown, ...points.slice(4)] : grown;
}

/**
 * The points of a text box resized to fit its text exactly: as wide as its longest line (no
 * wrapping), as tall as its lines, with the usual padding. The box keeps its top-left corner (a
 * callout keeps its leader). `measure` gives a string's width at the markup's font size. Null when
 * the markup cannot be auto-sized.
 */
export function autoSizedPoints(m: Markup, measure: (s: string) => number): Point[] | null {
  if (!canAutoSize(m) || TYPE_INFO[m.type].content !== 'text') return null;
  const lines = (m.text ?? '').split('\n');
  const textW = Math.max(...lines.map((l) => measure(l.trimEnd())));
  // Fork (leojru/redcolumn): the same room on every side of the text: to its capitals above and its baseline below.
  const w = textW + textPadding(m.style) * 2 + 0.5;
  const h = textBlockHeight(m, lines);
  // Fork (leojru/redcolumn): inside a border shape, the shape's box grows to hold the text.
  const shape = (m.type === 'text' || m.type === 'callout') && m.style.boxShape && m.style.boxShape !== 'rect' ? m.style.boxShape : null;
  const box = shape ? boundsOf(m.type === 'callout' ? m.points.slice(2, 4) : m.points) : contentBox(m);
  const outer = shape ? frameAroundText(shape, w, h, textPadding(m.style)) : { w, h };
  if (m.type === 'callout') {
    if (m.points.length < 4) return null;
    const pts = m.points.map((p) => [p[0], p[1]] as Point);
    const from = boundsOf(m.points.slice(2, 4));
    pts[2] = [box.x, box.y];
    pts[3] = [box.x + outer.w, box.y + outer.h];
    // Fork (leojru/redcolumn): the leader keeps its place on the box (centred stays centred).
    return refitCalloutKnees(pts, from, { x: box.x, y: box.y, w: outer.w, h: outer.h });
  }
  if (m.type === 'flagLabel') {
    // The pointed end grows with the box's height; solve for the outer width that leaves `w` for text.
    const b = boundsOf(m.points);
    let outer = w + h / 2;
    for (let i = 0; i < 4; i++) outer = w + flagTip({ x: 0, y: 0, w: outer, h });
    return [[b.x, b.y], [b.x + outer, b.y + h]];
  }
  return [[box.x, box.y], [box.x + outer.w, box.y + outer.h]];
}
