import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlowList } from '../components/FlowList';
import { HighlightCallout } from '../components/HighlightCallout';
import { SankeyChart } from '../components/SankeyChart';
import { SourceStrip } from '../components/SourceStrip';
import { DataMissingError, loadFlows, loadTree, usingFixture } from '../lib/data';
import { ProgramTable } from '../components/ProgramTable';
import { buildFlowModel } from '../lib/flowModel';
import { highlightSet, highlightSubtotal } from '../lib/highlight';
import { formatMoney, fyLong, fyShort, longDate, partialLabel } from '../lib/format';
import type { Measure } from '../lib/types';
import { useMediaQuery, useWidth } from '../state/media';
import { useMeta } from '../state/meta';
import { useLedgerParams } from '../state/params';
import { useAsync } from '../state/useAsync';

export function FlowView() {
  const { meta, year, partial } = useMeta();
  const { hl, measure, setMeasure, setHighlight } = useLedgerParams();
  const wide = useMediaQuery('(min-width: 640px)');
  const [ref, width] = useWidth<HTMLDivElement>();
  // Focus is keyed to the data it was chosen on, so it clears when year/measure change.
  const dataKey = `${year}:${measure}`;
  const [focusState, setFocusState] = useState<{ key: string; id: string | null }>({
    key: dataKey,
    id: null,
  });
  const focus = focusState.key === dataKey ? focusState.id : null;
  const setFocus = useCallback(
    (id: string | null) => setFocusState({ key: dataKey, id }),
    [dataKey],
  );

  const flows = useAsync(() => loadFlows(year, measure), dataKey);
  // tree.json adds full program detail (focus + phone list). Optional: the view works without it.
  const tree = useAsync(() => loadTree(year).catch(() => null), `tree:${year}`);
  const treeData = tree.status === 'ready' ? tree.data : null;
  const revenueOrder = useMemo(() => meta.revenueGroups?.map((g) => g.id), [meta]);
  // Highlight ids that exist in this year's tree; others are ignored silently.
  const highlight = useMemo(() => highlightSet(treeData, hl), [treeData, hl]);
  const highlighting = highlight.size > 0;
  const subtotal = useMemo(
    () => (treeData && highlighting ? highlightSubtotal(treeData, highlight, measure) : null),
    [treeData, highlight, highlighting, measure],
  );

  // Esc clears the focused secretariat.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFocus(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, setFocus]);

  const narrow = width > 0 && width < 960;
  const model = useMemo(
    () =>
      flows.status === 'ready'
        ? buildFlowModel(flows.data, {
            focus,
            topPrograms: narrow ? 12 : 16,
            highlight,
            tree: treeData,
            measure,
            revenueOrder,
          })
        : null,
    [flows, focus, narrow, highlight, treeData, measure, revenueOrder],
  );
  const listModel = useMemo(
    () =>
      flows.status === 'ready'
        ? buildFlowModel(flows.data, { tree: treeData, measure, revenueOrder, highlight })
        : null,
    [flows, treeData, measure, revenueOrder, highlight],
  );
  const focusEntry = focus ? model?.secretariats.find((x) => x.node.id === focus) : undefined;

  const spentLabel = partial ? 'Spent so far' : 'Spent';
  const spendWord =
    measure === 'enacted' ? 'enacted spending' : partial ? 'spending so far' : 'spending';
  const yearLabel = partial ? partialLabel(year, partial) : fyLong(year);
  const focusName = focus ? model?.nodes.find((n) => n.id === focus)?.name : null;

  const dek = (() => {
    if (flows.status !== 'ready') return null;
    const f = flows.data;
    const rev = formatMoney(f.revenueTotal);
    const revThrough = partial?.revenueThrough
      ? ` (through ${longDate(partial.revenueThrough)})`
      : '';
    const sp = formatMoney(f.spendingTotal);
    if (measure === 'enacted') {
      return (
        <>
          For {fyLong(year)}, the Legislature appropriated{' '}
          <span className="num text-ink">{sp}</span> in the enacted budget. The Commonwealth{' '}
          {partial ? 'has collected' : 'collected'} <span className="num text-ink">{rev}</span> in
          budgeted-fund revenue{partial ? ` so far${revThrough}` : ''}.
        </>
      );
    }
    return partial ? (
      <>
        So far in {fyLong(year)}, the Commonwealth has collected{' '}
        <span className="num text-ink">{rev}</span> in budgeted-fund revenue{revThrough} and spent{' '}
        <span className="num text-ink">{sp}</span>.
      </>
    ) : (
      <>
        In {fyLong(year)}, the Commonwealth collected <span className="num text-ink">{rev}</span> in
        budgeted-fund revenue and spent <span className="num text-ink">{sp}</span>.
      </>
    );
  })();

  return (
    <section className="py-8 md:py-12">
      {usingFixture() ? (
        <p className="mb-6 rounded-[8px] border border-clay/30 bg-clay-2/30 px-3 py-2 text-[0.8rem] text-ink">
          <strong className="font-semibold">Development fixture.</strong> /data is not built yet, so
          these are illustrative numbers, not real budget data.
        </p>
      ) : null}

      <p className="eyebrow">Flow · {yearLabel}</p>
      <h1 className="mt-2 max-w-[22ch]">Where the money comes from, and where it goes</h1>
      <p className="mt-4 min-h-[4.8em] max-w-[62ch] text-ink-2 sm:min-h-[3.2em]">{dek ?? ' '}</p>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="seg" role="group" aria-label="Measure">
          {(['enacted', 'actual'] as Measure[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={measure === m}
              onClick={() => setMeasure(m)}
            >
              {m === 'enacted' ? 'Enacted' : spentLabel}
            </button>
          ))}
        </div>
        {wide && focusName ? (
          <p className="flex flex-wrap items-baseline gap-x-2 text-[0.95rem] text-ink-2">
            Showing programs in <strong className="font-semibold text-ink">{focusName}</strong>
            <button type="button" onClick={() => setFocus(null)} className="link">
              Show all
            </button>
            <span className="text-[0.85rem]">(Esc)</span>
          </p>
        ) : wide ? (
          <p className="text-[0.95rem] text-ink-2">
            Hover for amounts. Click a secretariat to see its programs.
          </p>
        ) : null}
      </div>

      {subtotal ? (
        <HighlightCallout
          part={subtotal.part}
          whole={subtotal.whole}
          wholeLabel={spendWord}
          onClear={() => setHighlight([])}
        />
      ) : null}

      {/* Always rendered (empty while loading) so the chart below does not jump. */}
      <p className="mt-5 flex min-h-[1.6em] flex-wrap items-baseline gap-x-2 text-[0.9rem] text-ink-2">
        {flows.status === 'ready' ? (
          <>
            <span>
              Collected <span className="num text-ink">{formatMoney(flows.data.revenueTotal)}</span>
            </span>
            <span aria-hidden="true" className="text-ink-2/60">
              ·
            </span>
            <span>
              {measure === 'enacted' ? 'Enacted' : spentLabel}{' '}
              <span className="num text-ink">{formatMoney(flows.data.spendingTotal)}</span>
            </span>
            <span aria-hidden="true" className="text-ink-2/60">
              ·
            </span>
            <span>ribbons are proportional</span>
          </>
        ) : null}
      </p>

      {/*
        Reserve the chart's rendered height before data arrives (CLS): the Sankey
        is 680–780px tall on tablets/desktops; the phone list is about 2,100px.
      */}
      <div
        ref={ref}
        className={`mt-4 ${flows.status === 'error' ? '' : 'min-h-[2080px] sm:min-h-[680px] lg:min-h-[760px]'}`}
      >
        {flows.status === 'loading' ? (
          <p className="py-24 text-center text-[0.9rem] text-ink-2">Loading {fyShort(year)}…</p>
        ) : flows.status === 'error' ? (
          <p className="rounded-[8px] border border-rule px-4 py-10 text-center text-[0.95rem] text-ink-2">
            {flows.error instanceof DataMissingError
              ? `${measure === 'enacted' ? 'Enacted' : spentLabel} flows for ${fyLong(year)} have not been published yet.`
              : 'The data could not be loaded. Try again in a moment.'}
          </p>
        ) : wide && model && width > 0 ? (
          <SankeyChart
            model={model}
            width={width}
            highlighting={highlighting}
            focus={focus}
            onFocus={setFocus}
            spendWord={spendWord}
            label={`Flow of ${fyLong(year)} money from revenue sources to secretariats to programs. Each node is focusable; secretariats can be expanded.`}
          />
        ) : !wide && listModel ? (
          <FlowList
            model={listModel}
            highlighting={highlighting}
            spendWord={spendWord}
            year={year}
          />
        ) : null}
      </div>

      {wide && focusEntry ? (
        <ProgramTable
          sec={focusEntry.node}
          programs={focusEntry.programs}
          year={year}
          measureLabel={measure === 'enacted' ? 'Enacted' : spentLabel}
          highlighting={highlighting}
          onClose={() => setFocus(null)}
        />
      ) : null}

      <p className="mt-6 max-w-[70ch] text-[0.95rem] text-ink-2">
        <span className="font-semibold text-ink">How to read this.</span> State revenue is pooled,
        so the ribbons from each revenue source to each secretariat are proportional shares of its
        spending, not traced dollars.
      </p>

      <SourceStrip showRevenue />
    </section>
  );
}
