import { accountOf, socrataRowsUrl } from '../lib/data';
import type { ModelNode } from '../lib/flowModel';
import { formatMoney, formatShare } from '../lib/format';
import { useMeta } from '../state/meta';
import { HighlightDot } from './HighlightDot';

type Props = {
  sec: ModelNode;
  programs: ModelNode[];
  year: number;
  measureLabel: string;
  highlighting: boolean;
  onClose: () => void;
};

/** Every program in the focused secretariat, with a link to its source rows. */
export function ProgramTable({ sec, programs, year, measureLabel, highlighting, onClose }: Props) {
  const { meta } = useMeta();
  return (
    <section aria-labelledby="focus-table" className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="focus-table" className="text-[1.6rem]">
          {sec.name} <span className="num ml-1 font-sans text-[1rem] font-normal tracking-normal text-ink-2">{formatMoney(sec.amount)}</span>
        </h2>
        <button type="button" onClick={onClose} className="link text-[0.9rem]">
          Close
        </button>
      </div>
      <table className="mt-3 w-full border-collapse text-[0.95rem]">
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="colhead py-2">Program</th>
            <th scope="col" className="colhead hidden py-2 md:table-cell">Department</th>
            <th scope="col" className="colhead py-2 text-right">{measureLabel}</th>
            <th scope="col" className="colhead py-2 text-right">Share</th>
            <th scope="col" className="colhead py-2 text-right"><span className="sr-only">Source</span></th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => {
            const acct = accountOf(p.id);
            return (
              <tr key={p.id} className="border-b border-rule/70 transition-colors duration-200 hover:bg-paper-2/60">
                <td className="py-1.5 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    {highlighting && p.highlighted ? <HighlightDot title="Highlighted" /> : null}
                    <span className={p.bucket ? 'text-ink-2' : 'text-ink'}>{p.name}</span>
                  </span>
                </td>
                <td className="hidden py-1.5 pr-3 text-ink-2 md:table-cell">{p.dept ?? ''}</td>
                <td className="num py-1.5 text-right text-ink">{formatMoney(p.amount)}</td>
                <td className="num py-1.5 pl-3 text-right text-ink-2">{formatShare(p.amount, sec.amount)}</td>
                <td className="py-1.5 pl-3 text-right text-[0.85rem]">
                  {acct ? (
                    <a href={socrataRowsUrl(meta.sources.spending, year, acct)} aria-label={`rows for ${p.name}, from the source dataset`}>rows</a>
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
