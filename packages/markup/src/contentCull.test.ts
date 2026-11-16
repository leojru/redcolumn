// Added in the leojru/redcolumn fork (revu-layout): cutting a content stream down to a box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cullContent, type Rect, type XObjectInfo } from './contentCull.ts';

const BOX: Rect = { x0: 0, y0: 0, x1: 20, y1: 20 };
const none = () => null;
const cull = (content: string, xobject: (n: string) => XObjectInfo | null = none) => {
  const r = cullContent(content, BOX, xobject);
  assert.ok(r, 'readable');
  return r;
};

test('a path outside the box is dropped, one inside stays', () => {
  const r = cull('1 0 0 rg\n0 0 10 10 re\nf\n500 500 10 10 re\nf\n');
  assert.equal(r.content, '1 0 0 rg\n0 0 10 10 re\nf\n');
});

test('a stroke reaches as far as its line is wide', () => {
  // At x = 24, 4 from the box, a wide line reaches in; a thin one at x = 50 does not.
  assert.match(cull('20 w\n24 0 m\n24 10 l\nS\n').content, /24 0 m/);
  assert.doesNotMatch(cull('1 w\n50 0 m\n50 10 l\nS\n').content, /50 0 m/);
});

test('the matrix moves a path before it is tested', () => {
  assert.doesNotMatch(cull('q\n1 0 0 1 500 0 cm\n0 0 10 10 re\nf\nQ\n').content, /re/);
  assert.match(cull('q\n1 0 0 1 5 5 cm\n0 0 10 10 re\nf\nQ\n').content, /re/);
});

test('a clip that misses the box hides everything under it, up to its Q', () => {
  const r = cull('q\n500 500 10 10 re\nW\nn\n0 0 5 5 re\nf\nq\n1 1 2 2 re\nf\nQ\nQ\n1 1 2 2 re\nf\n');
  assert.equal(r.content, '1 1 2 2 re\nf\n');
});

test('a clip that reaches the box stays, with the drawing under it', () => {
  const r = cull('q\n0 0 30 30 re\nW\nn\n1 1 2 2 re\nf\nQ\n');
  assert.equal(r.content, 'q\n0 0 30 30 re\nW\nn\n1 1 2 2 re\nf\nQ\n');
});

test('without a q around it, a clip that misses the box ends the page', () => {
  const r = cull('0 0 5 5 re\nf\n500 500 10 10 re\nW\nn\n0 0 5 5 re\nf\n');
  assert.equal(r.content, '0 0 5 5 re\nf\n');
});

test('text out of reach is not shown, but its settings stay', () => {
  const r = cull('BT\n/F1 12 Tf\n1 0 0 rg\n500 500 Td\n(far) Tj\nET\nBT\n/F1 12 Tf\n5 5 Td\n(near) Tj\nET\n');
  assert.ok(!r.content.includes('(far)'));
  assert.ok(r.content.includes('(near) Tj'));
  assert.ok(r.content.includes('1 0 0 rg'));
  assert.equal(r.content.match(/BT/g)!.length, 2);
  assert.ok(r.names.has('F1'));
});

test('text whose line runs on from out of reach into the box stays', () => {
  const r = cull('BT\n/F1 12 Tf\n-60 5 Td\n(some long text here) Tj\n(and more) Tj\nET\n');
  assert.ok(r.content.includes('(and more) Tj'));
});

test('a form outside the box is not drawn; one that reaches in, or is unknown, is', () => {
  const info = (n: string): XObjectInfo | null => (n === 'Far' || n === 'Near' ? { bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, matrix: [1, 0, 0, 1, 0, 0] } : null);
  const r = cull('q\n1 0 0 1 500 500 cm\n/Far Do\nQ\nq\n1 0 0 1 5 5 cm\n/Near Do\nQ\n/Mystery Do\n', info);
  assert.ok(!r.names.has('Far'));
  assert.ok(r.names.has('Near'));
  assert.ok(r.names.has('Mystery'));
});

test('an inline image and marked content are kept', () => {
  const r = cull('/OC /MC0 BDC\nq\n10 0 0 10 0 0 cm\nBI /W 1 /H 1 /CS /G /BPC 8 ID \u0001 EI\nQ\nEMC\n');
  assert.ok(r.content.includes('BI /W 1'));
  assert.ok(r.names.has('MC0'));
  assert.ok(r.content.includes('EMC'));
});

test('a stream it cannot read comes back as null', () => {
  assert.equal(cullContent('(unfinished Tj', BOX, none), null);
  assert.equal(cullContent('q\nBT\nq\n', BOX, none), null);
});
