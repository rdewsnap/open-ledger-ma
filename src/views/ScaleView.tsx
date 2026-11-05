import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Breadcrumb } from '../components/scale/Breadcrumb';
import { AmountInContext } from '../components/AmountInContext';
import { HighlightCallout } from '../components/HighlightCallout';
import { OverBudgetNote } from '../components/OverBudgetNote';
import { ScaleList } from '../components/scale/ScaleList';
import { Treemap } from '../components/scale/Treemap';
import { SourceStrip } from '../components/SourceStrip';
import { areaDescription } from '../lib/areas';
import { capitalFor } from '../lib/capital';
import { DataMissingError, loadTree, usingFixture } from '../lib/data';
import { formatMoney, formatPerResident, formatShare, fyLong, fyShort, longDate, monthsInto, partialLabel } from '../lib/format';
import { highlightSet } from '../lib/highlight';
import {
  buildHierarchy,
  decodeNodeParam,
  encodeNodeParam,
  highlightTotal,
  resolveScalePath,
  secretariatColors,
} from '../lib/treemap';
import type { Measure } from '../lib/types';
import { useMediaQuery, useWidth } from '../state/media';
import { residentsFor } from '../lib/population';
import { useMeta } from '../state/meta';
import { useLedgerParams } from '../state/params';
import { useAsync } from '../state/useAsync';

/** `?node=` holds the zoom path (see encodeNodeParam). Only this view reads it. */
const NODE_PARAM = 'node';

type NavState = { scaleFrom?: string } | null;

export function ScaleView() {
  const { meta, year, partial } = useMeta();
  const { hl, measure, setMeasure, setHighlight } = useLedgerParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 640px)');
  const [ref, width] = useWidth<HTMLDivElement>();
  const [viewportH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));

  const tree = useAsync(() => loadTree(year), `tree:${year}`);
  const treeData = tree.status === 'ready' ? tree.data : null;
  const root = useMemo(
    () => (treeData ? buildHierarchy(treeData, measure) : null),
    [treeData, measure],
  );
  const colors = useMemo(
    () => (root ? secretariatColors(root) : new Map<string, string>()),
    [root],
  );
  // Highlight ids that exist in this year's tree; others are ignored silently.
  const highlight = useMemo(() => highlightSet(treeData, hl), [treeData, hl]);

  const nodeParam = params.get(NODE_PARAM);
  const chain = useMemo(
    () => (root ? resolveScalePath(root, decodeNodeParam(nodeParam)) : []),
    [root, nodeParam],
  );
  const focus = chain.at(-1) ?? null;

  const writeNode = useCallback(
    (id: string | null, opts: { replace: boolean; state?: NavState }) => {
      const enc = encodeNodeParam(id);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (enc) next.set(NODE_PARAM, enc);
          else next.delete(NODE_PARAM);
          return next;
        },
        { replace: opts.replace, preventScrollReset: true, state: opts.state ?? null },
      );
    },
    [setParams],
  );

  /** Zoom in: a new history entry, so the browser's back button zooms out. */
  const zoomTo = useCallback(
    (id: string) => writeNode(id, { replace: false, state: { scaleFrom: nodeParam ?? '' } }),
    [writeNode, nodeParam],
  );

  /** Zoom out to chain[index]. Steps back through history when that is where we came from. */
  const goUp = useCallback(
    (index: number) => {
      const target = chain[index];
      if (!target || index >= chain.length - 1) return;
      const targetParam = encodeNodeParam(target.data.id) ?? '';
      const from = (location.state as NavState)?.scaleFrom;
      if (index === chain.length - 2 && from === targetParam) navigate(-1);
      else writeNode(target.data.id, { replace: true });
    },
    [chain, location.state, navigate, writeNode],
  );

  // Esc goes up one level.
  useEffect(() => {
    if (chain.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      goUp(chain.length - 2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chain.length, goUp]);

  const total = root?.value ?? 0;
  const spentLabel = partial ? 'Spent so far' : 'Spent';
  const measureLabel = measure === 'enacted' ? 'Budgeted' : spentLabel;
  const spendWord =
    measure === 'enacted' ? 'budgeted spending' : partial ? 'spending so far' : 'spending';
  const totalLabel =
    measure === 'enacted'
      ? 'total budgeted spending'
      : partial
        ? 'spending so far'
        : 'total spending';
  const yearLabel = partial ? partialLabel(year, partial) : fyLong(year);
  const hlTotal = root ? highlightTotal(root, highlight) : 0;
  const residents = residentsFor(meta, year);
  const focusCapital = focus && focus.depth > 0 ? capitalFor(meta, year, focus.data.id) : null;
  const verb =
    measure === 'enacted' ? `budgeted for ${fyLong(year)}` : partial ? `spent so far in ${fyLong(year)}` : `spent in ${fyLong(year)}`;

  const dek = (() => {
    if (!root || total <= 0) return null;
    const amt = <span className="num text-ink">{formatMoney(total)}</span>;
    const lead =
      measure === 'enacted' ? (
        <>
          For {fyLong(year)} the Legislature budgeted {amt}.
        </>
      ) : partial ? (
        <>
          So far in {fyLong(year)} the state has spent {amt}, about{' '}
          {monthsInto(year, partial.through)} into a year that runs to {longDate(`${year}-06-30`)}.
          {treeData ? (
            <>
              {' '}
              The budget for the year is{' '}
              <span className="num text-ink">{formatMoney(treeData.enacted)}</span>; spending also
              includes payments made outside it, such as pensions, so the two are not a measure of how
              much budget is left.
            </>
          ) : null}
        </>
      ) : (
        <>
          In {fyLong(year)} the state spent {amt}.
        </>
      );
    const top = root.children?.[0];
    return (
      <>
        {lead} Each box is drawn to scale
        {top ? (
          <>
            ; {top.data.name} is{' '}
            <span className="num text-ink">{formatShare(top.value ?? 0, total)}</span> of the whole.
          </>
        ) : (
          '.'
        )}
        <OverBudgetNote tree={treeData} measure={measure} partial={!!partial} />
      </>
    );
  })();

  const height = wide
    ? Math.round(Math.min(640, Math.max(420, width * 0.58)))
    : Math.max(340, Math.round(viewportH * 0.6));

  return (
    <section className="min-h-[100svh] py-8 md:py-12">
      {usingFixture() ? (
        <p className="mb-6 rounded-[8px] border border-brick/30 bg-brick-2/30 px-3 py-2 text-[0.8rem] text-ink">
          <strong className="font-semibold">Development fixture.</strong> /data is not built yet, so
          these are illustrative numbers, not real budget data.
        </p>
      ) : null}

      <p className="eyebrow">Scale · {yearLabel}</p>
      <h1 className="mt-2 max-w-[22ch]">Every program, drawn to scale</h1>
      <p className="mt-4 max-w-[62ch] text-ink-2">{dek ?? ' '}</p>

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
        <p className="text-[0.95rem] text-ink-2">
          {wide
            ? 'Hover for amounts. Click a box to zoom in; Esc or the trail above the chart goes back.'
            : 'Tap a box to zoom in.'}
        </p>
      </div>

      {highlight.size > 0 && root ? (
        <HighlightCallout
          part={hlTotal}
          whole={total}
          wholeLabel={spendWord}
          onClear={() => setHighlight([])}
        />
      ) : null}

      {/* The trail's row is kept while loading so the chart does not jump. */}
      <div className="mt-5 flex min-h-[1.7em] flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {focus ? <Breadcrumb chain={chain} onPick={goUp} /> : null}
        {focus ? (
          <>
            {focus.depth > 0 ? (
              <p className="text-[0.95rem] text-ink-2">
                <span className="num text-ink">{formatMoney(focus.value ?? 0)}</span>
                <span aria-hidden="true" className="px-1.5 text-ink-2/60">
                  ·
                </span>
                <span className="num">{formatShare(focus.value ?? 0, total)}</span> of {totalLabel}
                {residents ? (
                  <>
                    <span aria-hidden="true" className="px-1.5 text-ink-2/60">
                      ·
                    </span>
                    <span className="num">{formatPerResident(focus.value ?? 0, residents)}</span> per resident
                  </>
                ) : null}
                {focusCapital ? (
                  <>
                    <span aria-hidden="true" className="px-1.5 text-ink-2/60">
                      ·
                    </span>
                    plus <span className="num text-ink">{formatMoney(focusCapital)}</span> capital, not
                    drawn
                  </>
                ) : null}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {focus?.depth === 1 && areaDescription(focus.data.id) ? (
        <p className="mt-1 max-w-[70ch] text-[0.95rem] text-ink-2">{areaDescription(focus.data.id)}</p>
      ) : null}

      {/* Reserve the treemap's height before the tree arrives (CLS). */}
      <div ref={ref} className="mt-3" style={{ minHeight: tree.status === 'error' ? 200 : height }}>
        {tree.status === 'loading' ? (
          <p className="py-24 text-center text-[0.9rem] text-ink-2">Loading {fyShort(year)}…</p>
        ) : tree.status === 'error' ? (
          <p className="rounded-[8px] border border-rule px-4 py-10 text-center text-[0.95rem] text-ink-2">
            {tree.error instanceof DataMissingError
              ? `The ${fyLong(year)} program tree has not been published yet.`
              : 'The data could not be loaded. Try again in a moment.'}
          </p>
        ) : focus && width > 0 ? (
          <Treemap
            focus={focus}
            width={width}
            height={height}
            colors={colors}
            highlight={highlight}
            total={total}
            totalLabel={totalLabel}
            onZoom={zoomTo}
            label={`Treemap of ${focus.depth === 0 ? `the ${fyLong(year)} budget` : focus.data.name}, ${measureLabel.toLowerCase()}. Each box is focusable; use the arrow keys to move, Enter to zoom in, Escape to zoom out.`}
          />
        ) : null}
      </div>

      {focus ? (
        <ScaleList
          focus={focus}
          colors={colors}
          highlight={highlight}
          measureLabel={measureLabel}
          year={year}
          onZoom={zoomTo}
        />
      ) : null}

      {root && total > 0 ? (
        <AmountInContext
          key={focus?.data.id ?? 'root'}
          area={focus && focus.depth > 0 ? { name: focus.data.name, amount: focus.value ?? 0, capital: focusCapital } : null}
          total={total}
          verb={verb}
          residents={residents}
          totalLabel={
            measure === 'enacted'
              ? `the whole operating budget for ${fyLong(year)}`
              : `all state operating spending${partial ? ' so far' : ''} in ${fyLong(year)}`
          }
          hint="Zoom into a spending area or department to compare with it too. Simple division: it does not say whether an amount is a lot or a little."
        />
      ) : null}

      <p className="mt-6 max-w-[70ch] text-[0.95rem] text-ink-2">
        <span className="font-semibold text-ink">How to read this.</span> Each large box is a
        spending area: one of the Governor’s cabinet offices, or an independent office such as the
        courts. Inside are its departments, and inside those, its programs (single budget line
        items). Box sizes are drawn to scale. Bond-funded capital spending (construction, land
        purchases) is not drawn; when you zoom into an area, its capital total is shown above the chart.
      </p>

      <SourceStrip />
    </section>
  );
}

export default ScaleView;
