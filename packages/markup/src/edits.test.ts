import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoSizedPoints, canAutoSize, keepTextInBox, canRoundCorners, defaultCornerRadius, markupColours, recolouredStyle } from './edits.ts';
import { markupShape, TEXT_PADDING } from './geometry.ts';
import { legendRows } from './legend.ts';
import { DEFAULT_STYLES, type Markup, type MarkupType, type Point } from './model.ts';
import { MarkupStore } from './store.ts';

function mk(type: MarkupType, points: Point[], extra: Partial<Markup> = {}): Markup {
  return { id: `${type}-${points.length}`, type, pageIndex: 0, points, style: { ...DEFAULT_STYLES[type] }, status: 'none', author: '', createdAt: 1, modifiedAt: 1, ...extra };
}

test('Change Colours lists each colour once and swaps line, fill and text colours', () => {
  const a = mk('rect', [[0, 0], [10, 10]], { style: { ...DEFAULT_STYLES.rect, stroke: '#FF0000', fill: '#00ff00' } });
  const b = mk('text', [[0, 0], [10, 10]], { style: { ...DEFAULT_STYLES.text, stroke: '#ff0000', fill: null, textColor: '#0000ff' } });
  assert.deepEqual(markupColours([a, b]), ['#ff0000', '#00ff00', '#0000ff']);
  const map = { '#ff0000': '#123456' };
  assert.deepEqual([recolouredStyle(a.style, map)?.stroke, recolouredStyle(a.style, map)?.fill], ['#123456', '#00ff00']);
  assert.equal(recolouredStyle(b.style, { '#0000ff': '#ffffff' })?.textColor, '#ffffff');
  assert.equal(recolouredStyle(a.style, { '#abcdef': '#000000' }), null);
});

test('rounded corners curve rectangles, polygons and polylines, but not text boxes', () => {
  const curves = (m: Markup) => markupShape(m)[0]!.path.filter((c) => c[0] === 'C').length;
  const rect = mk('rect', [[0, 0], [100, 50]]);
  assert.equal(curves(rect), 0);
  assert.equal(curves({ ...rect, style: { ...rect.style, cornerRadius: 10 } }), 4);
  const poly = mk('polygon', [[0, 0], [100, 0], [50, 80]], { style: { ...DEFAULT_STYLES.polygon, cornerRadius: 8 } });
  assert.equal(curves(poly), 3);
  // A polyline's ends stay sharp: only its inner corners round.
  const line = mk('polyline', [[0, 0], [50, 0], [50, 50], [100, 50]], { style: { ...DEFAULT_STYLES.polyline, cornerRadius: 8 } });
  assert.equal(curves(line), 2);
  assert.deepEqual([canRoundCorners(rect), canRoundCorners({ type: 'text' }), canRoundCorners({ type: 'polygon' })], [true, false, true]);
  assert.equal(defaultCornerRadius(rect), 5);
});

test('Auto-size fits a text box to its text and keeps its top-left corner', () => {
  const measure = (s: string) => s.length * 6;
  const box = mk('text', [[20, 30], [400, 300]], { text: 'Hello\nwide world line', style: { ...DEFAULT_STYLES.text, fontSize: 10 } });
  const pts = autoSizedPoints(box, measure)!;
  // 15 characters × 6 + padding; one line down to the second's capitals (10 × 0.718) + padding.
  assert.equal(pts[0]![0], 20);
  assert.equal(pts[0]![1], 30);
  assert.ok(Math.abs(pts[1]![0] - (20 + 90 + 2 * TEXT_PADDING + 0.5)) < 1e-6);
  assert.ok(Math.abs(pts[1]![1] - (30 + 12 + 7.18 + 2 * TEXT_PADDING)) < 1e-6);
  const callout = mk('callout', [[0, 0], [10, 10], [50, 50], [300, 200]], { text: 'ab', style: { ...DEFAULT_STYLES.callout, fontSize: 10 } });
  const c = autoSizedPoints(callout, measure)!;
  assert.deepEqual(c.slice(0, 3), [[0, 0], [10, 10], [50, 50]], 'the leader stays where it was');
  assert.equal(canAutoSize({ type: 'rect', text: 'x' }), false);
  assert.equal(canAutoSize({ type: 'text', text: '' }), false);
});

// Fork (leojru/redcolumn).
test('Auto-size with keepWidth keeps the box width and wraps the text in it', () => {
  const measure = (s: string) => s.length * 6;
  const box = mk('text', [[20, 30], [140, 300]], { text: 'COPY BEAM SCHEDULE FROM 309 NATHAN', style: { ...DEFAULT_STYLES.text, fontSize: 10 } });
  const [a, b] = autoSizedPoints(box, measure, { keepWidth: true })!;
  assert.deepEqual(a, [20, 30]);
  assert.equal(b![0], 140, 'width kept');
  // 120 wide less padding fits 18 characters: the text takes 2 lines.
  assert.ok(Math.abs(b![1] - (30 + 12 + 7.18 + 2 * TEXT_PADDING)) < 1e-6);
  const narrow = mk('text', [[0, 0], [20, 300]], { text: 'SCHEDULE', style: { ...DEFAULT_STYLES.text, fontSize: 10 } });
  assert.ok(autoSizedPoints(narrow, measure, { keepWidth: true })![1]![0] >= 48 + 2 * TEXT_PADDING, 'never narrower than the longest word');
});

test('markups left out of legends are not listed', () => {
  const legend = mk('legend', [[0, 0], [100, 100]]);
  const shown = mk('rect', [[0, 0], [10, 10]], { id: 'a' });
  const left = mk('cloud', [[0, 0], [10, 10]], { id: 'b', legendHidden: true });
  assert.deepEqual(legendRows(legend, [legend, shown, left]).map((r) => r.sample.id), ['a']);
});

test('flattening some markups moves the remaining imported ones to their annotations’ new places', async () => {
  const store = await MarkupStore.open('flat', { persist: false });
  const imported = (id: string, index: number, owned?: number[]): Markup => ({ ...mk('rect', [[0, 0], [1, 1]]), id, pdfAnnot: { index, digest: 'x', ...(owned ? { owned } : {}) } });
  store.importAnnotations([imported('a', 0, [1]), imported('b', 2, [3, 4]), imported('c', 5), { ...mk('rect', [[0, 0], [1, 1]]), id: 'mine' }], [], { 0: [0, 1, 2, 3, 4, 5] });
  // "a" (with its reply at 1) and "mine" are flattened.
  store.removeFlattened(['a', 'mine'], { 0: [0, 1] });
  assert.deepEqual(store.all().map((m) => [m.id, m.pdfAnnot?.index, m.pdfAnnot?.owned]), [['b', 0, [1, 2]], ['c', 3, undefined]]);
  assert.deepEqual(store.importedAnnotations(), { 0: [0, 1, 2, 3] });
  assert.equal(store.undoHistory().length, 0);
  await store.destroy();
});

test('an auto-sized text box grows with its line spacing', () => {
  const measure = (s: string) => s.length * 6;
  const height = (lineHeight?: number) => {
    const m = mk('text', [[0, 0], [100, 50]], { text: 'one\ntwo\nthree', style: { ...DEFAULT_STYLES.text, fontSize: 10, lineHeight } });
    const [a, b] = autoSizedPoints(m, measure)!;
    return b![1] - a![1];
  };
  assert.ok(Math.abs(height() - (2 * 10 * 1.2 + 7.18 + 2 * TEXT_PADDING)) < 1e-6);
  assert.ok(Math.abs(height(2) - (2 * 10 * 2 + 7.18 + 2 * TEXT_PADDING)) < 1e-6);
  assert.ok(height(2) > height(1));
});

test('resizing a text box keeps its text showing: no narrower than a word, as tall as the text wrapped', () => {
  const measure = (s: string) => s.length * 6;
  const m = mk('text', [[100, 100], [300, 140]], { text: 'SEE NOTE', style: { ...DEFAULT_STYLES.text, fontSize: 10 } });
  // Dragged small from the bottom right: the top left stays; the word fits; two lines fit.
  const [a, b] = keepTextInBox(m, [[100, 100], [110, 105]], measure) as [[number, number], [number, number]];
  assert.deepEqual(a, [100, 100]);
  assert.ok(Math.abs(b[0] - (100 + 24 + 2 * TEXT_PADDING + 0.5)) < 1e-6);
  assert.ok(Math.abs(b[1] - (100 + 12 + 7.18 + 2 * TEXT_PADDING)) < 1e-6);
  // From the top left: the bottom right stays.
  const [c, d] = keepTextInBox(m, [[295, 138], [300, 140]], measure) as [[number, number], [number, number]];
  assert.deepEqual(d, [300, 140]);
  assert.ok(c[0] < 295 && c[1] < 138);
  // Big enough: left exactly as dragged. A callout's leader stays.
  const fine: [number, number][] = [[100, 100], [260, 130]];
  assert.deepEqual(keepTextInBox(m, fine, measure), fine);
  const callout = mk('callout', [[0, 0], [10, 10], [50, 50], [300, 200]], { text: 'SEE', style: { ...DEFAULT_STYLES.callout, fontSize: 10 } });
  const out = keepTextInBox(callout, [[0, 0], [10, 10], [50, 50], [52, 52]], measure);
  assert.deepEqual(out.slice(0, 3), [[0, 0], [10, 10], [50, 50]]);
  assert.ok(out[3]![0] > 52 && out[3]![1] > 52);
});

test("a callout's centred leader stays centred when Auto-size changes the box; on the right it keeps its landing", () => {
  const measure = (s: string) => s.length * 6;
  const left = mk('callout', [[0, 200], [80, 100], [100, 60], [300, 140]], { text: 'TEXT', style: { ...DEFAULT_STYLES.callout, fontSize: 10 } });
  const a = autoSizedPoints(left, measure)!;
  const middle = (a[2]![1] + a[3]![1]) / 2;
  assert.ok(Math.abs(a[1]![1] - middle) < 1e-6);
  assert.equal(a[1]![0], 80);
  assert.deepEqual(a[0], [0, 200]);
  const right = mk('callout', [[500, 200], [320, 100], [100, 60], [300, 140]], { text: 'TEXT', style: { ...DEFAULT_STYLES.callout, fontSize: 10 } });
  const b = autoSizedPoints(right, measure)!;
  assert.ok(Math.abs(b[1]![0] - b[3]![0] - 20) < 1e-6);
  assert.ok(Math.abs(b[1]![1] - (b[2]![1] + b[3]![1]) / 2) < 1e-6);
});

// Fork (leojru/redcolumn).
test('Auto-size with keepWidth shrinks a box that is wider than its text, and the margin sets the room', () => {
  const measure = (s: string) => s.length * 6;
  const box = mk('text', [[0, 0], [300, 100]], { text: 'MF-24', style: { ...DEFAULT_STYLES.text, fontSize: 10, textMargin: 0 } });
  const [, b] = autoSizedPoints(box, measure, { keepWidth: true })!;
  assert.ok(Math.abs(b![0] - (30 + 0.5)) < 1e-6);
});
