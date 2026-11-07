// Added in the leojru/redcolumn fork (revu-layout). Vector snapshots: Snapshot copies the page
// content as vector graphics (and the markups in the area as markups); a saved PDF keeps it vector.
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFStream } from 'pdf-lib';
import { expect, test } from '../support/app.ts';

test.use({ settings: { unitSystem: 'imperial', lengthUnit: 'ft', areaUnit: 'ft', volumeUnit: 'ft', vectorSnapshots: true } });

type Raw = { id: string; type: string; groupId?: string; vector?: string; vectorImage?: string };

/** Every content stream drawn by a form XObject and the forms it draws, and whether any draws an image. */
function formContents(doc: PDFDocument, form: PDFStream, depth = 0): { text: string; images: number } {
  const decode = (s: PDFStream) => new TextDecoder('latin1').decode(s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : s.getContents());
  let text = decode(form);
  let images = 0;
  const xobjects = form.dict.lookupMaybe(PDFName.of('Resources'), PDFDict)?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  if (xobjects && depth < 6)
    for (const key of xobjects.keys()) {
      const x = xobjects.lookup(key, PDFStream);
      const subtype = x.dict.get(PDFName.of('Subtype'))?.toString();
      if (subtype === '/Image') images++;
      else if (subtype === '/Form') {
        const inner = formContents(doc, x, depth + 1);
        text += `\n${inner.text}`;
        images += inner.images;
      }
    }
  return { text, images };
}

test('snapshot copies the drawing as vector, with its markups, and saves it as vector', async ({ app }) => {
  await app.open('plan.pdf');
  // A markup inside the area, which comes along as a markup.
  await app.tool('rect');
  await app.drag([300, 300], [360, 340]);
  expect((await app.markups()).map((m) => m.type)).toEqual(['rect']);

  // The area around the title and the door box.
  await app.tool('snapshot');
  await app.drag([30, 20], [700, 480]);
  await expect.poll(async () => (await app.command('edit.paste')).enabled).toBe(true);
  await app.cmd('edit.paste');

  const raw = (await app.raw()) as unknown as Raw[];
  const snapshot = raw.find((m) => m.type === 'image');
  expect(snapshot?.vector?.startsWith('data:application/pdf;base64,')).toBe(true);
  expect(snapshot?.vectorImage).toBeTruthy();
  // The pasted rectangle is grouped with the snapshot; the original stays as it was.
  const rects = raw.filter((m) => m.type === 'rect');
  expect(rects).toHaveLength(2);
  expect(snapshot!.groupId).toBeTruthy();
  expect(rects.filter((r) => r.groupId === snapshot!.groupId)).toHaveLength(1);

  // Saved, the snapshot's appearance draws the page's own content: text operators, no picture.
  const before = (await app.saved()).length;
  await app.cmd('file.saveAs');
  await expect.poll(async () => (await app.saved()).length, { timeout: 30_000 }).toBe(before + 1);
  const doc = await PDFDocument.load((await app.saved()).at(-1)!.bytes, { ignoreEncryption: true });
  const annots = doc.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray).asArray().map((ref) => doc.context.lookup(ref, PDFDict));
  const stamp = annots.find((d) => d.get(PDFName.of('Subtype'))?.toString() === '/Stamp');
  expect(stamp).toBeTruthy();
  const ap = stamp!.lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N'), PDFStream);
  const { text, images } = formContents(doc, ap);
  expect(text).toMatch(/\/Fm0 Do/);
  expect(text).toMatch(/T[jJ]/);
  expect(images).toBe(0);
});

test('with Vector Snapshots off, snapshot copies one picture', async ({ app }) => {
  await app.page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('nb.settings') ?? '{}');
    localStorage.setItem('nb.settings', JSON.stringify({ ...s, vectorSnapshots: false }));
  });
  await app.page.reload();
  await app.page.waitForFunction(() => !!window.__nb?.commands);
  await app.open('plan.pdf');
  await app.tool('snapshot');
  await app.drag([30, 20], [700, 480]);
  await expect.poll(async () => (await app.command('edit.paste')).enabled).toBe(true);
  await app.cmd('edit.paste');
  const raw = (await app.raw()) as unknown as Raw[];
  expect(raw.map((m) => m.type)).toEqual(['image']);
  expect(raw[0]!.vector).toBeUndefined();
});

test('cut content copies the content it removes as vector', async ({ app }) => {
  await app.open('plan.pdf');
  await app.tool('cutContent');
  await app.drag([30, 20], [700, 480]);
  await expect.poll(async () => (await app.command('edit.paste')).enabled, { timeout: 20_000 }).toBe(true);
  await app.cmd('edit.paste');
  const raw = (await app.raw()) as unknown as Raw[];
  expect(raw.map((m) => m.type)).toEqual(['image']);
  expect(raw[0]!.vector?.startsWith('data:application/pdf;base64,')).toBe(true);
});
