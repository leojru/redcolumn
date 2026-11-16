// Added in the leojru/redcolumn fork (revu-layout). Makes a document smaller before it is saved,
// without changing anything a reader shows: objects nothing points to are left out, and streams
// stored uncompressed are compressed.
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, PDFStream, type PDFObject } from 'pdf-lib';

/** Streams that stay as they are: readers look at their bytes directly. */
const KEEP_AS_IS = new Set(['/Metadata', '/XRef', '/ObjStm']);
/** Below this a stream is not worth compressing. */
const MIN_STREAM_BYTES = 256;

/**
 * Drops every object the file's trailer cannot reach and compresses the streams that are stored
 * plain. Not for a signed document, whose earlier bytes must stay exactly as they are (it is saved
 * as an incremental update), nor for an encrypted one.
 */
export async function repackDocument(doc: PDFDocument): Promise<{ dropped: number; compressed: number }> {
  // Fonts, pictures and embedded pages are only written into the file when it is saved; write them first, or they look unused.
  await doc.flush();
  const ctx = doc.context;
  const trailer = ctx.trailerInfo;
  if (trailer.Encrypt) return { dropped: 0, compressed: 0 };

  const reached = new Set<string>();
  const todo: PDFObject[] = [trailer.Root, trailer.Info, trailer.ID].filter((o): o is PDFObject => !!o);
  while (todo.length) {
    const o = todo.pop()!;
    if (o instanceof PDFRef) {
      if (reached.has(o.tag)) continue;
      reached.add(o.tag);
      const target = ctx.lookup(o);
      if (target) todo.push(target);
    } else if (o instanceof PDFStream) todo.push(o.dict);
    else if (o instanceof PDFDict) for (const v of o.values()) todo.push(v);
    else if (o instanceof PDFArray) for (const v of o.asArray()) todo.push(v);
  }
  // Without a catalog nothing is reached: leave such a file alone.
  if (!trailer.Root || reached.size < 2) return { dropped: 0, compressed: 0 };

  let dropped = 0;
  for (const [ref] of [...ctx.enumerateIndirectObjects()]) {
    if (reached.has(ref.tag)) continue;
    ctx.delete(ref);
    dropped++;
  }

  let compressed = 0;
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || obj.contents.length < MIN_STREAM_BYTES) continue;
    const dict = obj.dict;
    if (dict.has(PDFName.of('Filter')) || dict.has(PDFName.of('DecodeParms')) || dict.has(PDFName.of('F'))) continue;
    if (KEEP_AS_IS.has(String(dict.get(PDFName.of('Type'))))) continue;
    const packed = ctx.flateStream(obj.contents);
    if (packed.contents.length >= obj.contents.length) continue;
    (obj as { contents: Uint8Array }).contents = packed.contents;
    dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
    compressed++;
  }
  return { dropped, compressed };
}
