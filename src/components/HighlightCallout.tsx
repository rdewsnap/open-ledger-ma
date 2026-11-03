import { formatMoney, formatShare } from '../lib/format';
import { HighlightDot } from './HighlightDot';

type Props = {
  part: number;
  whole: number;
  /** "spending", "enacted spending", "spending so far" */
  wholeLabel: string;
  onClear: () => void;
};

/** "Highlighted: $595M · 0.9% of spending  Clear" */
export function HighlightCallout({ part, whole, wholeLabel, onClear }: Props) {
  return (
    <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.95rem] text-ink">
      <HighlightDot />
      <span>
        Highlighted: <span className="num font-semibold">{formatMoney(part)}</span>
        <span aria-hidden="true" className="px-1.5 text-ink-2">·</span>
        <span className="num">{formatShare(part, whole)}</span> of {wholeLabel}
      </span>
      <button type="button" onClick={onClear} className="link ml-1 text-[0.9rem]">
        Clear
      </button>
    </p>
  );
}
