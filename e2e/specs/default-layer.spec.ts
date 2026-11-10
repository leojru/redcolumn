// Added in the leojru/redcolumn fork (revu-layout). Layers panel › Set as Default: new markups go on
// that layer; the Revu-style Properties row has a Layer field.
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic', classicLayout: true });

type Raw = { id: string; type: string; layer?: string };

test('a layer set as default takes new markups, and the Properties row shows and changes it', async ({ app }) => {
  await app.open('plan.pdf');
  const raw = async () => (await app.raw()) as unknown as Raw[];
  await app.tool('rect');
  await app.drag([200, 300], [300, 380]);
  await expect.poll(async () => (await raw()).length).toBe(1);
  const [first] = await raw();
  // Put it on a layer, so the Layers panel lists one.
  await app.page.evaluate((id) => (window as unknown as { __nb: { tools: { store: { update(id: string, p: object): void } } } }).__nb.tools.store.update(id, { layer: 'Walls' }), first!.id);

  await app.cmd('window.layers');
  const row = app.page.locator('.layers-grid tr').filter({ hasText: 'Walls' }).first();
  await row.click({ button: 'right' });
  await app.page.getByRole('menuitem', { name: 'Set as Default' }).click();
  await expect(row.locator('.layer-default')).toBeVisible();

  // The next markup from any tool goes on it, and the Properties row says so.
  await app.tool('ellipse');
  await expect(app.page.locator('.classic-props select[aria-label="Layer"]')).toHaveValue('Walls');
  await app.drag([400, 300], [500, 380]);
  await expect.poll(async () => (await raw()).find((m) => m.type === 'ellipse')?.layer).toBe('Walls');

  // Selected, the Properties row moves it to another layer.
  const ellipse = (await raw()).find((m) => m.type === 'ellipse')!;
  await app.tool('select');
  await app.page.evaluate((id) => (window as unknown as { __nb: { tools: { select: (ids: string[]) => void } } }).__nb.tools.select([id]), ellipse.id);
  await app.page.locator('.classic-props select[aria-label="Layer"]').selectOption('');
  await expect.poll(async () => (await raw()).find((m) => m.type === 'ellipse')?.layer).toBeUndefined();
});

test('Isolate shows only one markup layer, leaving the drawing, and End Isolate brings the rest back', async ({ app }) => {
  await app.open('plan.pdf');
  const raw = async () => (await app.raw()) as unknown as Raw[];
  for (const [i, layer] of ['Walls', 'Doors'].entries()) {
    await app.tool('rect');
    await app.drag([200 + i * 150, 300], [300 + i * 150, 380]);
    await expect.poll(async () => (await raw()).length).toBe(i + 1);
    const m = (await raw())[i]!;
    await app.page.evaluate(([id, l]) => (window as unknown as { __nb: { tools: { store: { update(id: string, p: object): void } } } }).__nb.tools.store.update(id, { layer: l }), [m.id, layer] as const);
  }
  await app.cmd('window.layers');
  const row = (name: string) => app.page.locator('.layers-grid tbody tr').filter({ hasText: name }).first();
  await row('Walls').click({ button: 'right' });
  await app.page.getByRole('menuitem', { name: 'Isolate', exact: true }).click();
  await expect(row('Doors')).toHaveClass(/off/);
  await expect(row('Walls')).not.toHaveClass(/off/);
  await row('Walls').click({ button: 'right' });
  await app.page.getByRole('menuitem', { name: 'End Isolate' }).click();
  await expect(row('Doors')).not.toHaveClass(/off/);
});

test('a markup layer saved into the PDF is listed once when the file is opened again', async ({ app }) => {
  await app.open('plan.pdf');
  const raw = async () => (await app.raw()) as unknown as Raw[];
  await app.tool('rect');
  await app.drag([200, 300], [300, 380]);
  await expect.poll(async () => (await raw()).length).toBe(1);
  await app.page.evaluate((id) => (window as unknown as { __nb: { tools: { store: { update(id: string, p: object): void } } } }).__nb.tools.store.update(id, { layer: 'Walls' }), (await raw())[0]!.id);
  const before = (await app.saved()).length;
  await app.cmd('file.saveAs');
  await expect.poll(async () => (await app.saved()).length, { timeout: 30_000 }).toBe(before + 1);
  const saved = (await app.saved()).at(-1)!;

  await app.page.locator('input[type=file][accept*="pdf"]').first().setInputFiles({ name: 'walls.pdf', mimeType: 'application/pdf', buffer: saved.bytes });
  await expect.poll(async () => (await app.documents()).find((d) => d.active)?.name).toBe('walls.pdf');
  await expect.poll(async () => (await raw()).find((m) => m.type === 'rect')?.layer, { timeout: 30_000 }).toBe('Walls');
  await app.cmd('window.layers');
  const rows = app.page.locator('.layers-grid tbody tr').filter({ hasText: 'Walls' });
  await expect(rows).toHaveCount(1);
  // The one row hides the markups too.
  await rows.first().locator('.layer-eye').click();
  await expect(rows.first()).toHaveClass(/off/);
});

test('Add Child puts a layer under the selected one, and the file keeps it nested', async ({ app }) => {
  await app.open('plan.pdf');
  const raw = async () => (await app.raw()) as unknown as Raw[];
  await app.cmd('window.layers');
  const add = async (item: string, name: string) => {
    await app.page.locator('.layers-panel button[title="Add Layer"], button[title="Add Layer"]').first().click();
    await app.page.getByRole('menuitem', { name: item }).click();
    const dialog = app.page.locator('.modal').filter({ hasText: 'Add Layer' });
    await dialog.locator('input').fill(name);
    await dialog.locator('button[type=submit]').click();
  };
  await add('Add After…', 'Walls');
  const row = (name: string) => app.page.locator('.layers-grid tbody tr').filter({ hasText: name }).first();
  await row('Walls').click();
  await add('Add Child…', 'Doors');
  // Listed straight after its parent, indented under it.
  await expect(app.page.locator('.layers-grid tbody tr .layer-label')).toHaveText(['Walls', 'Doors']);
  const indent = async (name: string) => row(name).locator('.layer-cell').evaluate((el) => parseFloat((el as HTMLElement).style.paddingLeft));
  expect(await indent('Doors')).toBeGreaterThan(await indent('Walls'));

  await app.tool('rect');
  await app.drag([200, 300], [300, 380]);
  await expect.poll(async () => (await raw()).length).toBe(1);
  await app.page.evaluate((id) => (window as unknown as { __nb: { tools: { store: { update(id: string, p: object): void } } } }).__nb.tools.store.update(id, { layer: 'Doors' }), (await raw())[0]!.id);
  const before = (await app.saved()).length;
  await app.cmd('file.saveAs');
  await expect.poll(async () => (await app.saved()).length, { timeout: 30_000 }).toBe(before + 1);
  const doc = await PDFDocument.load((await app.saved()).at(-1)!.bytes);
  const order = doc.catalog.lookup(PDFName.of('OCProperties'), PDFDict).lookup(PDFName.of('D'), PDFDict).lookup(PDFName.of('Order'), PDFArray);
  const name = (x: unknown) => (doc.context.lookup(x as never) as PDFDict).lookup(PDFName.of('Name'), PDFString, PDFHexString).decodeText();
  // Walls, then the array of its children: Doors.
  expect(name(order.get(0))).toBe('Walls');
  const kids = order.lookup(1, PDFArray);
  expect(kids.asArray().map(name)).toEqual(['Doors']);

  // Opened again, it is still one Walls with Doors under it.
  await app.page.locator('input[type=file][accept*="pdf"]').first().setInputFiles({ name: 'nested.pdf', mimeType: 'application/pdf', buffer: (await app.saved()).at(-1)!.bytes });
  await expect.poll(async () => (await app.documents()).find((d) => d.active)?.name).toBe('nested.pdf');
  await expect.poll(async () => (await raw()).find((m) => m.type === 'rect')?.layer, { timeout: 30_000 }).toBe('Doors');
  await expect(app.page.locator('.layers-grid tbody tr .layer-label')).toHaveText(['Walls', 'Doors']);
  expect(await indent('Doors')).toBeGreaterThan(await indent('Walls'));
});
