import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { loadTree } from '../lib/data';
import { formatMoney } from '../lib/format';
import { highlightSet, secOf } from '../lib/highlight';
import type { TreeNode } from '../lib/types';
import { useMediaQuery } from '../state/media';
import { useMeta } from '../state/meta';
import { useLedgerParams } from '../state/params';
import { useAsync } from '../state/useAsync';
import { Chevron, Ring } from './Icons';

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Header control for the Highlight lens: a button that opens a searchable list
 * of this year's secretariats (expandable to departments) with checkboxes.
 * The selection lives in the URL (`?hl=`), so it carries across views.
 */
export function HighlightControl() {
  const { year } = useMeta();
  const { hl, setHighlight, measure } = useLedgerParams();
  const [open, setOpen] = useState(false);
  const wide = useMediaQuery('(min-width: 640px)');
  const panelId = useId();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  // The tree is only needed once there is something to count or pick.
  const need = open || hl.length > 0;
  const tree = useAsync(() => (need ? loadTree(year).catch(() => null) : Promise.resolve(null)), need ? `tree:${year}` : 'idle');
  const treeData = tree.status === 'ready' ? tree.data : null;
  const valid = useMemo(() => highlightSet(treeData, hl), [treeData, hl]);
  const count = treeData ? valid.size : 0;

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  // Outside click closes (desktop popover; the phone sheet has its own backdrop).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Focus the filter on open; lock page scroll under the phone sheet.
  useEffect(() => {
    if (!open) return;
    filterRef.current?.focus({ preventScroll: true });
    if (wide) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, wide]);

  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-[6px] border px-3 py-1.5 text-[0.9rem] transition-colors duration-200 ${
          count > 0 ? 'border-gold text-ink' : 'border-rule text-ink-2 hover:border-ink-2 hover:text-ink'
        }`}
      >
        <Ring className={`h-3.5 w-3.5 ${count > 0 ? 'text-gold' : ''}`} filled={count > 0} />
        Highlight
        {count > 0 ? (
          <span>
            <span aria-hidden="true">· </span>
            <span className="num font-semibold">{count}</span>
            <span className="sr-only"> selected</span>
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {!wide ? <div aria-hidden="true" className="fixed inset-0 z-40 bg-ink/25" onClick={() => close(false)} /> : null}
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal={wide ? undefined : true}
            aria-labelledby={titleId}
            onKeyDown={onPanelKey}
            className={
              wide
                ? 'absolute top-full right-0 z-40 mt-2 flex max-h-[min(70vh,34rem)] w-[24rem] flex-col rounded-[8px] border border-rule bg-paper shadow-[0_8px_28px_rgba(28,36,51,0.14)]'
                : 'fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[8px] border-t border-rule bg-paper shadow-[0_-8px_28px_rgba(28,36,51,0.16)]'
            }
          >
            <Panel
              tree={treeData}
              loading={tree.status === 'loading'}
              ids={hl}
              valid={valid}
              measure={measure}
              titleId={titleId}
              filterRef={filterRef}
              onChange={setHighlight}
              onClose={() => close()}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

type PanelProps = {
  tree: TreeNode | null;
  loading: boolean;
  ids: string[];
  valid: ReadonlySet<string>;
  measure: 'actual' | 'enacted';
  titleId: string;
  filterRef: React.RefObject<HTMLInputElement | null>;
  onChange: (ids: string[]) => void;
  onClose: () => void;
};

function Panel({ tree, loading, ids, valid, measure, titleId, filterRef, onChange, onClose }: PanelProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([...valid].filter((id) => id.startsWith('dept:')).map((id) => secOf(id)!)));
  const q = fold(query.trim());

  const secs = useMemo(() => (tree?.children ?? []).filter((s) => s.id.startsWith('sec:')), [tree]);
  const rows = useMemo(() => {
    return secs
      .map((sec) => {
        const depts = (sec.children ?? []).filter((d) => d.id.startsWith('dept:'));
        const secHit = !q || fold(sec.name).includes(q);
        const deptHits = q ? depts.filter((d) => fold(d.name).includes(q)) : depts;
        return { sec, depts: secHit ? depts : deptHits, show: secHit || deptHits.length > 0, deptMatch: Boolean(q) && !secHit && deptHits.length > 0 };
      })
      .filter((r) => r.show);
  }, [secs, q]);

  const has = (id: string) => ids.includes(id);
  const toggleSec = (sec: TreeNode) => {
    if (has(sec.id)) onChange(ids.filter((x) => x !== sec.id));
    // Selecting a secretariat covers its departments; drop them from the list.
    else onChange([...ids.filter((x) => secOf(x) !== sec.id), sec.id]);
  };
  const toggleDept = (dept: TreeNode) => onChange(has(dept.id) ? ids.filter((x) => x !== dept.id) : [...ids, dept.id]);
  const toggleOpen = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="border-b border-rule px-4 pt-3 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <p id={titleId} className="font-semibold text-ink">
            Highlight
          </p>
          <button type="button" onClick={onClose} className="link text-[0.9rem]">
            Done
          </button>
        </div>
        <p className="mt-1 text-[0.875rem] leading-snug text-ink-2">Pick spending areas or departments. They stay highlighted on Flow, Scale and Changes.</p>
        <label className="mt-3 block">
          <span className="sr-only">Filter spending areas and departments</span>
          <input
            ref={filterRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[6px] border border-rule bg-paper px-3 py-1.5 text-[0.95rem] text-ink placeholder:text-ink-2/80 focus:border-brick focus:outline-none"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {loading && !tree ? (
          <p className="px-2 py-6 text-center text-[0.9rem] text-ink-2">Loading…</p>
        ) : !tree ? (
          <p className="px-2 py-6 text-center text-[0.9rem] text-ink-2">The list for this year could not be loaded.</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-[0.9rem] text-ink-2">Nothing matches “{query}”.</p>
        ) : (
          <ul>
            {rows.map(({ sec, depts, deptMatch }) => {
              const secOn = has(sec.id);
              const someDept = depts.some((d) => has(d.id)) || (sec.children ?? []).some((d) => has(d.id));
              const isOpen = deptMatch || expanded.has(sec.id);
              const listId = `hl-${sec.id.replace(/[^A-Za-z0-9]/g, '-')}`;
              return (
                <li key={sec.id}>
                  <div className="flex items-center gap-1 rounded-[6px] hover:bg-paper-2/70">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-2 py-1.5">
                      <Check checked={secOn} indeterminate={!secOn && someDept} onChange={() => toggleSec(sec)} />
                      <span className="min-w-0 flex-1 truncate text-[0.95rem] text-ink">{sec.name}</span>
                      <span className="num shrink-0 text-[0.85rem] text-ink-2">{formatMoney(sec[measure])}</span>
                    </label>
                    {depts.length > 0 ? (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={listId}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} departments in ${sec.name}`}
                        onClick={() => toggleOpen(sec.id)}
                        disabled={deptMatch}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-ink-2 hover:text-ink disabled:opacity-50"
                      >
                        <Chevron open={isOpen} />
                      </button>
                    ) : (
                      <span className="w-8 shrink-0" />
                    )}
                  </div>
                  {isOpen ? (
                    <ul id={listId} className="mb-1 ml-[1.1rem] border-l border-rule pl-2">
                      {depts.map((d) => (
                        <li key={d.id}>
                          <label className={`flex items-center gap-2.5 rounded-[6px] px-2 py-1 ${secOn ? '' : 'cursor-pointer hover:bg-paper-2/70'}`}>
                            <Check checked={secOn || has(d.id)} disabled={secOn} onChange={() => toggleDept(d)} />
                            <span className={`min-w-0 flex-1 truncate text-[0.9rem] ${secOn ? 'text-ink-2' : 'text-ink'}`}>{d.name}</span>
                            <span className="num shrink-0 text-[0.8rem] text-ink-2">{formatMoney(d[measure])}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2.5 text-[0.875rem]">
        <span className="text-ink-2">
          {valid.size === 0 ? 'Nothing highlighted' : <><span className="num text-ink">{valid.size}</span> highlighted</>}
        </span>
        <button type="button" onClick={() => onChange([])} disabled={ids.length === 0} className="link">
          Clear
        </button>
      </div>
    </>
  );
}

function Check({ checked, indeterminate = false, disabled = false, onChange }: { checked: boolean; indeterminate?: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      className="h-4 w-4 shrink-0 accent-gold"
    />
  );
}
