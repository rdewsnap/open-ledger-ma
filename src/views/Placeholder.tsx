import { SourceStrip } from '../components/SourceStrip';
import { fyLong } from '../lib/format';
import { useMeta } from '../state/meta';

export function Placeholder({ eyebrow, title, dek }: { eyebrow: string; title: string; dek: string }) {
  const { year } = useMeta();
  return (
    <section className="py-8 md:py-12">
      <p className="eyebrow">{eyebrow} · {fyLong(year)}</p>
      <h1 className="mt-2">{title}</h1>
      <p className="mt-4 max-w-[62ch] text-ink-2">{dek}</p>
      <div className="mt-8 grid h-64 place-items-center rounded-[8px] border border-dashed border-rule text-[0.9rem] text-ink-2">
        This view is being built.
      </div>
      <SourceStrip />
    </section>
  );
}
