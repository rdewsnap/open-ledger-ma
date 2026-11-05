import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChangeList } from '../components/changes/ChangeList';
import { ChangeTable } from '../components/changes/ChangeTable';
import { SearchBox } from '../components/changes/SearchBox';
import { SummaryStrip } from '../components/changes/SummaryStrip';
import { TextPicker } from '../components/changes/TextPicker';
import { HighlightDot } from '../components/HighlightDot';
import { SourceStrip } from '../components/SourceStrip';
import { DataMissingError, loadDiff } from '../lib/data';
import {
  DEFAULT_DIR,
  filterRows,
  maxAbsDelta,
  resolvePair,
  sortRows,
  summarize,
  toChangeRows,
  type SortKey,
} from '../lib/diff';
import { formatMoney, formatPercentChange, fyLong, fyShort, longDate, monthsInto } from '../lib/format';
import type { Measure } from '../lib/types';
import { useMediaQuery } from '../state/media';
import { useMeta } from '../state/meta';
import { useLedgerParams } from '../state/params';
import { useAsync } from '../state/useAsync';
import { sourcePath } from '../lib/source';
import { Link } from 'react-router';

const PAGE = 50;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'abs', label: '$ change' },
  { key: 'pct', label: '% change' },
  { key: 'name', label: 'Name' },
];

export function ChangesView() {
  const { meta, year } = useMeta();
  const { hl, measure, setMeasure } = useLedgerParams();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery('(min-width: 640px)');

  const years = useMemo(() => [...meta.years].sort((x, y) => x - y), [meta]);
  const { from, to } = resolvePair(years, year, params.get('from'), params.get('to'));

  const setPair = useCallback(
    (f: number, t: number) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('from', String(f));
          next.set('to', String(t));
          return next;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );
  const pickFrom = (y: number) => setPair(y, y < to ? to : (years.find((v) => v > y) ?? to));
  const pickTo = (y: number) =>
    setPair(y > from ? from : (years.filter((v) => v < y).at(-1) ?? from), y);

  const [query, setQuery] = useState('');
  const [hlOnly, setHlOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('abs');
  const [sortDir, setSortDir] = useState(DEFAULT_DIR.abs);

  const diff = useAsync(() => loadDiff(from, to), `${from}_${to}`);
  // Rows match on their own id, secId or deptId; ids absent from these years simply match nothing.
  const highlight = useMemo(() => new Set(hl), [hl]);
  const highlighting = highlight.size > 0;
  const highlightedOnly = highlighting && hlOnly;
  const rows = useMemo(
    () => (diff.status === 'ready' ? toChangeRows(diff.data.rows, measure, highlight) : []),
    [diff, measure, highlight],
  );
  const filtered = useMemo(
    () => filterRows(rows, query, highlightedOnly),
    [rows, query, highlightedOnly],
  );
  const sorted = useMemo(() => sortRows(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const hlSummary = useMemo(
    () => (highlighting ? summarize(filtered.filter((r) => r.highlighted)) : null),
    [highlighting, filtered],
  );
  const max = useMemo(() => maxAbsDelta(filtered), [filtered]);

  // "Show more" resets whenever the set or its order changes.
  const listKey = `${from}:${to}:${measure}:${query}:${highlightedOnly}:${sortKey}:${sortDir}`;
  const [limitState, setLimitState] = useState({ key: listKey, n: PAGE });
  const limit = limitState.key === listKey ? limitState.n : PAGE;
  const visible = sorted.slice(0, limit);

  const partialB = meta.partial?.[String(to)] ?? null;
  const spentB = partialB ? 'Spent so far' : 'Spent';
  const labelA = fyShort(from);
  const labelB = partialB && measure === 'actual' ? `${fyShort(to)} so far` : fyShort(to);
  const sortWord =
    sortKey === 'name'
      ? sortDir === 'asc'
        ? 'A–Z'
        : 'Z–A'
      : sortKey === 'abs'
        ? sortDir === 'desc'
          ? 'Largest'
          : 'Smallest'
        : sortDir === 'desc'
          ? 'Highest'
          : 'Lowest';
  const rowsHref = useCallback(
    (acct: string) => sourcePath({ ds: 'spending', years: [from, to], account: acct }),
    [from, to],
  );

  const tA = meta.totals[String(from)];
  const tB = meta.totals[String(to)];
  const dek = (() => {
    if (!tA || !tB) return null;
    const a = (
      <span className="num text-ink">
        {formatMoney(measure === 'enacted' ? tA.enacted : tA.actual)}
      </span>
    );
    const b = (
      <span className="num text-ink">
        {formatMoney(measure === 'enacted' ? tB.enacted : tB.actual)}
      </span>
    );
    if (measure === 'enacted') {
      return (
        <>
          Between {fyLong(from)} and {fyLong(to)}, the budget moved from {a} to {b}.
        </>
      );
    }
    if (partialB) {
      return (
        <>
          Spending was {a} in all of {fyLong(from)}. {fyLong(to)} is only about{' '}
          {monthsInto(to, partialB.through)} in, and its spending so far is {b}.
        </>
      );
    }
    return (
      <>
        Between {fyLong(from)} and {fyLong(to)}, spending moved from {a} to {b}.
      </>
    );
  })();

  return (
    <section className="min-h-[100svh] py-8 md:py-12">
      <p className="eyebrow">
        Changes · {fyShort(from)} → {fyShort(to)}
      </p>
      <h1 className="mt-2 max-w-[24ch]">What changed, program by program</h1>
      <p className="mt-4 max-w-[62ch] text-ink-2">{dek ?? ' '}</p>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <TextPicker
          label="From"
          value={from}
          onPick={pickFrom}
          options={years.map((y) => ({
            value: y,
            label: fyShort(y),
            disabled: y === years.at(-1),
          }))}
        />
        <TextPicker
          label="To"
          value={to}
          onPick={pickTo}
          options={years.map((y) => ({ value: y, label: fyShort(y), disabled: y === years[0] }))}
        />
        <div className="seg" role="group" aria-label="Measure">
          {(['enacted', 'actual'] as Measure[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={measure === m}
              onClick={() => setMeasure(m)}
            >
              {m === 'enacted' ? 'Budgeted' : 'Spent'}
            </button>
          ))}
        </div>
      </div>

      {partialB && measure === 'actual' ? (
        <p className="mt-4 rounded-[8px] border border-brick/30 bg-brick-2/30 px-3 py-2 text-[0.9rem] text-ink">
          <strong className="font-semibold">Not a like-for-like comparison.</strong>{' '}
          {fyShort(to)} spending covers only {monthsInto(to, partialB.through)} (through{' '}
          {longDate(partialB.through)}), so most programs will look like cuts that are not real.{' '}
          <button type="button" className="link" onClick={() => setMeasure('enacted')}>
            Compare budgets instead
          </button>
        </p>
      ) : null}

      {partialB && measure === 'enacted' && tA && tB && tA.enacted > tA.gaa ? (
        <p className="mt-4 rounded-[8px] border border-brick/30 bg-brick-2/30 px-3 py-2 text-[0.9rem] text-ink">
          <strong className="font-semibold">{fyShort(to)} has only its original budget so far.</strong>{' '}
          {fyShort(from)}’s figure includes{' '}
          <span className="num">{formatMoney(tA.enacted - tA.gaa)}</span> of supplemental budgets
          passed during the year. Original budget to original budget, the total went from{' '}
          <span className="num">{formatMoney(tA.gaa)}</span> to{' '}
          <span className="num">{formatMoney(tB.gaa)}</span> (
          <span className="num">{formatPercentChange((tB.gaa - tA.gaa) / tA.gaa)}</span>). Programs
          marked “none yet” may still be funded by a later supplemental budget.
        </p>
      ) : null}

      {/* Drawn (invisibly, with zeros) while loading so the controls below do not jump. */}
      <div
        className={diff.status === 'ready' ? '' : 'invisible'}
        aria-hidden={diff.status === 'ready' ? undefined : true}
      >
        <SummaryStrip
          all={summary}
          highlighted={hlSummary}
          labelA={labelA}
          labelB={labelB}
          filtered={diff.status === 'ready' && filtered.length !== rows.length}
          open={!!partialB}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <SearchBox onChange={setQuery} shown={filtered.length} total={rows.length} />
        {highlighting ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-[0.95rem] text-ink">
            <input
              type="checkbox"
              checked={hlOnly}
              onChange={(e) => setHlOnly(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            <HighlightDot /> Highlighted only
          </label>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <TextPicker
            label="Sort"
            value={sortKey}
            options={SORTS.map((x) => ({ value: x.key, label: x.label }))}
            onPick={(k) => {
              setSortKey(k);
              if (k !== sortKey) setSortDir(DEFAULT_DIR[k]);
            }}
          />
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            aria-label={`${sortWord}: sort direction ${sortDir === 'asc' ? 'ascending' : 'descending'}. Click to reverse.`}
            className="rounded-[6px] border border-rule px-2 py-0.5 text-[0.9rem] text-ink-2 hover:border-ink-2 hover:text-ink"
          >
            <span aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span> {sortWord}
          </button>
        </div>
      </div>

      <div className={`mt-2 ${diff.status === 'loading' ? 'min-h-[60svh]' : 'min-h-[200px]'}`}>
        {diff.status === 'loading' ? (
          <p className="py-24 text-center text-[0.9rem] text-ink-2">
            Loading {fyShort(from)} → {fyShort(to)}…
          </p>
        ) : diff.status === 'error' ? (
          <p className="mt-4 rounded-[8px] border border-rule px-4 py-10 text-center text-[0.95rem] text-ink-2">
            {diff.error instanceof DataMissingError
              ? `Changes from ${fyLong(from)} to ${fyLong(to)} have not been published yet.`
              : 'The data could not be loaded. Try again in a moment.'}
          </p>
        ) : sorted.length === 0 ? (
          <p className="mt-4 rounded-[8px] border border-rule px-4 py-10 text-center text-[0.95rem] text-ink-2">
            {query ? <>No programs match “{query}”.</> : 'No programs to show.'}
          </p>
        ) : wide ? (
          <ChangeTable
            rows={visible}
            max={max}
            labelA={labelA}
            labelB={labelB}
            sortKey={sortKey}
            sortDir={sortDir}
            highlighting={highlighting}
            rowsHref={rowsHref}
            open={!!partialB}
          />
        ) : (
          <ChangeList rows={visible} max={max} highlighting={highlighting} rowsHref={rowsHref} open={!!partialB} />
        )}
        {sorted.length > limit ? (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setLimitState({ key: listKey, n: limit + PAGE })}
              className="rounded-[6px] border border-rule px-4 py-1.5 text-[0.95rem] text-ink hover:border-ink-2"
            >
              Show more
            </button>
            <span className="text-[0.875rem] text-ink-2">
              Showing <span className="num">{visible.length}</span> of{' '}
              <span className="num">{sorted.length}</span>
            </span>
          </div>
        ) : null}
      </div>

      <p className="mt-6 max-w-[70ch] text-[0.95rem] text-ink-2">
        <span className="font-semibold text-ink">How to read this.</span> Bars run right for
        increases and left for decreases, scaled to the largest change in the list.{' '}
        {measure === 'enacted' ? 'Budgeted' : spentB} amounts; “new” means the program had $0 in{' '}
        {fyLong(from)}
        {partialB ? <>; “none yet” means it has $0 so far in {fyLong(to)}</> : null}. Amounts are in
        dollars of each year, not adjusted for inflation. Rows named “Other …” add together a department’s smaller line items; the tag says how many.
        This page shows what changed, not why; for explanations, see{' '}
        <Link to="/methodology#who-explains-the-changes">who explains the changes</Link>.
      </p>

      <SourceStrip years={[from, to]} />
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
        Compared: {fyLong(from)} and {fyLong(to)}, both from the pull of{' '}
        <span className="num">{meta.sources.spending.pulled}</span>
        <span aria-hidden="true" className="px-1.5 text-ink-2/60">
          ·
        </span>
        <Link to={sourcePath({ ds: 'spending', years: [from, to] })}>rows for both years</Link>
      </p>
    </section>
  );
}

export default ChangesView;
