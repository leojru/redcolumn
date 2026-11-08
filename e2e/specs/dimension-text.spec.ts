// Added in the leojru/redcolumn fork. Dimension text inline by default (the line breaks around it),
// or above the line from the Properties row; drawn with two clicks (Click to Place).
import { writeFileSync } from 'node:fs';
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic' });

type Raw = { id: string; type: string; text?: string; style: { dimText?: string } };

test('a new dimension has its text inline; the toolbar switches it above, and the saved PDF keeps it', async ({ app }, info) => {
  await app.open('plan.pdf');
  await app.tool('dimension');
  await app.clicks([[200, 600], [400, 600]]);
  const dialog = app.page.getByRole('dialog');
  await expect(dialog.locator('input')).toBeFocused();
  await dialog.locator('input').fill('12\'-6"');
  await app.page.keyboard.press('Enter');
  await expect.poll(async () => ((await app.raw()) as unknown as Raw[]).find((m) => m.type === 'dimension')?.text).toBe('12\'-6"');
  const dim = ((await app.raw()) as unknown as Raw[]).find((m) => m.type === 'dimension')!;
  expect(dim.style.dimText).toBe('inline');

  // Two more, to compare: one switched to Above from the toolbar while selected.
  await app.clicks([[200, 680], [400, 680]]);
  await dialog.locator('input').fill('12\'-6"');
  await app.page.keyboard.press('Enter');
  await expect.poll(async () => ((await app.raw()) as unknown as Raw[]).filter((m) => m.type === 'dimension').length).toBe(2);
  const second = ((await app.raw()) as unknown as Raw[]).filter((m) => m.type === 'dimension')[1]!;
  await app.page.keyboard.press('Escape');
  await app.page.evaluate((id) => window.__nb.tools.select([id]), second.id);
  await app.page.locator('select[data-dim-text]').selectOption('above');
  await expect.poll(async () => ((await app.raw()) as unknown as Raw[]).find((m) => m.id === second.id)?.style.dimText).toBe('above');
  // The first keeps its own; the tool's default is left alone (restyling a selection changes only it).
  expect(((await app.raw()) as unknown as Raw[]).find((m) => m.id === dim.id)?.style.dimText).toBe('inline');
  expect(await app.page.evaluate(() => (window.__nb.tools.getState() as unknown as { styles: Record<string, { dimText?: string }> }).styles.dimension?.dimText)).toBe('inline');

  const before = (await app.saved()).length;
  await app.cmd('file.saveAs');
  await expect.poll(async () => (await app.saved()).length, { timeout: 30_000 }).toBe(before + 1);
  writeFileSync(info.outputPath('dimensions.pdf'), (await app.saved()).at(-1)!.bytes);
});
