import { socrataRowsUrl } from '../lib/data';
import { partialLabel } from '../lib/format';
import { DATASET_NAMES } from '../lib/site';
import { useMeta } from '../state/meta';

export function SourceStrip({ showRevenue = false }: { showRevenue?: boolean }) {
  const { meta, year, partial } = useMeta();
  const s = meta.sources.spending;
  const r = meta.sources.revenue;
  return (
    <p className="mt-8 border-t border-rule pt-3 text-[0.8rem] leading-relaxed text-ink-2">
      Source:{' '}
      <a href={s.url} className="text-ink-2 hover:text-clay">{DATASET_NAMES[s.id] ?? s.name}</a> (<span className="num">{s.id}</span>), pulled{' '}
      <span className="num">{s.pulled}</span>
      <span aria-hidden="true" className="px-1.5 text-rule">·</span>
      <a href={socrataRowsUrl(s, year)} className="hover:text-clay">rows</a>
      {showRevenue ? (
        <>
          <span aria-hidden="true" className="px-1.5 text-rule">·</span>
          Revenue: <a href={r.url} className="text-ink-2 hover:text-clay">{DATASET_NAMES[r.id] ?? r.name}</a> (<span className="num">{r.id}</span>), pulled{' '}
          <span className="num">{r.pulled}</span>
        </>
      ) : null}
      {partial ? (
        <>
          <br />
          <span>{partialLabel(year, partial)}.</span>
        </>
      ) : null}
    </p>
  );
}
