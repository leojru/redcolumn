// Added in the leojru/redcolumn fork. Dimension text: inline by default (the line breaks around it) or
// above; typed where it sits (no pop-up), on two lines with Shift+Enter; dragged off the line on a
// leader, with the dimension line moved by its own knob. A Length's line breaks around its label.
import { writeFileSync } from 'node:fs';
import { expect, test } from '../support/app.ts';

test.use({ toolbar: 'classic' });

type Raw = { id: string; type: string; text?: string; style: { dimText?: string; labelLift?: number; labelShift?: number; leader?: number; labelOffset?: number; startCap?: string; endCap?: string } };

test('dimension text is typed in place, inline, on two lines; double-click edits it; Above from the toolbar', async ({ app }, info) => {
  const raw = async () => (await app.raw()) as unknown as Raw[];
  const dims = async () => (await raw()).filter((m) => m.type === 'dimension');
  await app.open('plan.pdf');
  await app.tool('dimension');
  await app.clicks([[200, 600], [400, 600]]);

  // No pop-up: the editor opens on the line, focused.
  await expect(app.page.getByRole('dialog')).toHaveCount(0);
  const editor = app.page.locator('textarea[data-dimension-editor]');
  await expect(editor).toBeFocused();
  await app.page.keyboard.type('12\'-6"');
  await app.page.keyboard.press('Shift+Enter');
  await app.page.keyboard.type('TYP.');
  await app.page.keyboard.press('Enter');
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await dims())[0]?.text).toBe('12\'-6"\nTYP.');
  const dim = (await dims())[0]!;
  expect(dim.style.dimText).toBe('inline');

  // Double-click on the text edits it where it is; Esc leaves it as it was.
  await app.tool('select');
  const mid = await app.at([300, 600]);
  await app.page.mouse.dblclick(mid.x, mid.y);
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('12\'-6"\nTYP.');
  await app.page.keyboard.type('X');
  await app.page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  expect((await dims())[0]!.text).toBe('12\'-6"\nTYP.');
  await app.page.screenshot({ path: info.outputPath('1-inline-two-lines.png') });

  // A second, switched to Above while selected.
  await app.tool('dimension');
  await app.clicks([[200, 680], [400, 680]]);
  await app.page.keyboard.type('12\'-6"');
  await app.page.keyboard.press('Enter');
  await expect.poll(async () => (await dims()).length).toBe(2);
  const second = (await dims())[1]!;
  await app.page.keyboard.press('Escape');
  await app.page.evaluate((id) => window.__nb.tools.select([id]), second.id);
  await app.page.locator('select[data-dim-text]').selectOption('above');
  await expect.poll(async () => (await raw()).find((m) => m.id === second.id)?.style.dimText).toBe('above');
  expect((await raw()).find((m) => m.id === dim.id)?.style.dimText).toBe('inline');
  await app.page.screenshot({ path: info.outputPath('2-above.png') });
});

test('dragging dimension text off the line puts it on a leader; Shift keeps it on the line; the diamond moves the line', async ({ app }, info) => {
  const raw = async () => (await app.raw()) as unknown as Raw[];
  await app.open('plan.pdf');
  await app.tool('dimension');
  await app.clicks([[200, 600], [400, 600]]);
  await app.page.keyboard.type('12\'-6"');
  await app.page.keyboard.press('Enter');
  await expect.poll(async () => (await raw()).find((m) => m.type === 'dimension')?.text).toBe('12\'-6"');
  const id = (await raw()).find((m) => m.type === 'dimension')!.id;
  await app.page.keyboard.press('Escape');
  await app.page.evaluate((id) => window.__nb.tools.select([id]), id);

  // Up and to the right: the text goes where it is dragged; the leader's foot and the line stay put.
  await app.drag([296, 600], [380, 560]);
  let style = (await raw()).find((m) => m.id === id)!.style;
  expect(style.labelLift).toBeGreaterThan(30);
  expect(style.labelShift).toBeGreaterThan(70);
  expect(style.labelOffset ?? 0).toBe(0);
  expect(style.leader ?? 0).toBe(0);
  await app.page.screenshot({ path: info.outputPath('3-leader.png') });


  // Undone, then dragged with Shift: it stays on the line, slid along it.
  await app.page.evaluate(() => window.__nb.commands().get('edit.undo')!.run());
  await expect.poll(async () => (await raw()).find((m) => m.id === id)?.style.labelLift ?? 0).toBe(0);
  await app.page.keyboard.down('Shift');
  await app.drag([296, 600], [360, 560]);
  await app.page.keyboard.up('Shift');
  style = (await raw()).find((m) => m.id === id)!.style;
  expect(style.labelLift ?? 0).toBe(0);
  expect(style.labelOffset).toBeGreaterThan(40);

  // The diamond, a fifth of the way along, moves the dimension line out.
  await app.drag([240, 600], [240, 570]);
  style = (await raw()).find((m) => m.id === id)!.style;
  expect(Math.abs(style.leader ?? 0)).toBeGreaterThan(20);
  await app.page.screenshot({ path: info.outputPath('4-offset.png') });

  // The toolbar's Start and End change the selected dimension's ends.
  await app.page.locator('select[data-line-end="start"]').selectOption('openArrow');
  await app.page.locator('select[data-line-end="end"]').selectOption('tick');
  style = (await raw()).find((m) => m.id === id)!.style;
  expect([style.startCap, style.endCap]).toEqual(['openArrow', 'tick']);
});

test('a Length breaks its line around its label, and its label comes off on a leader; the saved PDF too', async ({ app }, info) => {
  const raw = async () => (await app.raw()) as unknown as Raw[];
  await app.open('plan.pdf');
  await app.calibrate();
  await app.tool('length');
  await app.clicks([[200, 640], [420, 640]]);
  await app.tool('dimension');
  await app.clicks([[200, 720], [420, 720]]);
  await app.page.keyboard.type('12\'-6"');
  await app.page.keyboard.press('Shift+Enter');
  await app.page.keyboard.type('TYP.');
  await app.page.keyboard.press('Enter');
  await app.page.keyboard.press('Escape');
  // The Length's label comes off its line too, on a leader; its line stays put.
  const length = (await raw()).find((m) => m.type === 'length')!;
  await app.page.evaluate((id) => window.__nb.tools.select([id]), length.id);
  await app.drag([310, 640], [380, 600]);
  const ls = (await raw()).find((m) => m.id === length.id)!.style;
  expect(ls.labelLift).toBeGreaterThan(25);
  expect(ls.leader ?? 0).toBe(0);
  await app.page.evaluate(() => window.__nb.tools.select([]));
  await app.page.screenshot({ path: info.outputPath('5-length.png') });
  const before = (await app.saved()).length;
  await app.cmd('file.saveAs');
  await expect.poll(async () => (await app.saved()).length, { timeout: 30_000 }).toBe(before + 1);
  writeFileSync(info.outputPath('saved.pdf'), (await app.saved()).at(-1)!.bytes);
});
