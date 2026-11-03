import type { ScaleNode } from '../../lib/treemap';

/** "Massachusetts state budget › Health & Human Services › MassHealth". Ancestors are buttons. */
export function Breadcrumb({ chain, onPick }: { chain: ScaleNode[]; onPick: (index: number) => void }) {
  return (
    <nav aria-label="Zoom level" className="min-w-0">
      <ol className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.95rem]">
        {chain.map((n, i) => {
          const last = i === chain.length - 1;
          return (
            <li key={n.data.id} className="flex min-w-0 items-baseline gap-x-1.5">
              {i > 0 ? (
                <span aria-hidden="true" className="text-ink-2/70">
                  ›
                </span>
              ) : null}
              {last ? (
                <span aria-current="location" className="font-semibold text-ink">
                  {n.data.name}
                </span>
              ) : (
                <button type="button" onClick={() => onPick(i)} className="text-clay underline decoration-1 underline-offset-[3px] hover:text-ink">
                  {n.data.name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
