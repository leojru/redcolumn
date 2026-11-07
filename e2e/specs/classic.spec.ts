// Added in the leojru/redcolumn fork (revu-layout). The classic toolbars (Window › Toolbar Display):
// a main row of file commands and tools, and a Properties row that follows the context; and the
// classic panel layout (icon rails both sides, Tool Library open, Markups list closed).
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

test.describe('classic layout', () => {
  test.use({ toolbar: 'classic', classicLayout: true });

  test('icon rails on both sides, the Tool Library open, the Markups list closed until toggled', async ({ app }) => {
    await app.open('plan.pdf');
    const left = app.page.locator('.rail.left');
    const right = app.page.locator('.rail.right');
    // Icons only: the rails are not labelled.
    await expect(left).not.toHaveClass(/labelled/);
    await expect(right).not.toHaveClass(/labelled/);
    // Opening a document leaves the Tool Library open (it does not switch to Thumbnails).
    expect((await app.command('window.toolchest')).checked).toBe(true);
    // Measuring, properties and search are docked on the right, which starts closed.
    for (const id of ['measurements', 'properties', 'search']) await expect(right.locator(`[data-panel="${id}"]`)).toBeVisible();
    expect((await app.command('window.rightPanel')).checked).toBe(false);
    await right.locator('[data-panel="measurements"]').click();
    expect((await app.command('window.rightPanel')).checked).toBe(true);
    expect((await app.command('window.measurements')).checked).toBe(true);
    // The Markups list opens from the foot of the left rail, and closes again.
    expect((await app.command('window.bottomPanel')).checked).toBe(false);
    await left.locator('[data-rail-markups]').click();
    expect((await app.command('window.bottomPanel')).checked).toBe(true);
    await left.locator('[data-rail-markups]').click();
    expect((await app.command('window.bottomPanel')).checked).toBe(false);
  });

  test('one status bar: the view splits, the page strip, the toggles and the pointer position', async ({ app }) => {
    await app.open('plan.pdf');
    const bar = app.page.locator('.statusbar.classic');
    // The page strip is in the status bar, not under the drawing.
    await expect(bar.locator('.pagenav')).toHaveCount(1);
    await expect(app.page.locator('.pagenav')).toHaveCount(1);
    await expect(bar.locator('.pagenav')).toContainText('of 3');
    // Imperial units (the e2e settings): the page size in inches, as 17.00 × 11.00 in.
    await expect(bar.locator('.pagenav')).toContainText(/\d+\.\d\d × \d+\.\d\d in/);
    for (const label of ['Grid', 'Snap', 'Content', 'Markup', 'Reuse']) await expect(bar.getByRole('button', { name: label, exact: true })).toBeVisible();
    // Split from the status bar, and back to a single view.
    // Split asks for the document to show beside this one.
    const chooser = app.page.waitForEvent('filechooser');
    await bar.locator('[data-status-command="view.split"]').click();
    await (await chooser).setFiles(app.fixture('plan-rev1.pdf'));
    await expect.poll(async () => (await app.command('view.split')).checked).toBe(true);
    await expect(bar.locator('[data-status-command="view.split"]')).toHaveAttribute('aria-pressed', 'true');
    await bar.locator('[data-status-command="view.unsplit"]').click();
    await expect.poll(async () => (await app.command('view.split')).checked).toBe(false);
    // The pointer's position on the page.
    const c = await app.at([200, 200]);
    await app.page.mouse.move(c.x, c.y, { steps: 3 });
    await expect(bar.locator('.status-coords')).toContainText(/X .+ Y .+/);
  });
});
