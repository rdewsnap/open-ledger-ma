import { useState } from 'react';
import { formatMoney, formatShare, parseAmount } from '../lib/format';
import { useLedgerParams } from '../state/params';

export type ContextArea = {
  name: string;
  /** Operating spending (or budget) for the area, matching the charts. */
  amount: number;
  /** Bond-funded capital payments for the area; null when not published for the year. */
  capital: number | null;
};

type Props = {
  /** The spending area or department to compare with; null compares with the whole budget only. */
  area: ContextArea | null;
  /** All operating spending (or budget) for the year. */
  total: number;
  /** "spent in FY2026", "budgeted for FY2026", "spent so far in FY2027". */
  verb: string;
  /** What `total` is: "all state operating spending in FY2026". */
  totalLabel: string;
  /** Shown under the box when no area is chosen. */
  hint?: string;
};

/**
 * "How big is $65M?": the amount as a share of an area's operating spending, of the
 * same plus its capital spending, and of all operating spending. Arithmetic only; the
 * amount lives in ?amt= so a comparison can be shared.
 */
export function AmountInContext({ area, total, verb, totalLabel, hint }: Props) {
  const { amount, setAmount } = useLedgerParams();
  const [text, setText] = useState(() => (amount ? formatMoney(amount) : ''));
  const typed = parseAmount(text);
  const invalid = text.trim() !== '' && typed === null;
  const withCapital = area && area.capital ? area.amount + area.capital : null;

  const line = (whole: number, label: React.ReactNode) =>
    amount ? (
      <li className="border-b border-rule/60 py-2">
        <span className="num text-ink">{formatShare(amount, whole)}</span> of {label}{' '}
        <span className="num text-ink-2">({formatMoney(whole)})</span>
      </li>
    ) : null;

  return (
    <section aria-labelledby="amount-context-title" className="mt-8 rounded-[8px] border border-rule bg-paper-2/50 px-4 py-3 md:px-5">
      <h3 id="amount-context-title" className="colhead">
        Put an amount in context
      </h3>
      <form
        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setAmount(typed);
        }}
      >
        <label htmlFor="amount-context-input" className="text-[0.95rem] text-ink-2">
          How big is
        </label>
        <input
          id="amount-context-input"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder="$65M"
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseAmount(e.target.value);
            if (v !== null || e.target.value.trim() === '') setAmount(v);
          }}
          className="num w-[9rem] rounded-[6px] border border-rule bg-paper px-2 py-1 text-[1rem] text-ink"
        />
        <span className="text-[0.95rem] text-ink-2">?</span>
        {invalid ? <span className="text-[0.875rem] text-brick-text">Try a figure like $65M or 1.2 billion.</span> : null}
      </form>
      {amount ? (
        <ul className="mt-2 text-[0.95rem] text-ink-2">
          {area ? line(area.amount, <>what {area.name} {verb}</>) : null}
          {area && withCapital ? line(withCapital, <>the same plus its bond-funded capital spending</>) : null}
          {line(total, totalLabel)}
        </ul>
      ) : null}
      <p className="mt-2 text-[0.85rem] text-ink-2">
        {area
          ? 'Simple division: it does not say whether an amount is a lot or a little.'
          : (hint ?? 'Simple division: it does not say whether an amount is a lot or a little.')}
      </p>
    </section>
  );
}
