'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_THEME,
  isTheme,
  THEME_NAMES,
  THEME_STORAGE_KEY,
  THEME_SWATCHES,
  THEMES,
  type Theme,
} from '@/lib/theme';
import { EnvelopeIcon, MoonIcon, PaletteIcon, StampIcon, SunIcon } from './ui';

const NAV = [
  { href: '/', label: 'Letters', icon: <EnvelopeIcon /> },
  { href: '/stamps', label: 'Stamps & settings', icon: <StampIcon /> },
];

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
        >
          {item.icon}
          <span className="nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private window or blocked storage: the choice lasts until the page is closed.
    }
  },
};

/** The palette button with its swatch popover, and the light/dark toggle (sidebar footer). */
export function ThemeControls() {
  const id = useId();
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  // The boot script already applied the stored choice; read it back from the page.
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setTheme(isTheme(t) ? t : DEFAULT_THEME);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      const target = e.target as Node;
      if (!popover.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [open]);

  const pick = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    store.set(THEME_STORAGE_KEY, t);
    setTheme(t);
    setOpen(false);
    trigger.current?.focus();
  };

  const toggleDark = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    store.set(COLOR_MODE_STORAGE_KEY, next ? 'dark' : 'light');
    setDark(next);
  };

  return (
    <div className="sidebar-footer">
      <button
        ref={trigger}
        type="button"
        className="icon-button"
        aria-label={`Theme: ${THEME_NAMES[theme]}`}
        title={`Theme: ${THEME_NAMES[theme]}`}
        aria-expanded={open}
        aria-controls={`${id}-themes`}
        onClick={() => setOpen((o) => !o)}
      >
        <PaletteIcon />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Dark mode"
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={dark}
        onClick={toggleDark}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>
      {open && (
        <div
          ref={popover}
          id={`${id}-themes`}
          className="theme-popover"
          role="group"
          aria-labelledby={`${id}-h`}
        >
          <h3 id={`${id}-h`}>Theme</h3>
          <div className="swatches">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                className="swatch"
                aria-label={THEME_NAMES[t]}
                title={THEME_NAMES[t]}
                aria-pressed={t === theme}
                onClick={() => pick(t)}
              >
                <span
                  style={{
                    background: THEME_SWATCHES[t].dot,
                    boxShadow: `0 0 0 3px ${THEME_SWATCHES[t].ring}`,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
