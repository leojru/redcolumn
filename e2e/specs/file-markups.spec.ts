// Added in the leojru/redcolumn fork (revu-layout). As in Revu, a PDF on disk opens with what is saved in it.
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../support/app.ts';

const A: [number, number] = [300, 450];
const B: [number, number] = [520, 560];

test.describe('markups live in the file', () => {
  test.skip(({ app }) => app.kind !== 'desktop', 'only the desktop app opens files by their location');

  const copyOf = (fixture: string) => {
    const path = join(mkdtempSync(join(tmpdir(), 'file-markups-')), 'drawing.pdf');
    copyFileSync(fixture, path);
    return path;
  };
  const closeDocument = async (page: Page, app: { cmd(id: string): Promise<unknown> }, answer?: string) => {
    await app.cmd('file.close');
    if (!answer) return;
    const dialog = page.getByRole('dialog', { name: 'Save changes?' });
    await dialog.getByRole('button', { name: answer }).click();
  };

  const openFile = async (app: { answerOpenDialog(f: string): Promise<void>; cmd(id: string): Promise<unknown>; documents(): Promise<unknown[]>; fit(): Promise<void>; page: Page }, file: string, count = 1) => {
    await app.answerOpenDialog(file);
    await app.cmd('file.open');
    await expect.poll(async () => (await app.documents().catch(() => [])).length, { timeout: 30_000 }).toBe(count);
    await app.fit();
    await app.page.waitForTimeout(1200);
  };

  test("Don't Save, then opening it again, shows nothing kept", async ({ app }) => {
    const file = copyOf(app.fixture('plan.pdf'));
    await openFile(app, file);
    await app.tool('rect');
    await app.drag(A, B);
    await expect.poll(async () => (await app.raw()).length).toBe(1);
    await closeDocument(app.page, app, "Don't Save");
    await expect.poll(async () => (await app.documents()).length).toBe(0);

    await openFile(app, file);
    expect(await app.raw()).toEqual([]);
  });

  test('what was saved comes back from the file', async ({ app }) => {
    const file = copyOf(app.fixture('plan.pdf'));
    await openFile(app, file);
    await app.tool('rect');
    await app.drag(A, B);
    await expect.poll(async () => (await app.raw()).length).toBe(1);
    await app.cmd('file.save');
    await expect(app.page.locator('.doc-tab.active .dirty')).toHaveCount(0, { timeout: 20_000 });
    await closeDocument(app.page, app);
    await expect.poll(async () => (await app.documents()).length).toBe(0);

    await openFile(app, file);
    await expect.poll(async () => (await app.raw().catch(() => [])).length, { timeout: 30_000 }).toBe(1);
    expect((await app.raw())[0]).toMatchObject({ type: 'rect' });
  });

  test('an identical copy from another folder has its own tab and markups', async ({ app }) => {
    const first = copyOf(app.fixture('plan.pdf'));
    const second = copyOf(app.fixture('plan.pdf'));
    await openFile(app, first);
    await app.tool('rect');
    await app.drag(A, B);
    await expect.poll(async () => (await app.raw()).length).toBe(1);

    await openFile(app, second, 2);
    expect(await app.raw()).toEqual([]);
    await app.page.locator('.doc-tab').first().click();
    await expect.poll(async () => (await app.raw()).length).toBe(1);
  });

  test('changes never saved survive a crash', async ({ app }) => {
    const file = copyOf(app.fixture('plan.pdf'));
    await openFile(app, file);
    await app.tool('rect');
    await app.drag(A, B);
    await expect.poll(async () => (await app.raw()).length).toBe(1);
    await app.page.waitForTimeout(800);

    await app.page.reload();
    const bar = app.page.getByRole('region', { name: 'Recovered markups' });
    await expect(bar).toBeVisible({ timeout: 30_000 });
    expect(await app.raw()).toHaveLength(1);
  });
});
