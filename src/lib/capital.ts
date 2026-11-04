import type { Meta } from './types';

/**
 * Capital (bond-funded) payments for a secretariat or department id in one year:
 * 0 when the year is published but the area has none, null when the year (or the
 * id's level) has no capital figure.
 */
export function capitalFor(meta: Meta, year: number, id: string): number | null {
  const y = meta.capital?.[String(year)];
  if (!y) return null;
  if (id.startsWith('sec:')) return y.bySec[id] ?? 0;
  if (id.startsWith('dept:')) return y.byDept[id] ?? 0;
  return null;
}
