import type { ChangeRow } from '../../lib/diff';
import { formatMoney, formatMoneyChange } from '../../lib/format';
import { DiffBar } from './DiffBar';
import { pctText } from './rowText';
import { HighlightDot } from '../HighlightDot';
import { BucketTag } from './Tags';

type Props = {
  rows: ChangeRow[];
  max: number;
  highlighting: boolean;
  rowsHref: (account: string) => string;
};

/** Phone: one line per program, then "$A → $B · +$X (+Y%)", then a thin bar. */
export function ChangeList({ rows, max, highlighting, rowsHref }: Props) {
  return (
    <ul className="mt-3 border-t border-rule">
      {rows.map((r) => (
        <li key={r.id} className={`border-b border-rule/70 py-2.5 ${highlighting && r.highlighted ? 'bg-gold/[0.06]' : ''}`}>
          <p className="flex items-center gap-1.5 text-[1rem] leading-snug">
            {highlighting && r.highlighted ? <HighlightDot title="Highlighted" /> : null}
            {r.account ? (
              <a href={rowsHref(r.account)} className="min-w-0 truncate">
                {r.name}
              </a>
            ) : (
              <span className="min-w-0 truncate text-ink-2">{r.name}</span>
            )}
            {r.bucket ? <BucketTag accounts={r.accounts} /> : null}
          </p>
          <p className="num mt-0.5 text-[0.875rem] text-ink-2">
            {formatMoney(r.a)} → {formatMoney(r.b)} <span aria-hidden="true">·</span>{' '}
            <span className="text-ink">{formatMoneyChange(r.delta)}</span> ({pctText(r)})
          </p>
          <div className="mt-1.5">
            <DiffBar delta={r.delta} max={max} highlighted={r.highlighted} highlighting={highlighting} thin />
          </div>
        </li>
      ))}
    </ul>
  );
}
