import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import source from '../../../METHODOLOGY.md?raw';
import { Prose } from './Prose';
import { slugify } from './text';
import { SourceStrip } from '../SourceStrip';

/** Split the leading "# Title" and first paragraph (the dek) from the body. */
function parse(md: string) {
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const line = (n: number) => lines[n] ?? '';
  let i = 0;
  while (i < lines.length && !line(i).trim()) i++;
  if (line(i).startsWith('# ')) i++;
  while (i < lines.length && !line(i).trim()) i++;
  const para: string[] = [];
  while (i < lines.length && line(i).trim()) para.push(line(i++));
  const dek = para.join(' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '');
  const body = lines.slice(i).join('\n');
  const toc = [...body.matchAll(/^## (.+)$/gm)].map((m) => {
    const title = (m[1] ?? '').replace(/[`*_]/g, '');
    return { title, id: slugify(title) };
  });
  return { dek, body, toc };
}

export default function MethodologyPage() {
  const { dek, body, toc } = useMemo(() => parse(source), []);
  // The page is lazy-loaded, so the browser's own jump to #anchor misses; do it here.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);
  return (
    <section className="py-8 md:py-12">
      <p className="eyebrow">Methodology</p>
      <h1 className="mt-2">Where every number comes from</h1>
      <p className="mt-4 max-w-[62ch] text-ink-2">{dek}</p>
      <div className="mt-8 grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-6">
            <p className="colhead">On this page</p>
            <ol className="mt-3 space-y-2 border-l border-rule pl-3 text-[0.85rem] leading-snug">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="text-ink-2 no-underline hover:text-brick-text hover:underline">
                    {t.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
        <article className="min-w-0">
          <Prose source={body} />
        </article>
      </div>
      <SourceStrip showRevenue />
    </section>
  );
}
