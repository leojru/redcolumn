// Added in the leojru/redcolumn fork (revu-layout): the fork's defaults for new profiles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TOOLBAR_TOOLS, defaultWorkspace } from './profiles.ts';
import { DEFAULT_KEYS, keyMap } from '../commands/keys.ts';

test('new profiles start with the classic toolbars', () => {
  assert.equal(defaultWorkspace().toolbarStyle, 'classic');
  for (const tool of ['cloudPlus', 'callout', 'snapshot', 'length', 'area', 'count'] as const) assert.ok(DEFAULT_TOOLBAR_TOOLS.includes(tool), tool);
});

test("Leo's keys: Shift+D draws a dimension and Shift+L a polyline", () => {
  const keys = keyMap(Object.keys(DEFAULT_KEYS), defaultWorkspace().shortcuts);
  assert.equal(keys.get('Shift+D'), 'tool.dimension');
  assert.equal(keys.get('Shift+L'), 'tool.polyline');
  // The everyday letters stay as they were.
  for (const [combo, id] of <[string, string][]>[['C', 'tool.cloud'], ['K', 'tool.cloudPlus'], ['G', 'tool.snapshot'], ['L', 'tool.line'], ['A', 'tool.arrow'], ['Shift+C', 'tool.arc'], ['R', 'tool.rect'], ['Shift+P', 'tool.polygon']]) assert.equal(keys.get(combo), id, combo);
});
