type P = { className?: string; title?: string };

/** Small leaf glyph: the non-color signal for conservation lines. */
export function Leaf({ className = 'h-3.5 w-3.5', title }: P) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} fill="none">
      {title ? <title>{title}</title> : null}
      <path d="M13.5 2.5C7 2.5 3 5.5 3 10c0 1.4.5 2.5 1.2 3.3C5.8 9.5 8.3 7.6 11 6.6 8.7 8 6.6 10.2 5.3 13.9c.7.4 1.6.6 2.5.6 4.3 0 5.7-4.8 5.7-12Z" fill="currentColor" />
    </svg>
  );
}

/** The ledger mark: a page edge with one ribbon splitting in two. */
export function Mark({ className = 'h-7 w-7' }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#EFE9DC" stroke="#D9D1C2" />
      <path d="M8 7v18" stroke="#2B2824" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 11.5c7 0 7 -2.5 16 -2.5v4.6c-8.5 0-8.5 2.5-16 2.5Z" fill="#B5542D" />
      <path d="M8 16.3c7 0 7 5.2 16 5.2v3c-9 0-9-5.4-16-5.4Z" fill="#B5542D" opacity="0.55" />
    </svg>
  );
}
