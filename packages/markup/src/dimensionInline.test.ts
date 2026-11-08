// Added in the leojru/redcolumn fork.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approxTextWidth, cutSegment } from './dimensionInline.ts';
import { markupShape } from './geometry.ts';
import { dimensionText } from './render.ts';
import { TYPE_INFO } from './types.ts';
import type { Markup } from './model.ts';

const dim = (dimText: 'above' | 'inline' | undefined, extra: Partial<Markup['style']> = {}): Markup =>
  ({ id: 'd', type: 'dimension', pageIndex: 0, points: [[100, 200], [300, 200]], text: '12', style: { ...TYPE_INFO.dimension.style, dimText, ...extra } }) as Markup;

const strokes = (m: Markup) => markupShape(m).filter((p) => p.stroke && !p.decoration && p.path.length === 2);

test('Helvetica widths: digits are 0.556 em', () => {
  assert.ok(Math.abs(approxTextWidth('12', 10) - 11.12) < 1e-9);
  assert.equal(approxTextWidth('ab', 10, 'mono'), 12);
});

test('a segment loses the stretch around the centre, and keeps what lies outside it', () => {
  const cut = cutSegment([['M', 0, 0], ['L', 100, 0]], [50, 0], [1, 0], 20)!;
  assert.deepEqual(cut, [[['M', 0, 0], ['L', 40, 0]], [['M', 60, 0], ['L', 100, 0]]]);
  assert.deepEqual(cutSegment([['M', 0, 0], ['L', 30, 0]], [50, 0], [1, 0], 20), [[['M', 0, 0], ['L', 30, 0]]]);
  assert.deepEqual(cutSegment([['M', 45, 0], ['L', 55, 0]], [50, 0], [1, 0], 20), []);
});

test('new dimensions put their text inline; the line breaks around it, and the text sits on the line', () => {
  assert.equal(TYPE_INFO.dimension.style.dimText, 'inline');
  const inline = strokes(dim('inline'));
  assert.equal(inline.length, 2, 'two pieces of line');
  const [left, right] = inline.map((p) => p.path);
  const gap = (right![0]![1] as number) - (left![1]![1] as number);
  assert.ok(gap > approxTextWidth('12', 10) && gap < approxTextWidth('12', 10) + 10, `gap ${gap}`);
  const t = dimensionText(dim('inline'))!;
  assert.equal(t.inline, true);
  assert.equal(t.lines[0]!.at[0], 200);
  assert.ok(t.lines[0]!.at[1] > 200 && t.lines[0]!.at[1] < 205, 'baseline just below the line');

  assert.equal(strokes(dim('above')).length, 1, 'above: one whole line');
  assert.equal(strokes(dim(undefined)).length, 1, 'unset (older markups): above, as before');
  assert.ok(dimensionText(dim('above'))!.lines[0]!.at[1] < 200);
  assert.equal(strokes(dim('inline', { labelRotation: 30 })).length, 1, 'turned text: the line stays whole');
});

test('two lines (Shift+Enter): inline they straddle the line; above they stack over it', () => {
  const two = (dimText: 'inline' | 'above') => ({ ...dim(dimText), text: "12'-6\"\nTYP." }) as Markup;
  const inline = dimensionText(two('inline'))!;
  assert.equal(inline.lines.length, 2);
  assert.ok(inline.lines[0]!.at[1] < 200 && inline.lines[1]!.at[1] > 200, 'first above the line, second below');
  assert.ok(strokes(two('inline')).length === 2, 'the line still breaks');
  const above = dimensionText(two('above'))!;
  assert.ok(above.lines[0]!.at[1] < above.lines[1]!.at[1] && above.lines[1]!.at[1] < 200, 'both over the line, in order');
});

test('text dragged off the line has a leader square off the line, and the line stays whole', () => {
  const m = dim('inline', { labelLift: 30 });
  const t = dimensionText(m)!;
  assert.equal(t.inline, false);
  assert.equal(t.align, 'left');
  assert.deepEqual(t.leader!.slice(0, 2), [[200, 200], [200, 170]], 'up from the line at the text');
  assert.ok(t.lines[0]!.at[0] > 200, 'the text starts past the elbow');
  assert.equal(strokes(m).length, 1, 'no gap');
  assert.ok(markupShape(m).some((p) => p.decoration && p.path.length === 3), 'the leader is drawn');
});

test('a Length breaks its line around its label (no white box) unless a label background is chosen', async () => {
  const { breakAroundBox, lengthLabelBox } = await import('./dimensionInline.ts');
  const { measurementLabel } = await import('./render.ts');
  const len = (extra: Partial<Markup['style']> = {}) => ({ id: 'l', type: 'length', pageIndex: 0, points: [[100, 200], [300, 200]], style: { ...TYPE_INFO.length.style, ...extra } }) as Markup;
  const box = lengthLabelBox(len(), measurementLabel(len()))!;
  assert.ok(box && box.center[0] === 200);
  const pieces = breakAroundBox(markupShape(len()), box).filter((p) => p.stroke && !p.decoration && p.path.length === 2);
  assert.equal(pieces.length, 2, 'two pieces of line, either side of the label');
  assert.equal(lengthLabelBox(len({ labelBackground: '#ffff00' }), measurementLabel(len({ labelBackground: '#ffff00' }))), null, 'a chosen background keeps its box');
  // Slanted: the label stays level, and the line is cut where it passes under it.
  const slanted = { ...len(), points: [[100, 100], [300, 300]] } as Markup;
  const cut = breakAroundBox(markupShape(slanted), lengthLabelBox(slanted, measurementLabel(slanted))!).filter((p) => p.stroke && !p.decoration && p.path.length === 2);
  assert.equal(cut.length, 2);
});
