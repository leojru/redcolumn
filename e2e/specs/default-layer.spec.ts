// Added in the leojru/redcolumn fork (revu-layout). Layers panel › Set as Default: new markups go on
// that layer; the Revu-style Properties row has a Layer field.
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
