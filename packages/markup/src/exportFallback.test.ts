import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFStream, PDFString, StandardFonts } from 'pdf-lib';
import { exportWithAnnotations } from './export.ts';
import { DEFAULT_STYLES, type Markup } from './model.ts';

const box = (text: string): Markup => ({
  id: 't1',
  type: 'text',
  pageIndex: 0,
  points: [[20, 20], [220, 120]],
  style: { ...DEFAULT_STYLES.text },
  text,
  status: 'none',
  author: 'Tester',
  createdAt: 1,
  modifiedAt: 1,
});

async function usesFallback(text: string, extra: Partial<Markup> = {}): Promise<boolean> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  let used = 0;
  const fallbackFont = (d: PDFDocument, name: StandardFonts) => {
    used++;
    return d.embedFont(name);
  };
  await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [{ ...box(text), ...extra }], { fallbackFont });
  return used > 0;
}

test('the fallback font is told which characters the markups draw', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  const seen: string[] = [];
  const fallbackFont = (d: PDFDocument, name: StandardFonts, text: string) => {
    seen.push(text);
    return d.embedFont(name);
  };
  await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [box('中文 abc 中')], { fallbackFont });
  assert.ok(seen.length > 0);
  for (const text of seen) assert.deepEqual([...text].sort(), [...'中文 abc'].sort());
});

test('the fallback font is used only for text the standard fonts cannot show', async () => {
  assert.equal(await usesFallback('Plain text, caf\u00e9 \u00b1 5mm, \u201cquotes\u201d \u2013 dashes \u2026'), false);
  assert.equal(await usesFallback('\u0391\u03b8\u03ae\u03bd\u03b1'), true, 'Greek');
  assert.equal(await usesFallback('\u041c\u043e\u0441\u043a\u0432\u0430'), true, 'Cyrillic');
  assert.equal(await usesFallback('x', { type: 'stamp', stamp: { lines: ['\u2713 OK'], frame: 'box' } }), true, 'a stamp line');
  assert.equal(await usesFallback('x', { type: 'table', table: { cols: [1], rows: [1], cells: [['\u2265 5']] } }), true, 'a table cell');
});

// Fork (leojru/redcolumn): one ∅ in a table used to letter every markup in the fallback font.
test('only the markups that need it are lettered in the fallback font', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  const fallbackFont = (d: PDFDocument) => d.embedFont(StandardFonts.Courier);
  const table: Markup = { ...box('x'), id: 't2', createdAt: 2, type: 'table', table: { cols: [1], rows: [1], cells: [['∅ 6']] } };
  const out = await PDFDocument.load(await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [box('4" CONC. SLAB'), table], { fallbackFont }));
  const fontsOf = (i: number) => {
    const annot = out.getPage(0).node.Annots()!.lookup(i) as PDFDict;
    const ap = annot.lookup(PDFName.of('AP')) as PDFDict;
    const n = ap.lookup(PDFName.of('N')) as PDFStream;
    const fonts = (n.dict.lookup(PDFName.of('Resources')) as PDFDict).lookup(PDFName.of('Font')) as PDFDict;
    return fonts.values().map((v) => String((out.context.lookup(v) as PDFDict).get(PDFName.of('BaseFont'))));
  };
  assert.ok(fontsOf(0).every((f) => f.includes('Helvetica')), `text box: ${fontsOf(0)}`);
  assert.ok(fontsOf(1).some((f) => f.includes('Courier')), `table: ${fontsOf(1)}`);
});

test('annotations are saved in the order the markups draw', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  const first = await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [{ ...box('A'), id: 'a', createdAt: 1 }, { ...box('B'), id: 'b', createdAt: 2 }]);
  const loaded = await PDFDocument.load(first);
  const ids = (d: PDFDocument) =>
    d.getPage(0).node.Annots()!.asArray().map((r) => (d.context.lookup(r) as PDFDict).lookup(PDFName.of('NM'), PDFString, PDFHexString).decodeText());
  assert.deepEqual(ids(loaded), ['a', 'b']);
  // A brought to the front (now later than B) and C new: they save as B, A, C.
  const markups: Markup[] = [
    { ...box('A'), id: 'a', createdAt: 3, pdfAnnot: { index: 0, digest: '' } },
    { ...box('B'), id: 'b', createdAt: 2, pdfAnnot: { index: 1, digest: '' } },
    { ...box('C'), id: 'c', createdAt: 4 },
  ];
  const second = await PDFDocument.load(await exportWithAnnotations(first.buffer as ArrayBuffer, markups, { imported: { 0: [0, 1] } }));
  assert.deepEqual(ids(second), ['b', 'a', 'c']);
});
