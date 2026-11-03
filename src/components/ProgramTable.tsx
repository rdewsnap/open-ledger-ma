import { accountOf, socrataRowsUrl } from '../lib/data';
import type { ModelNode } from '../lib/flowModel';
import { formatMoney, formatShare } from '../lib/format';
import { useMeta } from '../state/meta';
import { Leaf } from './Icons';

type Props = {
  sec: ModelNode;
  programs: ModelNode[];
  year: number;
  measureLabel: string;
  overlay: boolean;
  onClose: () => void;
};

/** Every program in the focused secretariat, with a link to its source rows. */
export function ProgramTable({ sec, programs, year, measureLabel, overlay, onClose }: Props) {
  const { meta } = useMeta();
  return (
    <section aria-labelledby="focus-table" className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="focus-table" className="text-[1.35rem]">
          {sec.name} <span className="num ml-1 text-[0.95rem] font-normal text-ink-2">{formatMoney(sec.amount)}</span>
        </h2>
        <button type="button" onClick={onClose} className="text-[0.85rem] text-ink-2 hover:text-clay">
          Close
        </button>
      </div>
      <table className="mt-3 w-full border-collapse text-[0.9rem]">
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="eyebrow py-2 font-semibold">Program</th>
            <th scope="col" className="eyebrow hidden py-2 font-semibold md:table-cell">Department</th>
            <th scope="col" className="eyebrow py-2 text-right font-semibold">{measureLabel}</th>
            <th scope="col" className="eyebrow py-2 text-right font-semibold">Share</th>
            <th scope="col" className="eyebrow py-2 text-right font-semibold"><span className="sr-only">Source</span></th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => {
            const acct = accountOf(p.id);
            return (
              <tr key={p.id} className="border-b border-rule/70 transition-colors duration-200 hover:bg-paper-2/60">
                <td className="py-1.5 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    {overlay && p.conservation ? <Leaf className="h-3 w-3 shrink-0 text-moss" title="Conservation line" /> : null}
                    <span className={p.bucket ? 'text-ink-2' : 'text-ink'}>{p.name}</span>
                  </span>
                </td>
                <td className="hidden py-1.5 pr-3 text-ink-2 md:table-cell">{p.dept ?? ''}</td>
                <td className="num py-1.5 text-right text-ink">{formatMoney(p.amount)}</td>
                <td className="num py-1.5 pl-3 text-right text-ink-2">{formatShare(p.amount, sec.amount)}</td>
                <td className="py-1.5 pl-3 text-right text-[0.8rem]">
                  {acct ? (
                    <a href={socrataRowsUrl(meta.sources.spending, year, acct)} aria-label={`Source rows for ${p.name}`}>rows</a>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
