import { describe, expect, it } from 'vitest';
import {
  ancestorIndex,
  encodeHighlightParam,
  highlightSet,
  highlightSubtotal,
  inHighlight,
  parseHighlightParam,
  secOf,
} from './highlight';
import type { TreeNode } from './types';

const leaf = (id: string, v: number): TreeNode => ({ id, name: id, enacted: v * 2, gaa: v * 2, actual: v });
const tree: TreeNode = {
  id: 'root',
  name: 'Budget',
  enacted: 0,
  gaa: 0,
  actual: 0,
  children: [
    {
      ...leaf('sec:EHS', 0),
      children: [
        { ...leaf('dept:EHS/EHS', 0), children: [leaf('prog:1', 600), leaf('prog:2', 300)] },
        { ...leaf('dept:EHS/DMH', 0), children: [leaf('prog:3', 100), leaf('prog:neg', -5)] },
      ],
    },
    { ...leaf('sec:EEA', 0), children: [{ ...leaf('dept:EEA/DCR', 0), children: [leaf('prog:4', 50)] }] },
  ],
};

describe('hl param', () => {
  it('parses sec and dept ids, dropping junk and repeats', () => {
    expect(parseHighlightParam('sec:EEA,dept:EHS/DMH')).toEqual(['sec:EEA', 'dept:EHS/DMH']);
    expect(parseHighlightParam(' sec:EEA , ,nope,prog:1,sec:EEA,dept:EHS')).toEqual(['sec:EEA']);
    expect(parseHighlightParam(null)).toEqual([]);
  });
  it('encodes to null when empty', () => {
    expect(encodeHighlightParam([])).toBeNull();
    expect(encodeHighlightParam(['dept:EHS/DMH', 'sec:EEA'])).toBe('dept:EHS/DMH,sec:EEA');
  });
  it('finds the secretariat of an id', () => {
    expect(secOf('dept:EHS/DMH')).toBe('sec:EHS');
    expect(secOf('sec:EEA')).toBe('sec:EEA');
    expect(secOf('prog:1')).toBeNull();
  });
});

describe('highlightSet', () => {
  it('keeps ids that exist in this year, silently', () => {
    expect([...highlightSet(tree, ['sec:EEA', 'sec:GONE', 'dept:EHS/DMH'])]).toEqual(['sec:EEA', 'dept:EHS/DMH']);
    expect(highlightSet(null, ['sec:EEA']).size).toBe(0);
  });
  it('drops a department whose secretariat is selected', () => {
    expect([...highlightSet(tree, ['dept:EHS/DMH', 'sec:EHS'])]).toEqual(['sec:EHS']);
  });
});

describe('membership and subtotal', () => {
  const anc = ancestorIndex(tree);
  it('matches a program by its department or secretariat', () => {
    expect(inHighlight('prog:3', new Set(['dept:EHS/DMH']), anc)).toBe(true);
    expect(inHighlight('prog:1', new Set(['dept:EHS/DMH']), anc)).toBe(false);
    expect(inHighlight('prog:4', new Set(['sec:EEA']), anc)).toBe(true);
    expect(inHighlight('prog:other:EEA', new Set(['sec:EEA']), anc, 'sec:EEA')).toBe(true);
    expect(inHighlight('prog:4', new Set(), anc)).toBe(false);
  });
  it('sums the top-most selected subtrees once, negatives as zero', () => {
    expect(highlightSubtotal(tree, new Set(['sec:EHS', 'dept:EHS/DMH']), 'actual')).toEqual({ part: 1000, whole: 1050 });
    expect(highlightSubtotal(tree, new Set(['dept:EEA/DCR']), 'enacted')).toEqual({ part: 100, whole: 2100 });
    expect(highlightSubtotal(tree, new Set(), 'actual').part).toBe(0);
  });
});
