import { useState } from 'react';
import { accountOf, socrataRowsUrl } from '../lib/data';
import { useMeta } from '../state/meta';
import { COLORS, type FlowModel, type ModelNode } from '../lib/flowModel';
import { formatMoney, formatShare } from '../lib/format';
import { HighlightDot } from './HighlightDot';
import { Chevron } from './Icons';

type Props = { model: FlowModel; highlighting: boolean; spendWord: string; year: number };

const CAP = 12;

function Bar({ value, max, color, dim }: { value: number; max: number; color: string; dim: boolean }) {
  const pct = max > 0 ? Math.max(0.6, (value / max) * 100) : 0;
  return (
    <div className="mt-1.5 h-[5px] w-full rounded-full bg-paper-2" aria-hidden="true">
      <div className="h-full rounded-full transition-[opacity,background-color] duration-200" style={{ width: `${pct}%`, background: color, opacity: dim ? 0.45 : 1 }} />
    </div>
  );
}

function Row({ node, whole, wholeLabel, max, highlighting, color, rowsHref }: { node: ModelNode; whole: number; wholeLabel: string; max: number; highlighting: boolean; color: string; rowsHref?: string }) {
  const hl = highlighting && node.highlighted;
  const lens = highlighting && node.kind !== 'revenue';
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[1rem] leading-snug text-ink">
          {hl ? <HighlightDot title="Highlighted" /> : null}
          <span className="truncate">{node.name}</span>
        </span>
        <span className="num shrink-0 text-[0.95rem] text-ink">{formatMoney(node.amount)}</span>
      </div>
      <Bar value={node.amount} max={max} color={hl ? COLORS.moss : color} dim={lens && !hl} />
      <p className="mt-1 text-[0.85rem] text-ink-2">
        <span className="num">{formatShare(node.amount, whole)}</span> of {wholeLabel}
        {rowsHref ? (
          <>
            <span aria-hidden="true" className="px-1.5 text-ink-2/60">·</span>
            <a href={rowsHref} aria-label={`rows for ${node.name}, from the source dataset`}>rows</a>
          </>
        ) : null}
      </p>
    </>
  );
}

/** Phone layout (<640px): revenue list, then secretariats that expand to programs. */
export function FlowList({ model, highlighting, spendWord, year }: Props) {
  const { meta } = useMeta();
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const revMax = Math.max(...model.revenue.map((r) => r.amount), 1);
  const secMax = Math.max(...model.secretariats.map((s) => s.node.amount), 1);

  return (
    <div className="space-y-10">
      <section aria-labelledby="list-rev">
        <h2 id="list-rev" className="text-[1.35rem]">Revenue</h2>
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {model.revenue.map((r) => (
            <li key={r.id} className="py-3">
              <Row node={r} whole={model.revenueTotal} wholeLabel="revenue collected" max={revMax} highlighting={highlighting} color={r.color} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="list-sec">
        <h2 id="list-sec" className="text-[1.35rem]">Secretariats</h2>
        <p className="mt-1 text-[0.9rem] text-ink-2">Tap a row to see its programs.</p>
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {model.secretariats.map(({ node, programs }) => {
            const expanded = open === node.id;
            const pMax = Math.max(...programs.map((p) => p.amount), 1);
            return (
              <li key={node.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`progs-${node.id}`}
                  onClick={() => {
                    setOpen(expanded ? null : node.id);
                    setShowAll(false);
                  }}
                  className={`block w-full py-3 text-left transition-colors duration-200 ${expanded ? 'bg-paper-2/60' : ''}`}
                >
                  <Row node={node} whole={model.spendingTotal} wholeLabel={`total ${spendWord}`} max={secMax} highlighting={highlighting} color={expanded ? COLORS.clay : node.color} />
                  <span className="mt-1 inline-flex items-center gap-1 text-[0.85rem] font-medium text-clay-text">
                    {expanded ? 'Hide programs' : `${programs.length} program${programs.length === 1 ? '' : 's'}`}
                    <Chevron open={expanded} />
                  </span>
                </button>
                {expanded ? (
                  <ul id={`progs-${node.id}`} className="mb-3 ml-3 border-l border-rule pl-3">
                    {(showAll ? programs : programs.slice(0, CAP)).map((p) => {
                      const acct = accountOf(p.id);
                      return (
                        <li key={p.id} className="py-2">
                          <Row
                            node={p}
                            whole={node.amount}
                            wholeLabel={node.name}
                            max={pMax}
                            highlighting={highlighting}
                            color={node.color}
                            rowsHref={acct ? socrataRowsUrl(meta.sources.spending, year, acct) : undefined}
                          />
                        </li>
                      );
                    })}
                    {programs.length > CAP ? (
                      <li className="py-2">
                        <button type="button" onClick={() => setShowAll(!showAll)} className="link text-[0.9rem]">
                          {showAll ? 'Show fewer' : `Show all ${programs.length}`}
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
