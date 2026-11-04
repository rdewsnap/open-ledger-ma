import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { FlowList } from '../components/FlowList';
import { HighlightCallout } from '../components/HighlightCallout';
import { OverBudgetNote } from '../components/OverBudgetNote';
import { SankeyChart } from '../components/SankeyChart';
import { SourceStrip } from '../components/SourceStrip';
import { DataMissingError, loadFlows, loadTree, usingFixture } from '../lib/data';
import { FlowBreakdown } from '../components/FlowBreakdown';
import { buildFlowModel } from '../lib/flowModel';
import { highlightSet, highlightSubtotal } from '../lib/highlight';
import { formatMoney, fyLong, fyShort, longDate, monthsInto, partialLabel } from '../lib/format';
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
  // Focus (the expanded spending area) and the selection (the node in the breakdown)
  // are keyed to the data they were chosen on, so they clear when year/measure change.
  const dataKey = `${year}:${measure}`;
  const [pick, setPick] = useState<{ key: string; focus: string | null; selected: string | null }>({
    key: dataKey,
    focus: null,
    selected: null,
  });
  const focus = pick.key === dataKey ? pick.focus : null;
  const selected = pick.key === dataKey ? pick.selected : null;
  const setFocus = useCallback(
    (id: string | null) => setPick({ key: dataKey, focus: id, selected: id }),
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

  // Esc clears the expanded area and the selection.
  useEffect(() => {
    if (!focus && !selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFocus(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, selected, setFocus]);

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
  // Any node can be selected; a top-level spending area also expands in the chart.
  const setSelected = useCallback(
    (id: string | null) => {
      if (id?.startsWith('prog:office:')) id = id.replace('prog:office:', 'sec:');
      if (id?.startsWith('sec:') && model?.nodes.some((n) => n.id === id)) return setFocus(id);
      setPick((p) => ({ key: dataKey, focus: p.key === dataKey ? p.focus : null, selected: id }));
    },
    [dataKey, model, setFocus],
  );
  const panelId = selected ?? focus;

  const spentLabel = partial ? 'Spent so far' : 'Spent';
  const spendWord =
    measure === 'enacted' ? 'budgeted spending' : partial ? 'spending so far' : 'spending';
  const yearLabel = partial ? partialLabel(year, partial) : fyLong(year);
  const panelName = panelId
    ? (model?.nodes.find((n) => n.id === panelId)?.name ??
      treeData?.children?.find((c) => c.id === panelId)?.name ??
      listModel?.secretariats.find((x) => x.node.id === panelId)?.node.name ??
      null)
    : null;

  const dek = (() => {
    if (flows.status !== 'ready') return null;
    const f = flows.data;
    const rev = formatMoney(f.revenueTotal);
    const revSoFar = partial?.revenueThrough
      ? ` in the first ${monthsInto(year, partial.revenueThrough)} (through ${longDate(partial.revenueThrough)})`
      : ' so far';
    const sp = formatMoney(f.spendingTotal);
    if (measure === 'enacted') {
      return (
        <>
          For {fyLong(year)}, the Legislature budgeted{' '}
          <span className="num text-ink">{sp}</span>. The state{' '}
          {partial ? 'has taken in' : 'took in'} <span className="num text-ink">{rev}</span>
          {partial ? revSoFar : ''}.
        </>
      );
    }
    return partial ? (
      <>
        So far in {fyLong(year)}, the state has taken in{' '}
        <span className="num text-ink">{rev}</span> and spent{' '}
        <span className="num text-ink">{sp}</span>. The year runs to{' '}
        {longDate(`${year}-06-30`)}, so these cover only about {monthsInto(year, partial.through)}{' '}
        of spending (through {longDate(partial.through)})
        {partial.revenueThrough
          ? ` and ${monthsInto(year, partial.revenueThrough)} of revenue (through ${longDate(partial.revenueThrough)})`
          : ''}
        .
      </>
    ) : (
      <>
        In {fyLong(year)}, the state took in <span className="num text-ink">{rev}</span> and spent{' '}
        <span className="num text-ink">{sp}</span>.
        <OverBudgetNote tree={treeData} measure={measure} partial={!!partial} />
      </>
    );
  })();

  return (
    <section className="py-8 md:py-12">
      {usingFixture() ? (
        <p className="mb-6 rounded-[8px] border border-brick/30 bg-brick-2/30 px-3 py-2 text-[0.8rem] text-ink">
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
              {m === 'enacted' ? 'Budgeted' : spentLabel}
            </button>
          ))}
        </div>
        {wide && panelId ? (
          <p className="flex flex-wrap items-baseline gap-x-2 text-[0.95rem] text-ink-2">
            Selected <strong className="font-semibold text-ink">{panelName ?? 'item'}</strong>
            <a href="#breakdown" className="link">
              Breakdown below
            </a>
            <button type="button" onClick={() => setFocus(null)} className="link">
              Clear
            </button>
            <span className="text-[0.85rem]">(Esc)</span>
          </p>
        ) : wide ? (
          <p className="text-[0.95rem] text-ink-2">
            Click anything in the chart for a breakdown below it.
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
              {measure === 'enacted' ? 'Budgeted' : spentLabel}{' '}
              <span className="num text-ink">{formatMoney(flows.data.spendingTotal)}</span>
            </span>
            {/* Phones get a list, not ribbons. */}
            <span aria-hidden="true" className="hidden text-ink-2/60 sm:inline">
              ·
            </span>
            <span className="hidden sm:inline">ribbons are proportional</span>
            {/* Its own line, so a separator dot never ends a wrapped line. */}
            <span className="basis-full">
              The two totals are counted differently, so the gap is not a surplus or deficit (
              <Link to="/methodology#why-revenue-minus-spending-is-not-a-surplus">why</Link>).
            </span>
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
              ? `${measure === 'enacted' ? 'Budgeted' : spentLabel} flows for ${fyLong(year)} have not been published yet.`
              : 'The data could not be loaded. Try again in a moment.'}
          </p>
        ) : wide && model && width > 0 ? (
          <SankeyChart
            model={model}
            width={width}
            highlighting={highlighting}
            focus={focus}
            onFocus={setFocus}
            selected={selected}
            onSelect={setSelected}
            spendWord={spendWord}
            label={`Flow of ${fyLong(year)} money from revenue sources to spending areas to programs. Each node is focusable; spending areas can be expanded.`}
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

      {wide && panelId && model && listModel ? (
        <FlowBreakdown
          key={panelId}
          id={panelId}
          model={model}
          full={listModel}
          tree={treeData}
          year={year}
          measure={measure}
          measureLabel={measure === 'enacted' ? 'Budgeted' : spentLabel}
          spendWord={spendWord}
          highlighting={highlighting}
          onSelect={setSelected}
          onClose={() => setFocus(null)}
        />
      ) : null}

      <p className="mt-6 max-w-[70ch] text-[0.95rem] text-ink-2">
        <span className="font-semibold text-ink">How to read this.</span> State revenue is pooled,
        so the ribbons from each revenue source to each spending area are proportional shares of its
        spending, not traced dollars.
      </p>

      <SourceStrip showRevenue />
    </section>
  );
}
