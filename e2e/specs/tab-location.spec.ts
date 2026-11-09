// Added in the leojru/redcolumn fork (revu-layout). Hovering over a document's tab shows where the file is.
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic' });

test('a tab opened from disk shows the file location on hover', async ({ app }) => {
  test.skip(app.kind !== 'desktop', 'browsers do not reveal file locations');
  await app.answerOpenDialog(app.fixture('plan.pdf'));
  await app.cmd('file.open');
  await expect(app.page.locator('.doc-tab.active')).toContainText('plan');
  const tab = app.page.locator('.doc-tab.active');
  await tab.hover();
  await expect(tab).toHaveAttribute('title', /plan\.pdf\n.*[\\/]plan\.pdf$/);
});
