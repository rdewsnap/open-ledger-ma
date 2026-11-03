/** Shapes from docs/DATA_CONTRACT.md. Dollars are plain USD numbers. */

export type SourceInfo = {
  id: string;
  name: string;
  url: string;
  pulled: string;
  api?: string;
  rowsUpdatedAt?: string;
  filter?: string;
};

export type YearTotals = { enacted: number; gaa: number; actual: number; revenue: number };

export type Meta = {
  generated: string;
  years: number[];
  partial?: Record<string, { through: string; label: string; revenueThrough?: string }>;
  sources: { spending: SourceInfo; revenue: SourceInfo };
  totals: Record<string, YearTotals>;
  revenueGroups?: { id: string; name: string }[];
  coverage?: Record<string, { mappedAccounts: number; otherAccounts: number; otherBuckets: number; mappedShareActual: number; mappedShareEnacted: number }>;
};

export type TreeNode = {
  id: string;
  name: string;
  raw?: string;
  code?: string;
  enacted: number;
  gaa: number;
  actual: number;
  conservation?: true;
  other?: true;
  children?: TreeNode[];
};

export type FlowNodeKind = 'revenue' | 'secretariat' | 'program';

export type FlowNode = {
  id: string;
  name: string;
  kind: FlowNodeKind;
  value: number;
  conservation?: true;
  parent?: string;
  other?: true;
};

export type FlowLink = { source: string; target: string; value: number; proportional?: true };

export type Measure = 'actual' | 'enacted';

export type Flows = {
  nodes: FlowNode[];
  links: FlowLink[];
  revenueTotal: number;
  spendingTotal: number;
  measure: Measure;
};
