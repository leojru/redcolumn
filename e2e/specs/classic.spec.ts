// Added in the leojru/redcolumn fork (revu-layout). The classic toolbars (Window › Toolbar Display):
// a main row of file commands and tools, and a Properties row that follows the context.
import { expect, test } from '../support/app.ts';

test.describe('classic toolbars', () => {
  test.use({ toolbar: 'classic' });

  test.beforeEach(async ({ app }) => {
    await app.open('plan.pdf');
  });

  test('shows the document when idle and the style of the tool in use', async ({ app }) => {
    const main = app.page.locator('.classic-main');
    const props = app.page.locator('.classic-props');
    await expect(main).toBeVisible();
    expect((await app.command('window.classicToolbars')).checked).toBe(true);
    // The menu bar is plain in this layout: help and feedback stay in the Help menu.
    await expect(app.page.locator('.menubar-help')).toHaveCount(0);

    // Idle: the open document's name and page count.
    await expect(props).toContainText('Name:');
    await expect(props).toContainText('plan');
    await expect(props).toContainText('Pages: 3');

    // File commands sit on the main row and run the same commands as the menus.
    for (const id of ['file.open', 'file.save', 'file.print', 'edit.undo']) await expect(main.locator(`[data-command="${id}"]`)).toBeVisible();

    // Picking a tool swaps the document for the tool's style.
    await main.locator('[data-toolbar-tool="rect"]').click();
    expect((await app.command('tool.rect')).checked).toBe(true);
    await expect(props).not.toContainText('Pages:');
    await expect(props.getByTitle(/^Line color/)).toBeVisible();

    // Measure tools are on the row by default.
    for (const tool of ['length', 'area', 'count']) await expect(main.locator(`[data-toolbar-tool="${tool}"]`)).toBeVisible();
  });

  test('switches to the simplified toolbar and back', async ({ app }) => {
    await app.cmd('window.simplifiedToolbar');
    await expect(app.page.locator('.classic-toolbars')).toHaveCount(0);
    await expect(app.page.locator('.toolbar.tools')).toBeVisible();
    await app.cmd('window.classicToolbars');
    await expect(app.page.locator('.classic-toolbars')).toBeVisible();
    expect((await app.command('window.classicToolbars')).checked).toBe(true);
  });
});
