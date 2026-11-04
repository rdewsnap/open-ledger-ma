/**
 * Pure helpers for the Scale view (zoomable treemap): URL path encoding,
 * hierarchy + layout, colors and label fitting. No DOM, so it can be unit tested.
 */
import { hierarchy, treemap, treemapSquarify, type HierarchyNode, type HierarchyRectangularNode } from 'd3-hierarchy';
import { COLORS, warmRamp } from './flowModel';
import type { HighlightSet } from './highlight';
import type { Measure, TreeNode } from './types';

/* ------------------------------------------------------------------ */
/* Zoom path <-> URL                                                   */
/* ------------------------------------------------------------------ */

/**
 * The zoom path lives in `?node=` as the deepest zoomed node, compactly:
 *   sec:EHS            → "EHS"
 *   dept:EHS/DMH       → "EHS.DMH"
 * "." is used (not "/") because URLSearchParams leaves it unescaped.
 * Any other id is kept verbatim (it can still be resolved against the tree).
 */
export function encodeNodeParam(id: string | null | undefined): string | null {
  if (!id || id === 'root') return null;
  const sec = id.match(/^sec:([A-Za-z0-9_-]+)$/);
  if (sec) return sec[1]!;
  const dept = id.match(/^dept:([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/);
  if (dept) return `${dept[1]}.${dept[2]}`;
  return id;
}

/** Inverse of encodeNodeParam: the chain of ids from (excluding) root to the node. */
export function decodeNodeParam(param: string | null | undefined): string[] {
  if (!param) return [];
  const s = param.trim();
  if (!s || s === 'root') return [];
  if (s.includes(':')) {
    // A raw id. Departments imply their secretariat.
    const dept = s.match(/^dept:([^/]+)\/(.+)$/);
    return dept ? [`sec:${dept[1]}`, s] : [s];
  }
  const [sec, dept] = s.split('.');
  if (!sec) return [];
  return dept ? [`sec:${sec}`, `dept:${sec}/${dept}`] : [`sec:${sec}`];
}

/**
 * Walk the tree along `ids`, returning the longest valid chain of nodes
 * (always starting with the root). Unknown ids are dropped, so a stale URL
 * (e.g. after a year change) lands on the deepest node that still exists.
 * Leaves are never zoom targets.
 */
export function resolvePath<T extends { id: string; children?: T[] }>(root: T, ids: string[]): T[] {
  const out: T[] = [root];
  let cur = root;
  for (const id of ids) {
    const next = cur.children?.find((c) => c.id === id);
    if (!next || !next.children?.length) break;
    out.push(next);
    cur = next;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Hierarchy                                                           */
/* ------------------------------------------------------------------ */

export type ScaleDatum = Omit<TreeNode, 'children'> & {
  /** Secretariat id this node belongs to (root: "root"). */
  sec: string;
  children?: ScaleDatum[];
};

export type ScaleNode = HierarchyNode<ScaleDatum>;

/**
 * Full hierarchy for one measure. Values are summed from leaves; negative
 * leaves (rare accounting reversals) are drawn as zero.
 */
export function buildHierarchy(tree: TreeNode, measure: Measure): ScaleNode {
  const decorate = (n: TreeNode, sec: string): ScaleDatum => {
    const s = n.id.startsWith('sec:') ? n.id : sec;
    return { ...n, sec: s, children: n.children?.map((k) => decorate(k, s)) };
  };
  const root = hierarchy<ScaleDatum>(decorate(tree, 'root'));
  root.sum((d) => (d.children?.length ? 0 : Math.max(0, d[measure] ?? 0)));
  root.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return root;
}

/** resolvePath for a built hierarchy: zoomable (non-leaf, non-empty) nodes only. */
export function resolveScalePath(root: ScaleNode, ids: string[]): ScaleNode[] {
  const out: ScaleNode[] = [root];
  let cur = root;
  for (const id of ids) {
    const next = cur.children?.find((c) => c.data.id === id);
    if (!next || !next.children?.length || !(next.value ?? 0)) break;
    out.push(next);
    cur = next;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Highlight                                                           */
/* ------------------------------------------------------------------ */

/** A node is highlighted when it or any ancestor is in the set (see lib/highlight.ts). */
export type { HighlightSet } from './highlight';
export { NO_HIGHLIGHT } from './highlight';

export function isHighlighted(node: ScaleNode, set: HighlightSet): boolean {
  if (set.size === 0) return false;
  for (let n: ScaleNode | null = node; n; n = n.parent) if (set.has(n.data.id)) return true;
  return false;
}

/** Sum of the top-most highlighted subtrees under `root` (no double counting). */
export function highlightTotal(root: ScaleNode, set: HighlightSet): number {
  if (set.size === 0) return 0;
  let total = 0;
  const walk = (n: ScaleNode) => {
    if (set.has(n.data.id)) {
      total += n.value ?? 0;
      return;
    }
    n.children?.forEach(walk);
  };
  walk(root);
  return total;
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export type Cell = {
  id: string;
  node: ScaleNode;
  /** 1 = child of the zoomed node, 2 = grandchild. */
  depth: 1 | 2;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Depth-1 cell whose grandchildren are drawn inside it (label goes in a header strip). */
  group: boolean;
  /** Height of the header strip (0 when no header). */
  header: number;
};

export const GAP = 2;
export const HEADER_H = 22;

/**
 * Lay out the zoomed node's descendants to depth 2. Only that slice is copied
 * and tiled, so the cost is bounded by what's on screen, not the whole tree.
 */
export function layoutTreemap(focus: ScaleNode, width: number, height: number): Cell[] {
  if (width <= 0 || height <= 0 || !focus.children?.length) return [];
  const live = (n: ScaleNode) => (n.value ?? 0) > 0;
  const sub = hierarchy<ScaleNode>(focus, (n) =>
    n === focus || n.parent === focus ? n.children?.filter(live) : undefined,
  );
  // Values come from the full hierarchy (whole subtrees), not just the copied slice.
  sub.each((h) => {
    (h as { value?: number }).value = h.data.value ?? 0;
  });
  sub.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const headerFor = (n: HierarchyRectangularNode<ScaleNode>) =>
    n.depth === 1 && n.y1 - n.y0 >= HEADER_H + 18 && n.x1 - n.x0 >= 56 ? HEADER_H : GAP;
  const edge = (n: HierarchyRectangularNode<ScaleNode>) => (n.depth === 0 ? 0 : GAP);

  const laid = treemap<ScaleNode>()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingInner(GAP)
    .paddingTop((n) => (n.depth === 0 ? 0 : headerFor(n)))
    .paddingRight(edge)
    .paddingBottom(edge)
    .paddingLeft(edge)(sub);

  const cells: Cell[] = [];
  for (const d of laid.descendants()) {
    if (d.depth === 0) continue;
    const group = d.depth === 1 && Boolean(d.children?.length);
    cells.push({
      id: d.data.data.id,
      node: d.data,
      depth: d.depth as 1 | 2,
      x0: d.x0,
      y0: d.y0,
      x1: d.x1,
      y1: d.y1,
      group,
      header: group ? headerFor(d) : 0,
    });
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Color                                                               */
/* ------------------------------------------------------------------ */

/**
 * Secretariat base colors. As in the Flow view, offices under `minShare` of the
 * total share the last sand tint, so the ramp spreads over the ones you can see.
 */
export function secretariatColors(root: ScaleNode, minShare = 0.005): Map<string, string> {
  const total = root.value ?? 0;
  const secs = (root.children ?? []).filter((s) => total > 0 && (s.value ?? 0) / total >= minShare);
  const out = new Map<string, string>();
  secs.forEach((s, i) => out.set(s.data.id, warmRamp(secs.length > 1 ? i / (secs.length - 1) : 0)));
  for (const s of root.children ?? []) if (!out.has(s.data.id)) out.set(s.data.id, COLORS.blue3);
  return out;
}

function rgb(c: string): [number, number, number] {
  const m = c.trim().match(/^#?([0-9a-f]{6})$/i);
  if (m) {
    const v = parseInt(m[1]!, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const r = c.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : [0, 0, 0];
}

/** Mix `color` toward paper by `t` (0 = color, 1 = paper). */
export function tint(color: string, t: number): string {
  const a = rgb(color);
  const b = rgb(COLORS.paper);
  const m = a.map((v, i) => Math.round(v + (b[i]! - v) * t));
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Lighter tint per tree depth: (root), secretariat, department, program. */
const DEPTH_TINT = [0, 0, 0.32, 0.52];

export function cellFill(base: string, treeDepth: number): string {
  return tint(base, DEPTH_TINT[Math.min(treeDepth, DEPTH_TINT.length - 1)] ?? 0.52);
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Label colors for cells: white on the darker fills, near-black on the lighter ones. */
export const LABEL_LIGHT = '#FFFFFF';
export const LABEL_DARK = '#141B27';

/** White or near-black, whichever has more contrast on `fill` (labels are 11–12.5px, so this needs 4.5:1). */
export function textOn(fill: string): string {
  const L = luminance(fill);
  const onLight = (1.05) / (L + 0.05);
  const onDark = (L + 0.05) / (luminance(LABEL_DARK) + 0.05);
  return onLight >= onDark ? LABEL_LIGHT : LABEL_DARK;
}

/* ------------------------------------------------------------------ */
/* Label fitting                                                       */
/* ------------------------------------------------------------------ */

export type LabelFont = 'name' | 'amount' | 'tiny';
export type Measurer = (text: string, font: LabelFont) => number;

export type LabelFit =
  | { mode: 'none' }
  | { mode: 'full'; name: string; amount: string }
  | { mode: 'tiny'; name: string; amount?: string };

export const LABEL = {
  padX: 6,
  /** Cells at least this tall get name + amount on two lines. */
  fullH: 40,
  /** Cells at least this tall get a single small line; below, nothing. */
  tinyH: 24,
  /** Fewest characters of the name worth showing before an ellipsis. */
  minChars: 4,
  gap: 6,
};

/** Longest prefix of `text` (+ "…") whose measured width fits `max`, or null. */
export function ellipsize(text: string, max: number, font: LabelFont, measure: Measurer, minChars = LABEL.minChars): string | null {
  if (measure(text, font) <= max) return text;
  let lo = 0;
  let hi = text.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid).trimEnd()}…`, font) <= max) lo = mid;
    else hi = mid - 1;
  }
  if (lo < Math.min(minChars, text.length)) return null;
  return `${text.slice(0, lo).trimEnd()}…`;
}

/**
 * Decide what label a cell of `w`×`h` px can carry. `lead` reserves room at the
 * start of the first line (e.g. the highlight marker).
 *   h ≥ 40: name on one line (ellipsized if needed), amount beneath.
 *   h ≥ 24: one small line: name, plus the amount if both fit.
 *   below:  nothing.
 */
export function fitLabel(w: number, h: number, name: string, amount: string, measure: Measurer, lead = 0): LabelFit {
  const room = w - LABEL.padX * 2 - lead;
  if (h < LABEL.tinyH || room <= 0) return { mode: 'none' };
  if (h >= LABEL.fullH && measure(amount, 'amount') <= w - LABEL.padX * 2) {
    const n = ellipsize(name, room, 'name', measure);
    if (n) return { mode: 'full', name: n, amount };
  }
  const withAmount = measure(name, 'tiny') + LABEL.gap + measure(amount, 'tiny');
  if (withAmount <= room) return { mode: 'tiny', name, amount };
  const n = ellipsize(name, room, 'tiny', measure);
  return n ? { mode: 'tiny', name: n } : { mode: 'none' };
}
