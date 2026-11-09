// Added in the leojru/redcolumn fork (revu-layout). The text's colour apart from its border's, borders
// drawn as clouds on text boxes and snapshots, and a Length's text typed over.
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic' });

type Raw = { type: string; style: { stroke: string; textColor?: string; cloudBorder?: boolean; arcRadius?: number; dash?: string; width: number }; id: string };

async function textBox(app: Parameters<Parameters<typeof test>[2]>[0]['app']) {
  await app.open('plan.pdf');
  await app.tool('text');
  await app.drag([300, 300], [500, 380]);
  await app.page.locator('textarea.text-editor').fill('Note');
  await app.page.keyboard.press('Control+Enter');
  await app.tool('select');
  await app.clicks([[400, 340]]);
}

/** Picks swatch `n` in the named colour menu of the top bar; returns its colour. */
const color = async (app: { page: import('@playwright/test').Page }, label: string, n: number) => {
  await app.page.locator('.classic-props').getByRole('button', { name: label }).first().click();
  const swatch = app.page.locator('.color-pop .color-swatch').nth(n);
  const hex = (await swatch.getAttribute('title'))!;
  await swatch.click();
  return hex.toLowerCase();
};

test('the line colour and the text colour change apart in the top bar', async ({ app }) => {
  await textBox(app);
  const before = ((await app.raw()) as unknown as Raw[])[0]!.style.stroke;
  const line = await color(app, 'Line color', 12);
  let s = ((await app.raw()) as unknown as Raw[])[0]!.style;
  expect(s.stroke.toLowerCase()).toBe(line);
  expect(s.textColor).toBe(before);
  const text = await color(app, 'Text color', 20);
  s = ((await app.raw()) as unknown as Raw[])[0]!.style;
  expect(s.stroke.toLowerCase()).toBe(line);
  expect(s.textColor?.toLowerCase()).toBe(text);
});

test('Cloud in the line style list makes a text box a cloud, with its settings in the bar', async ({ app }) => {
  await textBox(app);
  const row = app.page.locator('.classic-props');
  const lineStyle = row.locator('label[title="Line style"] select');
  await lineStyle.selectOption('cloud');
  expect(((await app.raw()) as unknown as Raw[])[0]!.style.cloudBorder).toBe(true);
  await row.getByRole('combobox', { name: 'Cloud arcs' }).selectOption('inside');
  expect(((await app.raw()) as unknown as Raw[])[0]!.style).toMatchObject({ cloudBorder: true, cloudInside: true });
  await lineStyle.selectOption('solid');
  expect(((await app.raw()) as unknown as Raw[])[0]!.style.cloudBorder).toBeUndefined();
});

test.describe('snapshots', () => {
  test.use({ settings: { unitSystem: 'imperial', lengthUnit: 'ft', areaUnit: 'ft', volumeUnit: 'ft', vectorSnapshots: true } });

  test('a pasted snapshot takes a dashed or a cloud border, and saves', async ({ app }) => {
    await app.open('plan.pdf');
    await app.tool('snapshot');
    await app.drag([250, 250], [550, 450]);
    await expect.poll(async () => (await app.command('edit.paste')).enabled).toBe(true);
    await app.cmd('edit.paste');
    await app.tool('select');
    const pasted = ((await app.raw()) as unknown as Raw[]).find((m) => m.type === 'image')!;
    await app.page.evaluate((id) => (window as unknown as { __nb: { tools: { select: (ids: string[]) => void } } }).__nb.tools.select([id]), pasted.id);
    const lineStyle = app.page.locator('.classic-props label[title="Line style"] select');
    await expect(lineStyle).toBeVisible();
    await lineStyle.selectOption('dashed');
    let s = ((await app.raw()) as unknown as Raw[]).find((m) => m.type === 'image')!.style;
    expect(s.dash).toBe('dashed');
    expect(s.width).toBeGreaterThan(0);
    await lineStyle.selectOption('cloud');
    s = ((await app.raw()) as unknown as Raw[]).find((m) => m.type === 'image')!.style;
    expect(s.cloudBorder).toBe(true);
    expect(s.dash).toBeUndefined();
    const before = (await app.saved()).length;
    await app.cmd('file.saveAs');
    await expect.poll(async () => (await app.saved()).length, { timeout: 30_000 }).toBe(before + 1);
  });
});

test.describe('length', () => {
  test('double-clicking a Length and typing a new length resizes the line', async ({ app }) => {
    await app.open('plan.pdf');
    await app.calibrate();
    await app.tool('length');
    await app.clicks([[300, 500], [400, 500]]);
    await app.tool('select');
    const before = ((await app.raw()) as unknown as { points: number[][] }[])[0]!.points;
    const mid = await app.at([350, 500]);
    await app.page.mouse.dblclick(mid.x, mid.y);
    const editor = app.page.locator('textarea[aria-label="Length"]');
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue(/'-/);
    await editor.fill(`3'-0"`);
    await editor.press('Enter');
    await expect(editor).toBeHidden();
    const after = ((await app.raw()) as unknown as { points: number[][] }[])[0]!.points;
    expect(after[0]).toEqual(before[0]);
    // Calibrated at 100 pt = 10 ft: 3 ft is 30 pt.
    expect(after[1]![0]).toBeCloseTo(before[0]![0]! + 30, 3);
    expect(after[1]![1]).toBeCloseTo(before[0]![1]!, 3);
  });
});
