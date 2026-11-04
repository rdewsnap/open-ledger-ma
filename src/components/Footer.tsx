import { SITE } from '../lib/site';

export function Footer() {
  const sep = <span aria-hidden="true" className="px-1.5 text-ink-2/60">·</span>;
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1120px] px-4 pb-10 sm:px-6 md:px-12">
      <div className="flex flex-col gap-1 border-t border-rule pt-4 text-[14px] leading-relaxed text-ink-2 md:flex-row md:items-baseline md:justify-between md:gap-6">
        <p>
          {SITE.name}
          {sep}
          <a href={`https://${SITE.domain}`}>{SITE.domain}</a>
          {sep}
          Data: Office of the Comptroller (<a href={SITE.comptroller}>CTHRU</a>)
          {sep}
          MIT
          {sep}
          <a href={SITE.github}>GitHub</a>
        </p>
        <p>No cookies. Anonymous visit counts only.</p>
      </div>
    </footer>
  );
}
