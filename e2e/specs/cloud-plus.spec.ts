// Added in the leojru/redcolumn fork. Cloud+ as Revu draws it: no arrowhead where the leader meets the
// cloud; selected, it offers the cloud's fill, hatch and Highlight with the callout's text; its line
// colour goes to both. A hatch stays under the border (#10).
import { writeFileSync } from 'node:fs';
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic' });

type Raw = { id: string; type: string; groupId?: string; style: { stroke: string; startCap?: string; blendMode?: string; hatch?: string; fill?: string | null } };

test('Cloud+: leader without an arrowhead; the cloud styled with fill, hatch and highlight; one line colour', async ({ app }, info) => {
  const raw = async () => (await app.raw()) as unknown as Raw[];
  await app.open('plan.pdf');
  await app.tool('cloudPlus');
  await app.clicks([[150, 520], [330, 640]]);
  await app.page.keyboard.type('REV 1');
  await app.page.mouse.click(5, 300);
  await expect.poll(async () => (await raw()).filter((m) => m.type === 'callout').length).toBe(1);
  const cloud = (await raw()).find((m) => m.type === 'cloud')!;
  const callout = (await raw()).find((m) => m.type === 'callout')!;
  expect(callout.groupId).toBe(cloud.groupId);
  expect(callout.style.startCap).toBe('none');

  // Selected (both), the toolbar shows the cloud's style: Highlight, fill and hatch.
  await app.page.evaluate((ids) => window.__nb.tools.select(ids), [cloud.id, callout.id]);
  await app.page.locator('[data-highlight-toggle]').click();
  await expect.poll(async () => (await raw()).find((m) => m.id === cloud.id)?.style.blendMode).toBe('multiply');
  await app.page.evaluate(() => (window.__nb.tools as unknown as { setStyle(t: string, p: object): void }).setStyle('cloud', { fill: '#c8f7c5', hatch: 'grid', hatchColor: '#ff9966' }));
  await app.page.evaluate(() => (window.__nb.tools as unknown as { setStyle(t: string, p: object): void }).setStyle('cloud', { stroke: '#0000ff' }));
  await expect.poll(async () => (await raw()).find((m) => m.id === callout.id)?.style.stroke).toBe('#0000ff');
  expect((await raw()).find((m) => m.id === cloud.id)?.style.hatch).toBe('grid');

  // A rectangle with a thick border and a hatch: the hatch stays inside the line.
  await app.tool('rect');
  await app.clicks([[420, 520], [620, 640]]);
  const rect = (await raw()).find((m) => m.type === 'rect')!;
  await app.page.keyboard.press('Escape');
  await app.page.evaluate((id) => window.__nb.tools.select([id]), rect.id);
  await app.page.evaluate(() => (window.__nb.tools as unknown as { setStyle(t: string, p: object): void }).setStyle('rect', { width: 6, fill: '#c8f7c5', hatch: 'grid', hatchColor: '#ff9966' }));
  await app.page.evaluate(() => window.__nb.tools.select([]));
  await app.page.evaluate(() => (window.__nb.viewer as unknown as { zoomToRect(r: { x: number; y: number; w: number; h: number }, margin: number): void }).zoomToRect({ x: 120, y: 450, w: 520, h: 220 }, 1.05));
  await app.page.waitForTimeout(800);
  await app.page.screenshot({ path: info.outputPath('cloud-plus.png') });
  const before = (await app.saved()).length;
  await app.cmd('file.saveAs');
  await expect.poll(async () => (await app.saved()).length, { timeout: 30_000 }).toBe(before + 1);
  writeFileSync(info.outputPath('saved.pdf'), (await app.saved()).at(-1)!.bytes);
});
