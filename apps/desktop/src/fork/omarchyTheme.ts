// Added in the leojru/redcolumn fork (revu-layout). Follows the Omarchy desktop theme: reads the current
// theme's palette (~/.local/state/omarchy/current/theme/colors.toml) and sends it to every window,
// again whenever the theme changes (omarchy theme set swaps that folder and bumps theme.generation).
import { BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fromApp } from '../paths';
import { parsePalette, type OmarchyPalette } from './omarchyPalette';


const STATE_DIR = path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'omarchy', 'current');
const COLORS = path.join(STATE_DIR, 'theme', 'colors.toml');

function readPalette(): OmarchyPalette | null {
  try {
    return parsePalette(fs.readFileSync(COLORS, 'utf8'));
  } catch {
    return null;
  }
}

/** Answers `omarchy:palette` and pushes `omarchy:palette-changed` to every window on a theme switch. Linux only. */
export function installOmarchyTheme() {
  ipcMain.handle('omarchy:palette', (event) => (process.platform === 'linux' && fromApp(event) ? readPalette() : null));
  if (process.platform !== 'linux' || !fs.existsSync(STATE_DIR)) return;
  let timer: NodeJS.Timeout | null = null;
  let last = JSON.stringify(readPalette());
  const changed = () => {
    if (timer) clearTimeout(timer);
    // A theme switch rewrites several files in a row: read once they have settled.
    timer = setTimeout(() => {
      const palette = readPalette();
      const json = JSON.stringify(palette);
      if (json === last) return;
      last = json;
      for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('omarchy:palette-changed', palette);
    }, 300);
  };
  try {
    fs.watch(STATE_DIR, { persistent: false }, changed);
  } catch {
    // No watching (an unusual file system): the palette is still read when a window opens.
  }
}
