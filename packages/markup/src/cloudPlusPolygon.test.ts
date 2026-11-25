// Added in the leojru/redcolumn fork: a Cloud+ whose cloud is a polygon (outlined corner by corner, as Revu's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDict, PDFDocument, PDFName, PDFString, PDFHexString } from 'pdf-lib';
import { exportWithAnnotations } from './export.ts';
import { nearestOnCloud } from './callout.ts';
import { cloudPlusGroups } from './bluebeamTypes.ts';
import { DEFAULT_STYLES, type Markup, type Point } from './model.ts';

const corners: Point[] = [[100, 100], [300, 100], [320, 250], [120, 280]];
const cloud: Markup = { id: 'c', type: 'polygonCloud', pageIndex: 0, points: corners, style: { ...DEFAULT_STYLES.polygonCloud, arcRadius: 8 }, status: 'none', author: 'T', createdAt: 1, modifiedAt: 1, groupId: 'g' };
const callout: Markup = { id: 'k', type: 'callout', pageIndex: 0, points: [[300, 100], [340, 60], [340, 40], [420, 70]], style: { ...DEFAULT_STYLES.callout }, text: 'NOTE', status: 'none', author: 'T', createdAt: 2, modifiedAt: 2, groupId: 'g' };

test('a polygon cloud with its callout is a Cloud+, saved as Revu writes one', async () => {
  assert.ok(cloudPlusGroups([cloud, callout]).has('g'));
  const doc = await PDFDocument.create();
  doc.addPage([500, 500]);
  const out = await PDFDocument.load(await exportWithAnnotations((await doc.save()).buffer as ArrayBuffer, [cloud, callout]));
  const annots = out.getPage(0).node.Annots()!.asArray().map((r) => out.context.lookup(r) as PDFDict);
  for (const a of annots) {
    assert.equal(a.lookup(PDFName.of('Subj'), PDFString, PDFHexString).decodeText(), 'Cloud+');
    assert.equal(String(a.get(PDFName.of('ITEx'))), '/PolyText');
  }
  assert.ok(annots.some((a) => String(a.get(PDFName.of('Subtype'))) === '/Polygon'), 'the cloud stays a polygon');
});

test("a polygon cloud's leader tip lands on a join of its outline", () => {
  const tip = nearestOnCloud(cloud, [500, 300]);
  const onEdge = corners.some((p, i) => {
    const q = corners[(i + 1) % corners.length]!;
    const cross = (q[0] - p[0]) * (tip[1] - p[1]) - (q[1] - p[1]) * (tip[0] - p[0]);
    return Math.abs(cross) / Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6;
  });
  assert.ok(onEdge, `on an edge: ${tip}`);
  assert.ok(tip[0] > 200, `on the side facing the point: ${tip}`);
});
