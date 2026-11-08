// Added in the leojru/redcolumn fork.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameAround } from './textFrames.ts';

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
