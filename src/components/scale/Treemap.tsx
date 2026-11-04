import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { COLORS } from '../../lib/flowModel';
import { formatMoney, formatShare } from '../../lib/format';
import {
  cellFill,
  fitLabel,
  isHighlighted,
  layoutTreemap,
  LABEL_LIGHT,
  textOn,
  type Cell,
  type HighlightSet,
  type LabelFit,
  type ScaleNode,
} from '../../lib/treemap';
import { HighlightDot } from '../HighlightDot';
import { useMeasurer } from './measure';
import { ScaleTooltip, type ScaleTip } from './ScaleTooltip';

type Props = {
  focus: ScaleNode;
  width: number;
  height: number;
  /** Secretariat id → base color. */
  colors: Map<string, string>;
  highlight: HighlightSet;
  /** The whole budget for the current measure (for "% of total"). */
  total: number;
  totalLabel: string;
  onZoom: (id: string) => void;
  label: string;
};

const MARKER_W = 13;
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

type Paint = { fill: string; opacity: number; text: string; hl: boolean };

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Zoomable treemap of the focused node's children (and their children). */
export function Treemap({ focus, width, height, colors, highlight, total, totalLabel, onZoom, label }: Props) {
  const focusId = focus.data.id;
  const measure = useMeasurer();
  const cells = useMemo(() => layoutTreemap(focus, width, height), [focus, width, height]);
  const depth1 = useMemo(() => cells.filter((c) => c.depth === 1), [cells]);
  const anyHighlight = highlight.size > 0;
  // Inside a highlighted node everything is highlighted: color says so, no marker needed.
  const markers = anyHighlight && !isHighlighted(focus, highlight);

  const paint = useMemo(() => {
    const map = new Map<string, Paint>();
    for (const c of cells) {
      const hl = isHighlighted(c.node, highlight);
      const base = hl ? COLORS.gold : (colors.get(c.node.data.sec) ?? COLORS.blue3);
      const fill = cellFill(base, c.node.depth);
      map.set(c.id, { fill, opacity: anyHighlight && !hl ? 0.45 : 1, text: textOn(fill), hl });
    }
    return map;
  }, [cells, colors, highlight, anyHighlight]);

  const labels = useMemo(() => {
    const map = new Map<string, LabelFit>();
    for (const c of cells) {
      const amount = formatMoney(c.node.value ?? 0);
      const lead = markers && paint.get(c.id)?.hl ? MARKER_W : 0;
      const w = c.x1 - c.x0;
      // Groups carry a one-line label in their header strip.
      const fit = c.group ? (c.header > 2 ? fitLabel(w, 24, c.node.data.name, amount, measure, lead) : { mode: 'none' as const }) : fitLabel(w, c.y1 - c.y0, c.node.data.name, amount, measure, lead);
      map.set(c.id, fit);
    }
    return map;
  }, [cells, measure, paint, markers]);

  // The node we were on before this one: after zooming out (Esc, breadcrumb or
  // the browser's back button), the roving focus lands back on it.
  const [seen, setSeen] = useState<{ cur: string; prev: string | null }>({ cur: focusId, prev: null });
  if (seen.cur !== focusId) setSeen({ cur: focusId, prev: seen.cur });
  const returnTo = seen.cur === focusId ? seen.prev : null;

  // Roving tabindex over the focused node's children.
  const [activeState, setActiveState] = useState<{ key: string; id: string | null }>({ key: focusId, id: null });
  const chosen = activeState.key === focusId ? activeState.id : null;
  const activeId =
    chosen && depth1.some((c) => c.id === chosen)
      ? chosen
      : returnTo && depth1.some((c) => c.id === returnTo)
        ? returnTo
        : (depth1[0]?.id ?? null);
  const setActive = (id: string) => setActiveState({ key: focusId, id });

  // Tooltip: follows the pointer, or anchors to a keyboard-focused / tapped cell.
  const [tipState, setTipState] = useState<{ key: string; id: string; x: number; y: number; pinned: boolean } | null>(null);
  const tip = tipState && tipState.key === focusId ? tipState : null;

  const kbMode = useRef(false);
  const layerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const prev = useRef<{ id: string; cells: Cell[]; w: number; h: number } | null>(null);

  // Zoom animation (FLIP): the new view grows out of (or shrinks into) the cell it came from.
  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = { id: focusId, cells, w: width, h: height };
    const layer = layerRef.current;
    if (!p || p.id === focusId || !layer) return;
    if (kbMode.current) {
      const target = rootRef.current?.querySelector<HTMLElement>(`[data-cell="${CSS.escape(activeId ?? '')}"]`);
      target?.focus({ preventScroll: true });
    }
    if (prefersReducedMotion() || typeof layer.animate !== 'function') return;
    const W = width;
    const H = height;
    let from: string | null = null;
    const grown = p.cells.find((c) => c.id === focusId);
    const shrunk = cells.find((c) => c.id === p.id);
    if (grown && p.w === W && p.h === H) {
      const w = Math.max(1, grown.x1 - grown.x0);
      const h = Math.max(1, grown.y1 - grown.y0);
      from = `translate(${grown.x0}px, ${grown.y0}px) scale(${w / W}, ${h / H})`;
    } else if (shrunk) {
      const w = Math.max(1, shrunk.x1 - shrunk.x0);
      const h = Math.max(1, shrunk.y1 - shrunk.y0);
      from = `scale(${W / w}, ${H / h}) translate(${-shrunk.x0}px, ${-shrunk.y0}px)`;
    }
    const frames = from
      ? [{ transform: from, opacity: 0.55 }, { transform: 'none', opacity: 1 }]
      : [{ opacity: 0 }, { opacity: 1 }];
    const anim = layer.animate(frames, { duration: 250, easing: EASE });
    return () => anim.cancel();
    // activeId is read for focus restore only when the focused node changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, cells, width, height]);

  const tipFor = (c: Cell): ScaleTip => {
    const n = c.node;
    const chain = n.ancestors().reverse();
    const path = chain
      .slice(1, -1)
      .map((a) => a.data.name)
      .join(' › ');
    const parent = n.parent;
    const zoomable = Boolean(n.children?.length);
    return {
      name: n.data.name,
      path,
      amount: n.value ?? 0,
      total,
      totalLabel,
      parentAmount: parent?.value ?? total,
      parentName: parent && parent.depth > 0 ? parent.data.name : '',
      highlighted: paint.get(c.id)?.hl ?? false,
      hint: zoomable
        ? 'Click or press Enter to zoom in.'
        : c.depth === 2
          ? 'Click to zoom in.'
          : n.data.accounts
            ? `Adds together ${n.data.accounts} smaller line item${n.data.accounts === 1 ? '' : 's'} in this department.`
            : undefined,
    };
  };

  const local = (e: MouseEvent) => {
    const r = rootRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };
  const anchor = (c: Cell) => ({ x: Math.min(c.x1 - 8, c.x0 + (c.x1 - c.x0) / 2), y: c.y0 + Math.min((c.y1 - c.y0) / 2, 28) });

  /** What a click/Enter on a cell does. */
  const activate = (c: Cell) => {
    if (c.node.children?.length) onZoom(c.id);
    else if (c.depth === 2 && c.node.parent) onZoom(c.node.parent.data.id);
    else setTipState((t) => (t && t.key === focusId && t.id === c.id && t.pinned ? null : { key: focusId, id: c.id, ...anchor(c), pinned: true }));
  };

  const move = (from: Cell, key: string): Cell | undefined => {
    const i = depth1.indexOf(from);
    if (key === 'Home') return depth1[0];
    if (key === 'End') return depth1.at(-1);
    const cx = (c: Cell) => (c.x0 + c.x1) / 2;
    const cy = (c: Cell) => (c.y0 + c.y1) / 2;
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[key];
    if (!dir) return undefined;
    let best: Cell | undefined;
    let bestScore = Infinity;
    for (const c of depth1) {
      if (c === from) continue;
      const dx = cx(c) - cx(from);
      const dy = cy(c) - cy(from);
      const along = dx * dir[0]! + dy * dir[1]!;
      if (along <= 1) continue;
      const across = Math.abs(dir[0] ? dy : dx);
      const score = along + across * 2;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    // No neighbour that way: step through value order instead.
    return best ?? (key === 'ArrowRight' || key === 'ArrowDown' ? depth1[i + 1] : depth1[i - 1]);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>, c: Cell) => {
    kbMode.current = true;
    if (e.key === 'Escape') return; // the view zooms out
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(c);
      return;
    }
    const next = move(c, e.key);
    if (next) {
      e.preventDefault();
      setActive(next.id);
      rootRef.current?.querySelector<HTMLElement>(`[data-cell="${CSS.escape(next.id)}"]`)?.focus();
    }
  };

  const tipCell = tip ? cells.find((c) => c.id === tip.id) : undefined;

  return (
    <div
      ref={rootRef}
      className="relative select-none"
      style={{ height }}
      onPointerDown={() => {
        kbMode.current = false;
      }}
      onMouseLeave={() => setTipState((t) => (t?.pinned ? t : null))}
    >
      <div role="group" aria-label={label} className="absolute inset-0 overflow-hidden rounded-[6px]">
        <div ref={layerRef} className="absolute inset-0" style={{ transformOrigin: '0 0' }}>
          {cells.map((c) => {
            const p = paint.get(c.id)!;
            const fit = labels.get(c.id) ?? { mode: 'none' };
            const w = c.x1 - c.x0;
            const h = c.y1 - c.y0;
            const isTop = c.depth === 1;
            const zoomable = Boolean(c.node.children?.length);
            const amount = formatMoney(c.node.value ?? 0);
            const share = formatShare(c.node.value ?? 0, focus.value ?? 0);
            const aria = `${c.node.data.name}, ${amount}, ${share} of ${focus.depth === 0 ? 'the total' : focus.data.name}${p.hl ? ', highlighted' : ''}${zoomable ? '. Press Enter to zoom in.' : ''}`;
            return (
              <div
                key={c.id}
                data-cell={isTop ? c.id : undefined}
                role={isTop ? (zoomable ? 'button' : 'img') : undefined}
                aria-label={isTop ? aria : undefined}
                aria-hidden={isTop ? undefined : true}
                aria-describedby={isTop && tip?.id === c.id ? 'scale-tip' : undefined}
                tabIndex={isTop ? (c.id === activeId ? 0 : -1) : undefined}
                className="absolute rounded-[4px] outline-none transition-[opacity,background-color,box-shadow] duration-200 ease-out hover:shadow-[inset_0_0_0_1.5px_rgba(28,36,51,0.55)] focus-visible:shadow-[inset_0_0_0_2px_#A8322D,inset_0_0_0_3.5px_#FAFAF7]"
                style={{
                  left: c.x0,
                  top: c.y0,
                  width: Math.max(0, w),
                  height: Math.max(0, h),
                  background: p.fill,
                  opacity: p.opacity,
                  cursor: zoomable || !isTop ? 'zoom-in' : 'default',
                }}
                onClick={() => activate(c)}
                onKeyDown={isTop ? (e) => onKey(e, c) : undefined}
                onFocus={(e) => {
                  if (!isTop) return;
                  setActive(c.id);
                  if (e.currentTarget.matches(':focus-visible')) setTipState({ key: focusId, id: c.id, ...anchor(c), pinned: false });
                }}
                onBlur={() => setTipState((t) => (t?.pinned ? t : null))}
                onMouseEnter={(e) => setTipState((t) => (t?.pinned ? t : { key: focusId, id: c.id, ...local(e), pinned: false }))}
                onMouseMove={(e) => {
                  const pt = local(e);
                  setTipState((t) => (t && !t.pinned ? { ...t, id: c.id, ...pt } : t));
                }}
              >
                {fit.mode !== 'none' ? <CellLabel fit={fit} color={p.text} marker={markers && p.hl} header={c.group} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      {tip && tipCell ? <ScaleTooltip id="scale-tip" tip={tipFor(tipCell)} x={tip.x} y={tip.y} width={width} height={height} /> : null}
    </div>
  );
}

function CellLabel({ fit, color, marker, header }: { fit: Exclude<LabelFit, { mode: 'none' }>; color: string; marker: boolean; header: boolean }) {
  const onDark = color === LABEL_LIGHT;
  const dot = marker ? (
    <span className="mr-[5px] inline-flex align-[1px]">
      <HighlightDot onDark={onDark} />
    </span>
  ) : null;
  return (
    <div className="pointer-events-none absolute top-[4px] right-[6px] left-[6px] overflow-hidden whitespace-nowrap" style={{ color }}>
      {fit.mode === 'full' ? (
        <>
          <div className="text-[12.5px] leading-[15px] font-semibold">
            {dot}
            {fit.name}
          </div>
          <div className="num text-[11px] leading-[14px]">{fit.amount}</div>
        </>
      ) : (
        <div className="text-[11px] leading-[14px] font-medium" data-header={header || undefined}>
          {dot}
          {fit.name}
          {fit.amount ? <span className="num ml-[6px] font-normal">{fit.amount}</span> : null}
        </div>
      )}
    </div>
  );
}
