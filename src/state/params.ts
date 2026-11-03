import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import type { Measure } from '../lib/types';

/**
 * Global view state lives in the URL so it survives navigation and can be shared:
 *   ?overlay=1     Conservation lines on
 *   ?fy=2026       fiscal year
 *   ?measure=enacted   Flow measure (default: spent)
 */
export const KEPT_PARAMS = ['overlay', 'fy', 'measure'] as const;

export function useLedgerParams() {
  const [params, setParams] = useSearchParams();

  const overlay = params.get('overlay') === '1';
  const fyRaw = Number(params.get('fy'));
  const fy = Number.isInteger(fyRaw) && fyRaw > 2000 ? fyRaw : null;
  const measure: Measure = params.get('measure') === 'enacted' ? 'enacted' : 'actual';

  const update = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setParams],
  );

  return {
    overlay,
    fy,
    measure,
    setOverlay: (on: boolean) => update('overlay', on ? '1' : null),
    setYear: (year: number) => update('fy', String(year)),
    setMeasure: (m: Measure) => update('measure', m === 'enacted' ? 'enacted' : null),
    /** Search string to carry across nav links. */
    carry: () => {
      const next = new URLSearchParams();
      for (const k of KEPT_PARAMS) {
        const v = params.get(k);
        if (v) next.set(k, v);
      }
      const s = next.toString();
      return s ? `?${s}` : '';
    },
  };
}
