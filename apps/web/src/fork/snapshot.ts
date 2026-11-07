// Added in the leojru/redcolumn fork (revu-layout). Vector snapshots for the Snapshot and Cut Content
// tools: the area's PDF content as vector graphics, with the markups inside it copied alongside.
import { makeVectorSnapshot, markupBounds, type Markup, type Point } from '@nb/markup';

interface SnapshotDoc {
  pages: readonly { width: number; height: number }[];
  bytes(): Promise<ArrayBuffer>;
}

/** The area kept on the page, as the picture snapshot clamps it. */
function clamp(doc: SnapshotDoc, pageIndex: number, rect: { x: number; y: number; w: number; h: number }) {
  const size = doc.pages[pageIndex];
  if (!size) return null;
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  const w = Math.min(size.width, rect.x + rect.w) - x;
  const h = Math.min(size.height, rect.y + rect.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** The area's page content as a one-page PDF data URL, or null to fall back to the picture (too big, unreadable). */
export async function vectorSnapshotOf(doc: SnapshotDoc, pageIndex: number, rect: { x: number; y: number; w: number; h: number }, polygon?: readonly Point[]): Promise<string | null> {
  const area = clamp(doc, pageIndex, rect);
  if (!area) return null;
  try {
    return await makeVectorSnapshot(await doc.bytes(), pageIndex, area, polygon);
  } catch {
    return null;
  }
}

/**
 * The snapshot and copies of the markups lying wholly inside its box, grouped so they paste and
 * move together; the markups stay markups (editable), drawn over the snapshot.
 */
export function withMarkupsInside(snapshot: Markup, pageMarkups: readonly Markup[]): Markup[] {
  const box = markupBounds(snapshot);
  const inside = pageMarkups.filter((m) => {
    if (m.id === snapshot.id) return false;
    const b = markupBounds(m);
    return b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h;
  });
  if (!inside.length) return [snapshot];
  const groupId = crypto.randomUUID();
  return [{ ...snapshot, groupId }, ...inside.sort((a, b) => a.createdAt - b.createdAt).map((m) => ({ ...m, groupId }))];
}
