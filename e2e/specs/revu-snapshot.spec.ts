// Added in the leojru/redcolumn fork (revu-layout). A Revu snapshot comes in as its drawing, with its
// border and fill as settings: one border on screen, and both can be changed.
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic' });

type Raw = { id: string; type: string; vector?: string; style: { fill: string | null; cloudBorder?: boolean; width: number; arcRadius?: number } };

/** A page with one snapshot written the way Revu writes them. */
async function revuFile() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const ctx = doc.context;
  const content = ctx.register(ctx.stream('2 w 0 0 m 200 100 l S', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 200, 100] }));
  const form = ctx.register(ctx.stream('q 1 1 0 rg 0 0 200 100 re f Q /MWFOForm Do q 1 0 0 RG 3 w 3 3 194 94 re S Q', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 200, 100], Resources: { XObject: { MWFOForm: content } } }));
  const stamp = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Stamp', IT: 'StampSnapshot', Subj: 'Snapshot', F: 4, Rect: [100, 500, 300, 600], BS: { W: 3, S: 'S' }, BE: { S: 'C', I: 2 }, C: [1, 0, 0], IC: [1, 1, 0], AP: { N: form } }));
  page.node.set(PDFName.of('Annots'), ctx.obj([stamp]));
  return Buffer.from(await doc.save());
}

test("a Revu snapshot's cloud and fill are settings that can be changed and saved", async ({ app }) => {
  await app.page.locator('input[type=file][accept*="pdf"]').first().setInputFiles({ name: 'revu-snapshot.pdf', mimeType: 'application/pdf', buffer: await revuFile() });
  // The document's store appears a moment after the file is handed over.
  const snapshot = async () => ((await app.raw().catch(() => [])) as unknown as Raw[]).find((m) => m.type === 'image');
  await expect.poll(snapshot, { timeout: 30_000 }).toBeTruthy();
  const found = (await snapshot())!;
  expect(found.vector).toMatch(/^data:application\/pdf/);
  expect(found.style).toMatchObject({ fill: '#ffff00', cloudBorder: true, width: 3, arcRadius: 7 });

  await app.page.evaluate((id) => (window as unknown as { __nb: { tools: { select: (ids: string[]) => void } } }).__nb.tools.select([id]), found.id);
  const lineStyle = app.page.locator('.classic-props label[title="Line style"] select');
  await lineStyle.selectOption({ label: 'Solid' });
  await expect.poll(async () => (await snapshot())!.style.cloudBorder ?? false).toBe(false);

  const before = (await app.saved()).length;
  await app.cmd('file.saveAs');
  await expect.poll(async () => (await app.saved()).length, { timeout: 30_000 }).toBe(before + 1);
  const out = await PDFDocument.load((await app.saved()).at(-1)!.bytes);
  const annot = out.getPage(0).node.Annots()!.lookup(0, PDFDict);
  expect(annot.get(PDFName.of('BE'))).toBeUndefined();
  expect(annot.get(PDFName.of('IC'))?.toString()).toContain('1 1 0');
  expect(annot.get(PDFName.of('IT'))?.toString()).toBe('/StampSnapshot');
});
