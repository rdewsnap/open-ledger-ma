import { Link, useSearchParams } from 'react-router';
import { formatMoney, fyLong, fyShort } from '../lib/format';
import { DATASET_NAMES } from '../lib/site';
import {
  cleanYear,
  fullDollars,
  PAGE_SIZE,
  parseSourceQuery,
  readableName,
  SPENDING_FIELDS,
  sourceApiUrl,
  sourcePath,
  type SourceQuery,
} from '../lib/source';
import { useMeta } from '../state/meta';
import { useAsync } from '../state/useAsync';

type Raw = Record<string, string | undefined>;

async function fetchRows(url: string): Promise<Raw[]> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CTHRU answered ${res.status}`);
  return (await res.json()) as Raw[];
}

function UseTag({ children }: { children: string }) {
  return (
    <span className="ml-2 rounded-[3px] border border-brick/40 px-1.5 py-px align-[1px] text-[0.72rem] font-semibold tracking-wide text-brick-text uppercase">
      {children}
    </span>
  );
}

/** One account: every field of every row (one column per year and fund). */
function AccountTable({ rows }: { rows: Raw[] }) {
  const fields = SPENDING_FIELDS.filter((f) => rows.some((r) => r[f.key] !== undefined && r[f.key] !== ''));
  const dupYears = new Set(rows.map((x) => x.fiscal_year)).size < rows.length;
  const head = (r: Raw) => `${fyShort(Number(cleanYear(r.fiscal_year)))}${dupYears ? ` · ${readableName(r.department_name)}` : ''}`;
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-[0.95rem]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th scope="col" className="colhead py-2">Field</th>
            {rows.map((r, i) => (
              <th key={i} scope="col" className="colhead py-2 text-right">
                {head(r)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key} className={`border-b border-rule/70 ${f.use ? 'bg-paper-2/70' : ''}`}>
              <th scope="row" className="py-2 pr-4 text-left font-normal text-ink-2">
                {f.label}
                {f.use ? <UseTag>{`Site's ${f.use}`}</UseTag> : null}
                <span className="code block text-[0.75rem] text-ink-2/80">{f.key}</span>
              </th>
              {rows.map((r, i) => (
                <td key={i} className={`py-2 pl-4 text-right align-top ${f.money ? 'num' : ''} ${f.use ? 'font-semibold text-ink' : 'text-ink'}`}>
                  {f.money ? fullDollars(r[f.key]) : f.key === 'fiscal_year' ? cleanYear(r[f.key]) : (r[f.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pager({ q, count }: { q: SourceQuery; count: number }) {
  const page = q.page ?? 1;
  if (page === 1 && count < PAGE_SIZE) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center gap-4 text-[0.95rem]">
      {page > 1 ? <Link to={sourcePath({ ...q, page: page - 1 })}>Previous {PAGE_SIZE}</Link> : null}
      <span className="text-ink-2">
        Rows {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + count}
      </span>
      {count === PAGE_SIZE ? <Link to={sourcePath({ ...q, page: page + 1 })}>Next {PAGE_SIZE}</Link> : null}
    </nav>
  );
}

/** A year of spending: accounts ranked by dollars spent. */
function SpendingYearTable({ rows, q }: { rows: Raw[]; q: SourceQuery }) {
  const start = ((q.page ?? 1) - 1) * PAGE_SIZE;
  return (
    <>
      <table className="mt-6 w-full border-collapse text-[0.95rem]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th scope="col" className="colhead w-10 py-2 text-right">#</th>
            <th scope="col" className="colhead py-2 pl-4">Account</th>
            <th scope="col" className="colhead hidden py-2 md:table-cell">Department</th>
            <th scope="col" className="colhead py-2 text-right">
              Budgeted<span className="sr-only"> (enacted appropriation, including supplementals)</span>
            </th>
            <th scope="col" className="colhead py-2 text-right">
              Spent<span className="sr-only"> (total expenses)</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.appropriation_account_number}-${i}`} className="border-b border-rule/70 align-top">
              <td className="num py-2 text-right text-ink-2">{start + i + 1}</td>
              <td className="py-2 pr-3 pl-4">
                <Link to={sourcePath({ ds: 'spending', years: q.years, account: r.appropriation_account_number })}>{readableName(r.appropriation_account_name)}</Link>
                <span className="code ml-2 text-[0.8rem] text-ink-2">{r.appropriation_account_number}</span>
              </td>
              <td className="hidden py-2 pr-3 text-ink-2 md:table-cell">{readableName(r.department_name)}</td>
              <td className="num py-2 text-right text-ink-2">{formatMoney(Number(r.total_enacted_budget_appropriation ?? 0))}</td>
              <td className="num py-2 pl-3 text-right text-ink">{formatMoney(Number(r.total_expenses ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager q={q} count={rows.length} />
    </>
  );
}

/** A year of revenue: collections summed by source. */
function RevenueYearTable({ rows, q }: { rows: Raw[]; q: SourceQuery }) {
  const start = ((q.page ?? 1) - 1) * PAGE_SIZE;
  return (
    <>
      <table className="mt-6 w-full border-collapse text-[0.95rem]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th scope="col" className="colhead w-10 py-2 text-right">#</th>
            <th scope="col" className="colhead py-2 pl-4">Revenue source</th>
            <th scope="col" className="colhead hidden py-2 md:table-cell">Category</th>
            <th scope="col" className="colhead py-2 text-right">Collected</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-rule/70 align-top">
              <td className="num py-2 text-right text-ink-2">{start + i + 1}</td>
              <td className="py-2 pr-3 pl-4 text-ink">{readableName(r.revenue_source_name)}</td>
              <td className="hidden py-2 pr-3 text-ink-2 md:table-cell">{readableName(r.revenue_category_name)}</td>
              <td className="num py-2 text-right text-ink">{fullDollars(r.collected)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager q={q} count={rows.length} />
    </>
  );
}

/** The rows behind a number, fetched live from CTHRU and shown as a readable table. */
export default function SourceView() {
  const { meta } = useMeta();
  const [params] = useSearchParams();
  const q = parseSourceQuery(params);
  const source = q?.ds === 'revenue' ? meta.sources.revenue : meta.sources.spending;
  const url = q ? sourceApiUrl(source, q, q.ds === 'revenue' ? source.filter : undefined) : '';
  const rows = useAsync(() => (url ? fetchRows(url) : Promise.resolve([])), url);

  if (!q) {
    return (
      <section className="py-8 md:py-12">
        <p className="eyebrow">Source rows</p>
        <h1 className="mt-2">Nothing to look up</h1>
        <p className="mt-4 text-ink-2">
          This page shows the state&rsquo;s rows behind a number. Follow a &ldquo;rows&rdquo; link from any view.
        </p>
      </section>
    );
  }

  const yearsLabel = q.years.map(fyLong).join(' and ');
  const data = rows.status === 'ready' ? rows.data : [];
  const title =
    q.ds === 'spending' && q.account
      ? readableName(data[0]?.appropriation_account_name) || `Account ${q.account}`
      : q.ds === 'spending'
        ? `Spending accounts, ${yearsLabel}`
        : `Revenue collected, ${yearsLabel}`;
  const dek =
    q.ds === 'spending' && q.account ? (
      <>
        Account <span className="code">{q.account}</span>
        {data[0]?.department_name ? <> · {readableName(data[0].department_name)}</> : null} · {yearsLabel}. Every field of the
        state&rsquo;s record, with the two this site reads marked.
      </>
    ) : q.ds === 'spending' ? (
      <>Every appropriation account, largest spending first. Select an account to see its full record.</>
    ) : (
      <>Budgeted-fund collections summed by revenue source, largest first. The site groups these into seven revenue sources.</>
    );

  return (
    <section className="py-8 md:py-12">
      <p className="eyebrow">Source rows · {DATASET_NAMES[source.id] ?? source.name}</p>
      <h1 className="mt-2 max-w-[28ch] text-[2rem] md:text-[2.5rem]">{title}</h1>
      <p className="mt-4 max-w-[68ch] text-ink-2">{dek}</p>

      <div className="min-h-[24rem]">
        {rows.status === 'loading' ? (
          <p className="py-16 text-center text-[0.9rem] text-ink-2">Fetching rows from CTHRU…</p>
        ) : rows.status === 'error' ? (
          <p className="mt-6 rounded-[6px] border border-rule px-4 py-8 text-center text-[0.95rem] text-ink-2">
            CTHRU did not answer just now. You can <a href={url}>open the rows directly</a>.
          </p>
        ) : !data.length ? (
          <p className="mt-6 rounded-[6px] border border-rule px-4 py-8 text-center text-[0.95rem] text-ink-2">No rows match.</p>
        ) : q.ds === 'spending' && q.account ? (
          <AccountTable rows={data} />
        ) : q.ds === 'spending' ? (
          <SpendingYearTable rows={data} q={q} />
        ) : (
          <RevenueYearTable rows={data} q={q} />
        )}
      </div>

      <p className="mt-8 border-t border-rule pt-3 text-[0.875rem] leading-relaxed text-ink-2">
        Fetched live from the Office of the Comptroller&rsquo;s <a href={source.url}>CTHRU</a> dataset{' '}
        <span className="code">{source.id}</span> · <a href={url}>same query as raw JSON</a> ·{' '}
        <Link to="/methodology">how the site uses these fields</Link>
      </p>
    </section>
  );
}
