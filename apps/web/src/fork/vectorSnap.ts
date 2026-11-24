// Added in the leojru/redcolumn fork (revu-layout). Snapping to the line work of a vector snapshot
// (Markup.vector, our one-page PDF data URL): its PDF is read once in an engine of its own, and its
// lines are placed on the page where the snapshot sits (stretched into its box, turned with it).
import { boundsOf, markupDigest, rotatePoint, rotationCentre, vectorSnapshotBytes, type Markup } from '@nb/markup';
import { PdfEngine, type PdfDocument } from '@nb/pdf-core';

/** Most snapshots whose line work is remembered. */
const MAX_REMEMBERED = 32;

export interface PlacedLines {
  segments: Float32Array;
  curves: Uint8Array;
}

/** Whether a markup is a vector snapshot whose picture is still the one captured with it (no crop). */
export function hasSnapVector(m: Markup): boolean {
  return m.type === 'image' && !!m.vector && !!m.image && !m.crop && m.vectorImage === markupDigest({ image: m.image } as Markup);
}

let engine: PdfEngine | null = null;
const lines = new Map<string, Promise<{ doc: PdfDocument; segments: Float32Array; curves: Uint8Array }>>();

function read(url: string) {
  let hit = lines.get(url);
  if (!hit) {
    if (!engine?.alive) {
      engine = new PdfEngine();
      lines.clear();
    }
    const bytes = vectorSnapshotBytes(url);
    hit = bytes
      ? engine.open(bytes.slice().buffer).then(async (doc) => {
          const g = await doc.geometry(0);
          return { doc, segments: g.segments, curves: g.curves };
        })
      : Promise.reject(new Error('Unreadable vector snapshot'));
    hit.catch(() => lines.delete(url));
    lines.set(url, hit);
    if (lines.size > MAX_REMEMBERED) {
      const [oldest, old] = lines.entries().next().value!;
      lines.delete(oldest);
      void old.then((o) => o.doc.close()).catch(() => undefined);
    }
  }
  return hit;
}

/** The snapshot's line work on the page, where the snapshot is (null when it cannot be read). */
export async function placedLines(m: Markup): Promise<PlacedLines | null> {
  if (!m.vector || !hasSnapVector(m)) return null;
  const { doc, segments, curves } = await read(m.vector);
  const size = doc.pages[0];
  const b = boundsOf(m.points);
  if (!size?.width || !size?.height) return null;
  const kx = b.w / size.width;
  const ky = b.h / size.height;
  const centre = m.rotation ? rotationCentre(m) : null;
  const out = new Float32Array(segments.length);
  for (let i = 0; i + 1 < segments.length; i += 2) {
    let p: [number, number] = [b.x + segments[i]! * kx, b.y + segments[i + 1]! * ky];
    if (centre) p = rotatePoint(p, centre, m.rotation!);
    out[i] = p[0];
    out[i + 1] = p[1];
  }
  return { segments: out, curves };
}
