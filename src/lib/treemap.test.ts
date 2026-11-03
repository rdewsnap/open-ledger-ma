import { describe, expect, it } from 'vitest';
import {
  buildHierarchy,
  highlightTotal,
  isHighlighted,
  decodeNodeParam,
  ellipsize,
  encodeNodeParam,
  fitLabel,
  layoutTreemap,
  resolvePath,
  resolveScalePath,
  textOn,
  tint,
  type Measurer,
} from './treemap';
import type { TreeNode } from './types';

/** 7px per character in every font: deterministic stand-in for canvas measureText. */
const mono7: Measurer = (t) => t.length * 7;

const leaf = (id: string, actual: number, extra: Partial<TreeNode> = {}): TreeNode => ({ id, name: id, enacted: actual, gaa: actual, actual, ...extra });
const tree: TreeNode = {
  id: 'root',
  name: 'Massachusetts state budget',
  enacted: 0,
  gaa: 0,
  actual: 0,
  children: [
    {
      ...leaf('sec:EHS', 0),
      name: 'Health & Human Services',
      children: [
        { ...leaf('dept:EHS/EHS', 0), children: [leaf('prog:40000500', 600), leaf('prog:40000700', 300)] },
        { ...leaf('dept:EHS/DMH', 0), children: [leaf('prog:50110100', 100), leaf('prog:neg', -5)] },
      ],
    },
    {
      ...leaf('sec:EEA', 0),
      children: [{ ...leaf('dept:EEA/DCR', 0), children: [leaf('prog:2', 50)] }],
    },
  ],
};

describe('node param encoding', () => {
  it('encodes secretariats and departments compactly', () => {
    expect(encodeNodeParam('root')).toBeNull();
    expect(encodeNodeParam(null)).toBeNull();
    expect(encodeNodeParam('sec:EHS')).toBe('EHS');
    expect(encodeNodeParam('dept:EHS/DMH')).toBe('EHS.DMH');
  });

  it('decodes to the id chain below root', () => {
    expect(decodeNodeParam(null)).toEqual([]);
    expect(decodeNodeParam('')).toEqual([]);
    expect(decodeNodeParam('EHS')).toEqual(['sec:EHS']);
    expect(decodeNodeParam('EHS.DMH')).toEqual(['sec:EHS', 'dept:EHS/DMH']);
  });

  it('round-trips and survives URLSearchParams unescaped', () => {
    for (const id of ['sec:EHS', 'dept:EHS/DMH', 'dept:EEA/DCR']) {
      const p = encodeNodeParam(id)!;
      expect(decodeNodeParam(p).at(-1)).toBe(id);
      expect(new URLSearchParams({ node: p }).toString()).toBe(`node=${p}`);
    }
  });

  it('accepts raw ids too', () => {
    expect(decodeNodeParam('dept:EHS/DMH')).toEqual(['sec:EHS', 'dept:EHS/DMH']);
    expect(decodeNodeParam(encodeNodeParam('prog:other:EHS/DMH'))).toEqual(['prog:other:EHS/DMH']);
  });

  it('resolves the longest valid prefix and never zooms into a leaf', () => {
    expect(resolvePath(tree, decodeNodeParam('EHS.DMH')).map((n) => n.id)).toEqual(['root', 'sec:EHS', 'dept:EHS/DMH']);
    expect(resolvePath(tree, decodeNodeParam('EHS.NOPE')).map((n) => n.id)).toEqual(['root', 'sec:EHS']);
    expect(resolvePath(tree, decodeNodeParam('ZZZ')).map((n) => n.id)).toEqual(['root']);
    expect(resolvePath(tree, ['sec:EHS', 'dept:EHS/EHS', 'prog:40000500']).map((n) => n.id)).toEqual(['root', 'sec:EHS', 'dept:EHS/EHS']);
  });
});

describe('label fitting', () => {
  it('shows nothing below 24px tall', () => {
    expect(fitLabel(300, 23, 'MassHealth', '$7.4B', mono7)).toEqual({ mode: 'none' });
  });

  it('shows name + amount on two lines when tall and wide enough', () => {
    expect(fitLabel(200, 44, 'MassHealth', '$7.4B', mono7)).toEqual({ mode: 'full', name: 'MassHealth', amount: '$7.4B' });
  });

  it('ellipsizes a long name but keeps the amount', () => {
    const r = fitLabel(100, 44, 'MassHealth managed care', '$7.4B', mono7);
    expect(r.mode).toBe('full');
    if (r.mode === 'full') {
      expect(r.name.endsWith('…')).toBe(true);
      expect(mono7(r.name, 'name')).toBeLessThanOrEqual(100 - 12);
    }
  });

  it('uses a single tiny line between 24 and 40px', () => {
    expect(fitLabel(300, 30, 'MassHealth', '$7.4B', mono7)).toEqual({ mode: 'tiny', name: 'MassHealth', amount: '$7.4B' });
    const r = fitLabel(80, 30, 'MassHealth managed care', '$7.4B', mono7);
    expect(r).toMatchObject({ mode: 'tiny' });
    expect('amount' in r && r.amount).toBeFalsy();
  });

  it('drops the label when not even a few characters fit', () => {
    expect(fitLabel(30, 60, 'MassHealth managed care', '$7.4B', mono7)).toEqual({ mode: 'none' });
  });

  it('reserves room for a leading marker', () => {
    const plain = fitLabel(110, 44, 'Parks & Recreation', '$200M', mono7);
    const leafy = fitLabel(110, 44, 'Parks & Recreation', '$200M', mono7, 14);
    expect(plain.mode).toBe('full');
    expect(leafy.mode).toBe('full');
    if (plain.mode === 'full' && leafy.mode === 'full') expect(leafy.name.length).toBeLessThan(plain.name.length);
  });

  it('ellipsize returns the text untouched when it fits, null when too narrow', () => {
    expect(ellipsize('Courts', 100, 'name', mono7)).toBe('Courts');
    expect(ellipsize('Department of Courts', 20, 'name', mono7)).toBeNull();
  });
});

describe('hierarchy + layout', () => {
  const root = buildHierarchy(tree, 'actual');

  it('sums leaves and clamps negatives', () => {
    expect(root.value).toBe(1050);
    expect(root.children?.[0]?.data.id).toBe('sec:EHS');
  });

  it('highlights descendants and totals highlighted subtrees once', () => {
    const set = new Set(['sec:EEA', 'dept:EEA/DCR']);
    expect(highlightTotal(root, set)).toBe(50);
    expect(isHighlighted(root.find((n) => n.data.id === 'prog:2')!, set)).toBe(true);
    expect(isHighlighted(root.find((n) => n.data.id === 'prog:50110100')!, set)).toBe(false);
    const dmh = new Set(['dept:EHS/DMH']);
    expect(highlightTotal(root, dmh)).toBe(100);
    expect(isHighlighted(root.find((n) => n.data.id === 'prog:50110100')!, dmh)).toBe(true);
  });

  it('lays out two levels with areas proportional to value', () => {
    const cells = layoutTreemap(root, 400, 300);
    expect(cells.filter((c) => c.depth === 1).map((c) => c.id)).toEqual(['sec:EHS', 'sec:EEA']);
    expect(cells.some((c) => c.id.startsWith('prog:'))).toBe(false);
    const a = (id: string) => {
      const c = cells.find((x) => x.id === id)!;
      return (c.x1 - c.x0) * (c.y1 - c.y0);
    };
    expect(a('sec:EHS') / a('sec:EEA')).toBeGreaterThan(10);
    // Zero-value nodes are not drawn.
    const dmh = layoutTreemap(root.find((n) => n.data.id === 'dept:EHS/DMH')!, 200, 100);
    expect(dmh.map((c) => c.id)).toEqual(['prog:50110100']);
  });

  it('resolves a zoom path on the hierarchy', () => {
    expect(resolveScalePath(root, decodeNodeParam('EHS.DMH')).map((n) => n.data.id)).toEqual(['root', 'sec:EHS', 'dept:EHS/DMH']);
    expect(resolveScalePath(root, decodeNodeParam('EEA.NOPE')).map((n) => n.data.id)).toEqual(['root', 'sec:EEA']);
  });

  it('tints toward paper and picks readable text', () => {
    expect(tint('#000000', 0)).toBe('#000000');
    expect(tint('#B5542D', 1)).toBe('#f7f3ea');
    expect(textOn('#2B2824')).toBe('#FFFFFF');
    expect(textOn('#B5542D')).toBe('#FFFFFF');
    expect(textOn('#BB6B45')).toBe('#1A1714');
    expect(textOn('#E6D3B8')).toBe('#1A1714');
  });
});
