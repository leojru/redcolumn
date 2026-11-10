// Added in the leojru/redcolumn fork (revu-layout). Vector snapshots: an area of a PDF page kept as
// PDF content (lines, text and fills stay vector), not as a picture.
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFObjectCopier, PDFOperator, PDFNumber, PDFOperatorNames as Ops, PDFRef, PDFStream } from 'pdf-lib';
import type { Point } from './model';
import { snapshotInset, type SnapshotSheet } from './bluebeam';
import { pageMatrix, type Matrix } from './export';

/** Largest snapshot kept as vector: past this the caller keeps the picture instead. */
export const MAX_VECTOR_SNAPSHOT_BYTES = 25 * 1024 * 1024;

const PDF_DATA_URL = 'data:application/pdf;base64,';

/** The inverse of an affine matrix. */
function invert([a, b, c, d, e, f]: Matrix): Matrix {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/** `first` then `second`, as one matrix (PDF row-vector convention). */
function compose(first: Matrix, second: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = first;
  const [a2, b2, c2, d2, e2, f2] = second;
  return [a1 * a2 + b1 * c2, a1 * b2 + b1 * d2, c1 * a2 + d1 * c2, c1 * b2 + d1 * d2, e1 * a2 + f1 * c2 + e2, e1 * b2 + f1 * d2 + f2];
}

const apply = (m: Matrix, [u, v]: Point): Point => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]];

const op = (name: string, ...args: number[]) => PDFOperator.of(name as Ops, args.map((n) => PDFNumber.of(n)));

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Fork: a one-page PDF as a data URL, the form a vector snapshot keeps its content in. */
export const vectorSnapshotUrl = (bytes: Uint8Array) => PDF_DATA_URL + toBase64(bytes);

export function vectorSnapshotBytes(url: string): Uint8Array | null {
  if (!url.startsWith(PDF_DATA_URL)) return null;
  const bin = atob(url.slice(PDF_DATA_URL.length));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * A one-page PDF of `rect` (page space: points from the top left of the page as shown, y down)
 * on page `pageIndex` of `source`, upright and the size of `rect`, as a data URL. With `polygon`
 * (page space) only what lies inside the outline is kept (even-odd, as the picture snapshot).
 * The page's annotations are not included: only its own content.
 */
export async function makeVectorSnapshot(source: ArrayBuffer | Uint8Array, pageIndex: number, rect: { x: number; y: number; w: number; h: number }, polygon?: readonly Point[]): Promise<string | null> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true, updateMetadata: false });
  const page = src.getPage(pageIndex);
  const toUser = pageMatrix(page);
  // The area's corners in the source page's user space, for the embedded content's bounding box.
  const corners = ([[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]] as Point[]).map((p) => apply(toUser, p));
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const box = { left: Math.min(...xs), bottom: Math.min(...ys), right: Math.max(...xs), top: Math.max(...ys) };

  const out = await PDFDocument.create({ updateMetadata: false });
  const embedded = await out.embedPage(page, box);
  const sheet = out.addPage([rect.w, rect.h]);
  // The embedded form's space starts at the box's lower left. Form → source user space → page space
  // (y down) → the new sheet (y up, origin at the area's lower left).
  const formToUser: Matrix = [1, 0, 0, 1, box.left, box.bottom];
  const pageToSheet: Matrix = [1, 0, 0, -1, -rect.x, rect.y + rect.h];
  const m = compose(compose(formToUser, invert(toUser)), pageToSheet);
  const name = sheet.node.newXObject('Snap', embedded.ref);
  const ops: PDFOperator[] = [op(Ops.PushGraphicsState)];
  if (polygon && polygon.length >= 3) {
    polygon.forEach((p, i) => {
      const [x, y] = apply(pageToSheet, p);
      ops.push(op(i ? Ops.LineTo : Ops.MoveTo, x, y));
    });
    ops.push(op(Ops.ClosePath), op(Ops.ClipEvenOdd), op(Ops.EndPath));
  }
  ops.push(op(Ops.ConcatTransformationMatrix, ...m), PDFOperator.of(Ops.DrawObject, [name]), op(Ops.PopGraphicsState));
  sheet.pushOperators(...ops);
  sheet.node.set(PDFName.of('NBSnapshot'), PDFName.of('Vector'));
  const bytes = await out.save({ useObjectStreams: true });
  if (bytes.length > MAX_VECTOR_SNAPSHOT_BYTES) return null;
  return PDF_DATA_URL + toBase64(bytes);
}

const numbersOf = (a: PDFArray | undefined, n: number): number[] | null => {
  const out = (a?.asArray() ?? []).map((v) => (v instanceof PDFNumber ? v.asNumber() : NaN));
  return out.length === n && out.every(Number.isFinite) ? out : null;
};

/**
 * Another tool's stamp (a Revu snapshot) as a one-page PDF the size of its /Rect, drawn from its own
 * appearance, or null when it cannot be: for showing it sharply, not for saving.
 */
export async function stampAppearanceSheet(doc: PDFDocument, pageIndex: number, annotIndex: number): Promise<Uint8Array | null> {
  const page = doc.getPages()[pageIndex];
  if (!page || page.getRotation().angle % 360 !== 0) return null;
  const annot = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)?.lookupMaybe(annotIndex, PDFDict);
  if (!annot || annot.get(PDFName.of('Subtype')) !== PDFName.of('Stamp')) return null;
  const form = annot.lookupMaybe(PDFName.of('AP'), PDFDict)?.lookupMaybe(PDFName.of('N'), PDFStream);
  const rect = numbersOf(annot.lookupMaybe(PDFName.of('Rect'), PDFArray), 4);
  if (!form || !rect) return null;
  const bbox = numbersOf(form.dict.lookupMaybe(PDFName.of('BBox'), PDFArray), 4);
  if (!bbox) return null;
  const matrix = (numbersOf(form.dict.lookupMaybe(PDFName.of('Matrix'), PDFArray), 6) ?? [1, 0, 0, 1, 0, 0]) as Matrix;
  const [w, h] = [Math.abs(rect[2]! - rect[0]!), Math.abs(rect[3]! - rect[1]!)];
  // The appearance's box as its /Matrix turns it, fitted to the sheet (PDF 12.5.5).
  const corners = ([[bbox[0]!, bbox[1]!], [bbox[2]!, bbox[1]!], [bbox[0]!, bbox[3]!], [bbox[2]!, bbox[3]!]] as Point[]).map((p) => apply(matrix, p));
  const [x0, y0] = [Math.min(...corners.map((p) => p[0])), Math.min(...corners.map((p) => p[1]))];
  const [x1, y1] = [Math.max(...corners.map((p) => p[0])), Math.max(...corners.map((p) => p[1]))];
  if (!(w > 0) || !(h > 0) || !(x1 > x0) || !(y1 > y0)) return null;
  const out = await PDFDocument.create({ updateMetadata: false });
  const sheet = out.addPage([w, h]);
  const copied = PDFObjectCopier.for(doc.context, out.context).copy(form);
  const ref = out.context.register(copied) as PDFRef;
  const name = sheet.node.newXObject('Stamp', ref);
  const [sx, sy] = [w / (x1 - x0), h / (y1 - y0)];
  sheet.pushOperators(op(Ops.PushGraphicsState), op(Ops.ConcatTransformationMatrix, sx, 0, 0, sy, -x0 * sx, -y0 * sy), PDFOperator.of(Ops.DrawObject, [name]), op(Ops.PopGraphicsState));
  return out.save({ useObjectStreams: true });
}

/**
 * A Revu snapshot's drawing without the border and fill Revu painted around it, upright as the page
 * shows it, or null when the snapshot is not built the way Revu builds them. Its appearance is
 * `/MWFOForm Do` plus the fill and border, and the border and fill are also in /BS, /BE, /C and /IC.
 */
export async function snapshotContentSheet(doc: PDFDocument, pageIndex: number, annotIndex: number): Promise<SnapshotSheet | null> {
  const page = doc.getPages()[pageIndex];
  const annot = page?.node.lookupMaybe(PDFName.of('Annots'), PDFArray)?.lookupMaybe(annotIndex, PDFDict);
  if (!page || !annot || annot.get(PDFName.of('IT')) !== PDFName.of('StampSnapshot')) return null;
  const form = annot.lookupMaybe(PDFName.of('AP'), PDFDict)?.lookupMaybe(PDFName.of('N'), PDFStream);
  const content = form?.dict.lookupMaybe(PDFName.of('Resources'), PDFDict)?.lookupMaybe(PDFName.of('XObject'), PDFDict)?.lookupMaybe(PDFName.of('MWFOForm'), PDFStream);
  const rect = numbersOf(annot.lookupMaybe(PDFName.of('Rect'), PDFArray), 4);
  const bbox = form && numbersOf(form.dict.lookupMaybe(PDFName.of('BBox'), PDFArray), 4);
  if (!form || !content || !rect || !bbox) return null;
  const matrix = (numbersOf(form.dict.lookupMaybe(PDFName.of('Matrix'), PDFArray), 6) ?? [1, 0, 0, 1, 0, 0]) as Matrix;
  const border = annot.lookupMaybe(PDFName.of('BS'), PDFDict);
  const width = border?.lookupMaybe(PDFName.of('W'), PDFNumber)?.asNumber() ?? 1;
  const effect = annot.lookupMaybe(PDFName.of('BE'), PDFDict);
  const cloud = effect?.get(PDFName.of('S')) === PDFName.of('C');
  const inset = snapshotInset(width, cloud ? (effect!.lookupMaybe(PDFName.of('I'), PDFNumber)?.asNumber() ?? 1) : null);

  // The appearance's box as its /Matrix turns it, fitted to /Rect (PDF 12.5.5).
  const [left, right] = [Math.min(rect[0]!, rect[2]!), Math.max(rect[0]!, rect[2]!)];
  const [bottom, top] = [Math.min(rect[1]!, rect[3]!), Math.max(rect[1]!, rect[3]!)];
  const corners = ([[bbox[0]!, bbox[1]!], [bbox[2]!, bbox[1]!], [bbox[0]!, bbox[3]!], [bbox[2]!, bbox[3]!]] as Point[]).map((p) => apply(matrix, p));
  const [x0, y0] = [Math.min(...corners.map((p) => p[0])), Math.min(...corners.map((p) => p[1]))];
  const [x1, y1] = [Math.max(...corners.map((p) => p[0])), Math.max(...corners.map((p) => p[1]))];
  if (!(right > left) || !(top > bottom) || !(x1 > x0) || !(y1 > y0)) return null;
  const [sx, sy] = [(right - left) / (x1 - x0), (top - bottom) / (y1 - y0)];
  const fit: Matrix = [sx, 0, 0, sy, left - x0 * sx, bottom - y0 * sy];

  // The sheet is the snapshot's outline as the page shows it.
  const toPage = invert(pageMatrix(page));
  const outline = ([[left + inset, bottom + inset], [right - inset, top - inset]] as Point[]).map((p) => apply(toPage, p));
  const x = Math.min(outline[0]![0], outline[1]![0]);
  const y = Math.min(outline[0]![1], outline[1]![1]);
  const w = Math.abs(outline[1]![0] - outline[0]![0]);
  const h = Math.abs(outline[1]![1] - outline[0]![1]);
  if (!(w > 0) || !(h > 0)) return null;
  const pageToSheet: Matrix = [1, 0, 0, -1, -x, y + h];

  const out = await PDFDocument.create({ updateMetadata: false });
  const sheet = out.addPage([w, h]);
  const ref = out.context.register(PDFObjectCopier.for(doc.context, out.context).copy(content)) as PDFRef;
  const name = sheet.node.newXObject('Snap', ref);
  sheet.pushOperators(op(Ops.PushGraphicsState), op(Ops.ConcatTransformationMatrix, ...compose(compose(compose(matrix, fit), toPage), pageToSheet)), PDFOperator.of(Ops.DrawObject, [name]), op(Ops.PopGraphicsState));
  sheet.node.set(PDFName.of('NBSnapshot'), PDFName.of('Vector'));
  const bytes = await out.save({ useObjectStreams: true });
  return bytes.length > MAX_VECTOR_SNAPSHOT_BYTES ? null : { bytes, inset };
}
