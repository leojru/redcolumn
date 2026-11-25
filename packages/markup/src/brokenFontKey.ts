// Added in the leojru/redcolumn fork (revu-layout).
/**
 * Set on an annotation's raw values (readPdfExtras) when its appearance draws text in a font that is missing its
 * descendant font. Files saved by builds that wrote a NaN link destination lost such fonts (pdf-lib dropped the
 * object stream holding them), and Acrobat and Revu then show that text as garbage. Import saves such markups afresh.
 */
export const BROKEN_FONT_KEY = 'NBBrokenFont';
