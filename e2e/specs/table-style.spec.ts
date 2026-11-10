// Added in the leojru/redcolumn fork (revu-layout). A selected table's top bar shows its own line style
// and width, so changing them back works.
import { expect, test } from '../support/app.ts';

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
  const lineStyle = row.locator('label[title="Line style"] select');
  await expect(lineStyle).toHaveValue('solid');
  await lineStyle.selectOption('dashed');
  await expect.poll(async () => (await table()).style.dash).toBe('dashed');
  await expect(lineStyle).toHaveValue('dashed');
  await lineStyle.selectOption('solid');
  await expect.poll(async () => (await table()).style.dash).toBeUndefined();
  await expect(lineStyle).toHaveValue('solid');

  const width = row.locator('label[title="Line width"] input');
  await width.fill('3');
  await width.press('Enter');
  await expect.poll(async () => (await table()).style.width).toBe(3);
  await expect(width).toHaveValue(/^3/);
});
