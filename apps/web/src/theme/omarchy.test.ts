// Added in the leojru/redcolumn fork (revu-layout): the Omarchy theme's tokens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDark, luminance, mix, omarchyTheme, omarchyTokens, validPalette } from './omarchy.ts';

const everforest = {
  mode: 'dark', accent: '#7fbbb3', selection: '#3d484d', muted: '#475258',
  background: '#2d353b', dark_background: '#21272c', darker_background: '#181d20', lighter_background: '#343f44',
  foreground: '#d3c6aa', bright_foreground: '#d3c6aa', red: '#e67e80', yellow: '#dbbc7f', orange: '#e09d7f', green: '#a7c080', magenta: '#d699b6',
};

test('mixes and measures colours', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.ok(luminance('#ffffff') > 0.99 && luminance('#000000') < 0.01);
});

test('a dark Omarchy theme gives its own surfaces, text and accents', () => {
  const t = omarchyTokens(everforest);
  assert.equal(t['--panel'], '#2d353b');
  assert.equal(t['--bg'], '#21272c');
  assert.equal(t['--viewer-desk'], '#181d20');
  assert.equal(t['--text'], '#d3c6aa');
  assert.equal(t['--surface-active'], '#3d484d');
  assert.equal(t['--danger-text'], '#e67e80');
  assert.equal(t['--measure-orange'], '#e09d7f');
  // A pale accent is darkened behind white symbols; the accent itself stays for highlights.
  assert.equal(t['--accent-hi'], '#7fbbb3');
  assert.ok(luminance(t['--accent']!) < luminance('#7fbbb3'));
  assert.deepEqual(omarchyTheme(everforest), { id: 'omarchy', label: 'Omarchy', dark: true, color: '#2d353b', symbolColor: '#d3c6aa' });
});

test('a light theme is light, from its mode or its background', () => {
  assert.equal(isDark({ background: '#fdf6e3', foreground: '#586e75', mode: 'light' }), false);
  assert.equal(isDark({ background: '#fdf6e3', foreground: '#586e75' }), false);
  assert.equal(isDark({ background: '#1e1e2e', foreground: '#cdd6f4' }), true);
});

test('colours a theme does not name are mixed from its background and foreground', () => {
  const t = omarchyTokens({ background: '#1e1e2e', foreground: '#cdd6f4' });
  assert.match(t['--surface-2']!, /^#[0-9a-f]{6}$/);
  assert.match(t['--accent']!, /^#[0-9a-f]{6}$/);
  assert.equal(validPalette({ background: '#1e1e2e', foreground: 'nope' }), false);
  assert.equal(validPalette(null), false);
});
