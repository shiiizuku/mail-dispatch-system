'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface Download {
  label: string;
  href: string;
}

/**
 * A button that opens a file in a modal before it is saved: the PDF as it will print, in the
 * browser's own viewer (which can also print it), with a download link for each format.
 *
 * A native <dialog> opened with showModal(): focus is trapped and Esc closes it. `closedby="any"`
 * adds closing by clicking outside, with a fallback for browsers that do not support it yet.
 */
export function PreviewDialog(props: {
  /** Text of the button that opens it. */
  label: string;
  eyebrow?: string;
  title: string;
  /** A PDF shown inline. */
  previewUrl: string;
  downloads: Download[];
  primary?: boolean;
  disabled?: boolean;
}) {
  const { label, eyebrow, title, previewUrl, downloads, primary, disabled } = props;
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => setOpen(false);
    d.addEventListener('close', onClose);
    // Light dismiss where `closedby` is not supported: a click on the backdrop lands on the
    // <dialog> itself, outside its content box.
    const onClick = (e: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype || e.target !== d) return;
      const r = d.getBoundingClientRect();
      const inside =
        r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
      if (!inside) d.close();
    };
    d.addEventListener('click', onClick);
    return () => {
      d.removeEventListener('close', onClose);
      d.removeEventListener('click', onClick);
    };
  }, []);

  const show = () => {
    setOpen(true);
    dialog.current?.showModal();
  };

  return (
    <>
      <button
        type="button"
        className={primary ? 'primary' : undefined}
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={show}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="preview"
        aria-labelledby={`${id}-title`}
        // React 19 passes unknown attributes through; `closedby` is not in its types yet.
        {...{ closedby: 'any' }}
      >
        <header className="preview-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id={`${id}-title`}>{title}</h2>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close preview"
            onClick={() => dialog.current?.close()}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="preview-body">
          {/* Mounted only while open, so the file is made when someone asks to see it. */}
          {open && <iframe src={previewUrl} title={`Preview: ${title}`} />}
        </div>
        <footer className="preview-foot">
          <span className="hint">
            Shown as it will print. Use the viewer’s print button to print it.
          </span>
          <span className="spacer" />
          {downloads.map((d, i) => (
            <a
              key={d.href}
              className={i === 0 ? 'button primary' : 'button'}
              href={d.href}
              download
            >
              {d.label}
            </a>
          ))}
          <button type="button" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </footer>
      </dialog>
    </>
  );
}
