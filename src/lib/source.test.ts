import { describe, expect, it } from 'vitest';
import { parseSourceQuery, readableName, sourcePath } from './source';

describe('source rows paths', () => {
  it('round-trips a query', () => {
    const path = sourcePath({ ds: 'spending', years: [2025, 2026], account: '7061-0008' });
    expect(path).toBe('/source?ds=spending&fy=2025%2C2026&acct=70610008');
    const q = parseSourceQuery(new URLSearchParams(path.split('?')[1]));
    expect(q).toEqual({ ds: 'spending', years: [2025, 2026], account: '70610008', page: 1 });
  });
  it('rejects a query without a year', () => {
    expect(parseSourceQuery(new URLSearchParams('ds=spending'))).toBeNull();
  });
});

describe('readableName', () => {
  it('title-cases all-caps names and drops trailing commas', () => {
    expect(readableName('REIMBURSEMENT OF SCHOOL AID TO CITIES,')).toBe('Reimbursement of School Aid to Cities');
    expect(readableName('DEPARTMENT OF MENTAL HEALTH (DMH)')).toBe('Department of Mental Health (DMH)');
    expect(readableName('EXECUTIVE OFFICE OF HEALTH and HUMAN SERVICES')).toBe('Executive Office of Health and Human Services');
  });
  it('leaves mixed case alone', () => {
    expect(readableName('Chapter 70 school aid')).toBe('Chapter 70 school aid');
  });
});
