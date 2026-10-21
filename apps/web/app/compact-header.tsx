'use client';

import { useEffect } from 'react';

const SELECTOR = '.page-header';
/** From this width up the sidebar sits beside the page and the header stays full size. */
const DESKTOP = '(min-width: 1024px)';
/** Scrolled past this (px) the pinned header shrinks; back above RELEASE it grows again. The gap keeps it from flickering. */
const COMPACT_AT = 40;
const RELEASE_AT = 8;

/**
 * Publishes the page header's height as `--page-head-h` (the pinned side column sits below it) and,
 * on narrow screens, shrinks the pinned header once the page has scrolled. The header keeps its
 * place in the flow: the height it loses is handed back as a bottom margin, so nothing below it
 * jumps.
 */
export function CompactHeader() {
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP);
    let frame = 0;

    const release = (el: HTMLElement) => {
      el.removeAttribute('data-stuck');
      el.style.marginBottom = '';
    };

    const update = () => {
      frame = 0;
      const el = document.querySelector<HTMLElement>(SELECTOR);
      if (!el) return;
      const compact = el.hasAttribute('data-stuck');
      if (desktop.matches) {
        if (compact) release(el);
      } else {
        const next = compact ? window.scrollY > RELEASE_AT : window.scrollY > COMPACT_AT;
        if (next && !compact) {
          const before = el.offsetHeight;
          el.setAttribute('data-stuck', '');
          el.style.marginBottom = `${Math.max(0, before - el.offsetHeight)}px`;
        } else if (!next && compact) {
          release(el);
        }
      }
      if (!el.hasAttribute('data-stuck')) {
        document.documentElement.style.setProperty('--page-head-h', `${el.offsetHeight}px`);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      const el = document.querySelector<HTMLElement>(SELECTOR);
      if (el) release(el);
      schedule();
    };

    const pages = new MutationObserver(schedule);
    pages.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    schedule();
    return () => {
      pages.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
