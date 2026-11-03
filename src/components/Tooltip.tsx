import { formatMoney, formatShare } from '../lib/format';
import { Leaf } from './Icons';

export type TipData = {
  title: string;
  /** e.g. "Income tax → Health & Human Services" for links */
  kicker?: string;
  amount: number;
  part: number;
  whole: number;
  wholeLabel: string;
  proportional?: boolean;
  conservation?: boolean;
  hint?: string;
};

export function TooltipBody({ tip }: { tip: TipData }) {
  return (
    <>
      {tip.kicker ? <p className="eyebrow mb-1 !normal-case !tracking-normal">{tip.kicker}</p> : null}
      <p className="font-display text-[1rem] leading-snug font-[560] text-ink">{tip.title}</p>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="num text-[1.05rem] text-ink">{formatMoney(tip.amount)}</span>
        {tip.proportional ? (
          <span className="rounded-full border border-rule px-1.5 text-[0.66rem] font-semibold tracking-wide text-ink-2 uppercase">
            proportional
          </span>
        ) : null}
      </p>
      <p className="text-[0.8rem] text-ink-2">
        <span className="num">{formatShare(tip.part, tip.whole)}</span> of {tip.wholeLabel}
      </p>
      {tip.conservation ? (
        <p className="mt-1 flex items-center gap-1 text-[0.78rem] text-moss">
          <Leaf className="h-3 w-3" /> Conservation line
        </p>
      ) : null}
      {tip.hint ? <p className="mt-1.5 text-[0.75rem] text-ink-2">{tip.hint}</p> : null}
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
      className="pointer-events-none absolute z-10 rounded-[12px] border border-rule bg-paper/95 px-3.5 py-2.5 backdrop-blur-[2px]"
      style={{ left, top: Math.max(0, y - 24), width: W }}
    >
      <TooltipBody tip={tip} />
    </div>
  );
}
