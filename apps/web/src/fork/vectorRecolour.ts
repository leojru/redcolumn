// Added in the leojru/redcolumn fork (revu-layout). Change Colours on a vector snapshot: the colours in
// the snapshot's PDF content change, so it stays vector (a picture of it would turn soft when zoomed).
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, type PDFObject } from 'pdf-lib';
import { vectorSnapshotBytes, vectorSnapshotUrl } from '@nb/markup';
import type { PictureColours } from '../markup/pictureColours';

type Rgb = [number, number, number];
type Space = 'gray' | 'rgb' | 'cmyk';
/** The colour a colour becomes (0..255), or null to leave it. */
export type ColourMap = (rgb: Rgb) => Rgb | null;

const rgbOfHex = (hex: string): Rgb => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** The swaps as a colour map, with the same rule as the pixels: the nearest main colour, shifted by the same amount. Null when a colour becomes see-through. */
export function colourMapOf(mode: PictureColours): ColourMap | null {
  if (mode.swaps.some((w) => !w.to)) return null;
  const swaps = mode.swaps.map((w) => ({ from: rgbOfHex(w.from), to: rgbOfHex(w.to!) }));
  if (!swaps.length) return null;
  return (c) => {
    let best = swaps[0]!;
    let bestD = Infinity;
    for (const w of swaps) {
      const d = (w.from[0] - c[0]) ** 2 + (w.from[1] - c[1]) ** 2 + (w.from[2] - c[2]) ** 2;
      if (d < bestD) {
        best = w;
        bestD = d;
      }
    }
    if (best.from.every((v, i) => v === best.to[i])) return null;
    return [0, 1, 2].map((i) => Math.max(0, Math.min(255, c[i]! + best.to[i]! - best.from[i]!))) as Rgb;
  };
}

const WS = new Set([' ', '\n', '\r', '\t', '\f', '\0']);
const DELIM = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%']);
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/** The index after the string that starts at `i` (a `(`). */
function skipString(s: string, i: number): number {
  let depth = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') i++;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
  }
  return s.length;
}

/** The index after the array or dictionary that starts at `i`. */
function skipNested(s: string, i: number): number {
  let depth = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '(') i = skipString(s, i);
    else if (c === '[' || (c === '<' && s[i + 1] === '<')) {
      depth++;
      i += c === '[' ? 1 : 2;
    } else if (c === ']' || (c === '>' && s[i + 1] === '>')) {
      depth--;
      i += c === ']' ? 1 : 2;
      if (depth <= 0) return i;
    } else i++;
  }
  return s.length;
}

const toRgb = (space: Space, v: number[]): Rgb =>
  space === 'gray' ? [v[0]! * 255, v[0]! * 255, v[0]! * 255] : space === 'rgb' ? [v[0]! * 255, v[1]! * 255, v[2]! * 255] : [255 * (1 - v[0]!) * (1 - v[3]!), 255 * (1 - v[1]!) * (1 - v[3]!), 255 * (1 - v[2]!) * (1 - v[3]!)];
const SIZE: Record<Space, number> = { gray: 1, rgb: 3, cmyk: 4 };
const fmt = (v: number) => String(Math.round((v / 255) * 1000) / 1000);

/**
 * A content stream with its device colours (g rg k, and sc/scn in a gray, RGB or CMYK space) changed by
 * `map`. `spaceOf` says what a named colour space is. What it cannot read (patterns, spot colours,
 * pictures) is left as it is. `initial` is set first, for what the stream draws before setting a colour.
 */
export function recolourContent(src: string, spaceOf: (name: string) => Space | null, map: ColourMap, initial?: boolean): string {
  const out: string[] = [];
  if (initial) {
    const black = map([0, 0, 0]);
    if (black) out.push(`${black.map(fmt).join(' ')} rg ${black.map(fmt).join(' ')} RG`);
  }
  let args: string[] = [];
  let fill: Space | null = 'gray';
  let stroke: Space | null = 'gray';
  const stack: [Space | null, Space | null][] = [];
  const raw = (opName: string) => out.push(args.length ? `${args.join(' ')} ${opName}` : opName);
  const colour = (isStroke: boolean, space: Space, always: boolean, opName: string) => {
    const v = args.map(Number);
    const to = v.length === SIZE[space] && v.every(Number.isFinite) ? map(toRgb(space, v)) : null;
    if (to) out.push(`${to.map(fmt).join(' ')} ${isStroke ? 'RG' : 'rg'}`);
    else if (always && v.length === SIZE[space] && v.every(Number.isFinite)) out.push(`${toRgb(space, v).map(fmt).join(' ')} ${isStroke ? 'RG' : 'rg'}`);
    else raw(opName);
  };
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    if (WS.has(c)) {
      i++;
      continue;
    }
    if (c === '%') {
      while (i < n && src[i] !== '\n' && src[i] !== '\r') i++;
      continue;
    }
    const start = i;
    if (c === '(') {
      i = skipString(src, i);
      args.push(src.slice(start, i));
    } else if (c === '[' || (c === '<' && src[i + 1] === '<')) {
      i = skipNested(src, i);
      args.push(src.slice(start, i));
    } else if (c === '<') {
      i = src.indexOf('>', i) + 1 || n;
      args.push(src.slice(start, i));
    } else if (c === '/') {
      i++;
      while (i < n && !WS.has(src[i]!) && !DELIM.has(src[i]!)) i++;
      args.push(src.slice(start, i));
    } else if (DELIM.has(c)) {
      i++;
    } else {
      while (i < n && !WS.has(src[i]!) && !DELIM.has(src[i]!)) i++;
      const tok = src.slice(start, i);
      if (NUMBER.test(tok) || tok === 'true' || tok === 'false' || tok === 'null') {
        args.push(tok);
        continue;
      }
      switch (tok) {
        case 'g':
          colour(false, 'gray', false, tok);
          break;
        case 'G':
          colour(true, 'gray', false, tok);
          break;
        case 'rg':
          colour(false, 'rgb', false, tok);
          break;
        case 'RG':
          colour(true, 'rgb', false, tok);
          break;
        case 'k':
          colour(false, 'cmyk', false, tok);
          break;
        case 'K':
          colour(true, 'cmyk', false, tok);
          break;
        case 'cs':
        case 'CS': {
          const space = args[0]?.startsWith('/') ? spaceOf(args[0].slice(1)) : null;
          if (tok === 'cs') fill = space;
          else stroke = space;
          raw(tok);
          break;
        }
        case 'sc':
        case 'scn':
          if (fill) colour(false, fill, true, tok);
          else raw(tok);
          break;
        case 'SC':
        case 'SCN':
          if (stroke) colour(true, stroke, true, tok);
          else raw(tok);
          break;
        case 'q':
          stack.push([fill, stroke]);
          raw(tok);
          break;
        case 'Q': {
          [fill, stroke] = stack.pop() ?? ['gray', 'gray'];
          raw(tok);
          break;
        }
        case 'BI': {
          // An inline picture is left as it is: everything up to its EI.
          const id = src.slice(i).search(/\sID[\s]/);
          const end = id < 0 ? -1 : src.slice(i + id + 3).search(/\sEI(?=[\s]|$)/);
          const stop = end < 0 ? n : i + id + 3 + end + 3;
          out.push(src.slice(start, stop));
          i = stop;
          break;
        }
        default:
          // g/rg set their own space; a named colour space is unknown to what follows only until its cs.
          raw(tok);
      }
      args = [];
      continue;
    }
  }
  return out.join('\n');
}

const NAME = (s: string) => PDFName.of(s);

function spaceReader(resources: PDFDict | undefined): (name: string) => Space | null {
  return (name) => {
    if (name === 'DeviceGray' || name === 'G' || name === 'CalGray') return 'gray';
    if (name === 'DeviceRGB' || name === 'RGB' || name === 'CalRGB') return 'rgb';
    if (name === 'DeviceCMYK' || name === 'CMYK') return 'cmyk';
    const entry = resources?.lookupMaybe(NAME('ColorSpace'), PDFDict)?.lookup(NAME(name));
    if (entry instanceof PDFName) return entry === NAME('DeviceGray') ? 'gray' : entry === NAME('DeviceRGB') ? 'rgb' : entry === NAME('DeviceCMYK') ? 'cmyk' : null;
    if (entry instanceof PDFArray && entry.lookup(0) === NAME('ICCBased')) {
      const stream = entry.lookup(1);
      const channels = stream instanceof PDFRawStream ? (stream.dict.lookup(NAME('N')) as PDFNumber | undefined)?.asNumber() : undefined;
      return channels === 1 ? 'gray' : channels === 3 ? 'rgb' : channels === 4 ? 'cmyk' : null;
    }
    return null;
  };
}

/** Rewrites a stream's colours in place. False when it is not one this can read. */
function rewriteStream(doc: PDFDocument, ref: PDFRef | PDFObject | undefined, resources: PDFDict | undefined, map: ColourMap, initial: boolean): boolean {
  const stream = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
  if (!(stream instanceof PDFRawStream) || !(ref instanceof PDFRef)) return false;
  const text = new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode());
  const next = recolourContent(text, spaceReader(resources), map, initial);
  const bytes = Uint8Array.from(next, (c) => c.charCodeAt(0) & 255);
  const dict = stream.dict.clone(doc.context);
  dict.delete(NAME('Filter'));
  dict.delete(NAME('DecodeParms'));
  dict.set(NAME('Length'), PDFNumber.of(bytes.length));
  doc.context.assign(ref, PDFRawStream.of(dict, bytes));
  return true;
}

/** Every form drawn from `resources`, and the forms they draw, rewritten once each. */
function recolourForms(doc: PDFDocument, resources: PDFDict | undefined, map: ColourMap, seen: Set<PDFRef>) {
  const xobjects = resources?.lookupMaybe(NAME('XObject'), PDFDict);
  if (!xobjects) return;
  for (const [, value] of xobjects.entries()) {
    if (!(value instanceof PDFRef) || seen.has(value)) continue;
    const form = doc.context.lookup(value);
    if (!(form instanceof PDFRawStream) || form.dict.get(NAME('Subtype')) !== NAME('Form')) continue;
    seen.add(value);
    const own = form.dict.lookupMaybe(NAME('Resources'), PDFDict) ?? resources;
    recolourForms(doc, own, map, seen);
    rewriteStream(doc, value, own, map, false);
  }
}

/**
 * A vector snapshot (data URL) with its colours changed, or null when that cannot be done without a
 * picture: a colour made see-through, or content this does not read. Pictures inside the snapshot keep their colours.
 */
export async function recolourVectorSnapshot(url: string, mode: PictureColours): Promise<string | null> {
  const map = colourMapOf(mode);
  const bytes = vectorSnapshotBytes(url);
  if (!map || !bytes) return null;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const page = doc.getPage(0);
    recolourForms(doc, page.node.Resources(), map, new Set());
    // What the snapshot draws before it sets a colour is black: set it first on the sheet's own content.
    const contents = page.node.get(NAME('Contents'));
    const parts = contents instanceof PDFArray ? contents.asArray() : [contents];
    if (!parts.length || !parts.every((part, i) => rewriteStream(doc, part, page.node.Resources(), map, i === 0))) return null;
    return vectorSnapshotUrl(await doc.save({ useObjectStreams: true }));
  } catch {
    return null;
  }
}
