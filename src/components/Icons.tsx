type P = { className?: string };

/** The Highlight control's glyph: a ring, filled when a highlight is active. */
export function Ring({ className = 'h-3.5 w-3.5', filled = false }: P & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none">
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      {filled ? <circle cx="8" cy="8" r="2.75" fill="currentColor" /> : null}
    </svg>
  );
}

/** Small chevron for disclosures; rotates when open. */
export function Chevron({ className = 'h-2.5 w-2.5', open = false }: P & { open?: boolean }) {
  return (
    <svg viewBox="0 0 10 10" className={`${className} transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true">
      <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
