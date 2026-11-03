import { Link, NavLink } from 'react-router';
import { fyShort, partialLabel } from '../lib/format';
import { CONSERVATION_HELP, SITE } from '../lib/site';
import { useMeta } from '../state/meta';
import { useLedgerParams } from '../state/params';
import { Leaf, Mark } from './Icons';

const NAV = [
  { to: '/', label: 'Flow', end: true },
  { to: '/scale', label: 'Scale' },
  { to: '/changes', label: 'Changes' },
  { to: '/methodology', label: 'Methodology' },
];

export function Header() {
  const { meta, year } = useMeta();
  const { overlay, setOverlay, setYear, carry } = useLedgerParams();
  const search = carry();
  const years = [...meta.years].sort((a, b) => a - b);

  return (
    <header className="mx-auto w-full max-w-[1120px] px-4 pt-6 sm:px-6 md:px-12 md:pt-10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <Link to={{ pathname: '/', search }} className="group inline-flex items-center gap-2.5 text-ink no-underline">
          <Mark className="h-8 w-8 shrink-0" />
          <span className="font-display text-[1.65rem] leading-none font-[580] tracking-[-0.015em] md:text-[2rem]" style={{ fontVariationSettings: '"opsz" 72' }}>
            Open Ledger <span className="text-clay">MA</span>
          </span>
        </Link>
        <p className="text-[0.95rem] text-ink-2 sm:pb-0.5 sm:text-right">{SITE.tagline}</p>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-y border-rule py-3 md:mt-7 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Views" className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden pb-1 md:overflow-visible md:pb-0">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={{ pathname: n.to, search }}
              end={n.end}
              className={({ isActive }) =>
                `relative px-2 py-1 text-[0.95rem] no-underline transition-colors duration-200 ${
                  isActive
                    ? 'font-semibold text-ink after:absolute after:inset-x-2 after:-bottom-1 md:after:-bottom-[13px] after:h-[2px] after:rounded-full after:bg-clay'
                    : 'text-ink-2 hover:text-ink'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="seg max-w-full overflow-x-auto" role="group" aria-label="Fiscal year">
            {years.map((y) => {
              const partial = meta.partial?.[String(y)];
              return (
                <button
                  key={y}
                  type="button"
                  aria-pressed={y === year}
                  onClick={() => setYear(y)}
                  title={partial ? partialLabel(y, partial) : `Fiscal year ${y}`}
                  aria-label={partial ? partialLabel(y, partial) : `Fiscal year ${y}`}
                >
                  <span className="num text-[0.82rem]">{fyShort(y)}</span>
                  {partial ? (
                    <span className="ml-1.5 inline-block rounded-full border border-clay/40 px-1.5 py-px align-[1px] text-[0.66rem] leading-tight font-semibold tracking-wide text-clay">
                      {partial.label}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={overlay}
            aria-describedby={overlay ? 'overlay-help' : undefined}
            onClick={() => setOverlay(!overlay)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.875rem] font-medium transition-colors duration-200 ${
              overlay ? 'border-moss bg-moss text-paper' : 'border-rule text-ink-2 hover:text-ink'
            }`}
          >
            <Leaf className="h-3.5 w-3.5" />
            Conservation lines
            <span aria-hidden="true" className={`relative ml-0.5 inline-block h-3.5 w-6 rounded-full transition-colors duration-200 ${overlay ? 'bg-paper/35' : 'bg-rule'}`}>
              <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-paper transition-[left] duration-200 ${overlay ? 'left-3' : 'left-0.5'}`} />
            </span>
          </button>
        </div>
      </div>

      {overlay ? (
        <p id="overlay-help" className="mt-3 flex max-w-[72ch] gap-2 text-[0.875rem] leading-relaxed text-ink-2">
          <Leaf className="mt-1 h-3.5 w-3.5 shrink-0 text-moss" />
          <span>{CONSERVATION_HELP}</span>
        </p>
      ) : null}
    </header>
  );
}
