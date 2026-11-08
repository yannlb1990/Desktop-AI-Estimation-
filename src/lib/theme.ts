/**
 * Light or dark for the app (dashboard, projects, settings...). Dark is the default; the
 * public pages (home, pricing, sign in) keep the brand's dark look whatever is chosen.
 * The choice is kept on this device. index.html applies it before the page draws, so the
 * screen does not flash dark then light.
 */
export type ThemePref = 'dark' | 'light' | 'system';

const KEY = 'metricore_theme';
const APP_PATHS = /^\/(dashboard|site|xero|project|insights|clients|settings|materials|admin)(\/|$)/;

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch { return 'dark'; }
}

export function resolveTheme(pref: ThemePref): 'dark' | 'light' {
  if (pref === 'system') {
    try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch { return 'dark'; }
  }
  return pref;
}

export function isAppPath(path: string): boolean {
  return APP_PATHS.test(path);
}

/** The look a page should have: the builder's choice inside the app, dark elsewhere. */
export function applyTheme(path = window.location.pathname): void {
  const mode = isAppPath(path) ? resolveTheme(getThemePref()) : 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('light', mode === 'light');
  root.style.colorScheme = mode;
}

export function setThemePref(pref: ThemePref): void {
  try { localStorage.setItem(KEY, pref); } catch { /* private window: this page only */ }
  applyTheme();
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: pref }));
}
