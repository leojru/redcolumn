// Added in the leojru/redcolumn fork (revu-layout). Vector snapshots for the Snapshot and Cut Content
// tools: the area's PDF content as vector graphics, with the markups over it drawn in (not editable).
import { makeVectorSnapshot, markupBounds, type Markup, type Point } from '@nb/markup';
import type { ExportOptions } from '@nb/markup/export';

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

/** The document with the page's markups drawn into its content: other tools get plain page content, nothing to re-read. */
async function withMarkupsDrawnIn(bytes: ArrayBuffer, pageIndex: number, markups: readonly Markup[], options: ExportOptions): Promise<ArrayBuffer | Uint8Array> {
  const { exportWithAnnotations } = await import('@nb/markup/export');
  const { flattenAnnotations } = await import('../documents/process');
  const exported = await exportWithAnnotations(bytes, markups, options);
  return (await flattenAnnotations(exported, null, (page) => (page === pageIndex ? 'flatten' : 'drop'))).bytes;
}

/** The markups to draw into a snapshot of `area`, with what saving them needs; omitted to leave them out. */
export interface SnapshotMarkups {
  all: readonly Markup[];
  options: ExportOptions;
}

/**
 * The area's page content as a one-page PDF data URL, with `markups` over the area drawn in, or
 * null to fall back to the picture (too big, unreadable).
 */
export async function vectorSnapshotOf(doc: SnapshotDoc, pageIndex: number, rect: { x: number; y: number; w: number; h: number }, polygon?: readonly Point[], markups?: SnapshotMarkups): Promise<string | null> {
  const area = clamp(doc, pageIndex, rect);
  if (!area) return null;
  try {
    const bytes = await doc.bytes();
    const over = markups?.all.some((m) => {
      if (m.pageIndex !== pageIndex) return false;
      const b = markupBounds(m);
      return b.x < area.x + area.w && b.x + b.w > area.x && b.y < area.y + area.h && b.y + b.h > area.y;
    });
    return await makeVectorSnapshot(over ? await withMarkupsDrawnIn(bytes, pageIndex, markups!.all, markups!.options) : bytes, pageIndex, area, polygon);
  } catch (err) {
    console.warn('Vector snapshot failed; keeping the picture.', err);
    return null;
  }
}
