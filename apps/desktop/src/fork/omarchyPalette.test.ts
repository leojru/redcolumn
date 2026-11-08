// Added in the leojru/redcolumn fork (revu-layout).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePalette } from './omarchyPalette.ts';

test("reads an Omarchy theme's colors.toml", () => {
  const p = parsePalette('mode = "dark"\n\naccent = "#7fbbb3"\nbackground = "#2d353b" # comment\nforeground = "#d3c6aa"\n[ignored]\nbad = 3\n');
  assert.deepEqual(p, { mode: 'dark', accent: '#7fbbb3', background: '#2d353b', foreground: '#d3c6aa' });
});

test('a palette without a background or foreground is no palette', () => {
  assert.equal(parsePalette('accent = "#7fbbb3"\n'), null);
  assert.equal(parsePalette(''), null);
});
