import type { ChangeRow } from '../../lib/diff';
import { formatPercentChange } from '../../lib/format';

/** "+4.2%", "−0.8%", "new" (A is $0), "—" (no change from $0). */
export function pctText(r: Pick<ChangeRow, 'pct' | 'delta'>): string {
  if (r.pct === null) return r.delta === 0 ? '—' : 'new';
  return formatPercentChange(r.pct);
}
