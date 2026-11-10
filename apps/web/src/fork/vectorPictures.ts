// Added in the leojru/redcolumn fork (revu-layout). Keeps vector snapshots sharp on screen: past the
// resolution of the stored picture, the part in view is drawn from the snapshot's PDF content.
import { stampAppearanceSheet, vectorSnapshotBytes, type MarkupStore } from '@nb/markup';
import { PDFDocument } from 'pdf-lib';
import type { PdfDocument, PdfEngine } from '@nb/pdf-core';

interface Sheet {
  doc: PdfDocument;
  width: number;
  height: number;
}

/** A piece of the sheet drawn at `scale` pixels per sheet point. */
interface Tile {
  bitmap: ImageBitmap;
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

interface Request {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

interface View {
  tile?: Tile;
  want?: Request;
  timer?: ReturnType<typeof setTimeout>;
  busy?: boolean;
  retryAt?: number;
}

const SETTLE_MS = 90;
const RETRY_MS = 5000;
const MAX_TILE_PX = 8192;
const MAX_SHEETS = 24;
const MAX_VIEWS = 8;

/** Where the vector drawing of a stamp from another tool comes from, by its picture. Read only when zoomed in. */
const sources = new Map<string, () => Promise<Uint8Array | null>>();
const parsed = new WeakMap<PdfDocument, Promise<PDFDocument>>();

/** Lets the stamps another tool wrote (Revu snapshots) in this document be drawn sharply. Saving does not use this. */
export function registerStampSources(doc: PdfDocument, store: MarkupStore) {
  for (const m of store.all()) {
    if (m.type !== 'image' || !m.image || m.vector || !m.pdfAnnot?.image || sources.has(m.image)) continue;
    const { pageIndex } = m;
    const { index } = m.pdfAnnot;
    sources.set(m.image, async () => {
      let file = parsed.get(doc);
      if (!file) parsed.set(doc, (file = doc.bytes().then((b) => PDFDocument.load(b, { ignoreEncryption: true, updateMetadata: false }))));
      return stampAppearanceSheet(await file, pageIndex, index);
    });
  }
}

/** A drawer for `setVectorPictureDrawer`: true when it drew the snapshot, false to show the picture. */
export function createVectorPictures(engine: PdfEngine, redraw: () => void) {
  const sheets = new Map<string, Sheet>();
  const opening = new Set<string>();
  const failed = new Map<string, number>();
  const views = new WeakMap<HTMLCanvasElement, Map<string, View>>();

  const open = (url: string) => {
    if (opening.has(url) || (failed.get(url) ?? 0) > Date.now()) return;
    const load = sources.get(url);
    if (!load && !url.startsWith('data:application/pdf')) return;
    opening.add(url);
    void (load ? load() : Promise.resolve(vectorSnapshotBytes(url)))
      .then((bytes) => {
        if (!bytes) throw new Error('No drawing');
        return engine.open(bytes.slice().buffer as ArrayBuffer);
      })
      .then((doc) => {
        const page = doc.pages[0];
        if (!page) throw new Error('No page');
        sheets.set(url, { doc, width: page.width, height: page.height });
        if (sheets.size > MAX_SHEETS) {
          const [oldest, sheet] = sheets.entries().next().value!;
          sheets.delete(oldest);
          void sheet.doc.close();
        }
        redraw();
      })
      .catch(() => failed.set(url, Date.now() + RETRY_MS))
      .finally(() => opening.delete(url));
  };

  const render = (url: string, view: View) => {
    view.timer = undefined;
    const sheet = sheets.get(url);
    const req = view.want;
    if (!sheet || !req || view.busy) return;
    view.busy = true;
    view.want = undefined;
    const px = Math.floor(req.x * req.scale);
    const py = Math.floor(req.y * req.scale);
    sheet.doc
      .renderTile(0, req.scale, px, py, Math.max(1, Math.ceil(req.w * req.scale)), Math.max(1, Math.ceil(req.h * req.scale)), { transparent: true })
      .then(({ bitmap }) => {
        view.tile?.bitmap.close();
        view.tile = { bitmap, x: px / req.scale, y: py / req.scale, w: bitmap.width / req.scale, h: bitmap.height / req.scale, scale: req.scale };
        redraw();
      })
      .catch(() => {
        // The engine may have restarted: open the sheet again later.
        sheets.delete(url);
        view.retryAt = Date.now() + RETRY_MS;
      })
      .finally(() => {
        view.busy = false;
        if (view.want) view.timer = setTimeout(() => render(url, view), SETTLE_MS);
      });
  };

  return (ctx: CanvasRenderingContext2D, url: string, box: { x: number; y: number; w: number; h: number }, pictureWidth: number): boolean => {
    const canvas = ctx.canvas;
    // Only what is on screen: exports and thumbnails use the picture.
    if (!(canvas instanceof HTMLCanvasElement) || !canvas.isConnected || !(box.w > 0) || !(box.h > 0)) return false;
    const t = ctx.getTransform();
    const pixelsPerPoint = Math.hypot(t.a, t.b);
    if (box.w * pixelsPerPoint <= pictureWidth * 1.1) return false;

    const sheet = sheets.get(url);
    if (!sheet) {
      open(url);
      return false;
    }
    let byUrl = views.get(canvas);
    if (!byUrl) views.set(canvas, (byUrl = new Map()));
    let view = byUrl.get(url);
    if (!view) {
      byUrl.set(url, (view = {}));
      if (byUrl.size > MAX_VIEWS) {
        const [oldest, old] = byUrl.entries().next().value!;
        byUrl.delete(oldest);
        old.tile?.bitmap.close();
      }
    }

    // What the canvas shows, in the snapshot's own sheet points.
    const inv = t.inverse();
    const corners = [new DOMPoint(0, 0), new DOMPoint(canvas.width, 0), new DOMPoint(0, canvas.height), new DOMPoint(canvas.width, canvas.height)].map((p) => p.matrixTransform(inv));
    const k = sheet.width / box.w;
    const x0 = Math.max(0, (Math.min(...corners.map((p) => p.x)) - box.x) * k);
    const y0 = Math.max(0, (Math.min(...corners.map((p) => p.y)) - box.y) * k);
    const x1 = Math.min(sheet.width, (Math.max(...corners.map((p) => p.x)) - box.x) * k);
    const y1 = Math.min(sheet.height, (Math.max(...corners.map((p) => p.y)) - box.y) * k);
    if (x1 <= x0 || y1 <= y0) return true;
    const scale = pixelsPerPoint / k;

    const tile = view.tile;
    const covers = !!tile && tile.x <= x0 + 1 / scale && tile.y <= y0 + 1 / scale && tile.x + tile.w >= x1 - 1 / scale && tile.y + tile.h >= y1 - 1 / scale;
    const sharp = !!tile && tile.scale >= scale * 0.99 && tile.scale <= scale * 2;
    if (!covers || !sharp) {
      if (!view.retryAt || view.retryAt <= Date.now()) {
        const mx = (x1 - x0) * 0.25;
        const my = (y1 - y0) * 0.25;
        const x = Math.max(0, x0 - mx);
        const y = Math.max(0, y0 - my);
        const w = Math.min(sheet.width, x1 + mx) - x;
        const h = Math.min(sheet.height, y1 + my) - y;
        view.want = { x, y, w, h, scale: Math.min(scale, MAX_TILE_PX / Math.max(w, h)) };
        if (!view.timer && !view.busy) {
          const v = view;
          view.timer = setTimeout(() => render(url, v), SETTLE_MS);
        }
      }
    }
    // Until the sharp piece is ready, the picture shows.
    if (!tile || !covers || tile.scale < scale * 0.8) return false;
    ctx.drawImage(tile.bitmap, box.x + tile.x / k, box.y + tile.y / k, tile.w / k, tile.h / k);
    return true;
  };
}
