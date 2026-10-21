'use client';

import { useEffect } from 'react';

const SELECTOR = '.page-header';
/** Scrolled this far (px) and the pinned header shrinks to a single bar. */
const THRESHOLD = 24;

/**
 * Shrinks the sticky page header once the page has scrolled. The header keeps its place in the flow:
 * the height it loses is handed back as a bottom margin, so nothing below it jumps and the
 * threshold can never flip back and forth.
 */
export function CompactHeader() {
  useEffect(() => {
    let frame = 0;

    const release = (el: HTMLElement) => {
      el.removeAttribute('data-stuck');
      el.style.marginBottom = '';
    };

    const update = () => {
      frame = 0;
      const el = document.querySelector<HTMLElement>(SELECTOR);
      if (!el) return;
      const stuck = window.scrollY > THRESHOLD;
      if (stuck === el.hasAttribute('data-stuck')) return;
      if (!stuck) return release(el);
      const before = el.offsetHeight;
      el.setAttribute('data-stuck', '');
      el.style.marginBottom = `${Math.max(0, before - el.offsetHeight)}px`;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      const el = document.querySelector<HTMLElement>(SELECTOR);
      if (el) release(el);
      schedule();
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
