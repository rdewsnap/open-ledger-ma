import type { ChangeRow, SortDir, SortKey } from '../../lib/diff';
import { formatMoney, formatMoneyChange } from '../../lib/format';
import { DiffBar } from './DiffBar';
import { pctText } from './rowText';
import { HighlightDot } from '../HighlightDot';
import { BucketTag } from './Tags';
import { Link } from 'react-router';

type Props = {
  rows: ChangeRow[];
  max: number;
  labelA: string;
  labelB: string;
  sortKey: SortKey;
  sortDir: SortDir;
  highlighting: boolean;
  rowsHref: (account: string) => string;
};

const ariaSort = (active: boolean, dir: SortDir) => (active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined);

/** Desktop: one row per program with an inline diverging bar. */
export function ChangeTable({ rows, max, labelA, labelB, sortKey, sortDir, highlighting, rowsHref }: Props) {
  return (
    <table className="mt-3 w-full table-fixed border-collapse text-[0.95rem]">
      <colgroup>
        <col />
        <col className="w-[5.5rem]" />
        <col className="w-[5.5rem]" />
        <col className="w-[6rem]" />
        <col className="w-[5rem]" />
        <col className="w-[22%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-rule text-left">
          <th scope="col" aria-sort={ariaSort(sortKey === 'name', sortDir)} className="colhead py-2">Program</th>
          <th scope="col" className="colhead py-2 text-right">{labelA}</th>
          <th scope="col" className="colhead py-2 text-right">{labelB}</th>
          <th scope="col" aria-sort={ariaSort(sortKey === 'abs', sortDir)} className="colhead py-2 text-right">Change</th>
          <th scope="col" aria-sort={ariaSort(sortKey === 'pct', sortDir)} className="colhead py-2 text-right">%</th>
          <th scope="col" className="py-2 pl-4"><span className="sr-only">Change, as a bar</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={`border-b border-rule/70 align-top transition-colors duration-200 hover:bg-paper-2/60 ${highlighting && r.highlighted ? 'bg-gold/[0.06]' : ''}`}>
            <td className="py-2 pr-3">
              <span className="flex items-center gap-1.5">
                {highlighting && r.highlighted ? <HighlightDot title="Highlighted" /> : null}
                {r.account ? (
                  <Link to={rowsHref(r.account)} className="truncate" title={`${r.name}: source rows for both years`}>
                    {r.name}
                  </Link>
                ) : (
                  <span className="truncate text-ink-2">{r.name}</span>
                )}
                {r.bucket ? <BucketTag accounts={r.accounts} /> : null}
              </span>
              <span className="block truncate text-[0.85rem] text-ink-2">{r.path}</span>
            </td>
            <td className="num py-2 text-right text-ink-2">{formatMoney(r.a)}</td>
            <td className="num py-2 text-right text-ink">{formatMoney(r.b)}</td>
            <td className="num py-2 text-right text-ink">{formatMoneyChange(r.delta)}</td>
            <td className="num py-2 text-right text-ink-2">{pctText(r)}</td>
            <td className="py-2 pl-4 align-middle">
              <DiffBar delta={r.delta} max={max} highlighted={r.highlighted} highlighting={highlighting} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
