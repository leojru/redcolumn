// Added in the leojru/redcolumn fork (revu-layout): Change Colours on vector snapshots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, rgb } from 'pdf-lib';
import { makeVectorSnapshot, vectorSnapshotBytes } from '@nb/markup';
import { colourMapOf, recolourContent, recolourVectorSnapshot } from './vectorRecolour.ts';

const toRed = colourMapOf({ swaps: [{ from: '#000000', to: '#ff0000' }, { from: '#ffffff', to: '#ffffff' }] })!;
const gray = () => 'gray' as const;

test('device colours change, the rest stays', () => {
  const out = recolourContent('q 0 g 1 0 0 RG (0 g) Tj /P0 cs /P0 scn 10 10 m S Q', gray, toRed);
  assert.match(out, /1 0 0 rg/);
  assert.match(out, /\(0 g\) Tj/);
  assert.match(out, /\/P0 scn/);
  assert.equal(colourMapOf({ swaps: [{ from: '#000000', to: null }] }), null);
});

test('a snapshot with nothing coloured draws red when black becomes red', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  page.drawLine({ start: { x: 10, y: 10 }, end: { x: 100, y: 100 }, thickness: 2 });
  page.drawRectangle({ x: 20, y: 20, width: 30, height: 30, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  const url = await makeVectorSnapshot(await doc.save(), 0, { x: 0, y: 0, w: 200, h: 200 });
  assert.ok(url);
  const next = await recolourVectorSnapshot(url, { swaps: [{ from: '#000000', to: '#ff0000' }] });
  assert.ok(next && next !== url);
  const bytes = vectorSnapshotBytes(next)!;
  const reopened = await PDFDocument.load(bytes);
  assert.equal(reopened.getPageCount(), 1);
  const outPage = reopened.getPage(0);
  const read = (s: unknown) => new TextDecoder('latin1').decode(decodePDFRawStream(s as PDFRawStream).decode());
  // Black unset in the content is set to red on the sheet; the explicit black rectangle is red inside the form.
  const sheet = outPage.node.lookup(PDFName.of('Contents'), PDFArray).lookup(0);
  assert.match(read(sheet), /^1 0 0 rg 1 0 0 RG/);
  const form = outPage.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict).entries()[0]![1];
  assert.match(read(reopened.context.lookup(form as never)), /1 0 0 RG/);
});
