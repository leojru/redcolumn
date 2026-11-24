import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import { exportWithAnnotations } from './export.ts';
import type { LinkStatus, StoredLink } from './store.ts';

const link = (id: string, status: LinkStatus): StoredLink => ({ id, pageIndex: 0, rect: { x: 10, y: 10, w: 20, h: 20 }, label: '3/A-501', kind: 'detail', detail: '3', targetPage: 1, targetRect: null, confidence: 0.8, status });

test('sheet links are saved as /Link annotations, except matches of taught marks still waiting for review', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  doc.addPage([400, 400]);
  const links = [link('0:3/A-501:2:2', 'review'), link('mark-a', 'review'), link('mark-b', 'accepted'), link('mark-c', 'rejected')];
  const out = await PDFDocument.load(await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [], { links }));
  const annots = out.getPage(0).node.Annots()?.asArray().map((r) => out.context.lookup(r, PDFDict)) ?? [];
  // The text-detected link in review and the kept taught-mark link; not the unconfirmed or rejected ones.
  assert.equal(annots.filter((d) => d.get(PDFName.of('Subtype'))?.toString() === '/Link').length, 2);
});

test('a link keeps what it is: the kind, identifier and label travel in our app data on the /Link', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  doc.addPage([400, 400]);
  const section: StoredLink = { ...link('0:A/A-501:2:2', 'accepted'), label: 'A/A-501', kind: 'section', detail: 'A' };
  const out = await PDFDocument.load(await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [], { links: [section] }));
  const annots = out.getPage(0).node.Annots()?.asArray().map((r) => out.context.lookup(r, PDFDict)) ?? [];
  const data = annots[0]?.lookup(PDFName.of('NBData'), PDFHexString).decodeText() ?? '';
  assert.match(data, /"kind":"section"/);
  assert.match(data, /"detail":"A"/);
  assert.match(data, /"label":"A\/A-501"/);
});

test('a link whose target rectangle is not a number goes to the whole page, and the file reads back whole', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  doc.addPage([400, 400]);
  const bad: StoredLink = { ...link('0:9/S2.1:2:2', 'accepted'), targetRect: { x: NaN, y: NaN, w: NaN, h: NaN } };
  const bytes = await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [], { links: [bad] });
  assert.ok(!new TextDecoder('latin1').decode(bytes).includes('NaN'), 'no NaN token in the file');
  const out = await PDFDocument.load(bytes);
  const annot = out.getPage(0).node.Annots()?.asArray().map((r) => out.context.lookup(r, PDFDict))[0];
  assert.equal(annot?.lookup(PDFName.of('Dest'), PDFArray).get(1)?.toString(), '/Fit');
});
