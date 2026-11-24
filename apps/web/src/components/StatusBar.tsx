// Modified in the leojru/redcolumn fork (revu-layout): compact classic status bar (leading, middle, compact; no X/Y in the classic bar).
import { msg } from '@nb/i18n';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { formatLatLon, formatLength, geoAt, type GeoRegion, type Scale } from '@nb/measure';
import type { PagePoint, TileViewer } from '../viewer/TileViewer';
import { settings, useSettings } from '../settings/settings';
import { useOnline } from '../offline/network';
import { desktop } from '../desktop/host';
import { assistantIsOn, subscribeAssistant } from '../desktop/assistantFlag';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import { toolLabel, type ArcMode, type Tool } from '../markup/MarkupTools';
import { shortcutLabel } from '../commands/shortcuts';
import type { Category } from './PreferencesDialog';

/** Where a toggle's settings live in Preferences. */
interface PrefsTarget {
  category: Category;
  tab: string;
}

interface Props {
  viewer: TileViewer | null;
  /** View rotation in clockwise quarter turns (from the viewer's stats). */
  rotation: number;
  /** Scale of a page, for showing the cursor position in real-world units. */
  scaleFor: (pageIndex: number) => Scale | null;
  /** The document's map registrations (geospatial PDFs), for showing latitude and longitude. */
  geoRegions: () => readonly GeoRegion[];
  /** Snap to drawing content (the tools' own toggle). */
  snapContent: boolean;
  onSnapContent: (on: boolean) => void;
  disabled: boolean;
  /** Synchronised split panes (null: off; undefined: no split). */
  sync?: 'document' | 'page' | null;
  onSync?: (mode: 'document' | 'page' | null) => void;
  /** Opens Preferences on a category and tab (right-click a toggle → Settings…). */
  onOpenSettings: (category: Category, tab: string) => void;
  /** The active pane's tool, shown at the left so a shortcut gives a visible cue. */
  tool: Tool;
  /** Back to the Select tool (clicking the tool's name). */
  onSelectTool: () => void;
  /** Fork addition (classic layout): controls at the far left, before the toggles. */
  leading?: ReactNode;
  /** Fork addition (classic layout): the page strip as the whole bar, given the bar's left and right controls to hold, so its page arrows sit in the middle. */
  middle?: (before: ReactNode, after: ReactNode) => ReactNode;
  /** Fork addition (classic layout): shorter toggle names; Polar, Track, Rulers, Crosshair and Draw to Scale stay in the View and Tools menus. */
  compact?: boolean;
  /** Fork addition (classic layout): controls just before the pointer position. */
  trailing?: ReactNode;
  /** A 3-point arc is armed: what the next click is for. */
  arc?: ArcMode;
}

/** What to click next while a 3-point arc is armed. */
const arcHint = (mode: Exclude<ArcMode, 'off'>) =>
  mode === 'awaitMid' ? msg('Arc: click a point on the curve, then the arc end') : msg('Arc: click the arc end');

function Toggle({
  label,
  title,
  on,
  onChange,
  disabled,
  prefs,
  onMenu,
}: {
  label: string;
  title: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  /** Where this toggle's settings live; right-click offers to open them. */
  prefs?: PrefsTarget;
  onMenu?: (e: React.MouseEvent, label: string, target: PrefsTarget) => void;
}) {
  return (
    // A disabled button gets no mouse events, so the right-click is taken one level up.
    <span className="status-toggle-wrap" onContextMenu={prefs && onMenu ? (e) => onMenu(e, label, prefs) : undefined}>
      <button className={`status-toggle${on ? ' on' : ''}`} title={title} aria-pressed={on} disabled={disabled} onClick={() => onChange(!on)}>
        {label}
      </button>
    </span>
  );
}

/**
 * The status bar: snap and grid toggles on the left, the pointer's position on the page (in
 * the page's scale) on the right. It follows the pointer itself so moving the mouse does not
 * re-render the rest of the app.
 */
export function StatusBar({ viewer, rotation: turns, scaleFor, geoRegions, snapContent, onSnapContent, disabled, sync, onSync, onOpenSettings, tool, onSelectTool, leading, middle, compact, trailing, arc }: Props) {
  const prefs = useSettings();
  const online = useOnline();
  const assistantOn = useSyncExternalStore(subscribeAssistant, assistantIsOn, () => false);
  const [cursor, setCursor] = useState<{ pageIndex: number; point: PagePoint } | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const openMenu = (e: React.MouseEvent, label: string, target: PrefsTarget) => {
    e.preventDefault();
    // The app's own menu for the bar's blank space must not open as well.
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items: [{ label: `${label} Settings…`, onClick: () => onOpenSettings(target.category, target.tab) }] });
  };
  const at = (category: Category, tab: string) => ({ prefs: { category, tab }, onMenu: openMenu });

  useEffect(() => {
    if (!viewer) return;
    const off = viewer.onCursor(setCursor);
    return () => {
      off();
      setCursor(null);
    };
  }, [viewer]);

  const shortcut = shortcutLabel(`tool.${tool}`);
  const scale = cursor ? scaleFor(cursor.pageIndex) : null;
  const size = cursor && viewer ? viewer.pageSize(cursor.pageIndex) : null;
  const onPage = cursor && size && cursor.point[0] >= 0 && cursor.point[1] >= 0 && cursor.point[0] <= size.width && cursor.point[1] <= size.height;
  const coord = (pt: number, axis: 'x' | 'y') => (scale ? formatLength(pt * (axis === 'y' ? (scale.yMetersPerPoint ?? scale.metersPerPoint) : scale.metersPerPoint), scale) : `${pt.toFixed(1)} pt`);
  const geo = onPage ? geoAt(geoRegions(), cursor.pageIndex, cursor.point) : null;

  const leadingGroup = leading && <div className="status-group status-leading">{leading}</div>;
  const toggles = (
    <div className="status-group">
      {tool !== 'select' && !compact && (
        <>
          <button type="button" className="status-toggle on status-tool" title={msg('The active tool. Click (or press Esc) to go back to Select.')} onClick={onSelectTool}>
            {shortcut ? `${toolLabel(tool)} (${shortcut})` : toolLabel(tool)}
          </button>
          {arc && arc !== 'off' && (
            <span className="status-hint" data-testid="arc-hint" title={msg('Esc or Backspace cancels the arc')}>
              {arcHint(arc)}
            </span>
          )}
          <span className="status-sep" />
        </>
      )}
      <Toggle label={msg('Grid')} title={msg('Show Grid (Shift+F9)')} on={prefs.showGrid} onChange={(v) => settings.set({ showGrid: v })} disabled={disabled} {...at('general', 'grid')} />
      <Toggle label={compact ? msg('Snap') : msg('Snap Grid')} title={msg('Snap to Grid (Ctrl+Shift+F9)')} on={prefs.snapToGrid} onChange={(v) => settings.set({ snapToGrid: v })} disabled={disabled} {...at('general', 'grid')} />
      <Toggle label={compact ? msg('Content') : msg('Snap Content')} title={msg('Snap to Content (Ctrl+Shift+F8): drawing lines, ends and intersections')} on={snapContent} onChange={onSnapContent} disabled={disabled} {...at('general', 'grid')} />
      <Toggle label={compact ? msg('Markup') : msg('Snap Markup')} title={msg('Snap to Markup (Ctrl+Shift+F7): corners, sides, centres and vertices of other markups')} on={prefs.snapToMarkup} onChange={(v) => settings.set({ snapToMarkup: v })} disabled={disabled} {...at('general', 'grid')} />
      {!compact && <Toggle label={msg('Polar')} title={msg('Polar Tracking (Ctrl+Shift+F10): line up at multiples of {angle}° from the last point', { angle: prefs.polarAngle })} on={prefs.polarTracking} onChange={(v) => settings.set({ polarTracking: v })} disabled={disabled} {...at('general', 'grid')} />}
      {!compact && <Toggle label={msg('Track')} title={msg('Object Snap Tracking (Ctrl+Shift+F11): rest on a snap point to pick it up, then line up with it')} on={prefs.objectSnapTracking} onChange={(v) => settings.set({ objectSnapTracking: v })} disabled={disabled} {...at('general', 'grid')} />}
      {!compact && (
        <>
          <span className="status-sep" />
          <Toggle label={msg('Rulers')} title={msg('Rulers (Ctrl+R)')} on={prefs.showRulers} onChange={(v) => settings.set({ showRulers: v })} disabled={disabled} {...at('interface', 'display')} />
          <Toggle label={msg('Crosshair')} title={msg('Full-Screen Crosshair')} on={prefs.crosshair} onChange={(v) => settings.set({ crosshair: v })} disabled={disabled} {...at('general', 'options')} />
        </>
      )}
      <span className="status-sep" />
      <Toggle label={msg('Reuse')} title={msg('Reuse: keep the markup tool active after placing a markup (off: back to Select)')} on={prefs.reuseTool} onChange={(v) => settings.set({ reuseTool: v })} {...at('tools', 'markup')} />
      {!compact && <Toggle label={msg('Draw to Scale')} title={msg('Draw to Scale: type exact lengths, angles and sizes while drawing, and edit a selected line\'s, rectangle\'s or polyline\'s sizes in the toolbar')} on={prefs.sketchToScale} onChange={(v) => settings.set({ sketchToScale: v })} {...at('tools', 'sketch')} />}
      {sync !== undefined && onSync && (
        <Toggle label={msg('Sync')} title={msg('Synchronise the split panes: they pan, zoom and turn pages together (View → Synchronise)')} on={!!sync} onChange={(v) => onSync(v ? 'document' : null)} />
      )}
    </div>
  );
  const right = (
    <div className="status-group right">
      {desktop() && assistantOn && (
        <button type="button" className="status-toggle on" title={msg('The MCP server can see the open document. File → Preferences → MCP.')} onClick={() => window.dispatchEvent(new Event('nb-assistant-open'))}>
          {msg('Assistant')}
        </button>
      )}
      {!online && (
        <span className="status-offline" role="status" title={msg('No network. Documents, markups and measurements on this device keep working and are saved here; Live Sessions, time stamps and cloud storage wait for the network.')}>
          {msg('Offline')}
        </span>
      )}
      {turns !== 0 && (
        <button className="status-toggle on" title={msg('The view is rotated (View → Rotate View). Click to reset.')} onClick={() => viewer?.rotateView(-turns)}>
          {msg('View {degrees}°', { degrees: turns * 90 })}
        </button>
      )}
      {trailing}
      {geo ? (
        <span
          className="status-coords"
          title={msg('Latitude and longitude at the pointer, from the map registered in this PDF ({map}). Right-click the page to copy them.', { map: `${geo.region.name}${geo.region.crs ? `, ${geo.region.crs}` : ''}` })}
        >
          {formatLatLon(geo.lat, geo.lon, prefs.geoFormat)}
        </span>
      ) : (
        // Fork change: the classic bar has no X/Y readout (lat/lon above still shows for map PDFs).
        !compact && (
          <span className="status-coords" title={msg('Pointer position from the page\'s top-left corner, at the page scale')}>
            {onPage ? `X ${coord(cursor.point[0], 'x')}   Y ${coord(cursor.point[1], 'y')}` : ''}
          </span>
        )
      )}
    </div>
  );

  return (
    <div className={`statusbar${compact ? ' classic' : ''}`}>
      {middle ? (
        middle(
          leadingGroup,
          <>
            {toggles}
            {right}
          </>,
        )
      ) : (
        <>
          {leadingGroup}
          {toggles}
          {right}
        </>
      )}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
