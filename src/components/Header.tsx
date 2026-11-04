import { Link, NavLink } from 'react-router';
import { fyShort, longDate } from '../lib/format';
import { SITE } from '../lib/site';
import { useMeta } from '../state/meta';
import { useLedgerParams } from '../state/params';
import { HighlightControl } from './HighlightControl';
import { Logo } from './Logo';

const NAV = [
  { to: '/', label: 'Flow', end: true },
  { to: '/scale', label: 'Scale' },
  { to: '/changes', label: 'Changes' },
  { to: '/methodology', label: 'Methodology' },
];

/** Masthead: wordmark and tagline, nav, one rule; then the year and the Highlight control. */
export function Header() {
  const { meta, year } = useMeta();
  const { setYear, carry } = useLedgerParams();
  const search = carry();
  const years = [...meta.years].sort((a, b) => a - b);

  return (
    <header className="mx-auto w-full max-w-[1120px] px-4 pt-6 sm:px-6 md:px-12 md:pt-10">
      <div className="flex flex-col gap-4 border-b border-rule pb-3 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <Link to={{ pathname: '/', search }} className="inline-flex items-center gap-2.5 font-display text-[1.75rem] leading-none font-bold text-ink no-underline hover:text-ink md:gap-3 md:text-[2.125rem]">
            <Logo className="h-[1.15em] w-[1.15em] shrink-0" />
            <span>
              Open Ledger <span className="text-brick">MA</span>
            </span>
          </Link>
          <p className="mt-1.5 text-[15px] leading-snug text-ink-2">{SITE.tagline}</p>
        </div>

        <nav aria-label="Views" className="-mx-1 flex gap-x-4 overflow-x-auto px-1 pb-1 md:gap-x-6 md:overflow-visible md:pb-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={{ pathname: n.to, search }}
              end={n.end}
              className={({ isActive }) =>
                `py-1 text-[1rem] whitespace-nowrap underline-offset-[6px] ${
                  isActive ? 'text-ink underline decoration-brick decoration-2 hover:text-ink' : 'text-ink-2 no-underline hover:text-ink'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1" role="group" aria-label="Fiscal year">
          <span className="text-[0.875rem] text-ink-2">Year</span>
          {years.map((y) => {
            const partial = meta.partial?.[String(y)];
            const on = y === year;
            const detail = partial ? `, fiscal year ${y}; spending through ${longDate(partial.through)}` : `, fiscal year ${y}`;
            return (
              <button
                key={y}
                type="button"
                aria-pressed={on}
                onClick={() => setYear(y)}
                aria-label={`${fyShort(y)}${partial ? ` ${partial.label}` : ''}${detail}`}
                className={`text-[0.95rem] underline-offset-[6px] transition-colors duration-200 ${
                  on ? 'text-ink underline decoration-brick decoration-2' : 'text-ink-2 hover:text-ink'
                }`}
              >
                <span className="num">{fyShort(y)}</span>
                {partial ? ' ' : null}
                {partial ? <span className="ml-1 inline-block text-[0.8rem] text-ink-2">{partial.label}</span> : null}
              </button>
            );
          })}
        </div>
        <HighlightControl />
      </div>
    </header>
  );
}
