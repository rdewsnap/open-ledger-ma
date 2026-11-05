/**
 * Money and percent formatting rules:
 *   $62.6B · $551M · $84M · $8.5M · $900K
 * One decimal for B; no decimals for M at or above $10M; one decimal under $10M;
 * none for K. Percent to one decimal.
 */

const MINUS = '−';

function trimRound(n: number, decimals: number): string {
  return n.toFixed(decimals);
}

export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? MINUS : '';
  const abs = Math.abs(value);

  // Decide the unit after rounding, so $999.96M reads as $1.0B, not $1000M.
  if (abs >= 1e9 || Number(trimRound(abs / 1e6, 0)) >= 1000) {
    return `${sign}$${trimRound(abs / 1e9, 1)}B`;
  }
  if (abs >= 1e6 || Number(trimRound(abs / 1e3, 0)) >= 1000) {
    const m = abs / 1e6;
    const decimals = Number(m.toFixed(1)) >= 10 ? 0 : 1;
    return `${sign}$${trimRound(m, decimals)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}$${trimRound(abs / 1e3, 0)}K`;
  }
  return `${sign}$${trimRound(abs, 0)}`;
}

/** Signed money change, e.g. "+$1.2B", "−$84M", "$0". */
export function formatMoneyChange(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '$0';
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

/**
 * An amount divided among residents: "$9,757", "$84", "$9.09", "less than 1¢".
 * Whole dollars from $10 up, cents below.
 */
export function formatPerResident(amount: number, residents: number): string {
  if (!residents || !Number.isFinite(amount) || !Number.isFinite(residents)) return '—';
  const each = Math.abs(amount) / residents;
  const sign = amount < 0 ? MINUS : '';
  if (each === 0) return '$0';
  if (each < 0.005) return 'less than 1¢';
  if (each < 9.995) return `${sign}$${each.toFixed(2)}`;
  return `${sign}$${Math.round(each).toLocaleString('en-US')}`;
}

/** Share of a whole, as "36.8%". Accepts a ratio (0.368). */
export function formatShare(part: number, whole: number): string {
  if (!whole || !Number.isFinite(part) || !Number.isFinite(whole)) return '—';
  return formatPercent(part / whole);
}

/** Ratio → "36.8%". Values that round to zero but aren't zero read "<0.1%". */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  const pct = ratio * 100;
  if (pct !== 0 && Math.abs(pct) < 0.05) return pct > 0 ? '<0.1%' : `${MINUS}<0.1%`;
  const s = Math.abs(pct).toFixed(1);
  return `${pct < 0 ? MINUS : ''}${s}%`;
}

/** Signed percent change, e.g. "+4.2%", "−0.8%". null → "new". */
export function formatPercentChange(ratio: number | null): string {
  if (ratio === null) return 'new';
  if (!Number.isFinite(ratio)) return '—';
  const s = formatPercent(ratio);
  return ratio > 0 ? `+${s}` : s;
}

/** 2027 → "FY27"; long form "FY2027". */
export function fyShort(year: number): string {
  return `FY${String(year).slice(-2)}`;
}
export function fyLong(year: number): string {
  return `FY${year}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-03" → "Nov 2026" (parsed as a calendar date, no timezone drift). */
export function monthYear(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : isoDate;
}

/** "2026-11-03" → "Nov 3, 2026". */
export function longDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : isoDate;
}

const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/**
 * How far into fiscal year `year` (July 1 to June 30) a cut-off date falls, to the
 * nearest month: (2027, "2026-11-03") → "four months".
 */
export function monthsInto(year: number, isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return '';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const n = Math.min(12, Math.max(1, Math.round((y - (year - 1)) * 12 + (mo - 7) + d / days)));
  return `${COUNT_WORDS[n - 1]} ${n === 1 ? 'month' : 'months'}`;
}

/** "FY27 in progress — spending through Nov 3, 2026; revenue through Sep 30, 2026" */
export function partialLabel(
  year: number,
  partial: { through: string; label: string; revenueThrough?: string },
): string {
  const rev = partial.revenueThrough ? `; revenue through ${longDate(partial.revenueThrough)}` : '';
  return `${fyShort(year)} ${partial.label} — spending through ${longDate(partial.through)}${rev}`;
}

const UNITS: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };

/** Reads "$65M", "65 million", "1.2b", "65,000,000" as dollars; null when it is not an amount. */
export function parseAmount(text: string): number | null {
  const m = text
    .trim()
    .toLowerCase()
    .replace(/[$,\s]/g, '')
    .match(/^(\d+(?:\.\d+)?|\.\d+)([a-z]*)$/);
  if (!m) return null;
  const unit = m[2] ? UNITS[m[2]] : 1;
  if (unit === undefined) return null;
  const value = Number(m[1]) * unit;
  return value > 0 && Number.isFinite(value) ? value : null;
}
