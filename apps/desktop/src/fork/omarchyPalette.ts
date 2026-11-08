// Added in the leojru/redcolumn fork (revu-layout). Reads an Omarchy theme's colors.toml (no Electron here, so it can be tested).

export type OmarchyPalette = Record<string, string>;

/** `key = "value"` lines of colors.toml (the palette is flat: no tables, no arrays). */
export function parsePalette(text: string): OmarchyPalette | null {
  const out: OmarchyPalette = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*"([^"]*)"\s*(?:#.*)?$/.exec(line);
    if (m) out[m[1]!] = m[2]!;
  }
  return out.background && out.foreground ? out : null;
}
