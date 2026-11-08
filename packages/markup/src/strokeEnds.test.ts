// Added in the leojru/redcolumn fork: flat line ends and sharp corners, as in Revu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strokeEnds } from './style.ts';
import { TYPE_INFO } from './types.ts';

test('lines and shapes have flat ends and sharp corners; ink and dots stay round', () => {
  const style = (type: keyof typeof TYPE_INFO, extra = {}) => ({ type, style: { ...TYPE_INFO[type].style, ...extra } });
  assert.deepEqual(strokeEnds(style('line')), { cap: 'butt', join: 'miter' });
  assert.deepEqual(strokeEnds(style('rect')), { cap: 'butt', join: 'miter' });
  assert.deepEqual(strokeEnds(style('polyline', { dash: 'dashed' })), { cap: 'butt', join: 'miter' });
  assert.deepEqual(strokeEnds(style('line', { dash: 'dotted' })), { cap: 'round', join: 'miter' });
  assert.deepEqual(strokeEnds(style('pen')), { cap: 'round', join: 'round' });
  assert.deepEqual(strokeEnds(style('highlighter')), { cap: 'butt', join: 'round' });
});
