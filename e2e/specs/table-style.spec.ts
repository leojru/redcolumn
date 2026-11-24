// Added in the leojru/redcolumn fork (revu-layout). A selected table's top bar shows its own line style
// and width, so changing them back works.
import { expect, test } from '../support/app.ts';

/** Picks a style by name in the top bar's Line style picker (a listbox). */
async function pickLineStyle(page: import('@playwright/test').Page, name: string) {
  await page.locator('.classic-props').getByRole('combobox', { name: 'Line style' }).click();
  await page.getByRole('listbox', { name: 'Line styles' }).getByRole('option', { name: new RegExp(`^${name}$`, 'i') }).click();
}


test.use({ toolbar: 'classic' });

type Raw = { id: string; style: { dash?: string; width: number } };

test("the top bar reads a selected table's line style and width, and takes it back to solid", async ({ app }) => {
  await app.open('plan.pdf');
  await app.tool('table');
  await app.drag([300, 300], [600, 500]);
  const dialog = app.page.locator('.modal').filter({ hasText: 'Rows' });
  await dialog.locator('button[type=submit]').click();
  await expect(dialog).toBeHidden();
  const [m] = (await app.raw()) as unknown as Raw[];
  await app.tool('select');
  await app.page.evaluate((id) => (window as unknown as { __nb: { tools: { select: (ids: string[]) => void } } }).__nb.tools.select([id]), m!.id);

  const table = async () => ((await app.raw()) as unknown as Raw[])[0]!;
  const row = app.page.locator('.classic-props');
  const lineStyle = row.getByRole('combobox', { name: 'Line style' });
  await expect(lineStyle).toContainText(/solid/i);
  await pickLineStyle(app.page, 'dashed');
  await expect.poll(async () => (await table()).style.dash).toBe('dashed');
  await expect(lineStyle).toContainText(/dashed/i);
  await pickLineStyle(app.page, 'solid');
  await expect.poll(async () => (await table()).style.dash).toBeUndefined();
  await expect(lineStyle).toContainText(/solid/i);

  const width = row.locator('label[title="Line width"] input');
  await width.fill('3');
  await width.press('Enter');
  await expect.poll(async () => (await table()).style.width).toBe(3);
  await expect(width).toHaveValue(/^3/);
});
