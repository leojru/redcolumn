// Added in the leojru/redcolumn fork (revu-layout): leaving out unused objects and compressing plain streams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { repackDocument } from './repack.ts';

const filler = (n: number) => new TextEncoder().encode('0 0 m 10 10 l S\n'.repeat(n));

test('objects nothing points to are left out, and plain streams are compressed', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  // A plain stream the page uses, and one nothing uses.
  const used = doc.context.register(doc.context.stream(filler(500), { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 10, 10] }));
  page.node.newXObject('Fm', used);
  const unused = doc.context.register(doc.context.stream(filler(500)));
  const before = await doc.save({ useObjectStreams: false });
  const result = await repackDocument(doc);
  assert.equal(result.dropped, 1);
  assert.equal(result.compressed, 1);
  assert.equal(doc.context.lookup(unused), undefined);
  const after = await doc.save({ useObjectStreams: false });
  assert.ok(after.length < before.length / 4, `${before.length} -> ${after.length}`);
  // It still opens, and the stream still holds what it did.
  const back = await PDFDocument.load(after);
  const xobjects = back.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'));
  assert.ok(xobjects);
  const form = back.context.lookup(back.context.enumerateIndirectObjects().find(([, o]) => o instanceof PDFRawStream && o.dict.has(PDFName.of('BBox')))![0]) as PDFRawStream;
  assert.equal(form.dict.get(PDFName.of('Filter')), PDFName.of('FlateDecode'));
});

test('a stream that is already filtered, or a metadata stream, is left as it is', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const meta = doc.context.register(doc.context.stream(filler(500), { Type: 'Metadata', Subtype: 'XML' }));
  doc.catalog.set(PDFName.of('Metadata'), meta);
  const packed = doc.context.register(doc.context.flateStream(filler(500)));
  doc.catalog.set(PDFName.of('Extra'), packed);
  const before = (doc.context.lookup(packed) as PDFRawStream).contents.length;
  assert.deepEqual(await repackDocument(doc), { dropped: 0, compressed: 0 });
  assert.equal((doc.context.lookup(meta) as PDFRawStream).dict.has(PDFName.of('Filter')), false);
  assert.equal((doc.context.lookup(packed) as PDFRawStream).contents.length, before);
});
