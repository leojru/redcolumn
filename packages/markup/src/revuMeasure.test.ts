// Added in the leojru/redcolumn fork: scales and lengths written as Revu writes its own, so Revu measures them again in feet and inches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib';
import { SCALE_PRESETS } from '@nb/measure';
import { exportWithAnnotations } from './export.ts';
import { scaleFromMeasure, type PdfDictValue } from './bluebeam.ts';
import { DEFAULT_STYLES, type Markup } from './model.ts';

const threeSixteenths = { ...SCALE_PRESETS.find((p) => p.label === '3/16" = 1\'-0"')!.scale, precision: 4 };
const length: Markup = { id: 'l', type: 'length', pageIndex: 0, points: [[100, 100], [300, 100]], style: { ...DEFAULT_STYLES.length, fontSize: 8, stroke: '#0000ff' }, status: 'none', author: 'T', createdAt: 1, modifiedAt: 1 };

/** The /Measure of Leo's length drawn in Revu (Pickett Studios, 11-25-26), as our reader sees it. */
const revuMeasure: PdfDictValue = {
  Type: 'Measure',
  Subtype: 'RL',
  R: '0.1875 in = 1 ft\' in"',
  X: [{ Type: 'NumberFormat', U: "'", C: 0.07407407, F: 'F', D: 4, FD: true, SS: '' }],
  D: [
    { Type: 'NumberFormat', U: "'", C: 1, F: 'F', D: 4, FD: true, PS: '', SS: '-' },
    { Type: 'NumberFormat', U: '"', C: 12, F: 'F', D: 4, FD: true, PS: '', SS: '' },
  ],
  TargetUnitConversion: 0.001157407,
} as unknown as PdfDictValue;

test("Revu's feet-and-inches scale reads as feet and inches, labelled as people write it", () => {
  const s = scaleFromMeasure(revuMeasure)!;
  assert.equal(s.unit, 'ft');
  assert.equal(s.feetInches, true);
  assert.equal(s.precision, 4);
  assert.equal(s.label, '3/16" = 1\'-0"');
});

test('a length saves its scale and text style as Revu writes its own', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([500, 500]);
  const out = await PDFDocument.load(await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [length], { scaleFor: () => threeSixteenths }));
  const annot = out.context.lookup(out.getPage(0).node.Annots()!.get(0)) as PDFDict;
  const measure = annot.lookup(PDFName.of('Measure'), PDFDict);
  assert.equal(measure.lookup(PDFName.of('R'), PDFString).decodeText(), '0.1875 in = 1 ft\' in"');
  assert.ok(Math.abs(measure.lookup(PDFName.of('TargetUnitConversion'), PDFNumber).asNumber() - 0.001157407) < 1e-8);
  const d = measure.lookup(PDFName.of('D'), PDFArray);
  const unit = (i: number) => (d.lookup(i, PDFDict).lookup(PDFName.of('U'), PDFString)).decodeText();
  assert.deepEqual([unit(0), unit(1)], ["'", '"']);
  assert.equal(String(d.lookup(1, PDFDict).get(PDFName.of('F'))), '/F', 'inches in fractions');
  assert.equal(annot.lookup(PDFName.of('MeasurementTypes'), PDFNumber).asNumber(), 130);
  assert.match(annot.lookup(PDFName.of('DS'), PDFString, PDFHexString).decodeText(), /^font: Helvetica 8pt; .*color:#0000FF/);
  // And it reads back as the scale it was.
  const { readPdfExtras } = await import('./pdfExtras.ts');
  const extras = (await readPdfExtras(await out.save()))!;
  const back = scaleFromMeasure((extras.pages[0]!.annots[0] as PdfDictValue).Measure as PdfDictValue)!;
  assert.equal(back.feetInches, true);
  assert.equal(back.precision, 4);
  assert.equal(back.label, '3/16" = 1\'-0"');
  assert.ok(Math.abs(back.metersPerPoint / threeSixteenths.metersPerPoint - 1) < 1e-6);
});
