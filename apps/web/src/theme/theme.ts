// Modified in the leojru/redcolumn fork (revu-layout): follows the Omarchy desktop theme when chosen.
import { desktop } from '../desktop/host';
import { settings } from '../settings/settings';
import { applyTheme, resetDeskColour, resolveTheme } from './themes';
import { applyOmarchyTokens, isDark, omarchyTheme, validPalette, type OmarchyPalette } from './omarchy';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Keeps the page in the theme chosen in Preferences, switching without a reload when the choice
 * changes or, for "Match the system", when the system's setting does.
 */
export function installTheme() {
  const media = window.matchMedia?.(DARK_QUERY);
  let shown = '';
  // Fork addition: the Omarchy desktop theme's palette (desktop app on Omarchy only), kept current.
  let palette: OmarchyPalette | null = null;
  const sync = () => {
    const choice = settings.get().theme;
    if (choice === 'omarchy' && validPalette(palette)) {
      const key = `omarchy:${JSON.stringify(palette)}`;
      if (key === shown) return;
      shown = key;
      const theme = omarchyTheme(palette);
      // The built-in theme of the same kind supplies the tokens the palette does not (brand, alerts' backgrounds).
      applyTheme({ ...resolveTheme(isDark(palette) ? 'graphite' : 'light', true), color: theme.color });
      applyOmarchyTokens(palette);
      resetDeskColour();
      desktop()?.setTitleBarSymbols?.(theme.symbolColor);
      window.dispatchEvent(new CustomEvent('nb-theme', { detail: theme }));
      return;
    }
    const theme = resolveTheme(choice, media?.matches ?? true);
    if (theme.id === shown) return;
    shown = theme.id;
    applyOmarchyTokens(null);
    applyTheme(theme);
    resetDeskColour();
    desktop()?.setTitleBarSymbols?.(theme.symbolColor);
    window.dispatchEvent(new CustomEvent('nb-theme', { detail: theme }));
  };
  sync();
  settings.subscribe(sync);
  media?.addEventListener('change', sync);
  const host = desktop();
  if (host?.omarchyPalette) {
    const take = (p: OmarchyPalette | null) => {
      palette = p;
      sync();
    };
    void host.omarchyPalette().then(take, () => {});
    host.onOmarchyPalette?.(take);
  }
}
