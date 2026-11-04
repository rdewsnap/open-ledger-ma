import type { ChangeRow } from '../../lib/diff';
import { formatPercentChange } from '../../lib/format';

/**
 * "+4.2%", "−0.8%", "new" (A is $0), "—" (no change from $0), or "none yet" when
 * B is $0 in a year still in progress (`open`), where $0 need not mean the program ended.
 */
export function pctText(r: Pick<ChangeRow, 'pct' | 'delta' | 'b'>, open = false): string {
  if (r.pct === null) return r.delta === 0 ? '—' : 'new';
  if (open && r.b === 0) return 'none yet';
  return formatPercentChange(r.pct);
}
