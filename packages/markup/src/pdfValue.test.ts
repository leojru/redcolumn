// Added in the leojru/redcolumn fork (revu-layout): reading a PDF string too long for pdf-lib's own decoder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFContext, PDFHexString } from 'pdf-lib';
import { toPdfValue } from './pdfValue.ts';

test('a very long UTF-16 string is read, not a stack overflow that loses the file’s annotations', () => {
  const text = 'ab'.repeat(300_000);
  const hex = 'FEFF' + [...text].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  assert.equal(toPdfValue(PDFContext.create(), PDFHexString.of(hex)), text);
});
