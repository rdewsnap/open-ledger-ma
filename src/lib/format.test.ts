import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatMoneyChange,
  formatPercent,
  formatPercentChange,
  formatShare,
  fyShort,
  monthYear,
  longDate,
  monthsInto,
  formatPerResident,
  parseAmount,
  partialLabel,
} from './format';

describe('formatMoney', () => {
  it('matches the documented examples', () => {
    expect(formatMoney(62_580_000_000)).toBe('$62.6B');
    expect(formatMoney(551_000_000)).toBe('$551M');
    expect(formatMoney(84_200_000)).toBe('$84M');
    expect(formatMoney(8_500_000)).toBe('$8.5M');
    expect(formatMoney(900_000)).toBe('$900K');
  });
  it('rolls units over after rounding', () => {
    expect(formatMoney(999_960_000)).toBe('$1.0B');
    expect(formatMoney(999_600)).toBe('$1.0M');
    expect(formatMoney(9_960_000)).toBe('$10M');
  });
  it('keeps one decimal on billions', () => {
    expect(formatMoney(1_000_000_000)).toBe('$1.0B');
    expect(formatMoney(22_810_000_000)).toBe('$22.8B');
  });
  it('handles small, zero and negative values', () => {
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(412)).toBe('$412');
    expect(formatMoney(-1_240_000_000)).toBe('−$1.2B');
    expect(formatMoney(Number.NaN)).toBe('—');
  });
});

describe('formatMoneyChange', () => {
  it('signs changes', () => {
    expect(formatMoneyChange(1_200_000_000)).toBe('+$1.2B');
    expect(formatMoneyChange(-84_000_000)).toBe('−$84M');
    expect(formatMoneyChange(0)).toBe('$0');
  });
});

describe('percent', () => {
  it('formats shares to one decimal', () => {
    expect(formatShare(23.0, 62.5)).toBe('36.8%');
    expect(formatPercent(0.368)).toBe('36.8%');
    expect(formatPercent(1)).toBe('100.0%');
  });
  it('marks tiny non-zero shares', () => {
    expect(formatPercent(0.0002)).toBe('<0.1%');
    expect(formatPercent(0)).toBe('0.0%');
  });
  it('guards zero denominators', () => {
    expect(formatShare(5, 0)).toBe('—');
  });
  it('signs percent changes', () => {
    expect(formatPercentChange(0.042)).toBe('+4.2%');
    expect(formatPercentChange(-0.008)).toBe('−0.8%');
    expect(formatPercentChange(null)).toBe('new');
  });
});

describe('labels', () => {
  it('formats fiscal years and months', () => {
    expect(fyShort(2027)).toBe('FY27');
    expect(monthYear('2026-11-03')).toBe('Nov 2026');
  });
});

describe('partial-year labels', () => {
  it('names both cut-off dates', () => {
    expect(longDate('2026-09-30')).toBe('Sep 30, 2026');
    expect(
      partialLabel(2027, { through: '2026-11-03', label: 'in progress', revenueThrough: '2026-09-30' }),
    ).toBe('FY27 in progress — spending through Nov 3, 2026; revenue through Sep 30, 2026');
  });
  it('says how many months into the fiscal year a cut-off falls', () => {
    expect(monthsInto(2027, '2026-11-03')).toBe('four months');
    expect(monthsInto(2027, '2026-09-30')).toBe('three months');
    expect(monthsInto(2027, '2026-07-02')).toBe('one month');
    expect(monthsInto(2027, '2027-06-30')).toBe('twelve months');
  });
});

describe('parseAmount', () => {
  it('reads the ways people write amounts', () => {
    expect(parseAmount('$65M')).toBe(65_000_000);
    expect(parseAmount('65 million')).toBe(65_000_000);
    expect(parseAmount('1.2b')).toBe(1_200_000_000);
    expect(parseAmount('65,000,000')).toBe(65_000_000);
    expect(parseAmount('$400K')).toBe(400_000);
  });
  it('rejects what is not an amount', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('65 lots')).toBeNull();
    expect(parseAmount('0')).toBeNull();
  });
});

describe('formatPerResident', () => {
  it('uses whole dollars from $10 and cents below', () => {
    expect(formatPerResident(69_802_692_201, 7_154_084)).toBe('$9,757');
    expect(formatPerResident(595_000_000, 7_154_084)).toBe('$83');
    expect(formatPerResident(65_000_000, 7_154_084)).toBe('$9.09');
    expect(formatPerResident(20_000, 7_154_084)).toBe('less than 1¢');
    expect(formatPerResident(0, 7_154_084)).toBe('$0');
    expect(formatPerResident(100, 0)).toBe('—');
  });
});
