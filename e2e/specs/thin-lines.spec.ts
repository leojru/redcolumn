// Added in the leojru/redcolumn fork (revu-layout). Disable Line Weights draws the page's lines as hairlines.
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic' });

/** Dark pixels on the page canvas. */
const dark = (app: { page: import('@playwright/test').Page }) =>
  app.page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i]! < 128 && data[i + 3]! > 128) n++;
    return n;
  });

test('Disable Line Weights thins the page lines, and turning it off brings them back', async ({ app }) => {
  await app.open('plan.pdf');
  // The room's heavy outline, close up.
  await app.page.evaluate(() => (window as unknown as { __nb: { viewer: { zoomToRect: (r: object, m: number) => void } } }).__nb.viewer.zoomToRect({ x: 290, y: 190, w: 220, h: 120 }, 1));
  await app.page.waitForTimeout(1200);
  const heavy = await dark(app);
  await app.cmd('view.thinLines');
  await expect.poll(() => dark(app), { timeout: 8000 }).toBeLessThan(heavy * 0.6);
  await app.cmd('view.thinLines');
  await expect.poll(() => dark(app), { timeout: 8000 }).toBeGreaterThan(heavy * 0.9);
});
