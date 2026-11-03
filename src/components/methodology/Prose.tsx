import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SITE } from '../../lib/site';
import { slugify, textOf } from './text';

function repoHref(href: string): string | null {
  const gh: string = SITE.github;
  if (!gh) return null;
  const path = href.replace(/^\.?\//, '').replace(/^\/+/, '');
  const isDir = path.endsWith('/');
  return `${gh.replace(/\/$/, '')}/${isDir ? 'tree' : 'blob'}/main/${path.replace(/\/$/, '')}`;
}

const components: Components = {
  h2: ({ children }) => (
    <h2 id={slugify(textOf(children))} className="mt-12 scroll-mt-24 border-t border-rule pt-6 text-[1.5rem] md:text-[1.75rem]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(textOf(children))} className="mt-8 scroll-mt-24 text-[1.15rem] md:text-[1.25rem]">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="mt-4 text-[1rem] leading-[1.7]">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-ink-2">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-5 marker:text-ink-2">{children}</ol>,
  li: ({ children }) => <li className="leading-[1.65]">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic text-ink-2">{children}</em>,
  blockquote: ({ children }) => <blockquote className="mt-4 border-l-2 border-clay pl-4 text-ink-2">{children}</blockquote>,
  hr: () => <hr className="my-8 border-rule" />,
  code: ({ children, className }) => (
    <code className={`${className ?? ''} num rounded-[6px] bg-paper-2 px-1 py-0.5 text-[0.85em] break-words`}>{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-[12px] border border-rule bg-paper-2 p-4 text-[0.85rem] [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  a: ({ href: rawHref, children }) => {
    const href: string = rawHref ?? '';
    const cls = 'text-clay underline decoration-clay/40 underline-offset-2 hover:decoration-clay';
    if (/^https?:\/\//.test(href)) {
      return (
        <a href={href} className={cls} rel="noreferrer">
          {children}
        </a>
      );
    }
    if (href.startsWith('#')) {
      return (
        <a href={href} className={cls}>
          {children}
        </a>
      );
    }
    const target = repoHref(href);
    return target ? (
      <a href={target} className={cls} rel="noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    );
  },
  table: ({ children }) => (
    <div className="mt-5 overflow-x-auto rounded-[12px] border border-rule" tabIndex={0} role="region" aria-label="Table">
      <table className="w-full min-w-[34rem] border-collapse text-[0.85rem]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-paper-2 text-left">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-rule last:border-b-0">{children}</tr>,
  th: ({ children, style }) => (
    <th scope="col" style={style} className="px-3 py-2 align-bottom text-[0.72rem] font-semibold tracking-wide text-ink-2 uppercase">
      {children}
    </th>
  ),
  td: ({ children, style }) => {
    const right = style?.textAlign === 'right';
    return (
      <td style={style} className={`px-3 py-2 align-top ${right ? 'num text-right whitespace-nowrap' : ''}`}>
        {children}
      </td>
    );
  },
};

export function Prose({ source }: { source: string }) {
  return (
    <div className="max-w-[72ch]">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </Markdown>
    </div>
  );
}
