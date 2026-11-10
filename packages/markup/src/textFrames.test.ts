// Added in the leojru/redcolumn fork.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameAround, frameInner } from './textFrames.ts';
import { framedTextBox } from './dimensionInline.ts';

test('a hexagon, triangle and circle keep their proportions as the text grows; a box fits it', () => {
  for (const kind of ['hexagon', 'triangle'] as const) {
    const one = frameAround(kind, 6, 12);
    const long = frameAround(kind, 40, 12);
    assert.ok(Math.abs(one.w / one.h - 2 / Math.sqrt(3)) < 1e-9, `${kind} regular`);
    assert.ok(Math.abs(long.w / long.h - 2 / Math.sqrt(3)) < 1e-9, `${kind} still regular with more text`);
    assert.ok(long.h > one.h, `${kind} grows every way`);
  }
  const c = frameAround('circle', 40, 12);
  assert.equal(c.w, c.h);
  assert.deepEqual(frameAround('rect', 40, 12), { w: 40, h: 12 });
});

test('a text box shape is sized as a Dimension frame and holds its text on one line', () => {
  for (const kind of ['circle', 'triangle', 'hexagon'] as const) {
    for (const width of [7, 17, 60, 200]) {
      const box = framedTextBox(kind, width, 1, 12);
      assert.ok(frameInner(kind, { x: 0, y: 0, ...box }, 4).w - 8 >= width, `${kind} ${width}`);
    }
  }
});
