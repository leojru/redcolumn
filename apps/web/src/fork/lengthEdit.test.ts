// Added in the leojru/redcolumn fork (revu-layout).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METERS_PER_UNIT, type Scale } from '@nb/measure';
import { pointsForTypedLength } from './lengthEdit.ts';

// 10 points on the page are one foot.
const scale: Scale = { metersPerPoint: METERS_PER_UNIT.ft / 10, unit: 'ft', feetInches: true, precision: 16, label: 'T' };

test('a typed length moves the end of the line along it', () => {
  for (const text of [`9'-8"`, `9' 8"`, '9 ft 8 in', '9 feet 8 inches']) {
    const p = pointsForTypedLength([[100, 50], [195, 50]], text, scale);
    assert.ok(p, text);
    assert.deepEqual(p[0], [100, 50]);
    assert.ok(Math.abs(p[1]![0] - (100 + (9 + 8 / 12) * 10)) < 1e-6, text);
    assert.equal(p[1]![1], 50);
  }
});

test('the line keeps its direction, and what is not a length changes nothing', () => {
  const p = pointsForTypedLength([[0, 0], [30, 40]], `10'-0"`, scale)!;
  assert.ok(Math.abs(p[1]![0] - 60) < 1e-6 && Math.abs(p[1]![1] - 80) < 1e-6);
  assert.equal(pointsForTypedLength([[0, 0], [30, 40]], 'hello', scale), null);
  assert.equal(pointsForTypedLength([[0, 0], [30, 40]], '0', scale), null);
});
