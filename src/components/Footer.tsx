import { SITE } from '../lib/site';

export function Footer() {
  const sep = <span aria-hidden="true" className="px-1.5 text-rule">·</span>;
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1120px] px-4 pb-10 sm:px-6 md:px-12">
      <div className="flex flex-col gap-2 border-t border-rule pt-5 text-[0.85rem] text-ink-2 md:flex-row md:items-baseline md:justify-between">
        <p className="leading-relaxed">
          <span className="font-display font-[560] text-ink">{SITE.name}</span>
          {sep}
          <a href={`https://${SITE.domain}`} className="text-ink-2 hover:text-clay">{SITE.domain}</a>
          {sep}
          Data: Office of the Comptroller (<a href={SITE.comptroller} className="text-ink-2 hover:text-clay">CTHRU</a>)
          {sep}
          MIT
          {sep}
          {SITE.github ? <a href={SITE.github} className="text-ink-2 hover:text-clay">GitHub</a> : <span>GitHub</span>}
        </p>
        <p>No tracking. No cookies.</p>
      </div>
    </footer>
  );
}
