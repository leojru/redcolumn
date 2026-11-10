// Added in the leojru/redcolumn fork (revu-layout). The classic toolbar layout: one main row of
// file commands and tools in groups, and under it a Properties row that follows the context
// (the open document's name and pages when idle; the style of the tool or selection otherwise).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Command } from '../../commands/appCommands';
import { shortcutLabel } from '../../commands/shortcuts';
import type { Tool } from '../../markup/MarkupTools';
import { StampMenu } from '../StampsDialog';
import { MARKUP_TOOLS, MarkupFields, MEASURE_TOOLS, StyleControls, toolTitle, type ToolBarProps } from '../ToolBar';
import { CLASSIC_COMMAND_ICONS, CLASSIC_TOOL_ICONS, MEASURE_TOOL_SET } from './classicIcons';
import './classic.css';

/** The main row's tool groups, in the order a markup-first workflow reaches for them. */
const CLASSIC_GROUPS: { label: string; tools: Tool[] }[] = [
  { label: 'Select', tools: ['select', 'lasso'] },
  { label: 'Markup', tools: ['text', 'highlighter', 'pen', 'eraser', 'callout', 'cloud', 'cloudPlus', 'polygonCloud', 'typewriter', 'note', 'flagLabel', 'stamp', 'image', 'snapshot', 'attachment', 'hyperlink'] },
  { label: 'Lines & Shapes', tools: ['line', 'arrow', 'arc', 'ellipticalArc', 'polyline', 'dimension', 'rect', 'ellipse', 'polygon'] },
  { label: 'Measure', tools: ['calibrate', 'length', 'polylength', 'perimeter', 'area', 'volume', 'arcLength', 'diameter', 'radius', 'angle', 'count', 'visualSearch', 'dynamicFill'] },
  { label: 'Text Markup', tools: ['textHighlight', 'underline', 'strikeout', 'squiggly', 'replaceText'] },
  { label: 'Tables & Areas', tools: ['legend', 'table', 'space', 'redaction'] },
];

const FILE_COMMANDS = ['file.newPdf', 'file.open', 'file.save', 'file.saveAs', 'file.print', 'file.share'];
const EDIT_COMMANDS = ['edit.undo', 'edit.redo'];

const GLYPHS = new Map<Tool, ReactNode>([...MARKUP_TOOLS, ...MEASURE_TOOLS].map((t) => [t.tool, t.icon]));

export interface ClassicToolbarsProps extends ToolBarProps {
  commands: ReadonlyMap<string, Command>;
  /** The active document's file name, shown in the Properties row when nothing is being drawn or edited. */
  docName: string | null;
  pageCount: number;
}

function CommandButton({ id, commands }: { id: string; commands: ReadonlyMap<string, Command> }) {
  const c = commands.get(id);
  if (!c) return null;
  const key = shortcutLabel(id);
  return (
    <button type="button" className="btn tool" data-command={id} disabled={!c.enabled} title={key ? `${c.label} (${key})` : c.label} onClick={c.run}>
      {CLASSIC_COMMAND_ICONS[id] ?? c.label.slice(0, 1)}
    </button>
  );
}

export function ClassicToolbars(props: ClassicToolbarsProps) {
  const { tools, state, enabled, visibleTools, author, onPlaceStamp, onNewStamp, onManageStamps, toolbarMenu, commands, docName, pageCount } = props;
  const shown = (tool: Tool) => GLYPHS.has(tool) && (!visibleTools || visibleTools.includes(tool));
  const groups = CLASSIC_GROUPS.map((g) => ({ ...g, tools: g.tools.filter(shown) })).filter((g) => g.tools.length);
  const idle = !props.styleType && !props.textType && !props.geometry && state.tool !== 'dynamicFill';

  // The Properties row scrolls sideways when it does not fit: with the wheel, or the arrows at the
  // ends, which show while there is more that way.
  const propsRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = propsRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOverflow((o) => (o.left === left && o.right === right ? o : { left, right }));
  }, []);
  const scrollBy = (dir: 1 | -1) => propsRef.current?.scrollBy({ left: dir * Math.max(200, (propsRef.current.clientWidth ?? 0) * 0.6), behavior: 'smooth' });
  useEffect(() => {
    const el = propsRef.current;
    if (!el) return;
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    // Its contents change with the selection and the tool.
    const changes = new MutationObserver(measure);
    changes.observe(el, { childList: true, subtree: true });
    // An up-and-down wheel scrolls it sideways (it has no up and down).
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    measure();
    return () => {
      resize.disconnect();
      changes.disconnect();
      el.removeEventListener('wheel', wheel);
    };
  }, [measure]);

  const toolButton = (tool: Tool) => {
    const icon = CLASSIC_TOOL_ICONS[tool] ?? GLYPHS.get(tool);
    const cls = MEASURE_TOOL_SET.has(tool) ? ' measure' : '';
    if (tool === 'stamp')
      return (
        <StampMenu
          key={tool}
          icon={icon}
          disabled={!enabled}
          active={state.tool === 'stamp'}
          title={toolTitle(tool)}
          author={author}
          currentId={state.tool === 'stamp' ? (state.preset?.stamp?.id ?? null) : null}
          onPlace={onPlaceStamp}
          onNew={onNewStamp}
          onManage={onManageStamps}
        />
      );
    return (
      <button key={tool} type="button" className={`btn tool${cls}${state.tool === tool && !state.preset ? ' active' : ''}`} data-toolbar-tool={tool} disabled={!enabled} title={toolTitle(tool)} onClick={() => tools.setTool(tool)}>
        {icon}
      </button>
    );
  };

  return (
    <div className="classic-toolbars">
      <div className="toolbar tools classic-main">
        <span className="tool-group" role="group" aria-label="File">
          {FILE_COMMANDS.map((id) => (
            <CommandButton key={id} id={id} commands={commands} />
          ))}
        </span>
        <span className="tool-group" role="group" aria-label="Edit">
          {EDIT_COMMANDS.map((id) => (
            <CommandButton key={id} id={id} commands={commands} />
          ))}
        </span>
        {groups.map((g) => (
          <span key={g.label} className="tool-group" role="group" aria-label={g.label}>
            {g.tools.map(toolButton)}
          </span>
        ))}
        {toolbarMenu && (
          <>
            <span className="grow" />
            {toolbarMenu}
          </>
        )}
      </div>
      <div className="classic-props-wrap">
      {overflow.left && (
        <button type="button" className="classic-props-scroll left" aria-label="Scroll the properties left" title="More properties" onClick={() => scrollBy(-1)}>
          ‹
        </button>
      )}
      {overflow.right && (
        <button type="button" className="classic-props-scroll right" aria-label="Scroll the properties right" title="More properties" onClick={() => scrollBy(1)}>
          ›
        </button>
      )}
      <div ref={propsRef} className="toolbar classic-props" role="toolbar" aria-label="Properties" onScroll={measure}>
        {idle ? (
          docName ? (
            <span className="classic-docinfo">
              <b>Name:</b> <span className="classic-docname" title={docName}>{docName}</span>
              <b>Pages:</b> {pageCount}
            </span>
          ) : (
            <span className="classic-docinfo muted">No document open</span>
          )
        ) : (
          <>
            <MarkupFields {...props} layerOnly />
            <StyleControls tools={tools} state={state} styleType={props.styleType} textType={props.textType} textMarkupStyle={props.textMarkupStyle} markups={props.markups} selectedStyle={props.selectedStyle} cloudBubble={props.cloudBubble} geometry={props.geometry} enabled={enabled} />
          </>
        )}
      </div>
      </div>
    </div>
  );
}
