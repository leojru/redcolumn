// Added in the leojru/redcolumn fork. A markup on one of the PDF's own layers (an annotation with /OC,
// imported with that layer's name, as Revu saves them) goes when the layer is switched off. Without
// this, the eye hid only the layer's page content, and its markups stayed on screen.
import type { PdfLayer } from '../documents/layers';

/**
 * The markup layer names hidden along with the PDF's layers: a name whose PDF layers are all off.
 * (Files can repeat a name; while one layer of that name is on, its markups stay.)
 */
export function markupLayersOfHiddenPdf(pdfLayers: readonly PdfLayer[], hiddenPdf: readonly string[]): string[] {
  const hidden = new Set(hiddenPdf);
  const allOff = new Map<string, boolean>();
  for (const l of pdfLayers) allOff.set(l.name, (allOff.get(l.name) ?? true) && hidden.has(l.id));
  return [...allOff].filter(([, off]) => off).map(([name]) => name);
}
