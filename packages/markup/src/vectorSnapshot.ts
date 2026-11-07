// Added in the leojru/redcolumn fork (revu-layout). Vector snapshots: an area of a PDF page kept as
// PDF content (lines, text and fills stay vector), not as a picture.
import { PDFDocument, PDFName, PDFOperator, PDFNumber, PDFOperatorNames as Ops } from 'pdf-lib';
import type { Point } from './model';
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
