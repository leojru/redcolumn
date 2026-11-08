// Added in the leojru/redcolumn fork. The classic Properties row stays one line; what does not fit
// is reached with the wheel or the arrows at its ends.
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic' });

for (const width of [1900, 1200]) {
  test(`a long Properties row (a dimension's) can be scrolled to its end at ${width}px`, async ({ app }, info) => {
    await app.page.setViewportSize({ width, height: 900 });
    await app.open('plan.pdf');
    await app.tool('dimension');
    const row = app.page.locator('.classic-props');
    const right = app.page.locator('.classic-props-scroll.right');
    const size = row.locator('input').last();
    const fits = await row.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    await app.page.screenshot({ path: info.outputPath(`row-${width}.png`), clip: { x: 0, y: 60, width, height: 80 } });
    if (fits) {
      await expect(right).toHaveCount(0);
      return;
    }
    await expect(right).toBeVisible();
    // The wheel over the row scrolls it sideways.
    const box = (await row.boundingBox())!;
    await app.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await app.page.mouse.wheel(0, 2000);
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(app.page.locator('.classic-props-scroll.left')).toBeVisible();
    await expect.poll(() => row.evaluate((el) => el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)).toBe(true);
    await expect(right).toHaveCount(0);
    const s = (await size.boundingBox())!;
    expect(s.x + s.width).toBeLessThanOrEqual(width);
    await app.page.screenshot({ path: info.outputPath(`row-${width}-end.png`), clip: { x: 0, y: 60, width, height: 80 } });
  });
}
