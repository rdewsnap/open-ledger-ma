import type { Meta } from './types';

/** Massachusetts residents for a fiscal year (Census estimate); null when not published. */
export function residentsFor(meta: Meta, year: number): number | null {
  return meta.population?.byYear[String(year)]?.residents ?? null;
}
