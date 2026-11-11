// Added in the leojru/redcolumn fork (revu-layout). Hovering over a document's tab shows where the file is, and Copy File Path copies it.
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

test('Copy File Path puts the full path on the clipboard', async ({ app }) => {
  test.skip(app.kind !== 'desktop', 'browsers do not reveal file locations');
  await app.answerOpenDialog(app.fixture('plan.pdf'));
  await app.cmd('file.open');
  await expect(app.page.locator('.doc-tab.active')).toContainText('plan');
  // Catch what is written rather than read the system clipboard, which a test run may share.
  await app.page.evaluate(() => {
    const w = window as unknown as { copied?: string };
    navigator.clipboard.writeText = async (text: string) => void (w.copied = text);
  });
  await app.page.locator('.doc-tab.active').click({ button: 'right' });
  await app.page.getByRole('menuitem', { name: 'Copy File Path' }).click();
  await expect.poll(() => app.page.evaluate(() => (window as unknown as { copied?: string }).copied)).toMatch(/^([A-Za-z]:)?[\\/].*[\\/]plan\.pdf$/);
});
