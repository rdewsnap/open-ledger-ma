import { createContext, useContext, type ReactNode } from 'react';
import { defaultYear, loadMeta } from '../lib/data';
import type { Meta } from '../lib/types';
import { useAsync } from './useAsync';
import { useLedgerParams } from './params';

type Partial = NonNullable<Meta['partial']>[string];
type MetaCtx = { meta: Meta; year: number; partial: Partial | null };

const Ctx = createContext<MetaCtx | null>(null);

export function MetaProvider({ children, fallback }: { children: ReactNode; fallback: (s: 'loading' | Error) => ReactNode }) {
  const state = useAsync(loadMeta, 'meta');
  const { fy } = useLedgerParams();
  if (state.status === 'loading') return <>{fallback('loading')}</>;
  if (state.status === 'error') return <>{fallback(state.error)}</>;
  const meta = state.data;
  const year = fy !== null && meta.years.includes(fy) ? fy : defaultYear(meta);
  const partial = meta.partial?.[String(year)] ?? null;
  return <Ctx.Provider value={{ meta, year, partial }}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMeta(): MetaCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMeta outside MetaProvider');
  return v;
}
