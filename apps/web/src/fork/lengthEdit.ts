// Added in the leojru/redcolumn fork (revu-layout). A Length's text typed over, as in Revu: the line
// keeps its start and direction and takes the length typed.
import { METERS_PER_UNIT, pageLengthFor, parseLength, type Scale } from '@nb/measure';
import type { Point } from '@nb/markup';

/** What was typed, in the form the length parser reads (9 ft 8 in as 9'-8"). */
function normalised(text: string, unit: Scale['unit']): string {
  let t = text.replace(/,/g, '').trim();
  if (unit === 'ft' || unit === 'in') {
    t = t
      .replace(/(\d)\s*(?:feet|foot|ft)\b\s*-?\s*/gi, "$1' ")
      .replace(/(\d)\s*(?:inches|inch|in)\b/gi, '$1"')
      .trim();
  }
  return t.replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
}

/** The line's points at the length typed; null if it is not a length above zero. */
export function pointsForTypedLength(points: readonly Point[], text: string, scale: Scale): Point[] | null {
  const a = points[0];
  const b = points[points.length - 1];
  if (!a || !b) return null;
  const value = parseLength(normalised(text, scale.unit), scale.unit);
  if (value === null || !(value > 0)) return null;
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const now = Math.hypot(dx, dy);
  if (!(now > 0)) return null;
  const next = pageLengthFor(scale, value * METERS_PER_UNIT[scale.unit], dx, dy);
  return [a, [a[0] + (dx / now) * next, a[1] + (dy / now) * next]];
}
