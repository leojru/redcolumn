import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addOuterGroup, groupChain, regroup, removeOuterGroup } from './groups.ts';

test('wraps a group in a new one and opens one level at a time', () => {
  const inner = { groupId: 'a' };
  const outer = addOuterGroup(inner, 'b');
  assert.deepEqual(outer, { groupId: 'b', innerGroups: ['a'] });
  assert.deepEqual(removeOuterGroup(outer), { groupId: 'a', innerGroups: undefined });
  assert.deepEqual(removeOuterGroup({ groupId: 'a' }), { groupId: undefined, innerGroups: undefined });
});
test('gives a copy groups of its own at every level', () => {
  assert.deepEqual(regroup({ groupId: 'b', innerGroups: ['a'] }, (g) => g + '2'), { groupId: 'b2', innerGroups: ['a2'] });
  assert.deepEqual(groupChain({}), []);
});
