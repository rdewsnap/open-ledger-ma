import { describe, expect, it } from 'vitest';
import { fixtureFlows } from '../fixtures';
import { buildFlowModel } from './flowModel';

const flows = fixtureFlows('enacted');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('buildFlowModel', () => {
  it('keeps the spending total intact after folding programs', () => {
    const m = buildFlowModel(flows, { topPrograms: 6 });
    const progIn = sum(m.links.filter((l) => l.source.startsWith('sec:')).map((l) => l.value));
    expect(progIn).toBeCloseTo(sum(flows.links.filter((l) => l.source.startsWith('sec:')).map((l) => l.value)), -2);
    const programs = m.nodes.filter((n) => n.kind === 'program');
    expect(programs.filter((p) => !p.bucket).length).toBe(6);
  });

  it('shows only the focused secretariat programs', () => {
    const m = buildFlowModel(flows, { focus: 'sec:EEA' });
    const programs = m.nodes.filter((n) => n.kind === 'program');
    expect(programs.every((p) => p.parent === 'sec:EEA')).toBe(true);
    expect(programs.every((p) => p.conservation)).toBe(true);
  });

  it('orders columns by value', () => {
    const m = buildFlowModel(flows);
    const secs = m.nodes.filter((n) => n.kind === 'secretariat');
    for (let i = 1; i < secs.length; i++) expect(secs[i - 1]!.amount).toBeGreaterThanOrEqual(secs[i]!.amount);
  });

  it('marks revenue links proportional', () => {
    const m = buildFlowModel(flows);
    expect(m.links.filter((l) => l.source.startsWith('rev:')).every((l) => l.proportional)).toBe(true);
  });
});

describe('foldSmallSecretariats', () => {
  it('folds tiny secretariats but never conservation ones', async () => {
    const { foldSmallSecretariats, SMALL_SECS } = await import('./flowModel');
    const f = fixtureFlows('enacted');
    const folded = foldSmallSecretariats(f, 0.05);
    const secs = folded.nodes.filter((n) => n.kind === 'secretariat');
    expect(secs.some((n) => n.id === SMALL_SECS)).toBe(true);
    expect(secs.some((n) => n.id === 'sec:EEA')).toBe(true);
    const revIn = (fl: typeof f) => fl.links.filter((l) => l.source.startsWith('rev:')).reduce((a, l) => a + l.value, 0);
    expect(revIn(folded)).toBe(revIn(f));
  });
});
