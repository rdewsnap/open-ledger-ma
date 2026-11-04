/**
 * Turns a contract `Flows` file into the graph the Flow view draws:
 * three ordered columns, a bounded number of program nodes, and colors.
 * Pure (no DOM) so it can be unit tested.
 */
import { scaleLinear } from 'd3-scale';
import { ancestorIndex, inHighlight, NO_HIGHLIGHT, secOf, type HighlightSet } from './highlight';
import type { FlowNodeKind, Flows, Measure, TreeNode } from './types';

export const COLORS = {
  paper: '#FAFAF7',
  paper2: '#EFF1F2',
  rule: '#D5D9DE',
  ink: '#1C2433',
  ink2: '#576174',
  brick: '#A8322D',
  brick2: '#F0D4D0',
  gold: '#9A7414',
  /* Revenue and decreases. */
  slate: '#5E6673',
  /* Spending: Commonwealth blue, lightening by size rank. */
  navy: '#1F3A68',
  blue1: '#4D6A96',
  blue2: '#8EA4C3',
  blue3: '#C9D4E4',
} as const;

export type ModelNode = {
  id: string;
  name: string;
  kind: FlowNodeKind;
  /** Dollar amount from the data file (not the drawn height). */
  amount: number;
  /** In the reader's highlight set (itself, its department or its secretariat). */
  highlighted: boolean;
  /** Secretariat id for program nodes. */
  parent?: string;
  /** Department name, when the program came from tree.json. */
  dept?: string;
  /** Synthetic bucket created by this view (or an "Other" bucket from the data). */
  bucket: boolean;
  color: string;
  /** Global draw order; used as nodeSort so columns stay ranked and tidy. */
  order: number;
};

export type ModelLink = {
  source: string;
  target: string;
  value: number;
  proportional: boolean;
  /** Ends at a highlighted node. */
  highlighted: boolean;
  color: string;
};

export type FlowModel = {
  nodes: ModelNode[];
  links: ModelLink[];
  revenueTotal: number;
  spendingTotal: number;
  /** Secretariats in rank order, each with its full program list (for lists + a11y). */
  secretariats: { node: ModelNode; programs: ModelNode[] }[];
  revenue: ModelNode[];
};

export type ModelOptions = {
  /** Secretariat to expand: right column shows only its programs. */
  focus?: string | null;
  /** Programs shown in the right column when nothing is focused. */
  topPrograms?: number;
  /** Programs shown for a focused secretariat. */
  focusPrograms?: number;
  /** Per-secretariat "Other" buckets smaller than this share fold into one node. */
  minOtherShare?: number;
  /** Secretariats smaller than this share of spending fold into "Smaller offices". */
  minSecShare?: number;
  /** Highlighted secretariat/department ids (see lib/highlight.ts). */
  highlight?: HighlightSet;
  /** tree.json for the year: gives full program detail for focus + phone lists, and departments for the highlight. */
  tree?: TreeNode | null;
  measure?: Measure;
  /** Revenue ids in display order (meta.revenueGroups). Default: by value. */
  revenueOrder?: string[];
};

type Leaf = { id: string; name: string; amount: number; dept?: string; other: boolean };

/** All program-level leaves under a tree node, with their department name. */
export function treeLeaves(node: TreeNode, measure: Measure): Leaf[] {
  const out: Leaf[] = [];
  const walk = (n: TreeNode, dept?: string) => {
    if (!n.children?.length) {
      out.push({ id: n.id, name: n.name, amount: n[measure], dept, other: Boolean(n.other) || isOtherId(n.id) });
      return;
    }
    const d = n.id.startsWith('dept:') ? n.name : dept;
    for (const k of n.children) walk(k, d);
  };
  walk(node);
  return out.filter((l) => l.amount > 0);
}

const ALL_OTHER = 'prog:__all-other';
export const SMALL_SECS = 'sec:__small';

const revenueRamp = scaleLinear<string>().domain([0, 1]).range([COLORS.slate, '#CDD1D7']);
/** Spending ramp shared by Flow and Scale: navy through pale blue. */
export const warmRamp = scaleLinear<string>()
  .domain([0, 0.34, 0.67, 1])
  .range([COLORS.navy, COLORS.blue1, COLORS.blue2, COLORS.blue3]);

export function isOtherId(id: string): boolean {
  return id.startsWith('prog:other') || id === ALL_OTHER;
}

export function buildFlowModel(flows: Flows, opts: ModelOptions = {}): FlowModel {
  const { focus = null, topPrograms = 16, focusPrograms = 14, minOtherShare = 0.012, minSecShare = 0.005, highlight = NO_HIGHLIGHT, tree = null, measure = flows.measure, revenueOrder } = opts;
  // Secretariats touched by the highlight (selected, or holding a selected department).
  const hlSecs = new Set([...highlight].map(secOf).filter((x): x is string => Boolean(x)));
  flows = foldSmallSecretariats(flows, minSecShare, (id) => hlSecs.has(id));
  const ancestors = ancestorIndex(tree);
  /** Program ids from flows.json fall back to their parent secretariat; folded offices map to theirs. */
  const isHl = (id: string, parent?: string) => {
    const office = id.match(/^prog:office:(.+)$/);
    return inHighlight(office ? `sec:${office[1]}` : id, highlight, ancestors, parent);
  };

  const byId = new Map(flows.nodes.map((n) => [n.id, n]));
  const kindOf = (id: string) => byId.get(id)?.kind;

  // Program → parent secretariat (prefer explicit parent; else the link source).
  const parentOf = new Map<string, string>();
  for (const n of flows.nodes) if (n.kind === 'program' && n.parent) parentOf.set(n.id, n.parent);
  for (const l of flows.links) {
    if (kindOf(l.target) === 'program' && kindOf(l.source) === 'secretariat' && !parentOf.has(l.target)) {
      parentOf.set(l.target, l.source);
    }
  }

  const revRank = (id: string) => {
    const i = revenueOrder?.indexOf(id) ?? -1;
    return i < 0 ? 1e6 : i;
  };
  const revenueRaw = flows.nodes
    .filter((n) => n.kind === 'revenue')
    .sort((a, b) => revRank(a.id) - revRank(b.id) || b.value - a.value);
  const secRaw = flows.nodes.filter((n) => n.kind === 'secretariat').sort((a, b) => b.value - a.value);
  const progRaw = flows.nodes.filter((n) => n.kind === 'program');

  // Program values from links (authoritative for the drawn graph).
  const progValue = new Map<string, number>();
  for (const l of flows.links) {
    if (kindOf(l.target) === 'program') progValue.set(l.target, (progValue.get(l.target) ?? 0) + l.value);
  }
  const valueOf = (id: string) => progValue.get(id) ?? byId.get(id)?.value ?? 0;

  const secColor = new Map<string, string>();
  secRaw.forEach((s, i) => secColor.set(s.id, warmRamp(secRaw.length > 1 ? i / (secRaw.length - 1) : 0)));
  const secRank = new Map(secRaw.map((s, i) => [s.id, i]));

  let order = 0;
  const revenue: ModelNode[] = revenueRaw.map((n, i) => ({
    id: n.id,
    name: n.name,
    kind: 'revenue',
    amount: n.value,
    highlighted: false,
    bucket: false,
    color: revenueRamp(revenueRaw.length > 1 ? i / (revenueRaw.length - 1) : 0),
    order: order++,
  }));
  const secNodes: ModelNode[] = secRaw.map((n) => ({
    id: n.id,
    name: n.name,
    kind: 'secretariat',
    amount: n.value,
    highlighted: isHl(n.id),
    bucket: false,
    color: secColor.get(n.id) ?? COLORS.blue2,
    order: order++,
  }));
  const secById = new Map(secNodes.map((s) => [s.id, s]));

  const toProgNode = (id: string, amount: number): ModelNode => {
    const raw = byId.get(id);
    const parent = parentOf.get(id);
    return {
      id,
      name: raw?.name ?? id,
      kind: 'program',
      amount,
      highlighted: isHl(id, parent),
      parent,
      bucket: isOtherId(id),
      color: (parent && secColor.get(parent)) ?? COLORS.blue3,
      order: 0,
    };
  };

  // Full program lists per secretariat, for the phone list and keyboard users.
  const fullPrograms = new Map<string, ModelNode[]>();
  for (const p of progRaw) {
    const parent = parentOf.get(p.id);
    if (!parent) continue;
    const list = fullPrograms.get(parent) ?? [];
    list.push(toProgNode(p.id, valueOf(p.id)));
    fullPrograms.set(parent, list);
  }
  const leafNode = (l: Leaf, secId: string): ModelNode => ({
    id: l.id,
    name: l.name,
    kind: 'program',
    amount: l.amount,
    highlighted: isHl(l.id, secId),
    parent: secId,
    dept: l.dept,
    bucket: l.other,
    color: secColor.get(secId) ?? COLORS.blue3,
    order: 0,
  });
  const treeSec = new Map((tree?.children ?? []).map((c) => [c.id, c]));
  for (const sec of secRaw) {
    const t = treeSec.get(sec.id);
    if (t) fullPrograms.set(sec.id, treeLeaves(t, measure).map((l) => leafNode(l, sec.id)));
  }
  for (const list of fullPrograms.values()) {
    list.sort((a, b) => Number(a.bucket) - Number(b.bucket) || b.amount - a.amount);
  }

  // Decide which program nodes to draw, and where everything else folds.
  const remap = new Map<string, string>(); // raw program id → drawn id
  const linkAgg = new Map<string, ModelLink>();
  const drawn = new Map<string, ModelNode>();
  const otherName = (secId: string) =>
    secId === SMALL_SECS ? 'Other smaller offices' : `Other ${secById.get(secId)?.name ?? 'programs'}`;
  const otherIdFor = (secId: string) => `prog:other:${secId.replace(/^sec:/, '')}`;

  const focusFromTree = Boolean(focus && treeSec.has(focus));
  if (focus && focusFromTree) {
    // Programs straight from tree.json; links built here, not from flows.
    const list = fullPrograms.get(focus) ?? [];
    const keep = list.filter((p) => !p.bucket).slice(0, focusPrograms);
    const keepIds = new Set(keep.map((p) => p.id));
    const rest = list.filter((p) => !keepIds.has(p.id)).reduce((a, p) => a + p.amount, 0);
    for (const p of keep) drawn.set(p.id, { ...p, amount: 0 });
    const sec = secById.get(focus);
    const addLink = (target: string, value: number, highlighted: boolean) =>
      linkAgg.set(`${focus}→${target}`, { source: focus, target, value, proportional: false, highlighted, color: sec?.color ?? COLORS.blue2 });
    for (const p of keep) addLink(p.id, p.amount, p.highlighted);
    if (rest > 0) {
      const oid = otherIdFor(focus);
      const hl = Boolean(sec?.highlighted);
      drawn.set(oid, { id: oid, name: otherName(focus), kind: 'program', amount: 0, highlighted: hl, parent: focus, bucket: true, color: sec?.color ?? COLORS.blue3, order: 0 });
      addLink(oid, rest, hl);
    }
  } else if (focus) {
    const list = (fullPrograms.get(focus) ?? []).filter((p) => !p.bucket);
    const keep = list.slice(0, focusPrograms);
    for (const p of keep) {
      remap.set(p.id, p.id);
      drawn.set(p.id, { ...p });
    }
    for (const p of fullPrograms.get(focus) ?? []) {
      if (!remap.has(p.id)) remap.set(p.id, otherIdFor(focus));
    }
  } else {
    const ranked = progRaw
      .filter((p) => !isOtherId(p.id) && parentOf.has(p.id))
      .sort((a, b) => valueOf(b.id) - valueOf(a.id));
    const keep = new Set(ranked.slice(0, topPrograms).map((p) => p.id));
    // Sum what folds into each secretariat's "Other".
    const otherTotals = new Map<string, number>();
    for (const p of progRaw) {
      const parent = parentOf.get(p.id);
      if (!parent) continue;
      if (keep.has(p.id)) {
        remap.set(p.id, p.id);
      } else {
        otherTotals.set(parent, (otherTotals.get(parent) ?? 0) + valueOf(p.id));
      }
    }
    for (const p of progRaw) {
      const parent = parentOf.get(p.id);
      if (!parent || keep.has(p.id)) continue;
      const share = (otherTotals.get(parent) ?? 0) / (flows.spendingTotal || 1);
      const keepOwn = share >= minOtherShare || hlSecs.has(parent);
      remap.set(p.id, keepOwn ? otherIdFor(parent) : ALL_OTHER);
    }
    for (const id of keep) drawn.set(id, toProgNode(id, 0));
  }

  // Aggregate sec→program links onto drawn nodes.
  const links: ModelLink[] = [];
  for (const l of flows.links) {
    const sk = kindOf(l.source);
    const tk = kindOf(l.target);
    if (sk === 'revenue' && tk === 'secretariat') {
      const src = revenue.find((r) => r.id === l.source);
      const tgt = secById.get(l.target);
      links.push({
        source: l.source,
        target: l.target,
        value: l.value,
        proportional: Boolean(l.proportional),
        highlighted: Boolean(tgt?.highlighted),
        color: src?.color ?? COLORS.slate,
      });
      continue;
    }
    if (sk === 'secretariat' && tk === 'program') {
      if (focus && (focusFromTree || l.source !== focus)) continue;
      const target = remap.get(l.target) ?? otherIdFor(l.source);
      if (!drawn.has(target)) {
        const isAll = target === ALL_OTHER;
        drawn.set(target, {
          id: target,
          name: isAll ? 'All other programs' : otherName(l.source),
          kind: 'program',
          amount: 0,
          highlighted: isAll ? false : Boolean(secById.get(l.source)?.highlighted),
          parent: isAll ? undefined : l.source,
          bucket: true,
          color: isAll ? COLORS.rule : (secColor.get(l.source) ?? COLORS.blue3),
          order: 0,
        });
      }
      const key = `${l.source}→${target}`;
      const agg = linkAgg.get(key);
      if (agg) agg.value += l.value;
      else {
        const sec = secById.get(l.source);
        const tgtNode = drawn.get(target);
        linkAgg.set(key, {
          source: l.source,
          target,
          value: l.value,
          proportional: Boolean(l.proportional),
          highlighted: Boolean(tgtNode?.highlighted ?? sec?.highlighted),
          color: sec?.color ?? COLORS.blue2,
        });
      }
    }
  }
  links.push(...linkAgg.values());

  // Program amounts = inbound drawn link totals.
  for (const l of linkAgg.values()) {
    const n = drawn.get(l.target);
    if (n) n.amount += l.value;
  }

  // Order programs by parent rank, then value; buckets last within a parent; global other last.
  const progNodes = [...drawn.values()]
    .filter((n) => n.amount > 0)
    .sort((a, b) => {
      const ra = a.id === ALL_OTHER ? 1e9 : (secRank.get(a.parent ?? '') ?? 1e8);
      const rb = b.id === ALL_OTHER ? 1e9 : (secRank.get(b.parent ?? '') ?? 1e8);
      return ra - rb || Number(a.bucket) - Number(b.bucket) || b.amount - a.amount;
    });
  for (const p of progNodes) p.order = order++;

  const kept = new Set([...revenue, ...secNodes, ...progNodes].map((n) => n.id));
  return {
    nodes: [...revenue, ...secNodes, ...progNodes],
    links: links.filter((l) => l.value > 0 && kept.has(l.source) && kept.has(l.target)),
    revenueTotal: flows.revenueTotal,
    spendingTotal: flows.spendingTotal,
    revenue,
    secretariats: secNodes.map((node) => ({ node, programs: fullPrograms.get(node.id) ?? [] })),
  };
}

/**
 * Many secretariats are a rounding error next to Health & Human Services. Fold the
 * ones under `minShare` of spending into one "Smaller offices" secretariat whose
 * "programs" are those offices, so it can be expanded like any other. Secretariats
 * for which `keep` returns true (the reader highlighted them) stay on their own.
 */
export function foldSmallSecretariats(flows: Flows, minShare: number, keep: (secId: string) => boolean = () => false): Flows {
  const total = flows.spendingTotal || 1;
  const small = flows.nodes.filter(
    (n) => n.kind === 'secretariat' && !keep(n.id) && n.value / total < minShare,
  );
  if (small.length < 2) return flows;
  const smallIds = new Set(small.map((n) => n.id));
  const officeId = (secId: string) => `prog:office:${secId.replace(/^sec:/, '')}`;

  const nodes: Flows['nodes'] = [];
  for (const n of flows.nodes) {
    if (smallIds.has(n.id)) continue;
    if (n.kind === 'program' && n.parent && smallIds.has(n.parent)) continue;
    nodes.push(n);
  }
  const smallTotal = small.reduce((a, n) => a + n.value, 0);
  nodes.push({ id: SMALL_SECS, name: `Smaller offices (${small.length})`, kind: 'secretariat', value: smallTotal });
  for (const s of small) {
    nodes.push({ id: officeId(s.id), name: s.name, kind: 'program', value: s.value, parent: SMALL_SECS });
  }

  const agg = new Map<string, Flows['links'][number]>();
  const links: Flows['links'] = [];
  const add = (source: string, target: string, value: number, proportional?: true) => {
    const k = `${source}→${target}`;
    const cur = agg.get(k);
    if (cur) cur.value += value;
    else {
      const l = { source, target, value, ...(proportional ? { proportional } : {}) };
      agg.set(k, l);
      links.push(l);
    }
  };
  for (const l of flows.links) {
    if (smallIds.has(l.target)) add(l.source, SMALL_SECS, l.value, l.proportional);
    // Links out of a small office are replaced by one office total below.
    else if (!smallIds.has(l.source)) links.push(l);
  }
  for (const s of small) {
    // Use the office's outbound program total when present, else its node value.
    const out = flows.links.filter((l) => l.source === s.id).reduce((a, l) => a + l.value, 0);
    add(SMALL_SECS, officeId(s.id), out || s.value);
  }
  return { ...flows, nodes, links };
}
