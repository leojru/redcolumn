// Added in the leojru/redcolumn fork (revu-layout). Command buttons for the classic status bar:
// the view splits on the left, dark pages and line weights on the right.
import type { ReactNode } from 'react';
import type { Command } from '../../commands/appCommands';
import { shortcutLabel } from '../../commands/shortcuts';

function ic(d: string): ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  'view.unsplit': ic('M2 2.5h12v11H2z'),
  'view.split': ic('M2 2.5h12v11H2zM8 2.5v11'),
  'view.splitHorizontal': ic('M2 2.5h12v11H2zM2 8h12'),
  'view.darkPages': (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
    </svg>
  ),
  'view.thinLines': ic('M2 13 13 2M2 9.5 9.5 2M6 14 14 6'),
};

/** Buttons that run app commands, pressed while the command is checked. `view.unsplit` counts as on while nothing is split. */
export function StatusCommands({ commands, ids }: { commands: ReadonlyMap<string, Command>; ids: readonly string[] }) {
  const split = commands.get('view.split')?.checked || commands.get('view.splitHorizontal')?.checked;
  return (
    <>
      {ids.map((id) => {
        const c = commands.get(id);
        if (!c) return null;
        const on = id === 'view.unsplit' ? !split : !!c.checked;
        // Single page: unsplitting is the action, and it is "on" (and has nothing to do) while unsplit.
        const enabled = id === 'view.unsplit' ? !!split : c.enabled;
        const key = shortcutLabel(id);
        const label = id === 'view.unsplit' ? 'Single View' : c.label;
        return (
          <button key={id} type="button" className={`status-toggle status-icon${on ? ' on' : ''}`} data-status-command={id} aria-pressed={on} aria-label={label} title={key ? `${label} (${key})` : label} disabled={!enabled && !on} onClick={enabled ? c.run : undefined}>
            {ICONS[id] ?? label}
          </button>
        );
      })}
    </>
  );
}
