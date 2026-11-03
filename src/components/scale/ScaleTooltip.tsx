import { formatMoney, formatShare } from '../../lib/format';
import { HighlightDot } from '../HighlightDot';

export type ScaleTip = {
  name: string;
  /** Ancestors, e.g. "Health & Human Services › EOHHS & MassHealth". */
  path: string;
  amount: number;
  total: number;
  totalLabel: string;
  parentAmount: number;
  parentName: string;
  highlighted: boolean;
  hint?: string;
};

const W = 256;

/** Tooltip for a treemap cell: name, path, amount, share of the whole and of its parent. */
export function ScaleTooltip({ tip, x, y, width, height, id }: { tip: ScaleTip; x: number; y: number; width: number; height: number; id: string }) {
  const flipX = x + 16 + W > width;
  const left = flipX ? Math.max(0, x - 16 - W) : x + 16;
  // Keep it inside the chart vertically (rough height; it is short).
  const top = Math.max(0, Math.min(y - 20, height - 150));
  return (
    <div
      id={id}
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-[8px] border border-rule bg-paper/95 px-3.5 py-2.5 backdrop-blur-[2px]"
      style={{ left, top, width: W }}
    >
      {tip.path ? <p className="mb-1 text-[0.8rem] leading-snug text-ink-2">{tip.path}</p> : null}
      <p className="text-[1rem] leading-snug font-semibold text-ink">{tip.name}</p>
      <p className="num mt-1.5 text-[1.05rem] text-ink">{formatMoney(tip.amount)}</p>
      <p className="text-[0.85rem] text-ink-2">
        <span className="num">{formatShare(tip.amount, tip.total)}</span> of {tip.totalLabel}
      </p>
      {tip.parentName && tip.parentAmount !== tip.total ? (
        <p className="text-[0.85rem] text-ink-2">
          <span className="num">{formatShare(tip.amount, tip.parentAmount)}</span> of {tip.parentName}
        </p>
      ) : null}
      {tip.highlighted ? (
        <p className="mt-1 flex items-center gap-1.5 text-[0.8rem] text-ink-2">
          <HighlightDot /> Highlighted
        </p>
      ) : null}
      {tip.hint ? <p className="mt-1.5 text-[0.8rem] text-ink-2">{tip.hint}</p> : null}
    </div>
  );
}
