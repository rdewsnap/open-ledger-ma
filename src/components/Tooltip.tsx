import { formatMoney, formatShare } from '../lib/format';
import { HighlightDot } from './HighlightDot';

export type TipData = {
  title: string;
  /** e.g. "Income tax → Health & Human Services" for links */
  kicker?: string;
  amount: number;
  part: number;
  whole: number;
  wholeLabel: string;
  proportional?: boolean;
  highlighted?: boolean;
  hint?: string;
};

export function TooltipBody({ tip }: { tip: TipData }) {
  return (
    <>
      {tip.kicker ? <p className="mb-1 text-[0.8rem] leading-snug text-ink-2">{tip.kicker}</p> : null}
      <p className="text-[1rem] leading-snug font-semibold text-ink">{tip.title}</p>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="num text-[1.05rem] text-ink">{formatMoney(tip.amount)}</span>
        {tip.proportional ? <span className="text-[0.8rem] text-ink-2">proportional share</span> : null}
      </p>
      <p className="text-[0.85rem] text-ink-2">
        <span className="num">{formatShare(tip.part, tip.whole)}</span> of {tip.wholeLabel}
      </p>
      {tip.highlighted ? (
        <p className="mt-1 flex items-center gap-1.5 text-[0.8rem] text-ink-2">
          <HighlightDot /> Highlighted
        </p>
      ) : null}
      {tip.hint ? <p className="mt-1.5 text-[0.8rem] text-ink-2">{tip.hint}</p> : null}
    </>
  );
}

export function Tooltip({ tip, x, y, containerWidth, id }: { tip: TipData; x: number; y: number; containerWidth: number; id: string }) {
  const W = 248;
  const flip = x + 16 + W > containerWidth;
  const left = flip ? Math.max(0, x - 16 - W) : x + 16;
  return (
    <div
      id={id}
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-[8px] border border-rule bg-paper/95 px-3.5 py-2.5 backdrop-blur-[2px]"
      style={{ left, top: Math.max(0, y - 24), width: W }}
    >
      <TooltipBody tip={tip} />
    </div>
  );
}
