/**
 * Highlight lens: a reader-chosen set of secretariat/department ids, kept in the
 * URL as `?hl=sec:EEA,dept:EHS/DMH` and shown across Flow, Scale and Changes.
 * Pure helpers (no DOM) so they can be unit tested.
 */
import type { Measure, TreeNode } from './types';

export type HighlightSet = ReadonlySet<string>;

export const NO_HIGHLIGHT: HighlightSet = new Set();

const ID = /^(sec:[A-Za-z0-9_-]+|dept:[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)$/;

/** "sec:EEA,dept:EHS/DMH" → ["sec:EEA", "dept:EHS/DMH"]. Malformed and repeated ids drop out. */
export function parseHighlightParam(param: string | null | undefined): string[] {
  if (!param) return [];
  const out: string[] = [];
  for (const raw of param.split(',')) {
    const id = raw.trim();
    if (ID.test(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function encodeHighlightParam(ids: readonly string[]): string | null {
  const clean = parseHighlightParam(ids.join(','));
  return clean.length ? clean.join(',') : null;
}

/** The secretariat a sec/dept id belongs to: "dept:EHS/DMH" → "sec:EHS". */
export function secOf(id: string): string | null {
  if (id.startsWith('sec:')) return id;
  const dept = id.match(/^dept:([^/]+)\//);
  return dept ? `sec:${dept[1]}` : null;
}

/** Secretariat and department nodes of a year's tree, by id. */
export function indexTree(tree: TreeNode): Map<string, TreeNode> {
  const out = new Map<string, TreeNode>();
  for (const sec of tree.children ?? []) {
    out.set(sec.id, sec);
    for (const dept of sec.children ?? []) if (dept.id.startsWith('dept:')) out.set(dept.id, dept);
  }
  return out;
}

/**
 * The ids from the URL that exist in this year's tree. Ids from another year
 * are ignored silently; a department under a selected secretariat is redundant
 * and drops out.
 */
export function highlightSet(tree: TreeNode | null | undefined, ids: readonly string[]): HighlightSet {
  if (!tree || ids.length === 0) return NO_HIGHLIGHT;
  const index = indexTree(tree);
  const out = new Set<string>();
  for (const id of ids) if (index.has(id)) out.add(id);
  for (const id of [...out]) {
    const sec = secOf(id);
    if (id.startsWith('dept:') && sec && out.has(sec)) out.delete(id);
  }
  return out.size ? out : NO_HIGHLIGHT;
}

/**
 * Ancestor sec/dept ids for every node in the tree (programs included), so a
 * program can be tested against the set without walking the tree again.
 */
export function ancestorIndex(tree: TreeNode | null | undefined): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!tree) return out;
  const walk = (n: TreeNode, chain: string[]) => {
    out.set(n.id, chain);
    const next = n.id.startsWith('sec:') || n.id.startsWith('dept:') ? [...chain, n.id] : chain;
    n.children?.forEach((k) => walk(k, next));
  };
  for (const sec of tree.children ?? []) walk(sec, []);
  return out;
}

/** True when the id, or any sec/dept id above it, is in the set. */
export function inHighlight(id: string, set: HighlightSet, ancestors: Map<string, string[]>, fallbackParent?: string): boolean {
  if (set.size === 0) return false;
  if (set.has(id)) return true;
  const chain = ancestors.get(id);
  if (chain) return chain.some((a) => set.has(a));
  return fallbackParent ? set.has(fallbackParent) : false;
}

/** Leaves summed with negatives as zero (the same rule the treemap draws by). */
function leafSum(n: TreeNode, measure: Measure): number {
  if (!n.children?.length) return Math.max(0, n[measure] ?? 0);
  return n.children.reduce((a, k) => a + leafSum(k, measure), 0);
}

/**
 * Subtotal of the highlighted subtrees and the whole budget for one measure.
 * Only the top-most selected nodes count, so nothing is counted twice.
 */
export function highlightSubtotal(tree: TreeNode, set: HighlightSet, measure: Measure): { part: number; whole: number } {
  const whole = leafSum(tree, measure);
  if (set.size === 0) return { part: 0, whole };
  let part = 0;
  const walk = (n: TreeNode) => {
    if (set.has(n.id)) {
      part += leafSum(n, measure);
      return;
    }
    n.children?.forEach(walk);
  };
  walk(tree);
  return { part, whole };
}
