// Added in the leojru/redcolumn fork: files whose text fonts lost their glyphs are repaired on the next save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';
import { exportWithAnnotations } from './export.ts';
import { importAnnotations, type ImportableAnnotation } from './import.ts';
import { DEFAULT_STYLES, type Markup } from './model.ts';
import { readPdfExtras } from './pdfExtras.ts';
import { BROKEN_FONT_KEY } from './brokenFontKey.ts';

const SANS = new Uint8Array(readFileSync(new URL('../../../apps/web/public/fonts/LiberationSans-Regular.ttf', import.meta.url)));
const systemFonts = { fontkit, load: async () => SANS };
const box: Markup = { id: 't1', type: 'text', pageIndex: 0, points: [[20, 20], [220, 120]], style: { ...DEFAULT_STYLES.text, fontFamily: 'Liberation Sans' }, text: 'REMOVE', status: 'none', author: 'T', createdAt: 1, modifiedAt: 1 } as Markup;

/** The Type0 fonts in the FreeText's appearance, with whether each has its descendant font. */
function apFonts(doc: PDFDocument): { dict: PDFDict; whole: boolean }[] {
  const annots = doc.getPage(0).node.Annots()!.asArray().map((r) => doc.context.lookup(r, PDFDict));
  const free = annots.find((a) => String(a.get(PDFName.of('Subtype'))) === '/FreeText')!;
  const n = (free.lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N')) as PDFRawStream).dict;
  const fonts = n.lookup(PDFName.of('Resources'), PDFDict).lookup(PDFName.of('Font'), PDFDict);
  return fonts.values().map((v) => {
    const dict = doc.context.lookup(v, PDFDict);
    const first = dict.lookup(PDFName.of('DescendantFonts'), PDFArray).get(0);
    return { dict, whole: !!(first instanceof PDFRef ? doc.context.lookup(first) : first) };
  });
}

test('a markup whose appearance font lost its descendant font is found on open and drawn again on save', async () => {
  const blank = await PDFDocument.create();
  blank.addPage([400, 400]);
  const good = await exportWithAnnotations((await blank.save()).buffer as ArrayBuffer, [box], { systemFonts });

  // Break it as the bad saves did: the descendant font (and what hangs off it) is gone.
  const broken = await PDFDocument.load(good);
  const [font] = apFonts(broken);
  assert.equal(font!.whole, true);
  broken.context.delete(font!.dict.lookup(PDFName.of('DescendantFonts'), PDFArray).get(0) as PDFRef);
  const bytes = await broken.save();
  assert.equal(apFonts(await PDFDocument.load(bytes))[0]!.whole, false);

  const extras = await readPdfExtras(bytes);
  assert.equal(extras!.pages[0]!.annots[0]?.[BROKEN_FONT_KEY], true);

  const doc = await PDFDocument.load(bytes);
  const annots = doc.getPage(0).node.Annots()!.asArray().map((r) => doc.context.lookup(r, PDFDict));
  const found: ImportableAnnotation[] = annots.map((a, index) => ({
    index, subtype: String(a.get(PDFName.of('Subtype'))).slice(1), rect: { x: 20, y: 20, w: 200, h: 100 }, color: null, interior: null, opacity: 1, borderWidth: 1, contents: 'REMOVE', author: 'T', intent: '', cloudy: false, da: '', flags: 4, vertices: [], ink: [], line: null, link: null,
    appData: a.lookupMaybe(PDFName.of('NBData'), PDFHexString)?.decodeText() ?? '',
  }));
  const { markups, imported } = importAnnotations(0, found, undefined, extras);
  assert.equal(markups.length, 1);
  assert.equal(markups[0]!.pdfAnnot?.digest, '', 'counts as changed, so the next save writes it');

  const repaired = await exportWithAnnotations(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, markups, { systemFonts, imported: { 0: imported } });
  const out = await PDFDocument.load(repaired);
  const fonts = apFonts(out);
  assert.ok(fonts.length && fonts.every((f) => f.whole), 'the redrawn appearance has a whole font');
  const again = await readPdfExtras(repaired);
  assert.equal(again!.pages[0]!.annots.some((a) => a?.[BROKEN_FONT_KEY]), false);
});

test('an appearance with whole fonts is not flagged', async () => {
  const blank = await PDFDocument.create();
  blank.addPage([400, 400]);
  const good = await exportWithAnnotations((await blank.save()).buffer as ArrayBuffer, [box], { systemFonts });
  const extras = await readPdfExtras(good);
  assert.equal(extras!.pages[0]!.annots.some((a) => a?.[BROKEN_FONT_KEY]), false);
});

test('a markup whose appearance font is a CFF subset is found on open', async () => {
  const base = await PDFDocument.create();
  base.addPage([400, 400]);
  const out = await exportWithAnnotations((await base.save()).buffer as ArrayBuffer, [box], { systemFonts });
  const doc = await PDFDocument.load(out);
  const [font] = apFonts(doc);
  const desc = doc.context.lookup(font!.dict.lookup(PDFName.of('DescendantFonts'), PDFArray).get(0), PDFDict);
  assert.equal((await readPdfExtras(await doc.save()))!.pages[0]!.annots[0]?.[BROKEN_FONT_KEY], undefined, 'a TrueType subset is fine');
  desc.set(PDFName.of('Subtype'), PDFName.of('CIDFontType0'));
  assert.equal((await readPdfExtras(await doc.save()))!.pages[0]!.annots[0]?.[BROKEN_FONT_KEY], true);
});
