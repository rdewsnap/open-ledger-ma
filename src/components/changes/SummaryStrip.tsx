import type { ChangeSummary } from '../../lib/diff';
import { formatMoney, formatMoneyChange, formatPercentChange } from '../../lib/format';
import { HighlightDot } from '../HighlightDot';

type Props = {
  all: ChangeSummary;
  /** Subtotal of highlighted rows; null when no highlight is active. */
  highlighted: ChangeSummary | null;
  labelA: string;
  labelB: string;
  filtered: boolean;
};

function Stat({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[0.875rem] text-ink-2">{label}</dt>
      <dd className="num mt-0.5 text-[1.15rem] text-ink">{value}</dd>
    </div>
  );
}

const pct = (s: ChangeSummary) => (s.pct === null ? '' : ` (${formatPercentChange(s.pct)})`);

/** Totals for the programs in view, and how many moved each way. */
export function SummaryStrip({ all, highlighted, labelA, labelB, filtered }: Props) {
  return (
    <section
      aria-label="Summary"
      className="mt-6 rounded-[8px] border border-rule bg-paper-2/50 px-4 py-3 md:px-5"
    >
      {filtered ? (
        <p className="mb-2 text-[0.875rem] font-semibold text-ink">Programs matching the filter</p>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-[repeat(3,auto)_1fr] sm:items-end">
        <Stat label={`Total ${labelA}`} value={formatMoney(all.a)} />
        <Stat label={`Total ${labelB}`} value={formatMoney(all.b)} />
        <Stat
          className="col-span-2 sm:col-span-1"
          label="Net change"
          value={`${formatMoneyChange(all.delta)}${pct(all)}`}
        />
        <div className="col-span-2 text-[0.9rem] text-ink-2 sm:col-span-1 sm:text-right">
          <dt className="sr-only">Programs by direction</dt>
          <dd>
            <span className="num text-ink">{all.up}</span> up{' '}
            <span aria-hidden="true" className="px-1 text-ink-2/60">
              ·
            </span>
            <span className="num text-ink">{all.down}</span> down{' '}
            <span aria-hidden="true" className="px-1 text-ink-2/60">
              ·
            </span>
            <span className="num text-ink">{all.new}</span> new{' '}
            <span aria-hidden="true" className="px-1 text-ink-2/60">
              ·
            </span>
            <span className="num text-ink">{all.ended}</span> ended
          </dd>
        </div>
      </dl>
      {highlighted ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 border-t border-rule pt-2.5 text-[0.95rem] text-ink-2">
          <HighlightDot />
          <span>Highlighted:</span>
          <span className="num text-ink">{formatMoney(highlighted.a)}</span> →{' '}
          <span className="num text-ink">{formatMoney(highlighted.b)}</span>
          <span aria-hidden="true" className="text-ink-2/60">
            ·
          </span>
          <span className="num text-ink">
            {formatMoneyChange(highlighted.delta)}
            {pct(highlighted)}
          </span>
          <span aria-hidden="true" className="text-ink-2/60">
            ·
          </span>
          <span>
            <span className="num">{highlighted.count}</span> programs
          </span>
        </p>
      ) : null}
    </section>
  );
}
