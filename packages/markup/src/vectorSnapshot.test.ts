// Added in the leojru/redcolumn fork (revu-layout): vector snapshots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePDFRawStream, degrees, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, PDFStream, rgb } from 'pdf-lib';
import { exportWithAnnotations } from './export.ts';
import { markupDigest } from './digest.ts';
import { DEFAULT_STYLES, type Markup } from './model.ts';
import { makeVectorSnapshot, stampAppearanceSheet, vectorSnapshotBytes } from './vectorSnapshot.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** A 600 × 400 page with a 50 pt square at (100, 100) in user space: page space (y down) 100..150 × 250..300. */
async function source(rotate = 0) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  page.drawRectangle({ x: 100, y: 100, width: 50, height: 50, borderColor: rgb(1, 0, 0), borderWidth: 1 });
  if (rotate) page.setRotation(degrees(rotate));
  return doc.save();
}

const text = (s: PDFStream) => new TextDecoder().decode(s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : s.getContents());

async function snapshotPage(url: string) {
  const bytes = vectorSnapshotBytes(url);
  assert.ok(bytes, 'a PDF data URL');
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  const page = doc.getPage(0);
  const xobjects = page.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
  // pdf-lib names it Snap-<suffix>.
  const [key] = xobjects.keys();
  assert.match(key!.toString(), /^\/Snap/);
  const form = xobjects.lookup(key!, PDFStream);
  const content = page.node.Contents();
  const ops = content instanceof PDFArray ? content.asArray().map((r) => text(doc.context.lookup(r as PDFRef, PDFStream))).join('\n') : text(content as PDFStream);
  return { page, form, ops };
}

test('a vector snapshot is a page the size of the area, holding the page content clipped to it', async () => {
  const url = await makeVectorSnapshot(await source(), 0, { x: 90, y: 240, w: 70, h: 70 });
  assert.ok(url);
  const { page, form, ops } = await snapshotPage(url);
  assert.deepEqual([page.getWidth(), page.getHeight()], [70, 70]);
  // The content's bounding box is the area in the source page's user space (y up).
  const bbox = form.dict.lookup(PDFName.of('BBox'), PDFArray).asArray().map((n) => Number(n.toString()));
  assert.deepEqual(bbox, [90, 90, 160, 160]);
  assert.match(ops, /\/Snap\S* Do/);
  assert.doesNotMatch(ops, /W\*/);
});

test('a polygon snapshot clips to its outline', async () => {
  const url = await makeVectorSnapshot(await source(), 0, { x: 90, y: 240, w: 70, h: 70 }, [[90, 240], [160, 240], [125, 310]]);
  const { ops } = await snapshotPage(url!);
  assert.match(ops, /W\*/);
});

test('a turned page gives an upright snapshot the size of the area as shown', async () => {
  // Turned 90°, the page shows as 400 wide and 600 tall.
  const url = await makeVectorSnapshot(await source(90), 0, { x: 10, y: 20, w: 120, h: 40 });
  const { page } = await snapshotPage(url!);
  assert.deepEqual([page.getWidth(), page.getHeight()], [120, 40]);
});

test('a saved vector snapshot draws its PDF content, not its picture', async () => {
  const vector = await makeVectorSnapshot(await source(), 0, { x: 90, y: 240, w: 70, h: 70 });
  const doc = await PDFDocument.create();
  doc.addPage([600, 400]);
  const markup: Markup = { id: 's1', type: 'image', pageIndex: 0, points: [[200, 100], [270, 170]], style: { ...DEFAULT_STYLES.image }, image: PNG, vector: vector!, vectorImage: markupDigest({ image: PNG } as Markup), subject: 'Snapshot', status: 'none', author: 'Tester', createdAt: 1, modifiedAt: 1 };
  const out = await PDFDocument.load(await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [markup]));
  const annot = out.getPage(0).node.Annots()!.lookup(0, PDFDict);
  const ap = annot.lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N'), PDFStream);
  const xobjects = ap.dict.lookup(PDFName.of('Resources'), PDFDict).lookup(PDFName.of('XObject'), PDFDict);
  const fm = xobjects.lookup(PDFName.of('Fm0'), PDFStream);
  assert.equal(fm.dict.lookup(PDFName.of('Subtype'))?.toString(), '/Form');
  assert.equal(xobjects.get(PDFName.of('Im0')), undefined);
  assert.match(text(ap), /\/Fm0 Do/);
});

test('without a vector, an image markup still draws its picture', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([600, 400]);
  const markup: Markup = { id: 'i1', type: 'image', pageIndex: 0, points: [[200, 100], [270, 170]], style: { ...DEFAULT_STYLES.image }, image: PNG, status: 'none', author: 'Tester', createdAt: 1, modifiedAt: 1 };
  const out = await PDFDocument.load(await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [markup]));
  const ap = out.getPage(0).node.Annots()!.lookup(0, PDFDict).lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N'), PDFStream);
  assert.match(text(ap), /\/Im0 Do/);
});

test('once its picture is changed, a vector snapshot saves the picture', async () => {
  const vector = await makeVectorSnapshot(await source(), 0, { x: 90, y: 240, w: 70, h: 70 });
  const doc = await PDFDocument.create();
  doc.addPage([600, 400]);
  // Captured with another picture (Change Colours has since replaced it).
  const markup: Markup = { id: 's2', type: 'image', pageIndex: 0, points: [[200, 100], [270, 170]], style: { ...DEFAULT_STYLES.image }, image: PNG, vector: vector!, vectorImage: 'stale', status: 'none', author: 'Tester', createdAt: 1, modifiedAt: 1 };
  const out = await PDFDocument.load(await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [markup]));
  const ap = out.getPage(0).node.Annots()!.lookup(0, PDFDict).lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N'), PDFStream);
  assert.match(text(ap), /\/Im0 Do/);
  assert.doesNotMatch(text(ap), /\/Fm0 Do/);
});

test("another tool's stamp becomes a sheet the size of its Rect, drawn from its appearance", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const ctx = doc.context;
  const form = ctx.register(ctx.stream('0 0 m 100 50 l S', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 100, 50], Matrix: [0, 1, -1, 0, 50, 0] }));
  const stamp = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Stamp', Rect: [100, 200, 150, 300], AP: { N: form } }));
  page.node.set(PDFName.of('Annots'), ctx.obj([stamp]));
  const sheet = await PDFDocument.load((await stampAppearanceSheet(doc, 0, 0))!);
  assert.deepEqual([sheet.getPage(0).getWidth(), sheet.getPage(0).getHeight()], [50, 100]);
  assert.equal(await stampAppearanceSheet(doc, 0, 1), null);
});
