import { sankey, type SankeyLink, type SankeyNode } from 'd3-sankey';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { COLORS, type FlowModel, type ModelLink, type ModelNode } from '../lib/flowModel';
import { formatMoney, formatShare } from '../lib/format';

type N = SankeyNode<ModelNode, ModelLink>;
type L = SankeyLink<ModelNode, ModelLink>;

type Props = {
  /** A model built for phones. Unfocused: revenue → spending areas. Focused: that area → its programs. */
  model: FlowModel;
  width: number;
  highlighting: boolean;
  spendWord: string;
  label: string;
  /** The spending area being shown, or null for the first step. */
  focus: string | null;
  /** Lit node (its bands traced, its breakdown below). */
  selected: string | null;
  onPick: (node: ModelNode) => void;
  onBack: () => void;
};

const BAR = 8;
const TOP = 30;
const GAP = 8;
const NAME_PX = 6.6; // average glyph width at 13px

function ribbon(x0: number, a0: number, a1: number, x1: number, b0: number, b1: number) {
  const xm = (x0 + x1) / 2;
  return `M${x0},${a0}C${xm},${a0} ${xm},${b0} ${x1},${b0}L${x1},${b1}C${xm},${b1} ${xm},${a1} ${x0},${a1}Z`;
}

function truncate(s: string, px: number) {
  const max = Math.max(4, Math.floor(px / NAME_PX));
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

const touches = (l: L, id: string) => (l.source as N).id === id || (l.target as N).id === id;

/**
 * Phone version of the Flow chart (<640px): two columns, revenue on the left and
 * spending areas on the right, with labels drawn inside the chart over the bands
 * so the full width goes to the ribbons. Tap an end to trace its bands; the list
 * below the chart carries the detail and the programs.
 */
export function PhoneSankey({ model, width, highlighting, spendWord, label, focus, selected, onPick, onBack }: Props) {
  const [kbFocus, setKbFocus] = useState<string | null>(null);

  const layout = useMemo(() => {
    const nodes = focus
      ? model.nodes.filter((n) => n.id === focus || (n.kind === 'program' && n.parent === focus))
      : model.nodes.filter((n) => n.kind !== 'program');
    const ids = new Set(nodes.map((n) => n.id));
    const links = model.links.filter((l) => ids.has(l.source) && ids.has(l.target));
    const rightCount = nodes.filter((n) => n.kind === (focus ? 'program' : 'secretariat')).length;
    const leftCount = nodes.length - rightCount;
    const height = Math.max(focus ? 360 : 420, Math.max(rightCount, leftCount) * 36 + TOP);
    const leftKind = focus ? 'secretariat' : 'revenue';
    const g = sankey<ModelNode, ModelLink>()
      .nodeId((d) => d.id)
      .nodeAlign((d) => (d.kind === leftKind ? 0 : 1))
      .nodeWidth(BAR)
      .nodePadding(GAP)
      .nodeSort((a, b) => a.order - b.order)
      .extent([
        [0, TOP],
        [width, height - 12],
      ])({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) });

    // Vertical room around each label so neighbours never overlap.
    const room = new Map<string, number>();
    for (const kind of [leftKind, focus ? 'program' : 'secretariat'] as const) {
      const col = g.nodes.filter((n) => n.kind === kind).sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
      const cy = (n: N) => ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2;
      col.forEach((n, i) => {
        const up = i > 0 ? cy(n) - cy(col[i - 1]!) : 99;
        const down = i < col.length - 1 ? cy(col[i + 1]!) - cy(n) : 99;
        room.set(n.id, Math.min(up, down));
      });
    }
    const paths = new Map<L, string>();
    for (const l of g.links) {
      const w = Math.max(1, l.width ?? 1);
      const a0 = (l.y0 ?? 0) - w / 2;
      const b0 = (l.y1 ?? 0) - w / 2;
      paths.set(l, ribbon((l.source as N).x1 ?? 0, a0, a0 + w, (l.target as N).x0 ?? 0, b0, b0 + w));
    }
    return { height, nodes: g.nodes, links: g.links, room, paths, leftKind };
  }, [model, width, focus]);

  const litId = selected && selected !== focus && layout.nodes.some((n) => n.id === selected) ? selected : null;
  const linkId = (l: L) => `${(l.source as N).id}→${(l.target as N).id}`;
  const onKey = (e: KeyboardEvent, n: N) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(n);
    }
  };
  const focusName = focus ? layout.nodes.find((n) => n.id === focus)?.name : null;

  const linkStyle = (l: L) => {
    let fill = l.color;
    let opacity = 0.38;
    if (highlighting) {
      if (l.highlighted) fill = COLORS.gold;
      else opacity *= 0.45;
    }
    if (litId) {
      if (touches(l, litId)) {
        fill = highlighting && l.highlighted ? COLORS.gold : COLORS.brick;
        opacity = 0.55;
      } else opacity = 0.06;
    }
    return { fill, opacity };
  };

  const litSet = useMemo(() => {
    if (!litId) return null;
    const s = new Set<string>([litId]);
    for (const l of layout.links) if (touches(l, litId)) s.add((l.source as N).id).add((l.target as N).id);
    return s;
  }, [litId, layout.links]);

  const half = width / 2 - 14;

  return (
    <div>
      {focus ? (
        <button type="button" onClick={onBack} className="link mb-3 text-[0.95rem]">
          ← All spending areas
        </button>
      ) : null}
      <svg
        width={width}
        height={layout.height}
        viewBox={`0 0 ${width} ${layout.height}`}
        role="group"
        aria-label={label}
        className="block select-none"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <rect x={0} y={0} width={width} height={layout.height} fill="transparent" onClick={onBack} />
        <g style={{ fontSize: 13, fontWeight: 600 }} fill={COLORS.ink2}>
          <text x={0} y={13}>{focus ? 'Spending area' : 'Revenue'}</text>
          <text x={width} y={13} textAnchor="end">{focus ? 'Programs' : 'Spending areas'}</text>
        </g>
        <line x1={0} x2={width} y1={TOP - 10} y2={TOP - 10} stroke={COLORS.rule} strokeWidth={1} />

        <g>
          {layout.links.map((l) => {
            const s = linkStyle(l);
            return (
              <path
                key={linkId(l)}
                d={layout.paths.get(l)}
                fill={s.fill}
                fillOpacity={s.opacity}
                style={{ transition: 'fill-opacity 240ms ease-out, fill 240ms ease-out', mixBlendMode: 'multiply' }}
                onClick={() => onPick(l.target as N)}
              />
            );
          })}
        </g>

        <g>
          {layout.nodes.map((n) => {
            const isRev = n.kind === layout.leftKind;
            const x0 = n.x0 ?? 0;
            const x1 = n.x1 ?? 0;
            const y0 = n.y0 ?? 0;
            const y1 = n.y1 ?? 0;
            const h = Math.max(1, y1 - y0);
            const cy = (y0 + y1) / 2;
            const hl = highlighting && n.highlighted;
            let fill = n.color;
            let opacity = 1;
            if (highlighting && n.kind !== 'revenue') {
              if (hl) fill = COLORS.gold;
              else opacity = 0.45;
            }
            if (litId === n.id) fill = hl ? COLORS.gold : COLORS.brick;
            const textX = isRev ? x1 + 6 : x0 - 6;
            const anchor = isRev ? 'start' : 'end';
            const amount = formatMoney(n.amount);
            const space = layout.room.get(n.id) ?? 0;
            const twoLine = space >= 30;
            const oneLine = !twoLine && space >= 13;
            const name = truncate(n.name, half - (twoLine ? 0 : amount.length * 7 + 6));
            const labelOpacity = litSet && !litSet.has(n.id) ? 0.4 : hl || !highlighting || n.kind === 'revenue' ? 1 : 0.6;
            const revenue = n.kind === 'revenue';
            const share = formatShare(n.amount, revenue ? model.revenueTotal : model.spendingTotal);
            const action = n.kind === 'secretariat' && !focus ? 'Show its programs.' : 'Show a breakdown below the chart.';
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-pressed={litId === n.id}
                aria-label={`${n.name}, ${amount}, ${share} of ${revenue ? 'revenue collected' : `total ${spendWord}`}${hl ? ', highlighted' : ''}. ${action}`}
                className="outline-none"
                style={{ cursor: 'pointer' }}
                onFocus={(e) => e.currentTarget.matches(':focus-visible') && setKbFocus(n.id)}
                onBlur={() => setKbFocus(null)}
                onClick={() => onPick(n)}
                onKeyDown={(e) => onKey(e, n)}
              >
                {/* Tap target: the bar plus the label area beside it. */}
                <rect x={isRev ? 0 : width - half} y={cy - 14} width={half} height={28} fill="transparent" />
                <rect x={x0} y={y0} width={x1 - x0} height={h} rx={1.5} fill={fill} opacity={opacity} style={{ transition: 'fill 240ms ease-out, opacity 240ms ease-out' }} />
                {kbFocus === n.id ? (
                  <rect x={x0 - 3} y={y0 - 3} width={x1 - x0 + 6} height={h + 6} rx={3} fill="none" stroke={COLORS.brick} strokeWidth={2} />
                ) : null}
                {twoLine || oneLine ? (
                  <g opacity={labelOpacity} style={{ transition: 'opacity 240ms ease-out' }}>
                    {twoLine ? (
                      <>
                        <text x={textX} y={cy - 2} textAnchor={anchor} className="svg-label" fill={COLORS.ink} style={{ fontSize: 13, fontWeight: litId === n.id ? 650 : 500 }}>
                          {name}
                        </text>
                        <text x={textX} y={cy + 12} textAnchor={anchor} className="svg-label num" fill={COLORS.ink2} style={{ fontSize: 12 }}>
                          {amount}
                        </text>
                      </>
                    ) : (
                      <text x={textX} y={cy + 4} textAnchor={anchor} className="svg-label" fill={COLORS.ink} style={{ fontSize: 12, fontWeight: 450 }}>
                        {name}
                        <tspan dx={5} className="num" fill={COLORS.ink2} style={{ fontSize: 11.5 }}>
                          {amount}
                        </tspan>
                      </text>
                    )}
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      <p className="mt-2 text-[0.85rem] text-ink-2">
        {focus
          ? `${focusName ?? 'This area'}’s largest programs, drawn to scale. Tap one for its breakdown.`
          : 'Tap a spending area to see its programs, or a revenue source for its share of each area. Spending bands are to scale; revenue bands show shares.'}
      </p>
    </div>
  );
}
