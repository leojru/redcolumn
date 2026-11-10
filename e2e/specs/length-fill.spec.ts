// Added in the leojru/redcolumn fork (revu-layout). The top bar's Fill on a Length is its label's background.
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic', settings: { unitSystem: 'imperial', lengthUnit: 'ft', areaUnit: 'ft', volumeUnit: 'ft', vectorSnapshots: false } });

type Raw = { id: string; type: string; style: { labelBackground?: string | null; fill?: string | null } };

test("a Length's Fill sets its label background, and No fill takes it away", async ({ app }) => {
  await app.open('plan.pdf');
  await app.calibrate();
  await app.tool('length');
  await app.clicks([[200, 400], [500, 400]]);
  const length = async () => ((await app.raw()) as unknown as Raw[]).find((m) => m.type === 'length');
  await expect.poll(length).toBeTruthy();
  const { id } = (await length())!;
  await app.tool('select');
  await app.page.evaluate((i) => (window as unknown as { __nb: { tools: { select: (ids: string[]) => void } } }).__nb.tools.select([i]), id);

  const fill = app.page.locator('.classic-props').getByRole('button', { name: /fill/i }).first();
  await expect(fill).toBeEnabled();
  await fill.click();
  const swatch = app.page.locator('.color-pop .color-swatch').nth(20);
  const color = (await swatch.getAttribute('title'))!.toLowerCase();
  await swatch.click();
  await expect.poll(async () => (await length())!.style.labelBackground?.toLowerCase()).toBe(color);
  expect((await length())!.style.fill ?? null).toBeNull();

  await fill.click();
  await app.page.locator('.color-pop').getByRole('button', { name: 'No fill' }).click();
  await expect.poll(async () => (await length())!.style.labelBackground).toBeUndefined();
});
