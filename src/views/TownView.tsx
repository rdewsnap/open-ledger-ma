import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DataMissingError, loadTowns } from '../lib/data';
import { formatMoney, formatMoneyChange, formatPercentChange, formatShare, fyLong, fyShort } from '../lib/format';
import { districtsNamedFor, normalizePlace, searchPlaces } from '../lib/towns';
import type { TownAid, TownPlace, Towns } from '../lib/types';
import { useMeta } from '../state/meta';
import { useAsync } from '../state/useAsync';

const CHERRY_SHEETS = 'https://www.mass.gov/cherry-sheet-estimates';

const sum = (a: TownAid | undefined) => (a ? a.ch70 + a.ugga : 0);

/** One row per year: school aid, unrestricted aid, total and the change from the year before. */
function AidTable({ years, aid, caption }: { years: number[]; aid: (year: number) => TownAid | undefined; caption: string }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-[0.95rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="colhead py-2">Year</th>
            <th scope="col" className="colhead py-2 text-right">School aid</th>
            <th scope="col" className="colhead py-2 text-right">Unrestricted aid</th>
            <th scope="col" className="colhead py-2 text-right">Total</th>
            <th scope="col" className="colhead py-2 text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y, i) => {
            const a = aid(y);
            const prev = i > 0 ? aid(years[i - 1] ?? 0) : undefined;
            const delta = a && prev ? sum(a) - sum(prev) : null;
            return (
              <tr key={y} className="border-b border-rule/60">
                <th scope="row" className="num py-2 text-left font-normal text-ink">{fyShort(y)}</th>
                {a ? (
                  <>
                    <td className="num py-2 text-right text-ink-2">{formatMoney(a.ch70)}</td>
                    <td className="num py-2 text-right text-ink-2">{formatMoney(a.ugga)}</td>
                    <td className="num py-2 text-right font-semibold text-ink">{formatMoney(sum(a))}</td>
                    <td className="num py-2 text-right text-ink-2">
                      {delta === null ? '—' : (
                        <>
                          {formatMoneyChange(delta)}
                          {sum(prev) > 0 ? ` (${formatPercentChange(delta / sum(prev))})` : ''}
                        </>
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={4} className="py-2 text-right text-ink-2">not on this year’s list</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlaceResult({ towns, place, onPick }: { towns: Towns; place: TownPlace; onPick: (id: string) => void }) {
  const latest = towns.years.filter((y) => place.aid[String(y)]).at(-1);
  const latestAid = latest ? place.aid[String(latest)] : undefined;
  const all = latest ? towns.totals[String(latest)] : undefined;
  const related = place.kind === 'town' ? districtsNamedFor(towns, place) : [];
  return (
    <section aria-labelledby="town-title" className="mt-8 border-t-2 border-ink pt-5">
      <p className="eyebrow">{place.kind === 'district' ? 'Regional school district' : 'City or town'}</p>
      <h2 id="town-title" className="mt-2 text-[1.75rem] md:text-[2rem]">{place.name}</h2>
      {latest && latestAid && all ? (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="num text-[1.75rem] leading-none font-semibold text-ink">{formatMoney(sum(latestAid))}</span>
          <span className="text-[0.95rem] text-ink-2">
            budgeted for {fyLong(latest)} · <span className="num">{formatShare(sum(latestAid), all.ch70 + all.ugga)}</span> of
            the aid on this list
          </span>
        </p>
      ) : null}
      <AidTable years={towns.years} aid={(y) => place.aid[String(y)]} caption={`State aid budgeted for ${place.name}, by fiscal year`} />
      {place.kind === 'district' ? (
        <p className="mt-4 max-w-[70ch] text-[0.95rem] text-ink-2">
          A regional school district serves more than one town, so it gets school aid directly and no
          unrestricted aid. Its member towns are listed separately.
        </p>
      ) : (
        <p className="mt-4 max-w-[70ch] text-[0.95rem] text-ink-2">
          {latestAid && latestAid.ch70 === 0
            ? `${place.name} gets no school aid of its own, which usually means its schools belong to a regional district that gets the aid instead. `
            : 'If some of its students attend a regional school district, that district’s school aid is listed separately. '}
          {related.length ? (
            <>
              Districts with {place.name} in the name:{' '}
              {related.map((d, i) => (
                <span key={d.id}>
                  {i ? ', ' : ''}
                  <button type="button" className="link" onClick={() => onPick(d.id)}>
                    {d.name}
                  </button>
                </span>
              ))}
              .
            </>
          ) : null}
        </p>
      )}
    </section>
  );
}

/** Look up the Chapter 70 and unrestricted aid the budget sets for a city, town or school district. */
export default function TownView() {
  const { meta } = useMeta();
  const [params, setParams] = useSearchParams();
  const towns = useAsync(loadTowns, 'towns');
  const [text, setText] = useState('');

  const pick = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('town', id);
    else next.delete('town');
    setParams(next, { replace: true, preventScrollReset: true });
    setText('');
  };

  if (towns.status === 'loading') {
    return (
      <section className="py-8 md:py-12">
        <p className="eyebrow">Your town</p>
        <h1 className="mt-2">What the state sends your city or town</h1>
        <p className="mt-4 text-ink-2">Loading…</p>
      </section>
    );
  }
  if (towns.status === 'error') {
    return (
      <section className="py-8 md:py-12">
        <p className="eyebrow">Your town</p>
        <h1 className="mt-2">What the state sends your city or town</h1>
        <p className="mt-4 max-w-[62ch] text-ink-2">
          {towns.error instanceof DataMissingError
            ? 'The town aid list has not been published yet.'
            : 'The town aid list could not be loaded. Try again in a moment.'}
        </p>
      </section>
    );
  }

  const data = towns.data;
  const first = data.years[0] ?? 0;
  const latest = data.years.at(-1) ?? 0;
  const all = data.totals[String(latest)] ?? { towns: 0, districts: 0, ch70: 0, ugga: 0, townCh70: 0, districtCh70: 0 };
  const budget = meta.totals[String(latest)]?.enacted ?? 0;
  const selected = data.places.find((p) => p.id === normalizePlace(params.get('town') ?? '').toUpperCase()) ?? null;
  const matches = searchPlaces(data, text);

  return (
    <section className="py-8 md:py-12">
      <p className="eyebrow">Your town · {fyShort(first)}–{fyShort(latest)}</p>
      <h1 className="mt-2">What the state sends your city or town</h1>
      <p className="mt-4 max-w-[62ch] text-ink-2">
        Each year’s budget lists two payments for every city, town and regional school district:{' '}
        <span className="text-ink">school aid</span> (Chapter 70) and{' '}
        <span className="text-ink">unrestricted aid</span>, which a community can spend as it chooses. In{' '}
        {fyLong(latest)} they add up to <span className="num font-semibold text-ink">{formatMoney(all.ch70 + all.ugga)}</span>
        {budget ? (
          <>
            , <span className="num">{formatShare(all.ch70 + all.ugga, budget)}</span> of the budget
          </>
        ) : null}
        .
      </p>

      <form className="mt-6" onSubmit={(e) => { e.preventDefault(); if (matches[0]) pick(matches[0].id); }}>
        <label htmlFor="town-search" className="colhead block">
          Find a city, town or school district
        </label>
        <input
          id="town-search"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start typing a name, like Worcester"
          autoComplete="off"
          spellCheck={false}
          className="mt-2 w-full max-w-[26rem] rounded-[6px] border border-rule bg-paper px-3 py-2 text-[1rem] text-ink placeholder:text-ink-2/70 focus:border-brick focus:outline-none"
        />
        <div aria-live="polite">
          {text.trim() && !matches.length ? (
            <p className="mt-2 text-[0.9rem] text-ink-2">No city, town or district on the list matches “{text.trim()}”.</p>
          ) : null}
          {matches.length ? (
            <ul className="mt-2 flex max-w-[44rem] flex-wrap gap-x-2 gap-y-2">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    className="rounded-[6px] border border-rule bg-paper px-2.5 py-1 text-[0.95rem] text-ink hover:border-brick"
                  >
                    {p.name}
                    {p.kind === 'district' ? <span className="text-ink-2"> · school district</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </form>

      {selected ? (
        <PlaceResult towns={data} place={selected} onPick={pick} />
      ) : (
        <section aria-labelledby="statewide-title" className="mt-8 border-t-2 border-ink pt-5">
          <p className="eyebrow">Statewide</p>
          <h2 id="statewide-title" className="mt-2 text-[1.75rem] md:text-[2rem]">
            All cities, towns and regional school districts
          </h2>
          <AidTable years={data.years} aid={(y) => data.totals[String(y)]} caption="State aid budgeted statewide, by fiscal year" />
        </section>
      )}

      <p className="mt-6 max-w-[70ch] text-[0.95rem] text-ink-2">
        <span className="font-semibold text-ink">How to read this.</span> These are the amounts set in each
        year’s original budget, not payments made, and not adjusted for inflation. They are the two largest
        kinds of local aid, but not all of it: charter school reimbursements, road money, library aid and
        school construction grants are separate, and so are the charges the state bills back to a town. The
        state’s <a href={CHERRY_SHEETS} rel="noreferrer">cherry sheets</a> give the full account for each
        community. <Link to="/methodology#aid-to-cities-and-towns">Where these numbers come from</Link>.
      </p>
    </section>
  );
}
