import { sankey, type SankeyLink, type SankeyNode } from 'd3-sankey';
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { formatMoney, formatShare } from '../lib/format';
import { COLORS, type FlowModel, type ModelLink, type ModelNode } from '../lib/flowModel';
import { Tooltip, type TipData } from './Tooltip';

type N = SankeyNode<ModelNode, ModelLink>;
type L = SankeyLink<ModelNode, ModelLink>;

const COLUMN: Record<ModelNode['kind'], number> = { revenue: 0, secretariat: 1, program: 2 };
const LEAF_PATH =
  'M13.5 2.5C7 2.5 3 5.5 3 10c0 1.4.5 2.5 1.2 3.3C5.8 9.5 8.3 7.6 11 6.6 8.7 8 6.6 10.2 5.3 13.9c.7.4 1.6.6 2.5.6 4.3 0 5.7-4.8 5.7-12Z';

/** Filled ribbon from band [a0,a1] at x0 to band [b0,b1] at x1 (ends may differ in width). */
function ribbon(x0: number, a0: number, a1: number, x1: number, b0: number, b1: number) {
  const xm = (x0 + x1) / 2;
  return `M${x0},${a0}C${xm},${a0} ${xm},${b0} ${x1},${b0}L${x1},${b1}C${xm},${b1} ${xm},${a1} ${x0},${a1}Z`;
}

const touches = (l: L, id: string) => (l.source as N).id === id || (l.target as N).id === id;

type Props = {
  model: FlowModel;
  width: number;
  overlay: boolean;
  focus: string | null;
  onFocus: (id: string | null) => void;
  spendWord: string; // "spending" / "enacted spending"
  label: string; // aria label for the chart
};

function truncate(s: string, px: number, charPx: number) {
  const max = Math.max(4, Math.floor(px / charPx));
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

export function SankeyChart({ model, width, overlay, focus, onFocus, spendWord, label }: Props) {
  const [hover, setHover] = useState<{ kind: 'node' | 'link'; id: string } | null>(null);
  const [tip, setTip] = useState<{ data: TipData; x: number; y: number } | null>(null);
  const [kbFocus, setKbFocus] = useState<string | null>(null);

  const narrow = width < 960;
  const labelL = narrow ? 132 : 168;
  const labelR = narrow ? 178 : 248;
  const top = 36;

  const layout = useMemo(() => {
    const counts = [0, 0, 0];
    for (const n of model.nodes) counts[COLUMN[n.kind]]! += 1;
    const maxCount = Math.max(...counts);
    const height = Math.min(980, Math.max(520, maxCount * (narrow ? 25 : 28) + top + 12));
    const gen = sankey<ModelNode, ModelLink>()
      .nodeId((d) => d.id)
      .nodeAlign((d) => COLUMN[d.kind])
      .nodeWidth(10)
      .nodePadding(narrow ? 9 : 11)
      .nodeSort((a, b) => a.order - b.order)
      .extent([
        [labelL, top],
        [width - labelR, height - 4],
      ]);
    const g = gen({
      nodes: model.nodes.map((n) => ({ ...n })),
      links: model.links.map((l) => ({ ...l })),
    });
    // Focused: re-space the program column at its own, larger scale so a small
    // secretariat's programs are legible. Disclosed in the column head.
    let zoom = 1;
    if (focus) {
      const progs = g.nodes.filter((n) => n.kind === 'program').sort((a, b) => a.order - b.order);
      const total = progs.reduce((a, n) => a + (n.value ?? 0), 0);
      const any = g.nodes.find((n) => (n.value ?? 0) > 0 && n.kind === 'secretariat');
      const k0 = any ? ((any.y1 ?? 0) - (any.y0 ?? 0)) / (any.value ?? 1) : 0;
      const pad = 8;
      const span = height - 4 - top - pad * Math.max(0, progs.length - 1);
      const k = total > 0 ? span / total : 0;
      if (k0 > 0 && k > k0 * 1.05) {
        zoom = k / k0;
        let y = top;
        for (const p of progs) {
          p.y0 = y;
          p.y1 = y + (p.value ?? 0) * k;
          y = p.y1 + pad;
        }
      }
    }

    // Vertical room around each node's centre, so labels never collide.
    const room = new Map<string, number>();
    for (const col of [0, 1, 2]) {
      const list = g.nodes.filter((n) => COLUMN[n.kind] === col).sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
      const cy = (n: N) => ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2;
      list.forEach((n, i) => {
        const prev = list[i - 1];
        const next = list[i + 1];
        const up = prev ? cy(n) - cy(prev) : 99;
        const down = next ? cy(next) - cy(n) : 99;
        room.set(n.id, Math.min(up, down));
      });
    }
    // Ribbon geometry. Target ends follow the (possibly zoomed) target node.
    const inOffset = new Map<string, number>();
    const paths = new Map<L, string>();
    const sorted = [...g.links].sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
    for (const l of sorted) {
      const s0 = l.source as N;
      const t0 = l.target as N;
      const w = Math.max(1, l.width ?? 1);
      const a0 = (l.y0 ?? 0) - w / 2;
      let b0 = (l.y1 ?? 0) - w / 2;
      let b1 = b0 + w;
      if (zoom > 1 && t0.kind === 'program') {
        const tv = t0.value || 1;
        const th = (t0.y1 ?? 0) - (t0.y0 ?? 0);
        const off = inOffset.get(t0.id) ?? 0;
        b0 = (t0.y0 ?? 0) + off;
        b1 = b0 + Math.max(1, (l.value / tv) * th);
        inOffset.set(t0.id, off + (b1 - b0));
      }
      paths.set(l, ribbon(s0.x1 ?? 0, a0, a0 + w, t0.x0 ?? 0, b0, b1));
    }
    return { height, nodes: g.nodes, links: g.links, room, paths, zoom };
  }, [model, width, narrow, labelL, labelR, focus]);

  const src = (l: L) => l.source as N;
  const tgt = (l: L) => l.target as N;
  const linkId = (l: L) => `${src(l).id}→${tgt(l).id}`;

  const nodeTip = (n: N): TipData => {
    const isRev = n.kind === 'revenue';
    return {
      kicker: isRev ? 'Collected' : n.dept,
      title: n.name,
      amount: n.amount,
      part: n.amount,
      whole: isRev ? model.revenueTotal : model.spendingTotal,
      wholeLabel: isRev ? 'revenue collected' : `total ${spendWord}`,
      conservation: n.conservation,
      hint: isRev
        ? 'Its ribbons split spending in proportion to this share of revenue.'
        : n.kind === 'secretariat'
          ? focus === n.id
            ? 'Click or press Enter to show all programs.'
            : 'Click or press Enter to see its programs.'
          : undefined,
    };
  };
  const linkTip = (l: L): TipData => ({
    kicker: `${src(l).name} → ${tgt(l).name}`,
    title: tgt(l).name,
    amount: l.value,
    part: l.value,
    whole: model.spendingTotal,
    wholeLabel: `total ${spendWord}`,
    proportional: l.proportional,
    conservation: l.conservation,
  });

  const localPoint = (e: MouseEvent) => {
    const r = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect() ??
      (e.currentTarget as Element).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Which nodes/links are "lit".
  const focusSet = useMemo(() => {
    if (!focus) return null;
    const ids = new Set<string>([focus]);
    for (const l of layout.links) if (touches(l, focus)) ids.add((l.source as N).id).add((l.target as N).id);
    return ids;
  }, [focus, layout.links]);

  const linkStyle = (l: L): { stroke: string; opacity: number } => {
    let stroke = l.color;
    let opacity = 0.35;
    if (overlay) {
      if (l.conservation) stroke = COLORS.moss;
      else opacity *= 0.45;
    }
    if (focus) {
      if (touches(l, focus)) {
        stroke = overlay && l.conservation ? COLORS.moss : COLORS.clay;
        opacity = 0.5;
      } else opacity = 0.06;
    }
    if (hover) {
      const lit = hover.kind === 'link' ? linkId(l) === hover.id : touches(l, hover.id);
      if (lit) opacity = Math.max(opacity, 0.7);
      else if (!focus) opacity *= 0.7;
    }
    return { stroke, opacity };
  };

  const nodeStyle = (n: N): { fill: string; opacity: number } => {
    let fill = n.color;
    let opacity = 1;
    if (overlay) {
      if (n.conservation) fill = COLORS.moss;
      else opacity = 0.45;
    }
    if (focus) {
      if (n.id === focus) fill = overlay && n.conservation ? COLORS.moss : COLORS.clay;
      else if (n.kind === 'secretariat') opacity = Math.min(opacity, 0.35);
    }
    return { fill, opacity };
  };

  const labelOpacity = (n: N) => {
    let o = 1;
    if (overlay && !n.conservation) o = 0.55;
    if (focusSet && !focusSet.has(n.id)) o = Math.min(o, 0.4);
    return o;
  };

  const onNodeKey = (e: KeyboardEvent, n: N) => {
    if (n.kind === 'secretariat' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onFocus(focus === n.id ? null : n.id);
    }
  };

  const showNodeTipAt = (n: N) =>
    setTip({ data: nodeTip(n), x: n.kind === 'revenue' ? (n.x0 ?? 0) - 4 : (n.x1 ?? 0) + 4, y: ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2 });

  const revenueX1 = layout.nodes.find((n) => n.kind === 'revenue')?.x1 ?? labelL;
  const secX0 = layout.nodes.find((n) => n.kind === 'secretariat')?.x0 ?? width / 2;
  const progX0 = layout.nodes.find((n) => n.kind === 'program')?.x0 ?? width - labelR;
  const focusName = focus ? layout.nodes.find((n) => n.id === focus)?.name : null;
  const midGap = progX0 - secX0 - 30;

  return (
    <div className="relative" onMouseLeave={() => { setHover(null); setTip(null); }}>
      <svg
        width={width}
        height={layout.height}
        viewBox={`0 0 ${width} ${layout.height}`}
        role="group"
        aria-label={label}
        className="block select-none"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <rect x={0} y={0} width={width} height={layout.height} fill="transparent" onClick={() => focus && onFocus(null)} />

        {/* Column heads */}
        <g className="eyebrow" style={{ fontSize: 10.5, letterSpacing: '0.09em', fontWeight: 600 }} fill={COLORS.ink2}>
          <text x={revenueX1} y={14} textAnchor="end">REVENUE</text>
          <text x={secX0} y={14}>SECRETARIATS</text>
          <text x={progX0} y={14}>
            {focusName && layout.zoom > 1 ? 'PROGRAMS · ENLARGED TO FIT' : 'PROGRAMS'}
          </text>
        </g>
        <line x1={0} x2={width} y1={top - 12} y2={top - 12} stroke={COLORS.rule} strokeWidth={1} />

        {/* Ribbons */}
        <g>
          {layout.links.map((l) => {
            const s = linkStyle(l);
            const id = linkId(l);
            return (
              <path
                key={id}
                d={layout.paths.get(l)}
                fill={s.stroke}
                fillOpacity={s.opacity}
                style={{ transition: 'fill-opacity 240ms ease-out, fill 240ms ease-out', mixBlendMode: 'multiply' }}
                onMouseEnter={(e) => {
                  setHover({ kind: 'link', id });
                  const p = localPoint(e);
                  setTip({ data: linkTip(l), ...p });
                }}
                onMouseMove={(e) => {
                  const p = localPoint(e);
                  setTip((t) => (t ? { ...t, ...p } : t));
                }}
                onMouseLeave={() => { setHover(null); setTip(null); }}
                onClick={() => {
                  const s2 = src(l);
                  const t2 = tgt(l);
                  const sec = s2.kind === 'secretariat' ? s2.id : t2.kind === 'secretariat' ? t2.id : null;
                  if (sec) onFocus(focus === sec ? null : sec);
                }}
              />
            );
          })}
        </g>

        {/* Nodes + labels */}
        <g>
          {layout.nodes.map((n) => {
            const x0 = n.x0 ?? 0;
            const x1 = n.x1 ?? 0;
            const y0 = n.y0 ?? 0;
            const y1 = n.y1 ?? 0;
            const h = Math.max(1, y1 - y0);
            const st = nodeStyle(n);
            const isSec = n.kind === 'secretariat';
            const isRev = n.kind === 'revenue';
            const cy = (y0 + y1) / 2;
            const lx = isRev ? x0 - 8 : x1 + 8;
            const anchor = isRev ? 'end' : 'start';
            const room = isRev ? labelL - 14 : n.kind === 'program' ? labelR - 18 : midGap;
            const leafW = overlay && n.conservation ? 14 : 0;
            const amount = formatMoney(n.amount);
            const space = layout.room.get(n.id) ?? 0;
            const twoLine = h >= 22 && space >= 32;
            const oneLine = !twoLine && space >= 12.5;
            const name = truncate(n.name, room - leafW - (twoLine ? 0 : amount.length * 7 + 8), narrow ? 6.6 : 7);
            const nodeLabel = `${n.name}, ${amount}, ${formatShare(n.amount, isRev ? model.revenueTotal : model.spendingTotal)} of ${isRev ? 'revenue collected' : `total ${spendWord}`}${n.conservation ? ', conservation line' : ''}`;
            const leafX = isRev ? lx - 11 : lx;
            const textX = isRev ? lx - leafW : lx + leafW;
            return (
              <g
                key={n.id}
                tabIndex={0}
                role={isSec ? 'button' : 'img'}
                aria-pressed={isSec ? focus === n.id : undefined}
                aria-label={isSec ? `${nodeLabel}. ${focus === n.id ? 'Showing its programs.' : 'Show its programs.'}` : nodeLabel}
                aria-describedby={tip && kbFocus === n.id ? 'flow-tip' : undefined}
                className="outline-none"
                style={{ cursor: isSec ? 'pointer' : 'default' }}
                onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setKbFocus(n.id); setHover({ kind: 'node', id: n.id }); showNodeTipAt(n); }}
                onBlur={() => { setKbFocus(null); setHover(null); setTip(null); }}
                onKeyDown={(e) => onNodeKey(e, n)}
                onMouseEnter={(e) => { setHover({ kind: 'node', id: n.id }); setTip({ data: nodeTip(n), ...localPoint(e) }); }}
                onMouseMove={(e) => { const p = localPoint(e); setTip((t) => (t ? { ...t, ...p } : t)); }}
                onMouseLeave={() => { setHover(null); setTip(null); }}
                onClick={() => isSec && onFocus(focus === n.id ? null : n.id)}
              >
                {/* generous hit area */}
                <rect x={x0 - 4} y={y0 - 2} width={x1 - x0 + 8} height={h + 4} fill="transparent" />
                <rect
                  x={x0}
                  y={y0}
                  width={x1 - x0}
                  height={h}
                  rx={1.5}
                  fill={st.fill}
                  opacity={st.opacity}
                  style={{ transition: 'fill 240ms ease-out, opacity 240ms ease-out' }}
                />
                {kbFocus === n.id ? (
                  <rect x={x0 - 3.5} y={y0 - 3.5} width={x1 - x0 + 7} height={h + 7} rx={4} fill="none" stroke={COLORS.clay} strokeWidth={2} />
                ) : null}
                {twoLine || oneLine ? (
                  <g opacity={labelOpacity(n)} style={{ transition: "opacity 240ms ease-out" }}>
                    {leafW ? (
                      <path d={LEAF_PATH} transform={`translate(${leafX} ${cy - (twoLine ? 13 : 6)}) scale(0.72)`} fill={COLORS.moss} />
                    ) : null}
                    {twoLine ? (
                      <>
                        <text x={textX} y={cy - 3} textAnchor={anchor} className="svg-label" fill={COLORS.ink} style={{ fontSize: narrow ? 12.5 : 13.5, fontWeight: isSec && focus === n.id ? 650 : 520 }}>
                          {name}
                        </text>
                        <text x={textX} y={cy + 12} textAnchor={anchor} className="svg-label num" fill={COLORS.ink2} style={{ fontSize: 11.5 }}>
                          {amount}
                        </text>
                      </>
                    ) : (
                      <text x={textX} y={cy + 4} textAnchor={anchor} className="svg-label" fill={COLORS.ink} style={{ fontSize: narrow ? 11.5 : 12, fontWeight: 480 }}>
                        {isRev ? (
                          <>
                            <tspan className="num" fill={COLORS.ink2} style={{ fontSize: 10.5 }}>{amount}</tspan>
                            <tspan dx={6}>{name}</tspan>
                          </>
                        ) : (
                          <>
                            {name}
                            <tspan dx={6} className="num" fill={COLORS.ink2} style={{ fontSize: 10.5 }}>{amount}</tspan>
                          </>
                        )}
                      </text>
                    )}
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {tip ? <Tooltip id="flow-tip" tip={tip.data} x={tip.x} y={tip.y} containerWidth={width} /> : null}
    </div>
  );
}
