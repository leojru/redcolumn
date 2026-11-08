// Added in the leojru/redcolumn fork. A text box's border shape (box, circle, triangle, hexagon),
// with the text centred inside it, as Revu's Shape list.
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic' });

type Raw = { id: string; type: string; text?: string; points: [number, number][]; style: { boxShape?: string; textAlign?: string; verticalAlign?: string } };

test('a text box takes a border shape; its text centres inside', async ({ app }, info) => {
  const raw = async () => (await app.raw()) as unknown as Raw[];
  await app.open('plan.pdf');
  const shapes = ['rect', 'circle', 'triangle', 'hexagon'] as const;
  for (const [i, shape] of shapes.entries()) {
    await app.tool('text');
    await app.clicks([[120 + i * 140, 560]]);
    await app.page.keyboard.type('1');
    await app.page.mouse.click(5, 300);
    await expect.poll(async () => (await raw()).filter((m) => m.type === 'text').length).toBe(i + 1);
    const id = (await raw()).filter((m) => m.type === 'text')[i]!.id;
    await app.page.evaluate((id) => window.__nb.tools.select([id]), id);
    await app.page.locator('select[data-box-shape]').selectOption(shape);
    if (shape !== 'rect') await expect.poll(async () => (await raw()).find((m) => m.id === id)?.style.boxShape).toBe(shape);
    // Right-click › Auto-size Text Box: the shape is fitted round the text.
    await app.cmd('edit.autoSize');
  }
  const sized = (await raw()).filter((m) => m.type === 'text');
  const width = (m: Raw) => Math.abs(m.points[1]![0] - m.points[0]![0]);
  expect(width(sized[0]!)).toBeLessThan(30);
  expect(width(sized[1]!)).toBeGreaterThan(width(sized[0]!));
  const hex = (await raw()).filter((m) => m.type === 'text')[3]!;
  expect(hex.style).toMatchObject({ boxShape: 'hexagon', textAlign: 'center', verticalAlign: 'middle' });
  await app.page.evaluate(() => window.__nb.tools.select([]));
  await app.page.evaluate(() => (window.__nb.viewer as unknown as { zoomToRect(r: { x: number; y: number; w: number; h: number }, margin: number): void }).zoomToRect({ x: 100, y: 530, w: 520, h: 90 }, 1.1));
  await app.page.waitForTimeout(800);
  await app.page.screenshot({ path: info.outputPath('shapes.png') });
});
