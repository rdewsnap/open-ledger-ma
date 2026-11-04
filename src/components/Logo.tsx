/** The shield mark: a Commonwealth-blue shield holding three ledger lines. Same drawing as public/favicon.svg. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path d="M4.5 3h23v12.6c0 7.4-5.3 11.6-11.5 13.6C9.8 27.2 4.5 23 4.5 15.6Z" fill="#1F3A68" />
      <rect x="9.5" y="8.6" width="13" height="2.8" rx="0.6" fill="#D2463E" />
      <rect x="9.5" y="13.8" width="10" height="2.8" rx="0.6" fill="#FAFAF7" />
      <rect x="9.5" y="19" width="6.5" height="2.8" rx="0.6" fill="#FAFAF7" />
    </svg>
  );
}
