import { useState } from 'react';
import { accountOf, socrataRowsUrl } from '../lib/data';
import { useMeta } from '../state/meta';
import { COLORS, type FlowModel, type ModelNode } from '../lib/flowModel';
import { formatMoney, formatShare } from '../lib/format';
import { Leaf } from './Icons';

type Props = { model: FlowModel; overlay: boolean; spendWord: string; year: number };

const CAP = 12;

function Bar({ value, max, color, dim }: { value: number; max: number; color: string; dim: boolean }) {
  const pct = max > 0 ? Math.max(0.6, (value / max) * 100) : 0;
  return (
    <div className="mt-1.5 h-[5px] w-full rounded-full bg-paper-2" aria-hidden="true">
      <div className="h-full rounded-full transition-[opacity,background-color] duration-200" style={{ width: `${pct}%`, background: color, opacity: dim ? 0.45 : 1 }} />
    </div>
  );
}

function Row({ node, whole, wholeLabel, max, overlay, color, rowsHref }: { node: ModelNode; whole: number; wholeLabel: string; max: number; overlay: boolean; color: string; rowsHref?: string }) {
  const cons = overlay && node.conservation;
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[0.95rem] leading-snug text-ink">
          {cons ? <Leaf className="h-3.5 w-3.5 shrink-0 text-moss" title="Conservation line" /> : null}
          <span className="truncate">{node.name}</span>
        </span>
        <span className="num shrink-0 text-[0.92rem] text-ink">{formatMoney(node.amount)}</span>
      </div>
      <Bar value={node.amount} max={max} color={cons ? COLORS.moss : color} dim={overlay && !node.conservation} />
      <p className="mt-1 text-[0.75rem] text-ink-2">
        <span className="num">{formatShare(node.amount, whole)}</span> of {wholeLabel}
        {rowsHref ? (
          <>
            <span aria-hidden="true" className="px-1.5 text-rule">·</span>
            <a href={rowsHref} aria-label={`Source rows for ${node.name}`}>rows</a>
          </>
        ) : null}
      </p>
    </>
  );
}

/** Phone layout (<640px): revenue list, then secretariats that expand to programs. */
export function FlowList({ model, overlay, spendWord, year }: Props) {
  const { meta } = useMeta();
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const revMax = Math.max(...model.revenue.map((r) => r.amount), 1);
  const secMax = Math.max(...model.secretariats.map((s) => s.node.amount), 1);

  return (
    <div className="space-y-10">
      <section aria-labelledby="list-rev">
        <h2 id="list-rev" className="eyebrow !font-sans">Revenue</h2>
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {model.revenue.map((r) => (
            <li key={r.id} className="py-3">
              <Row node={r} whole={model.revenueTotal} wholeLabel="revenue collected" max={revMax} overlay={overlay} color={r.color} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="list-sec">
        <h2 id="list-sec" className="eyebrow !font-sans">Secretariats</h2>
        <p className="mt-1 text-[0.8rem] text-ink-2">Tap a row to see its programs.</p>
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
                  <Row node={node} whole={model.spendingTotal} wholeLabel={`total ${spendWord}`} max={secMax} overlay={overlay} color={expanded ? COLORS.clay : node.color} />
                  <span className="mt-1 inline-flex items-center gap-1 text-[0.75rem] font-medium text-clay">
                    {expanded ? 'Hide programs' : `${programs.length} program${programs.length === 1 ? '' : 's'}`}
                    <svg viewBox="0 0 10 10" className={`h-2.5 w-2.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">
                      <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
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
                            overlay={overlay}
                            color={node.color}
                            rowsHref={acct ? socrataRowsUrl(meta.sources.spending, year, acct) : undefined}
                          />
                        </li>
                      );
                    })}
                    {programs.length > CAP ? (
                      <li className="py-2">
                        <button type="button" onClick={() => setShowAll(!showAll)} className="text-[0.8rem] font-medium text-clay">
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
