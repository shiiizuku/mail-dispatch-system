/*
 * Civic Ledger themes, as the DMS defines them (apps/web/src/components/theme-storage.ts), with
 * the same storage keys, so the two apps agree on what a stored choice means.
 *
 * - `dts.theme` holds the colour mode: light, dark or system.
 * - `dts.theme.v1` holds the palette.
 */

export const THEMES = [
  'neutral',
  'stone',
  'slate',
  'mist',
  'sand',
  'sage',
  'blush',
  'ocean',
  'iris',
  'clay',
  'civic',
] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'neutral';

export const THEME_NAMES: Record<Theme, string> = {
  neutral: 'Neutral pastel',
  stone: 'Stone grey',
  slate: 'Slate grey',
  mist: 'Cool mist',
  sand: 'Warm sand',
  sage: 'Sage pastel',
  blush: 'Blush pastel',
  ocean: 'Ocean blue',
  iris: 'Soft iris',
  clay: 'Warm clay',
  civic: 'Civic Ledger',
};

/** Each swatch: the theme's primary, ringed in its sidebar colour (light values, from tokens.css). */
export const THEME_SWATCHES: Record<Theme, { dot: string; ring: string }> = {
  neutral: { dot: 'oklch(0.517 0.042 163)', ring: 'oklch(0.911 0.013 82.4)' },
  stone: { dot: 'oklch(0.517 0.022 230)', ring: 'oklch(0.911 0.005 95)' },
  slate: { dot: 'oklch(0.517 0.055 252)', ring: 'oklch(0.911 0.014 255)' },
  mist: { dot: 'oklch(0.517 0.045 200)', ring: 'oklch(0.911 0.012 210)' },
  sand: { dot: 'oklch(0.517 0.058 52)', ring: 'oklch(0.911 0.022 72)' },
  sage: { dot: 'oklch(0.521 0.059 161.3)', ring: 'oklch(0.915 0.014 155.6)' },
  blush: { dot: 'oklch(0.526 0.059 7.3)', ring: 'oklch(0.913 0.012 11)' },
  ocean: { dot: 'oklch(0.517 0.068 235)', ring: 'oklch(0.911 0.021 235)' },
  iris: { dot: 'oklch(0.517 0.065 305)', ring: 'oklch(0.911 0.02 305)' },
  clay: { dot: 'oklch(0.517 0.075 35)', ring: 'oklch(0.911 0.027 45)' },
  civic: { dot: 'oklch(0.471 0.096 157.3)', ring: 'oklch(0.259 0.034 163.1)' },
};

export const COLOR_MODE_STORAGE_KEY = 'dts.theme';
export const THEME_STORAGE_KEY = 'dts.theme.v1';

export const isTheme = (v: unknown): v is Theme => THEMES.some((t) => t === v);

/**
 * Runs in <head> before first paint, so the page never flashes the wrong palette. Built from the
 * constants above because it cannot import them.
 */
export const themeBootScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(${JSON.stringify(THEMES)}.indexOf(t)<0)t=${JSON.stringify(DEFAULT_THEME)};d.dataset.theme=t;var m=localStorage.getItem(${JSON.stringify(
  COLOR_MODE_STORAGE_KEY,
)});var dark=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);d.classList.toggle('dark',dark);}catch(e){d.dataset.theme=${JSON.stringify(DEFAULT_THEME)};}})();`;
