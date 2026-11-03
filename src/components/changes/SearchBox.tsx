import { useEffect, useRef, useState } from 'react';

type Props = {
  onChange: (query: string) => void;
  shown: number;
  total: number;
  delay?: number;
};

/** Debounced program search. "/" focuses it; Esc clears it. */
export function SearchBox({ onChange, shown, total, delay = 160 }: Props) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => onChange(value.trim()), delay);
    return () => window.clearTimeout(t);
  }, [value, delay, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = shown !== total;
  return (
    <div className="flex w-full min-w-0 items-center gap-x-3 sm:w-auto sm:flex-1">
      <label className="relative block min-w-0 flex-1 sm:max-w-[22rem]">
        <span className="sr-only">Search programs, departments and secretariats</span>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-2" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) {
              e.preventDefault();
              setValue('');
              onChange('');
            } else if (e.key === 'Enter') {
              onChange(value.trim());
            }
          }}
          placeholder="Search programs, departments…"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-[6px] border border-rule bg-paper py-1.5 pr-9 pl-8 text-[0.9rem] text-ink placeholder:text-ink-2/70 focus:border-clay focus:outline-none"
        />
        <kbd aria-hidden="true" className="code pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-rule px-1 text-[0.68rem] text-ink-2 sm:block">
          /
        </kbd>
      </label>
      <p aria-live="polite" className="text-[0.82rem] whitespace-nowrap text-ink-2">
        {filtered ? (
          <>
            <span className="num text-ink">{shown}</span> of <span className="num">{total}</span> programs
          </>
        ) : (
          <>
            <span className="num text-ink">{total}</span> programs
          </>
        )}
      </p>
    </div>
  );
}
