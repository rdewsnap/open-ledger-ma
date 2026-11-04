import { useState } from 'react';
import { Link } from 'react-router';
import { accountOf } from '../lib/data';
import { sourcePath } from '../lib/source';
import { COLORS, SMALL_SECS, treeLeaves, type FlowModel, type ModelNode } from '../lib/flowModel';
import { formatMoney, formatShare, fyLong } from '../lib/format';
import type { Measure, TreeNode } from '../lib/types';
import { HighlightDot } from './HighlightDot';

type Row = {
  id: string;
  name: string;
  sub?: string;
  amount: number;
  highlighted?: boolean;
  muted?: boolean;
};

type Props = {
  /** Selected node id: a revenue source, spending area or program. */
  id: string;
  /** The chart's model (has the nodes and ribbons on screen). */
  model: FlowModel;
  /** The unfocused model (every spending area with its full program list). */
  full: FlowModel;
  tree: TreeNode | null;
  year: number;
  measure: Measure;
  measureLabel: string; // "Spent" / "Budgeted" / "Spent so far"
  spendWord: string; // "spending" / "budgeted spending"
  highlighting: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
};

const SHOW = 8;

/** Horizontal bars, longest first. Rows can be buttons that select another node. */
function BarList({ rows, whole, color, onPick, label, note }: { rows: Row[]; whole: number; color: string; onPick?: (id: string) => void; label: string; note?: string }) {
  const [all, setAll] = useState(false);
  const sorted = [...rows].filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const max = sorted[0]?.amount || 1;
  const shown = all ? sorted : sorted.slice(0, SHOW);
  return (
    <div>
      <h3 className="colhead border-b border-rule pb-2">{label}</h3>
      <ol className="mt-1">
        {shown.map((r) => {
          const name = (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              {r.highlighted ? <HighlightDot title="Highlighted" /> : null}
              <span className={`truncate ${r.muted ? 'text-ink-2' : 'text-ink'}`}>{r.name}</span>
            </span>
          );
          return (
            <li key={r.id} className="border-b border-rule/60 py-2">
              <div className="flex items-baseline justify-between gap-3 text-[0.95rem]">
                {onPick ? (
                  <button type="button" onClick={() => onPick(r.id)} className="group min-w-0 text-left hover:[&_span.truncate]:text-brick-text">
                    {name}
                  </button>
                ) : (
                  name
                )}
                <span className="num shrink-0 text-ink">
                  {formatMoney(r.amount)}
                  <span className="ml-2 inline-block w-[3.6em] text-right text-[0.85rem] text-ink-2">{formatShare(r.amount, whole)}</span>
                </span>
              </div>
              {r.sub ? <p className="mt-0.5 truncate text-[0.8rem] text-ink-2">{r.sub}</p> : null}
              <div className="mt-1.5 h-1.5 rounded-full bg-paper-2" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0.6, (r.amount / max) * 100)}%`, background: r.highlighted ? COLORS.gold : color }} />
              </div>
            </li>
          );
        })}
      </ol>
      {sorted.length > SHOW ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="link mt-2 text-[0.9rem]">
          {all ? 'Show fewer' : `Show all ${sorted.length}`}
        </button>
      ) : null}
      {note ? <p className="mt-3 text-[0.85rem] leading-snug text-ink-2">{note}</p> : null}
    </div>
  );
}

function findTree(node: TreeNode | null, id: string): TreeNode | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const hit = findTree(c, id);
    if (hit) return hit;
  }
  return null;
}

const PROPORTIONAL_NOTE =
  'State revenue is pooled, so no dollar is tagged to a program. These amounts split the spending in proportion to each source’s share of revenue.';
const MIX_LABEL = 'Statewide revenue mix, applied proportionally';
const MIX_NOTE =
  'This is not where this money actually came from. Most spending runs through the General Fund, where revenue is pooled, so these rows apply the state’s overall revenue mix to this amount. Federal money is the exception: it arrives as grants and reimbursements for specific programs, so the real federal share here may be much higher or lower.';

/**
 * The secondary display under the Flow chart: the selected node's total, its share,
 * and its parts as bar lists, so readers do not have to hover thin ribbons.
 */
export function FlowBreakdown({ id, model, full, tree, year, measure, measureLabel, spendWord, highlighting, onSelect, onClose }: Props) {
  const node: ModelNode | undefined = model.nodes.find((n) => n.id === id) ?? full.nodes.find((n) => n.id === id) ?? full.secretariats.find((s) => s.node.id === id)?.node;
  const treeNode = findTree(tree, id);
  const name = node?.name ?? treeNode?.name ?? id;
  const amount = node?.amount ?? (treeNode ? treeNode[measure] : 0);
  const kind = node?.kind ?? (id.startsWith('sec:') ? 'secretariat' : id.startsWith('rev:') ? 'revenue' : 'program');

  const revenueRows = (part: number): Row[] =>
    full.revenue.map((r) => ({ id: r.id, name: r.name, amount: model.revenueTotal ? (part * r.amount) / model.revenueTotal : 0 }));

  let eyebrow = '';
  let shareLine = '';
  let blocks: React.ReactNode = null;
  let table: React.ReactNode = null;

  if (kind === 'revenue') {
    eyebrow = 'Revenue source';
    shareLine = `${formatShare(amount, model.revenueTotal)} of revenue collected`;
    const areaRows: Row[] = full.secretariats.map(({ node: s }) => {
      const link = full.links.find((l) => l.source === id && l.target === s.id);
      return { id: s.id, name: s.name, amount: link?.value ?? 0, highlighted: highlighting && s.highlighted };
    });
    const paysFor = areaRows.reduce((a, r) => a + r.amount, 0);
    blocks = (
      <BarList
        label={`What it pays for, in proportion · ${formatMoney(paysFor)}`}
        rows={areaRows}
        whole={paysFor}
        color={COLORS.navy}
        onPick={onSelect}
        note={`${PROPORTIONAL_NOTE} ${
          paysFor < amount
            ? `Bands are scaled to total spending, which is counted differently from revenue, so this source's share of spending (${formatMoney(paysFor)}) is less than it collected.`
            : `Bands are scaled to total spending, which is counted differently from revenue, so this source's share of spending (${formatMoney(paysFor)}) is more than it collected.`
        }`}
      />
    );
  } else if (kind === 'secretariat') {
    eyebrow = 'Spending area';
    shareLine = `${formatShare(amount, model.spendingTotal)} of total ${spendWord}`;
    const entry = full.secretariats.find((s) => s.node.id === id);
    let parts: Row[];
    let partsLabel = 'By department';
    if (id === SMALL_SECS) {
      partsLabel = 'Offices';
      parts = (entry?.programs ?? []).map((p) => ({ id: p.id.replace(/^prog:office:/, 'sec:'), name: p.name, amount: p.amount, highlighted: highlighting && p.highlighted }));
    } else {
      parts = (treeNode?.children ?? []).map((d) => ({ id: d.id, name: d.name, amount: d[measure], muted: Boolean(d.other) }));
    }
    blocks = (
      <>
        <BarList label={partsLabel} rows={parts} whole={amount} color={COLORS.navy} onPick={id === SMALL_SECS ? onSelect : undefined} />
        <BarList label={MIX_LABEL} rows={revenueRows(amount)} whole={amount} color={COLORS.slate} note={MIX_NOTE} />
      </>
    );
    const programs: ModelNode[] =
      id === SMALL_SECS
        ? []
        : treeNode
          ? treeLeaves(treeNode, measure)
              .filter((l) => l.amount > 0)
              .sort((a, b) => b.amount - a.amount)
              .map((l) => ({ id: l.id, name: l.name, kind: 'program', amount: l.amount, dept: l.dept, bucket: l.other, highlighted: false, color: '', order: 0 }))
          : (entry?.programs ?? []);
    const hlIds = new Set((entry?.programs ?? []).filter((p) => p.highlighted).map((p) => p.id));
    if (programs.length) {
      table = (
        <div className="mt-10">
          <h3 className="colhead border-b border-rule pb-2">
            All {programs.length} programs
          </h3>
          <table className="w-full border-collapse text-[0.95rem]">
            <thead className="sr-only">
              <tr>
                <th scope="col">Program</th>
                <th scope="col">Department</th>
                <th scope="col">{measureLabel}</th>
                <th scope="col">Share</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => {
                const acct = accountOf(p.id);
                return (
                  <tr key={p.id} className="border-b border-rule/60 transition-colors duration-200 hover:bg-paper-2/60">
                    <td className="py-1.5 pr-3">
                      <button type="button" onClick={() => onSelect(p.id)} className="inline-flex items-center gap-1.5 text-left hover:text-brick-text">
                        {highlighting && (hlIds.has(p.id) || (node?.highlighted ?? false)) ? <HighlightDot title="Highlighted" /> : null}
                        <span className={p.bucket ? 'text-ink-2' : ''}>{p.name}</span>
                      </button>
                    </td>
                    <td className="hidden py-1.5 pr-3 text-ink-2 md:table-cell">{p.dept ?? ''}</td>
                    <td className="num py-1.5 text-right text-ink">{formatMoney(p.amount)}</td>
                    <td className="num w-[4.5em] py-1.5 pl-3 text-right text-ink-2">{formatShare(p.amount, amount)}</td>
                    <td className="w-[3em] py-1.5 pl-3 text-right text-[0.85rem]">
                      {acct ? (
                        <Link to={sourcePath({ ds: 'spending', years: [year], account: acct })} aria-label={`source rows for ${p.name}`}>
                          rows
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
  } else {
    eyebrow = 'Program';
    const parentId = node?.parent;
    const parent = parentId ? full.secretariats.find((s) => s.node.id === parentId)?.node : undefined;
    shareLine = parent
      ? `${formatShare(amount, parent.amount)} of ${parent.name} · ${formatShare(amount, model.spendingTotal)} of total ${spendWord}`
      : `${formatShare(amount, model.spendingTotal)} of total ${spendWord}`;
    const acct = accountOf(id);
    const facts: [string, React.ReactNode][] = [];
    if (parent) {
      facts.push([
        'Spending area',
        <button key="a" type="button" className="link" onClick={() => onSelect(parent.id)}>
          {parent.name}
        </button>,
      ]);
    }
    if (node?.dept) facts.push(['Department', node.dept]);
    if (treeNode && !treeNode.children?.length) {
      facts.push(['Budgeted', <span key="e" className="num">{formatMoney(treeNode.enacted)}</span>]);
      facts.push([measure === 'enacted' ? 'Spent' : measureLabel, <span key="s" className="num">{formatMoney(treeNode.actual)}</span>]);
    }
    if (acct) {
      facts.push([
        'Account',
        <span key="c">
          <span className="code">{acct}</span>
          {' · '}
          <Link to={sourcePath({ ds: 'spending', years: [year], account: acct })}>source rows</Link>
        </span>,
      ]);
    }
    blocks = (
      <>
        <div>
          <h3 className="colhead border-b border-rule pb-2">Details</h3>
          {facts.length ? (
            <dl className="mt-1">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-rule/60 py-2 text-[0.95rem]">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-[0.9rem] text-ink-2">
              This is a group of smaller programs. Select its spending area to see each one.
            </p>
          )}
        </div>
        <BarList label={MIX_LABEL} rows={revenueRows(amount)} whole={amount} color={COLORS.slate} note={MIX_NOTE} />
      </>
    );
  }

  return (
    <section id="breakdown" aria-labelledby="breakdown-title" className="mt-10 scroll-mt-6 border-t-2 border-ink pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">{eyebrow}</p>
        <button type="button" onClick={onClose} className="link text-[0.9rem]">
          Close
        </button>
      </div>
      <h2 id="breakdown-title" className="mt-2 text-[1.75rem] md:text-[2rem]">
        <span className="inline-flex items-center gap-2">
          {highlighting && node?.highlighted ? <HighlightDot size={10} title="Highlighted" /> : null}
          {name}
        </span>
      </h2>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="num text-[1.75rem] leading-none font-semibold text-ink">{formatMoney(amount)}</span>
        <span className="text-[0.95rem] text-ink-2">
          {kind === 'revenue' ? 'collected' : measureLabel.toLowerCase()} in {fyLong(year)} · {shareLine}
        </span>
      </p>
      <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">{blocks}</div>
      {table}
    </section>
  );
}
