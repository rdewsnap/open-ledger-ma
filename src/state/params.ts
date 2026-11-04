import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { encodeHighlightParam, parseHighlightParam } from '../lib/highlight';
import type { Measure } from '../lib/types';

/**
 * Global view state lives in the URL so it survives navigation and can be shared:
 *   ?fy=2026                    fiscal year
 *   ?measure=enacted            measure (default: spent)
 *   ?hl=sec:EEA,dept:EHS/DMH    highlighted secretariats/departments
 *   ?amt=65000000               an amount to put in context (dollars)
 */
export const KEPT_PARAMS = ['fy', 'measure', 'hl', 'amt'] as const;

/**
 * URLSearchParams escapes ":", "/" and ",", which are legal in a query string.
 * Unescape them so `?hl=sec:EEA,dept:EHS/DMH` stays readable when shared.
 */
export function prettySearch(params: URLSearchParams): string {
  const s = params.toString().replace(/%3A/gi, ':').replace(/%2F/gi, '/').replace(/%2C/gi, ',');
  return s ? `?${s}` : '';
}

export function useLedgerParams() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const fyRaw = Number(params.get('fy'));
  const fy = Number.isInteger(fyRaw) && fyRaw > 2000 ? fyRaw : null;
  const measure: Measure = params.get('measure') === 'enacted' ? 'enacted' : 'actual';
  const hlRaw = params.get('hl');
  const hl = useMemo(() => parseHighlightParam(hlRaw), [hlRaw]);
  const amtRaw = Number(params.get('amt'));
  const amount = Number.isFinite(amtRaw) && amtRaw > 0 ? amtRaw : null;

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(location.search);
      if (value === null) next.delete(key);
      else next.set(key, value);
      navigate(
        { pathname: location.pathname, search: prettySearch(next), hash: location.hash },
        { replace: true, preventScrollReset: true, state: location.state },
      );
    },
    [location, navigate],
  );

  return {
    fy,
    measure,
    /** Highlight ids from the URL, unvalidated against any year's tree. */
    hl,
    /** Dollar amount to put in context, or null. */
    amount,
    setAmount: (value: number | null) => update('amt', value === null ? null : String(Math.round(value))),
    setYear: (year: number) => update('fy', String(year)),
    setMeasure: (m: Measure) => update('measure', m === 'enacted' ? 'enacted' : null),
    setHighlight: (ids: readonly string[]) => update('hl', encodeHighlightParam(ids)),
    /** Search string to carry across nav links. */
    carry: () => {
      const next = new URLSearchParams();
      for (const k of KEPT_PARAMS) {
        const v = params.get(k);
        if (v) next.set(k, v);
      }
      return prettySearch(next);
    },
  };
}
