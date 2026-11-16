// Added in the leojru/redcolumn fork (revu-layout). Drops what a vector snapshot cannot show: the
// paths, text and drawn objects of a page's content that lie outside the snapshot's box.
//
// It reads a PDF content stream as operators and keeps every one that changes state (colours,
// fonts, clips, q/Q, cm...). It removes only painting that is certain to fall outside the box:
//  - a path painted (stroked or filled) whose bounding box misses the box;
//  - the text shown in a text object whose estimated reach misses the box;
//  - a Do of a form or image whose box misses the box;
//  - everything after a clip whose bounding box misses the box, up to the Q that ends it.
// Every estimate errs towards keeping. Anything it cannot read makes it return null (keep as is).

export type Matrix = [number, number, number, number, number, number];
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** What the culler needs to know about a form or image XObject it meets in a Do. */
export interface XObjectInfo {
  /** The form's /BBox in its own space (an image is the unit square). */
  bbox: Rect;
  /** The form's /Matrix, identity for an image. */
  matrix: Matrix;
}

interface Tok {
  k: 'num' | 'name' | 'str' | 'arr' | 'dict' | 'op';
  raw: string;
  n?: number;
  items?: Tok[];
}
interface Op {
  name: string;
  args: Tok[];
  raw: string;
}

const WHITE = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%']);
const isWhite = (c: number) => WHITE.has(c);
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

const mul = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];
const at = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const scaleOf = (m: Matrix) => Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const apart = (a: Rect, b: Rect) => a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1;

/** The bounding box of points, or null when there are none. */
function boxOf(points: readonly (readonly [number, number])[]): Rect | null {
  if (!points.length) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

const grow = (r: Rect, by: number): Rect => ({ x0: r.x0 - by, y0: r.y0 - by, x1: r.x1 + by, y1: r.y1 + by });

/** The box of a rectangle in one space as another space shows it. */
export function transformRect(r: Rect, m: Matrix): Rect {
  return boxOf([at(m, r.x0, r.y0), at(m, r.x1, r.y0), at(m, r.x0, r.y1), at(m, r.x1, r.y1)])!;
}

/** Splits a content stream into operators. Null when it cannot be read. */
function lex(s: string): Op[] | null {
  const ops: Op[] = [];
  let args: Tok[] = [];
  let i = 0;
  let opStart = 0;
  const n = s.length;
  const skipSpace = () => {
    while (i < n) {
      const c = s.charCodeAt(i);
      if (isWhite(c)) i++;
      else if (c === 37) {
        while (i < n && s.charCodeAt(i) !== 10 && s.charCodeAt(i) !== 13) i++;
      } else break;
    }
  };
  /** One value: a number, name, string, array, dictionary or (as 'op') anything else. */
  const value = (): Tok | null => {
    skipSpace();
    if (i >= n) return null;
    const start = i;
    const ch = s[i]!;
    if (ch === '(') {
      let depth = 0;
      while (i < n) {
        const c = s[i]!;
        if (c === '\\') i += 2;
        else {
          if (c === '(') depth++;
          else if (c === ')' && --depth === 0) {
            i++;
            break;
          }
          i++;
        }
      }
      if (depth !== 0) return null;
      return { k: 'str', raw: s.slice(start, i) };
    }
    if (ch === '<' && s[i + 1] === '<') {
      i += 2;
      const items: Tok[] = [];
      for (;;) {
        skipSpace();
        if (i >= n) return null;
        if (s[i] === '>' && s[i + 1] === '>') {
          i += 2;
          break;
        }
        const v = value();
        if (!v) return null;
        items.push(v);
      }
      return { k: 'dict', raw: s.slice(start, i), items };
    }
    if (ch === '<') {
      const end = s.indexOf('>', i);
      if (end < 0) return null;
      i = end + 1;
      return { k: 'str', raw: s.slice(start, i) };
    }
    if (ch === '[') {
      i++;
      const items: Tok[] = [];
      for (;;) {
        skipSpace();
        if (i >= n) return null;
        if (s[i] === ']') {
          i++;
          break;
        }
        const v = value();
        if (!v) return null;
        items.push(v);
      }
      return { k: 'arr', raw: s.slice(start, i), items };
    }
    if (ch === '/') {
      i++;
      while (i < n && !isWhite(s.charCodeAt(i)) && !DELIM.has(s[i]!)) i++;
      return { k: 'name', raw: s.slice(start, i) };
    }
    if (ch === ')' || ch === '>' || ch === ']' || ch === '{' || ch === '}') return null;
    while (i < n && !isWhite(s.charCodeAt(i)) && !DELIM.has(s[i]!)) i++;
    const raw = s.slice(start, i);
    if (!raw) return null;
    if (NUMBER.test(raw)) return { k: 'num', raw, n: Number(raw) };
    return { k: 'op', raw };
  };

  for (;;) {
    skipSpace();
    if (i >= n) break;
    if (!args.length) opStart = i;
    const tok = value();
    if (!tok) return null;
    if (tok.k !== 'op') {
      args.push(tok);
      continue;
    }
    let name = tok.raw;
    let end = i;
    if (name === 'BI') {
      // An inline image: its dictionary, then ID, the data and EI, kept as one operation.
      for (;;) {
        const t = value();
        if (!t) return null;
        if (t.k === 'op' && t.raw === 'ID') break;
        if (t.k === 'op') return null;
      }
      let at0 = i + 1;
      if (s[i] === '\r' && s[i + 1] === '\n') at0 = i + 2;
      let j = at0;
      for (;;) {
        j = s.indexOf('EI', j);
        if (j < 0) return null;
        if (isWhite(s.charCodeAt(j - 1)) && (j + 2 >= n || isWhite(s.charCodeAt(j + 2)))) break;
        j += 2;
      }
      i = j + 2;
      end = i;
      name = 'BI';
    }
    ops.push({ name, args, raw: s.slice(opStart, end).trim() });
    args = [];
  }
  return args.length ? null : ops;
}

const PATH_OPS = new Set(['m', 'l', 'c', 'v', 'y', 're', 'h']);
const STROKE = new Set(['S', 's', 'B', 'B*', 'b', 'b*']);
const PAINT = new Set(['S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'n']);
const SHOW = new Set(['Tj', 'TJ', "'", '"']);
/** Operators that put something on the page (a path painted as n only clips). */
const PAINTING = new Set(['S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'Do', 'sh', 'BI', 'Tj', 'TJ', "'", '"']);

const nums = (args: readonly Tok[], count: number): number[] | null => {
  if (args.length < count) return null;
  const out: number[] = [];
  for (const a of args.slice(args.length - count)) {
    if (a.k !== 'num' || !Number.isFinite(a.n)) return null;
    out.push(a.n!);
  }
  return out;
};

/** Adds the names `tok` holds (a /Name, or names inside an array or dictionary) to `into`. */
function collectNames(tok: Tok, into: Set<string>) {
  if (tok.k === 'name') into.add(tok.raw.slice(1));
  else if (tok.items) for (const t of tok.items) collectNames(t, into);
}

/** The bytes a show-text operation reaches over, in text space units (upper bound), and its string bytes. */
function showReach(op: Op, fontSize: number, hscale: number, tc: number, tw: number) {
  let glyphs = 0;
  let shift = 0;
  const count = (t: Tok) => {
    if (t.k === 'str') glyphs += t.raw.length;
    else if (t.k === 'num') shift += Math.abs(t.n ?? 0);
    else if (t.items) t.items.forEach(count);
  };
  op.args.forEach(count);
  const size = Math.abs(fontSize) * Math.max(hscale / 100, 1);
  return glyphs * (size * 1.6 + Math.abs(tc) + Math.abs(tw)) + (shift / 1000) * size;
}

export interface CullResult {
  /** The new content stream. */
  content: string;
  /** Every name the new content uses (resources it does not name can be dropped). */
  names: Set<string>;
  /** Operators kept and removed. */
  kept: number;
  removed: number;
}

/**
 * Removes what lies outside `region` (in the space the content starts in) from a content stream.
 * `xobject` tells about the forms and images a Do names; for one it does not know, the Do stays.
 * Null when the stream cannot be read.
 */
export function cullContent(content: string, region: Rect, xobject: (name: string) => XObjectInfo | null): CullResult | null {
  const ops = lex(content);
  if (!ops) return null;
  const keep = grow(region, 2);
  const out: Op[] = [];
  const names = new Set<string>();
  let removed = 0;

  let ctm: Matrix = IDENTITY;
  let lineWidth = 1;
  let miter = 10;
  const stack: { ctm: Matrix; lineWidth: number; miter: number }[] = [];
  /** > -1 while everything is dropped after a clip that misses the box: the q depth inside it. */
  let skipping = -1;

  // The path being built.
  let path: Op[] = [];
  let points: [number, number][] = [];
  let clips = false;

  // The text object being read.
  let text: { ops: Op[]; shows: { x: number; y: number; reach: number; op: Op }[]; mustKeep: boolean } | null = null;
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let fontSize = 0;
  let hscale = 100;
  let tc = 0;
  let tw = 0;
  let leading = 0;
  let rise = 0;
  let slack = 0;

  // q … Q blocks that paint nothing change nothing (Q restores the state): they are left out.
  const frames: { start: number; painted: boolean }[] = [];
  const push = (op: Op) => {
    const op_ = op.name;
    if (op_ === 'q') {
      frames.push({ start: out.length, painted: false });
      out.push(op);
    } else if (op_ === 'Q') {
      const frame = frames.pop();
      if (frame && !frame.painted) out.length = frame.start;
      else {
        out.push(op);
        if (frame && frames.length) frames[frames.length - 1]!.painted = true;
      }
    } else {
      if (frames.length && PAINTING.has(op_)) frames[frames.length - 1]!.painted = true;
      out.push(op);
    }
  };
  const emitPath = () => {
    for (const p of path) push(p);
    path = [];
    points = [];
    clips = false;
  };

  const addPoints = (op: Op): boolean => {
    const f = (count: number) => nums(op.args, count);
    let v: number[] | null;
    switch (op.name) {
      case 'm':
      case 'l':
        if (!(v = f(2))) return false;
        points.push(at(ctm, v[0]!, v[1]!));
        return true;
      case 'c':
        if (!(v = f(6))) return false;
        for (let k = 0; k < 6; k += 2) points.push(at(ctm, v[k]!, v[k + 1]!));
        return true;
      case 'v':
      case 'y':
        if (!(v = f(4))) return false;
        for (let k = 0; k < 4; k += 2) points.push(at(ctm, v[k]!, v[k + 1]!));
        return true;
      case 're':
        if (!(v = f(4))) return false;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) points.push(at(ctm, v[0]! + dx * v[2]!, v[1]! + dy * v[3]!));
        return true;
      default:
        return true;
    }
  };

  const finishText = () => {
    const t = text!;
    text = null;
    const near = t.mustKeep || t.shows.some((s) => Math.hypot(Math.max(keep.x0 - s.x, 0, s.x - keep.x1), Math.max(keep.y0 - s.y, 0, s.y - keep.y1)) <= s.reach);
    const gone = new Set(t.shows.map((s) => s.op));
    for (const o of t.ops) {
      if (!near && gone.has(o)) removed++;
      else push(o);
    }
  };

  for (const op of ops) {
    const name = op.name;
    if (skipping >= 0) {
      if (name === 'q') skipping++;
      else if (name === 'Q') {
        if (skipping > 0) skipping--;
        else {
          skipping = -1;
          const top = stack.pop();
          if (top) ({ ctm, lineWidth, miter } = top);
          push(op);
          continue;
        }
      }
      removed++;
      continue;
    }

    if (text) {
      // Inside BT … ET: everything is kept except the shown text that is out of reach.
      switch (name) {
        case 'ET':
          text.ops.push(op);
          finishText();
          continue;
        case 'Tf': {
          const v = nums(op.args, 1);
          if (!v) return null;
          fontSize = v[0]!;
          break;
        }
        case 'Tz': {
          const v = nums(op.args, 1);
          if (!v) return null;
          hscale = v[0]!;
          break;
        }
        case 'Tc': {
          const v = nums(op.args, 1);
          if (!v) return null;
          tc = v[0]!;
          break;
        }
        case 'Tw': {
          const v = nums(op.args, 1);
          if (!v) return null;
          tw = v[0]!;
          break;
        }
        case 'TL': {
          const v = nums(op.args, 1);
          if (!v) return null;
          leading = v[0]!;
          break;
        }
        case 'Ts': {
          const v = nums(op.args, 1);
          if (!v) return null;
          rise = v[0]!;
          break;
        }
        case 'Tr': {
          const v = nums(op.args, 1);
          if (!v) return null;
          if (v[0]! >= 4) text.mustKeep = true;
          break;
        }
        case 'Tm': {
          const v = nums(op.args, 6);
          if (!v) return null;
          tm = tlm = v as Matrix;
          slack = 0;
          break;
        }
        case 'Td':
        case 'TD':
        case 'T*': {
          let tx = 0;
          let ty = 0;
          if (name === 'T*') ty = -leading;
          else {
            const v = nums(op.args, 2);
            if (!v) return null;
            [tx, ty] = v as [number, number];
            if (name === 'TD') leading = -ty;
          }
          tlm = mul([1, 0, 0, 1, tx, ty], tlm);
          tm = tlm;
          slack = 0;
          break;
        }
        case 'q':
        case 'Q':
        case 'cm':
        case 'BT':
          // Not allowed inside a text object: leave the stream as it is.
          return null;
        default:
          break;
      }
      if (SHOW.has(name)) {
        if (name === "'" || name === '"') {
          tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
          tm = tlm;
          slack = 0;
        }
        const reach = showReach(op, fontSize, hscale, tc, tw);
        const full = mul(tm, ctm);
        const [x, y] = at(full, 0, rise);
        const scale = scaleOf(full);
        text.shows.push({ x, y, reach: (slack + reach + Math.abs(fontSize) * 2 + Math.abs(rise)) * scale, op });
        slack += reach;
      }
      text.ops.push(op);
      continue;
    }

    if (PATH_OPS.has(name)) {
      if (!addPoints(op)) return null;
      path.push(op);
      continue;
    }
    if (name === 'W' || name === 'W*') {
      clips = true;
      path.push(op);
      continue;
    }
    if (PAINT.has(name)) {
      if (!path.length) {
        push(op);
        continue;
      }
      const box = boxOf(points);
      if (clips) {
        // A clip that misses the box hides everything drawn under it, up to the Q that ends it.
        if (box && apart(box, keep)) {
          removed += path.length + 1;
          path = [];
          points = [];
          clips = false;
          skipping = 0;
          if (!stack.length) {
            // No q around it: the clip holds to the end of the stream.
            skipping = Number.MAX_SAFE_INTEGER;
          }
          continue;
        }
        emitPath();
        push(op);
        continue;
      }
      if (name === 'n') {
        removed += path.length + 1;
        path = [];
        points = [];
        continue;
      }
      const reach = STROKE.has(name) ? (Math.max(lineWidth, 0) * Math.max(miter, 1) * scaleOf(ctm)) / 2 + 1 : 0;
      if (box && apart(grow(box, reach), keep)) {
        removed += path.length + 1;
        path = [];
        points = [];
        continue;
      }
      emitPath();
      push(op);
      continue;
    }
    if (path.length) emitPath();

    switch (name) {
      case 'q':
        stack.push({ ctm, lineWidth, miter });
        break;
      case 'Q': {
        const top = stack.pop();
        if (top) ({ ctm, lineWidth, miter } = top);
        break;
      }
      case 'cm': {
        const v = nums(op.args, 6);
        if (!v) return null;
        ctm = mul(v as Matrix, ctm);
        break;
      }
      case 'w': {
        const v = nums(op.args, 1);
        if (!v) return null;
        lineWidth = v[0]!;
        break;
      }
      case 'M': {
        const v = nums(op.args, 1);
        if (!v) return null;
        miter = v[0]!;
        break;
      }
      case 'BT':
        text = { ops: [], shows: [], mustKeep: false };
        tm = tlm = IDENTITY;
        slack = 0;
        text.ops.push(op);
        continue;
      case 'Do': {
        const nameTok = op.args[op.args.length - 1];
        const info = nameTok?.k === 'name' ? xobject(nameTok.raw.slice(1)) : null;
        if (info) {
          const box = transformRect(transformRect(info.bbox, info.matrix), ctm);
          if (apart(box, keep)) {
            removed++;
            continue;
          }
        }
        break;
      }
      default:
        break;
    }
    push(op);
  }
  if (text) {
    // An unfinished text object: keep what it holds.
    for (const o of text.ops) push(o);
  }
  if (path.length) emitPath();
  const kept = out.length;
  for (const o of out) {
    for (const a of o.args) collectNames(a, names);
    // An inline image can name a colour space in the resources.
    if (o.name === 'BI') for (const m of o.raw.matchAll(/\/([^\s/<>\[\]()]+)/g)) names.add(m[1]!);
  }
  return { content: out.map((o) => o.raw).join('\n') + '\n', names, kept, removed };
}
