// Added in the leojru/redcolumn fork. A Dimension's or Length's text edited where it sits, as in Revu: no
// pop-up. It opens on a new dimension and on a double-click on one. Enter finishes, Shift+Enter
// starts a second line, Esc leaves the text as it was; clicking away finishes too. A Length's text is
// its measurement: a new one resizes the line.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { formatLength, realLengthAlong } from '@nb/measure';
import { cssFont, dimensionLine, dimensionText, textColor, type Markup, type MarkupStore } from '@nb/markup';
import { pointsForTypedLength } from '../../fork/lengthEdit';
import { useSettings } from '../../settings/settings';
import type { TileViewer } from '../../viewer/TileViewer';

const MIN_EDIT_FONT_PX = 13;

interface Props {
  markup: Markup;
  store: MarkupStore;
  viewer: TileViewer;
  onDone: () => void;
}

/** The text's angle along the line, kept reading left to right. */
function readingAngle(m: Markup): number {
  const [a, b] = [m.points[0]!, m.points[m.points.length - 1]!];
  let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  if (angle > Math.PI / 2) angle -= Math.PI;
  else if (angle < -Math.PI / 2) angle += Math.PI;
  return angle;
}

export function DimensionTextEditor({ markup, store, viewer, onDone }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancelled = useRef(false);
  // A Length's text is its measurement: typing a new one resizes the line.
  const isLength = markup.type === 'length';
  const lengthScale = store.scaleOf(markup);
  const measured = () => {
    const [a, b] = [markup.points[0]!, markup.points[markup.points.length - 1]!];
    return formatLength(realLengthAlong(lengthScale, b[0] - a[0], b[1] - a[1]), lengthScale);
  };
  const initial = isLength ? measured() : (markup.text ?? '');
  const [text, setText] = useState(initial);
  const invalid = isLength && text !== initial && !pointsForTypedLength(markup.points, text, lengthScale);
  const { spellCheck } = useSettings();

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const layout = dimensionText(markup);
  const line = dimensionLine(markup);
  const [p0, pN] = [markup.points[0]!, markup.points[markup.points.length - 1]!];
  const center = layout?.box.center ?? line?.text ?? ([(p0[0] + pN[0]) / 2, (p0[1] + pN[1]) / 2] as [number, number]);
  const angle = layout?.angle ?? readingAngle(markup);
  const [cx, cy] = viewer.pageToClient(center, markup.pageIndex);
  const size = markup.style.fontSize ?? 10;
  // When zoomed out, the editor is enlarged so what is typed can be read.
  const scale = Math.max(viewer.zoomFor(markup.pageIndex), MIN_EDIT_FONT_PX / size);
  const font = cssFont(markup.style, size * scale);
  const lines = text.split('\n');
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = font;
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width), size * scale * 3) + size * scale;
  const height = lines.length * size * scale * 1.2 + size * scale * 0.4;

  const finish = () => {
    const now = ref.current?.value ?? '';
    if (isLength) {
      const points = !cancelled.current && now !== initial ? pointsForTypedLength(markup.points, now, lengthScale) : null;
      if (points) {
        store.checkpoint();
        store.update(markup.id, { points });
      }
      onDone();
      return;
    }
    if (!cancelled.current && now !== (markup.text ?? '')) {
      store.checkpoint();
      store.update(markup.id, { text: now });
    }
    onDone();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      cancelled.current = true;
      e.currentTarget.blur();
    } else if (e.key === 'Enter' && (isLength || !e.shiftKey) && !e.nativeEvent.isComposing) {
      // Enter finishes; Shift+Enter is a new line.
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <textarea
      ref={ref}
      className="text-editor dimension-text-editor"
      data-dimension-editor={markup.id}
      aria-label={isLength ? 'Length' : 'Dimension text'}
      aria-invalid={invalid || undefined}
      spellCheck={spellCheck}
      value={text}
      rows={lines.length}
      wrap="off"
      onChange={(e) => setText(e.target.value)}
      onBlur={finish}
      onKeyDown={onKeyDown}
      style={{
        left: cx,
        top: cy,
        width,
        height,
        transform: `translate(-50%, -50%) rotate(${angle}rad)`,
        font,
        lineHeight: 1.2,
        textAlign: 'center',
        color: textColor(markup.style),
        ...(invalid ? { outlineColor: '#dc2626' } : {}),
        padding: `${size * scale * 0.2}px ${size * scale * 0.5}px`,
      }}
    />
  );
}
