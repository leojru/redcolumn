// Modified in the leojru/redcolumn fork (revu-layout): very long strings are decoded without overflowing the stack.
import { PDFArray, PDFBool, PDFDict, PDFHexString, PDFName, PDFNull, PDFNumber, PDFRef, PDFStream, PDFString, type PDFContext, type PDFObject } from 'pdf-lib';
import { dict, PdfName, PdfRefNum, type PdfDictValue, type PdfValue } from './bluebeam';

/** Keys whose referenced objects are kept as references: other annotations, pages, streams. */
const KEEP_REF = new Set(['P', 'Parent', 'IRT', 'Popup', 'OC', 'Flag', 'Image', 'AP', 'FS', 'Dest', 'A', 'StructParent']);

/**
 * Fork (leojru/redcolumn): a string's text. pdf-lib's own decoder spreads every character into one call and
 * overflows the stack on a very long string (a big note some tool wrote), which lost the whole file's
 * annotation dictionaries; those are decoded here instead.
 */
function textOf(obj: PDFString | PDFHexString): string {
  try {
    return obj.decodeText();
  } catch {
    const bytes = obj.asBytes();
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    return new TextDecoder('latin1').decode(bytes);
  }
}

/** A pdf-lib object as plain values, following references except to annotations, pages and streams. */
export function toPdfValue(ctx: PDFContext, obj: PDFObject | undefined, key: string | null = null, depth = 0): PdfValue {
  if (obj === undefined || obj === PDFNull) return null;
  if (obj instanceof PDFRef) {
    if ((key && KEEP_REF.has(key)) || depth > 8) return new PdfRefNum(obj.objectNumber);
    const target = ctx.lookup(obj);
    if (!target || target instanceof PDFStream) return new PdfRefNum(obj.objectNumber);
    return toPdfValue(ctx, target, key, depth + 1);
  }
  if (obj instanceof PDFNumber) return obj.asNumber();
  if (obj instanceof PDFBool) return obj.asBoolean();
  if (obj instanceof PDFName) return new PdfName(obj.decodeText());
  if (obj instanceof PDFString || obj instanceof PDFHexString) return textOf(obj);
  if (obj instanceof PDFArray) return obj.asArray().map((x) => toPdfValue(ctx, x, key, depth + 1));
  if (obj instanceof PDFDict) {
    const out: Record<string, PdfValue> = {};
    for (const [k, v] of obj.entries()) out[k.decodeText()] = toPdfValue(ctx, v, k.decodeText(), depth + 1);
    return out;
  }
  return null;
}

export function toPdfDict(ctx: PDFContext, obj: PDFObject | undefined): PdfDictValue | null {
  return dict(toPdfValue(ctx, obj));
}
