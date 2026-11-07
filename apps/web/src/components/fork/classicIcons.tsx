// Added in the leojru/redcolumn fork (revu-layout). Original 16 × 16 line icons for the classic
// toolbars, drawn in the same style as components/toolIcons.tsx (stroke in the text colour).
import type { ReactNode } from 'react';
import type { Tool } from '../../markup/MarkupTools';
import { TOOL_ICONS } from '../toolIcons';
import { MENU_ICONS } from '../menuIcons';

function ic(children: ReactNode): ReactNode {
  return (
    <svg className="tool-svg" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const dot = (cx: number, cy: number, r = 1) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

/** A sheet of paper with a folded corner, used by the file icons. */
const sheet = <path d="M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3" />;

/** Icons for the file and edit commands on the main toolbar, by command id. */
export const CLASSIC_COMMAND_ICONS: Record<string, ReactNode> = {
  'file.newPdf': ic(
    <>
      {sheet}
      <path d="M8 7.5v5M5.5 10h5" />
    </>,
  ),
  'file.open': ic(<path d="M1.5 3.5h4l1.5 1.5h6v2M1.5 3.5v9.5h11l2-6h-11l-2 6" />),
  'file.save': ic(
    <>
      <path d="M2 2h9.5L14 4.5V14H2z" />
      <path d="M4.5 2v3.5h6V2M4.5 14V9.5h7V14" />
    </>,
  ),
  'file.saveAs': ic(
    <>
      <path d="M2 2h9.5L14 4.5V8M2 2v12h5" />
      <path d="M4.5 2v3.5h6V2" />
      <path d="M9 14.5l.5-2 4-4 1.5 1.5-4 4z" />
    </>,
  ),
  'file.print': MENU_ICONS.print,
  'file.share': ic(
    <>
      <path d="M1.5 3.5h13v9h-13z" />
      <path d="M1.5 3.5 8 9l6.5-5.5" />
    </>,
  ),
  'edit.undo': ic(<path d="M5.5 3 2.5 6l3 3M2.5 6h7a4 4 0 0 1 0 8H7" />),
  'edit.redo': ic(<path d="M10.5 3l3 3-3 3M13.5 6h-7a4 4 0 0 0 0 8H9" />),
};

/** Drawn icons for markup and measure tools; tools without one fall back to their toolbar glyph. */
export const CLASSIC_TOOL_ICONS: Partial<Record<Tool, ReactNode>> = {
  select: ic(<path d="M3.5 1.5v11l3-3 2 4.5 2-1-2-4.3h4.2z" />),
  lasso: ic(
    <>
      <path d="M5 11.5C2 10.5 1.5 8 2.5 6 4 3 9.5 2 12.5 3.5s2 5-1.5 6.5c-2 .8-4 .8-5.5.6" strokeDasharray="2 1.4" />
      <path d="M5 11.5c-.5 1.5.5 3 2 2.5" />
    </>,
  ),
  // Lines and shapes.
  line: ic(<path d="M2.5 13.5 13.5 2.5" />),
  arrow: ic(<path d="M2.5 13.5 13.5 2.5M8 2.5h5.5V8" />),
  arc: ic(<path d="M2 13C2 6.5 6.5 3 13.5 3" />),
  ellipticalArc: ic(<path d="M2 11c0-4 3.5-7 7.5-7 2.5 0 4.5 1.3 5 3" />),
  polyline: TOOL_ICONS.polyline,
  dimension: ic(<path d="M2 4v8M14 4v8M2 8h12M2 8l2.2-1.6M2 8l2.2 1.6M14 8l-2.2-1.6M14 8l-2.2 1.6" />),
  rect: ic(<rect x="2" y="3.5" width="12" height="9" rx="0.5" />),
  ellipse: ic(<ellipse cx="8" cy="8" rx="6.2" ry="4.8" />),
  polygon: ic(<path d="M8 1.8 14 6.2l-2.3 7.3H4.3L2 6.2z" />),
  cloud: ic(<path d="M4 12.5a2 2 0 0 1-1.2-3.6A2.2 2.2 0 0 1 5 5.3a2.6 2.6 0 0 1 4.6-1 2.3 2.3 0 0 1 3.6 2.3 2 2 0 0 1 .3 3.9 2 2 0 0 1-2.5 2z" />),
  polygonCloud: ic(<path d="M3 13.5 2 8.5 5 3.5h6l3 5-1 5zM3 13.5l1.5-.8 1.6.8 1.6-.8 1.6.8 1.6-.8 1.6.8" />),
  // A cloud with a plus badge: the cloud comes with a callout for its note.
  cloudPlus: ic(
    <>
      <path d="M3.5 10.5a1.8 1.8 0 0 1-1-3.3 2 2 0 0 1 2-3.2 2.4 2.4 0 0 1 4.2-.9 2.1 2.1 0 0 1 3.2 2.1" />
      <path d="M3.5 10.5h4" />
      <path d="M12 8.5v6M9 11.5h6" strokeWidth="1.6" />
    </>,
  ),
  // Freehand.
  pen: ic(
    <>
      <path d="M10.5 2.5l3 3-7.5 7.5-3.8.8.8-3.8z" />
      <path d="M9 4l3 3" />
    </>,
  ),
  highlighter: TOOL_ICONS.highlighter,
  eraser: TOOL_ICONS.eraser,
  // Text and notes.
  text: ic(
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="0.5" />
      <path d="M5 5.5h6M8 5.5v6" />
    </>,
  ),
  callout: ic(
    <>
      <rect x="6" y="2" width="8.5" height="6.5" rx="0.5" />
      <path d="M8.3 4.2h4M10.3 4.2v2.6" />
      <path d="M6 7 1.5 13.5" />
      {dot(1.5, 13.5, 1.1)}
    </>,
  ),
  typewriter: ic(<path d="M2 12.5 5 4l3 8.5M3.1 9.5h3.8M10 12.5v-6M10 8c.5-1.2 2.5-1.6 3.5-.6v5" />),
  note: ic(
    <>
      <path d="M2.5 2.5h11v8l-3 3h-8z" />
      <path d="M10.5 13.5v-3h3M5 5.5h6M5 8h4" />
    </>,
  ),
  flagLabel: TOOL_ICONS.flagLabel,
  // Text markup on the PDF's own text.
  textHighlight: ic(
    <>
      <rect x="1.5" y="4" width="13" height="8" rx="0.5" fill="#facc15" fillOpacity="0.55" stroke="none" />
      <path d="M5 6h6M8 6v4.5" />
    </>,
  ),
  underline: ic(<path d="M4.5 2.5v5a3.5 3.5 0 0 0 7 0v-5M3 14h10" />),
  strikeout: ic(<path d="M5 2.5h6M8 2.5V13M2 8h12" />),
  squiggly: ic(<path d="M5 2.5h6M8 2.5v8M2 13.5l1.5-1.5 1.5 1.5 1.5-1.5 1.5 1.5 1.5-1.5 1.5 1.5 1.5-1.5 1.5 1.5" />),
  // Struck-out text with an insertion caret under it.
  replaceText: ic(<path d="M4 2h8M8 2v7M2 5.5h12M5 14l3-3.5 3 3.5" />),
  // Insert.
  image: TOOL_ICONS.image,
  stamp: TOOL_ICONS.stamp,
  snapshot: ic(
    <>
      <path d="M1.5 4.5v-3h3M11.5 1.5h3v3M14.5 11.5v3h-3M4.5 14.5h-3v-3" />
      <circle cx="8" cy="8" r="2.5" />
    </>,
  ),
  attachment: ic(<path d="M11 5.5 6 10.5a1.4 1.4 0 0 1-2-2L9.5 3a2.6 2.6 0 0 1 3.7 3.7L7.5 12.4a4 4 0 0 1-5.6-5.6L6.5 2.2" />),
  hyperlink: ic(<path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.5-2.5a2.6 2.6 0 0 0-3.7-3.7L8.2 4M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3 9.3A2.6 2.6 0 0 0 6.7 13l1.1-1" />),
  legend: ic(
    <>
      <rect x="1.5" y="2" width="13" height="12" rx="0.5" />
      <path d="M4 5h2M8 5h4M4 8h2M8 8h4M4 11h2M8 11h4" />
    </>,
  ),
  table: ic(
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="0.5" />
      <path d="M1.5 6h13M1.5 9.5h13M6 2.5v11M10.5 2.5v11" />
    </>,
  ),
  space: ic(<path d="M2 2.5h7v4h5v7H2z" strokeDasharray="2 1.3" />),
  redaction: ic(
    <>
      <rect x="1.5" y="5" width="13" height="6" rx="0.5" fill="currentColor" />
      <path d="M3 2.5h10M3 13.5h7" />
    </>,
  ),
  // Measurements (drawn in the measure colour by CSS).
  calibrate: ic(<path d="M1.5 6.5h13v4h-13zM4 6.5v2M6.5 6.5v1.3M9 6.5v2M11.5 6.5v1.3M2.5 3.5h11M2.5 3.5l1.5-1M2.5 3.5l1.5 1M13.5 3.5l-1.5-1M13.5 3.5l-1.5 1" />),
  length: ic(
    <>
      <path d="M2 13.5 14 2.5" />
      <path d="M3 10l3 3M10 3l3 3" />
    </>,
  ),
  polylength: ic(
    <>
      <path d="M1.8 13.5 5 6.5l4.5 4 4.7-8" />
      {dot(1.8, 13.5)}
      {dot(14.2, 2.5)}
      <path d="M11.5 12h3M13 10.5v3" />
    </>,
  ),
  perimeter: ic(
    <>
      <path d="M2.5 4l6-2 5.5 4-1.5 7.5H4z" />
      {dot(2.5, 4)}
      {dot(8.5, 2)}
      {dot(14, 6)}
      {dot(12.5, 13.5)}
      {dot(4, 13.5)}
    </>,
  ),
  area: ic(<path d="M2.5 4l6-2 5.5 4-1.5 7.5H4z" fill="currentColor" fillOpacity="0.3" />),
  arcLength: ic(
    <>
      <path d="M2 12.5a7 7 0 0 1 12 0" />
      <path d="M2 12.5v2M14 12.5v2" />
    </>,
  ),
  diameter: ic(
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M3.8 12.2l8.4-8.4" />
    </>,
  ),
  radius: ic(
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 8l4.2-4.2" />
      {dot(8, 8)}
    </>,
  ),
  angle: ic(<path d="M13.5 13.5h-11l7-10M6 13.5a4 4 0 0 0-1.2-3" />),
  volume: ic(<path d="M2 5.5 8 2.5l6 3v6l-6 3-6-3zM2 5.5l6 3 6-3M8 8.5v6" />),
  count: ic(
    <>
      <circle cx="4.5" cy="4.5" r="2.2" />
      <circle cx="11.5" cy="4.5" r="2.2" />
      <circle cx="4.5" cy="11.5" r="2.2" />
      <path d="M10 11.5l1.2 1.2 2.6-2.8" />
    </>,
  ),
  visualSearch: ic(
    <>
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="M10 10l4 4M4.5 6.5h4M6.5 4.5v4" />
    </>,
  ),
  dynamicFill: ic(
    <>
      <path d="M2.5 7.5 7 3l5 5-4.5 4.5a1.4 1.4 0 0 1-2 0l-3-3a1.4 1.4 0 0 1 0-2z" />
      <path d="M2.5 8.5h9.5M13.5 10.5s1.2 1.6 1.2 2.4a1.2 1.2 0 0 1-2.4 0c0-.8 1.2-2.4 1.2-2.4z" />
    </>,
  ),
};

/** True for the tools drawn in the measure colour. */
export const MEASURE_TOOL_SET = new Set<Tool>(['calibrate', 'length', 'polylength', 'perimeter', 'area', 'arcLength', 'diameter', 'radius', 'angle', 'volume', 'count', 'visualSearch', 'dynamicFill']);
