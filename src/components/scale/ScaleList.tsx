import { useState } from 'react';
import { accountOf } from '../../lib/data';
import { COLORS } from '../../lib/flowModel';
import { formatMoney, formatShare } from '../../lib/format';
import { cellFill, isHighlighted, type HighlightSet, type ScaleNode } from '../../lib/treemap';
import { HighlightDot } from '../HighlightDot';
import { sourcePath } from '../../lib/source';
import { Link } from 'react-router';

type Props = {
  focus: ScaleNode;
  colors: Map<string, string>;
  highlight: HighlightSet;
  measureLabel: string;
  year: number;
  onZoom: (id: string) => void;
};

const CAP = 20;

const KIND: Record<string, [string, string]> = {
  sec: ['spending area', 'spending areas'],
  dept: ['department', 'departments'],
  prog: ['program', 'programs'],
};

function kindOf(id: string, n: number) {
  const k = KIND[id.split(':')[0] ?? ''] ?? ['item', 'items'];
  return n === 1 ? k[0] : k[1];
}

/** The focused node's children, ranked, with share bars and source-row links. */
export function ScaleList({ focus, colors, highlight, measureLabel, year, onZoom }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const showAll = expanded === focus.data.id;
  const kids = (focus.children ?? []).filter((c) => (c.value ?? 0) > 0);
  const zeros = (focus.children?.length ?? 0) - kids.length;
  const max = kids[0]?.value ?? 1;
  const whole = focus.value ?? 0;
  const anyHl = highlight.size > 0;
  const markers = anyHl && !isHighlighted(focus, highlight);
  const shown = showAll ? kids : kids.slice(0, CAP);
  const firstId = kids[0]?.data.id ?? '';

  return (
    <section aria-labelledby="scale-list" className="mt-8">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 id="scale-list" className="text-[1.6rem]">
          {kids.length} {kindOf(firstId, kids.length)} in {focus.depth === 0 ? 'the budget' : focus.data.name}
        </h2>
        <span className="colhead">{measureLabel}</span>
      </div>
      <ul className="divide-y divide-rule border-b border-rule">
        {shown.map((c) => {
          const hl = isHighlighted(c, highlight);
          const base = hl ? COLORS.gold : (colors.get(c.data.sec) ?? COLORS.blue3);
          const value = c.value ?? 0;
          const zoomable = Boolean(c.children?.length);
          const acct = accountOf(c.data.id);
          const accounts = c.data.accounts;
          const pct = max > 0 ? Math.max(0.6, (value / max) * 100) : 0;
          const name = (
            <span className="flex min-w-0 items-center gap-1.5 text-[1rem] leading-snug text-ink">
              {markers && hl ? <HighlightDot title="Highlighted" /> : null}
              <span className={`truncate ${c.data.other ? 'text-ink-2' : ''}`}>{c.data.name}</span>
            </span>
          );
          return (
            <li key={c.data.id} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                {zoomable ? (
                  <button
                    type="button"
                    onClick={() => onZoom(c.data.id)}
                    className="group min-w-0 text-left"
                    aria-label={`${c.data.name}, ${formatMoney(value)}. Zoom in.`}
                  >
                    <span className="flex items-center gap-1 group-hover:[&_span.truncate]:text-brick-text">
                      {name}
                      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 shrink-0 text-ink-2 group-hover:text-brick-text" aria-hidden="true">
                        <path d="M3.5 2 6.5 5 3.5 8" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>
                ) : (
                  name
                )}
                <span className="num shrink-0 text-[0.95rem] text-ink">{formatMoney(value)}</span>
              </div>
              <div className="mt-1.5 h-[5px] w-full rounded-full bg-paper-2" aria-hidden="true">
                <div
                  className="h-full rounded-full transition-[opacity,background-color] duration-200"
                  style={{ width: `${pct}%`, background: cellFill(base, Math.min(c.depth, 2)), opacity: anyHl && !hl ? 0.45 : 1 }}
                />
              </div>
              <p className="mt-1 text-[0.85rem] text-ink-2">
                <span className="num">{formatShare(value, whole)}</span> of {focus.depth === 0 ? 'the total' : focus.data.name}
                {zoomable ? (
                  <>
                    <span aria-hidden="true" className="px-1.5 text-ink-2/60">·</span>
                    {c.children!.length} {kindOf(c.children![0]!.data.id, c.children!.length)}
                  </>
                ) : null}
                {accounts ? (
                  <>
                    <span aria-hidden="true" className="px-1.5 text-ink-2/60">·</span>
                    {accounts} smaller line item{accounts === 1 ? '' : 's'}
                  </>
                ) : null}
                {acct ? (
                  <>
                    <span aria-hidden="true" className="px-1.5 text-ink-2/60">·</span>
                    <span className="code">{acct}</span>
                    <span aria-hidden="true" className="px-1.5 text-ink-2/60">·</span>
                    <Link to={sourcePath({ ds: 'spending', years: [year], account: acct })} aria-label={`source rows for ${c.data.name}`}>
                      rows
                    </Link>
                  </>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
      {kids.length > CAP ? (
        <button type="button" onClick={() => setExpanded(showAll ? null : focus.data.id)} className="link mt-2 text-[0.9rem]">
          {showAll ? 'Show fewer' : `Show all ${kids.length}`}
        </button>
      ) : null}
      {zeros > 0 ? (
        <p className="mt-2 text-[0.85rem] text-ink-2">
          {zeros} more with no {measureLabel.toLowerCase()} amount this year {zeros === 1 ? 'is' : 'are'} not drawn.
        </p>
      ) : null}
    </section>
  );
}
