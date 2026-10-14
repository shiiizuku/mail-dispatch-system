import type { ReactNode, SVGProps } from 'react';
import type { MailpieceStatus } from '@mds/mail';

/* Line icons, 24-unit grid, drawn in currentColor. Decorative: always aria-hidden. */
const Svg = ({ children, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
    {...props}
  >
    {children}
  </svg>
);

export const EnvelopeIcon = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);
export const StampIcon = () => (
  <Svg>
    <path d="M6 3h12v2a1.5 1.5 0 0 0 0 3v2a1.5 1.5 0 0 0 0 3v2a1.5 1.5 0 0 0 0 3v3H6v-3a1.5 1.5 0 0 0 0-3v-2a1.5 1.5 0 0 0 0-3V8a1.5 1.5 0 0 0 0-3Z" />
    <circle cx="12" cy="11.5" r="2.5" />
  </Svg>
);
export const PaletteIcon = () => (
  <Svg>
    <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.3 17 3 12 3Z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10" cy="7" r="1" fill="currentColor" />
    <circle cx="14.5" cy="7" r="1" fill="currentColor" />
  </Svg>
);
export const MoonIcon = () => (
  <Svg>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Svg>
);
export const SunIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </Svg>
);
export const InboxIcon = () => (
  <Svg>
    <path d="M3 13.5 5.5 5h13l2.5 8.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
    <path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5" />
  </Svg>
);

/* ── Status ──────────────────────────────────────────────────────────── */

type Tone = 'wait' | 'move' | 'done' | 'closed' | 'urgent';

/*
 * The DMS's four-tone signal, with a glyph per tone so status reads without colour. A returned
 * letter is the one state that needs someone to act, so it takes the urgent pill and its "!".
 */
const STATUS: Record<MailpieceStatus, { label: string; tone: Tone }> = {
  PREPARED: { label: 'Prepared', tone: 'wait' },
  PRINTED: { label: 'Printed', tone: 'move' },
  RELEASED: { label: 'Released', tone: 'done' },
  DELIVERED: { label: 'Delivered', tone: 'done' },
  RETURNED: { label: 'Returned', tone: 'urgent' },
  CANCELLED: { label: 'Cancelled', tone: 'closed' },
};

export const statusLabel = (s: MailpieceStatus) => STATUS[s]?.label ?? s;

function Glyph({ tone }: { tone: Tone }) {
  switch (tone) {
    case 'wait':
      return <span aria-hidden className="glyph-ring" />;
    case 'move':
      return <span aria-hidden className="glyph-dot" />;
    case 'done':
      return (
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 6.5 4.75 9 10 3" />
        </svg>
      );
    case 'closed':
      return <span aria-hidden className="glyph-dash" />;
    case 'urgent':
      return (
        <span aria-hidden className="glyph-bang">
          !
        </span>
      );
  }
}

export function StatusPill({ status }: { status: MailpieceStatus }) {
  const { label, tone } = STATUS[status] ?? { label: status, tone: 'closed' as const };
  return (
    <span className="pill" data-tone={tone}>
      <Glyph tone={tone} />
      {label}
    </span>
  );
}

/** A small alert pill, e.g. "Low" stock. */
export function UrgentPill({ children }: { children: ReactNode }) {
  return (
    <span className="pill" data-tone="urgent">
      <Glyph tone="urgent" />
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="disc">
        <InboxIcon />
      </span>
      <span className="title">{title}</span>
      {children && <p className="copy">{children}</p>}
    </div>
  );
}
