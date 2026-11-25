// Added in the leojru/redcolumn fork. Split shows the same document in both panes, as Revu does:
// a view of its own in each, the markups shared; closing it on one side leaves it open on the other.
import { expect, test } from '../support/app.ts';

// The classic layout (its Properties row never changes height, so a click lands where it was aimed).
test.use({ toolbar: 'classic' });

test('split shows the same document twice, each pane its own view, the markups shared', async ({ app }, info) => {
  await app.open('plan.pdf');
  await app.tool('rect');
  await app.drag([300, 450], [350, 500]);
  await app.cmd('view.split');
  await expect.poll(async () => (await app.command('view.split')).checked).toBe(true);
  await expect(app.page.locator('main.stage canvas')).toHaveCount(2, { timeout: 15_000 });
  // Listed once; the right pane shows it (with its markup).
  await expect.poll(async () => (await app.documents()).map((d) => d.name)).toEqual(['plan.pdf']);
  const count = () => app.page.evaluate(() => window.__nb.tools.store.all().length);
  expect(await count()).toBe(1);
  // Back in the left pane, a markup drawn there is in the document both panes show.
  const left = (await app.page.locator('main.stage canvas').first().boundingBox())!;
  await app.page.mouse.click(left.x + 20, left.y + 20);
  await app.tool('ellipse');
  await app.drag([500, 450], [560, 500]);
  await expect.poll(async () => (await app.markups()).length).toBe(2);
  await app.page.waitForTimeout(500);
  await app.page.screenshot({ path: info.outputPath('split.png') });
  // Single View: one tab, the document still open with both markups.
  await app.cmd('view.unsplit');
  await expect.poll(async () => (await app.command('view.split')).checked).toBe(false);
  await expect(app.page.locator('main.stage canvas')).toHaveCount(1);
  expect((await app.documents()).length).toBe(1);
  expect(await count()).toBe(2);
});

test('closing the right pane of a split document closes that view only, the document stays open', async ({ app }) => {
  await app.open('plan.pdf');
  await app.cmd('view.split');
  await expect(app.page.locator('main.stage canvas')).toHaveCount(2, { timeout: 15_000 });
  await app.page.locator('main.stage').nth(1).click({ position: { x: 5, y: 5 } });
  await app.cmd('file.close');
  await expect.poll(async () => (await app.command('view.split')).checked).toBe(false);
  await expect(app.page.locator('main.stage canvas')).toHaveCount(1);
  expect((await app.documents()).map((d) => d.name)).toEqual(['plan.pdf']);
});
