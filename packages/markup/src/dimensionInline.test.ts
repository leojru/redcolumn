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
  assert.equal(t.at[0], 200);
  assert.ok(t.at[1] > 200 && t.at[1] < 205, 'baseline just below the line');

  assert.equal(strokes(dim('above')).length, 1, 'above: one whole line');
  assert.equal(strokes(dim(undefined)).length, 1, 'unset (older markups): above, as before');
  assert.ok(dimensionText(dim('above'))!.at[1] < 200);
  assert.equal(strokes(dim('inline', { labelRotation: 30 })).length, 1, 'turned text: the line stays whole');
});
