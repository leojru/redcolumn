// Added in the leojru/redcolumn fork (revu-layout). The "Omarchy" theme: the app's colour tokens
// (themes.css) made from the Omarchy desktop theme's palette (colors.toml), so redcolumn changes with
// `omarchy theme set` like the terminal and the bar do.
import type { Theme } from './themes';

export type OmarchyPalette = Record<string, string>;

const HEX = /^#?([0-9a-f]{6})$/i;

function rgbOf(hex: string): [number, number, number] | null {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** `a` moved `t` (0..1) of the way to `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  if (!x || !y) return a;
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function rgba(hex: string, alpha: number): string {
  const c = rgbOf(hex);
  return c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})` : hex;
}

/** Relative luminance (WCAG), 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const c = rgbOf(hex);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A usable palette: at least a background and a foreground that are colours. */
export function validPalette(p: OmarchyPalette | null | undefined): p is OmarchyPalette {
  return !!p && !!rgbOf(p.background ?? '') && !!rgbOf(p.foreground ?? '');
}

export function isDark(p: OmarchyPalette): boolean {
  if (p.mode === 'dark') return true;
  if (p.mode === 'light') return false;
  return luminance(p.background!) < 0.35;
}

/** The theme entry for the picker's bookkeeping: tints the title bar and, dark or light, picks the base tokens. */
export function omarchyTheme(p: OmarchyPalette): Theme {
  return { id: 'omarchy', label: 'Omarchy', dark: isDark(p), color: p.background!, symbolColor: p.foreground! };
}

/** The colour tokens of themes.css, from the palette. Anything a theme does not name is mixed from its background and foreground. */
export function omarchyTokens(p: OmarchyPalette): Record<string, string> {
  const B = p.background!;
  const F = p.foreground!;
  const dark = isDark(p);
  const pick = (key: string, fallback: string) => (rgbOf(p[key] ?? '') ? p[key]! : fallback);
  const accent = pick('accent', pick('blue', '#14a39a'));
  // White symbols sit on the accent (the active tool, primary buttons): a pale accent is darkened behind them.
  const accentFill = luminance(accent) > 0.4 ? mix(accent, '#000000', 0.35) : accent;
  const surface2 = pick('lighter_background', mix(B, F, 0.08));
  return {
    '--bg': dark ? pick('dark_background', mix(B, '#000000', 0.25)) : mix(B, F, 0.06),
    '--panel': B,
    '--border': mix(B, F, 0.16),
    '--border-2': mix(B, F, 0.22),
    '--border-input': mix(B, F, 0.45),
    '--text': F,
    '--text-strong': pick('bright_foreground', F),
    '--text-soft': mix(F, B, 0.15),
    '--muted': mix(F, B, 0.38),
    '--accent': accentFill,
    '--accent-hi': accent,
    '--ribbon': `linear-gradient(180deg, ${surface2} 0%, ${B} 100%)`,
    '--surface-sunken': dark ? pick('dark_background', mix(B, '#000000', 0.15)) : mix(B, F, 0.03),
    '--surface-raised': mix(B, F, 0.04),
    '--surface-2': surface2,
    '--surface-hover': mix(B, F, 0.12),
    '--surface-active': pick('selection', mix(B, F, 0.18)),
    '--tint-faint': rgba(F, 0.04),
    '--tint': rgba(F, 0.07),
    '--tint-strong': rgba(F, 0.12),
    '--danger-text': pick('red', dark ? '#f87171' : '#b91c1c'),
    '--warn-text': pick('yellow', dark ? '#fbbf24' : '#92580a'),
    '--ok-text': pick('green', dark ? '#4ade80' : '#15803d'),
    '--violet-text': pick('magenta', dark ? '#c4b5fd' : '#6d28d9'),
    '--viewer-desk': dark ? pick('darker_background', mix(B, '#000000', 0.35)) : mix(B, F, 0.15),
    '--scroll-thumb': mix(B, F, 0.25),
    '--scroll-thumb-hover': mix(B, F, 0.38),
    '--prefs-rail': dark ? pick('dark_background', mix(B, '#000000', 0.25)) : mix(B, F, 0.06),
    '--prefs-card': mix(B, F, 0.04),
    '--prefs-line': rgba(F, 0.14),
    // The measure tools' colour on the classic toolbar (components/fork/classic.css).
    '--measure-orange': pick('orange', pick('yellow', '#e0782b')),
  };
}

const applied = new Set<string>();

/** Sets the palette's tokens on <html> (over the base theme's stylesheet tokens), or clears them with null. */
export function applyOmarchyTokens(p: OmarchyPalette | null, doc: Document = document) {
  const style = doc.documentElement.style;
  for (const k of applied) style.removeProperty(k);
  applied.clear();
  if (!p) return;
  for (const [k, v] of Object.entries(omarchyTokens(p))) {
    style.setProperty(k, v);
    applied.add(k);
  }
}
