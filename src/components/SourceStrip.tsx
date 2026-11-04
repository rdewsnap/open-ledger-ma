import { Fragment } from 'react';
import { Link } from 'react-router';
import { sourcePath } from '../lib/source';
import { fyShort, partialLabel } from '../lib/format';
import { DATASET_NAMES } from '../lib/site';
import { useMeta } from '../state/meta';

type Props = {
  showRevenue?: boolean;
  /** Years this view draws from (default: the selected year). Each gets a rows link and, if open, an in-progress note. */
  years?: number[];
};

const Dot = () => (
  <span aria-hidden="true" className="px-1.5 text-ink-2/60">
    ·
  </span>
);

export function SourceStrip({ showRevenue = false, years }: Props) {
  const { meta, year } = useMeta();
  const s = meta.sources.spending;
  const r = meta.sources.revenue;
  const list = years?.length ? years : [year];
  const multi = list.length > 1;
  const partials = list.flatMap((y) => {
    const p = meta.partial?.[String(y)];
    return p ? [{ y, p }] : [];
  });
  return (
    <p className="mt-8 border-t border-rule pt-3 text-[0.875rem] leading-relaxed text-ink-2">
      Source: <a href={s.url}>{DATASET_NAMES[s.id] ?? s.name}</a> (<span className="code">{s.id}</span>), pulled <span className="num">{s.pulled}</span>
      <Dot />
      {list.map((y, i) => (
        <Fragment key={y}>
          {i > 0 ? <Dot /> : null}
          <Link to={sourcePath({ ds: 'spending', years: [y] })} aria-label={multi ? undefined : `source rows for ${fyShort(y)}`}>
            {multi ? `${fyShort(y)} rows` : 'rows'}
          </Link>
        </Fragment>
      ))}
      {showRevenue ? (
        <>
          <Dot />
          Revenue: <a href={r.url}>{DATASET_NAMES[r.id] ?? r.name}</a> (<span className="code">{r.id}</span>), pulled <span className="num">{r.pulled}</span>
          <Dot />
          <Link to={sourcePath({ ds: 'revenue', years: [year] })}>rows</Link>
        </>
      ) : null}
      {partials.map(({ y, p }) => (
        <Fragment key={y}>
          <br />
          <span>{partialLabel(y, p)}.</span>
        </Fragment>
      ))}
    </p>
  );
}
