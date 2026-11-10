// Added in the leojru/redcolumn fork.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameAround, frameAroundText, frameInner } from './textFrames.ts';

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

test('a text shape hugs its text, closer than a rectangle fitted inside it', () => {
  for (const kind of ['circle', 'triangle', 'hexagon'] as const) {
    const snug = frameAroundText(kind, 25, 17, 4);
    const roomy = frameAround(kind, 25, 17);
    assert.ok(snug.w < roomy.w * 0.85, `${kind}: ${snug.w} against ${roomy.w}`);
    // The text still fits on one line.
    assert.ok(frameInner(kind, { x: 0, y: 0, ...snug }).w >= 25, kind);
  }
});

test('a hexagon stays regular and a circle round when the text is long', () => {
  const hex = frameAroundText('hexagon', 120, 17, 4);
  assert.ok(Math.abs(hex.w / hex.h - 2 / Math.sqrt(3)) < 1e-9);
  const circle = frameAroundText('circle', 120, 17, 4);
  assert.equal(circle.w, circle.h);
  assert.deepEqual(frameAroundText('rect', 40, 12, 4), { w: 40, h: 12 });
});
