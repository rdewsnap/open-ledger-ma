type Props = {
  delta: number;
  /** Largest |change| in the current set; half the track is this much. */
  max: number;
  highlighted?: boolean;
  /** A highlight set is active: highlighted bars turn gold, the rest step back. */
  highlighting?: boolean;
  thin?: boolean;
};

/**
 * Inline diverging bar: increases grow right in brick, decreases grow left in
 * slate, from a zero line in ink. While a highlight is active, highlighted rows
 * are gold and everything else steps back.
 */
export function DiffBar({ delta, max, highlighted = false, highlighting = false, thin = false }: Props) {
  const share = max > 0 ? Math.min(1, Math.abs(delta) / max) : 0;
  // Keep any non-zero change visible as a sliver.
  const pct = delta === 0 ? 0 : Math.max(share * 50, 0.6);
  const color = highlighting && highlighted ? 'bg-gold' : delta > 0 ? 'bg-brick' : 'bg-slate';
  const dim = highlighting && !highlighted ? 'opacity-45' : '';
  return (
    <div aria-hidden="true" className={`relative w-full ${thin ? 'h-1.5' : 'h-3'}`}>
      <span
        className={`absolute top-0 bottom-0 rounded-[2px] ${color} ${dim}`}
        style={delta >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
      />
      <span className={`absolute left-1/2 w-px -translate-x-1/2 bg-ink ${thin ? '-top-0.5 -bottom-0.5' : '-top-1 -bottom-1'}`} />
    </div>
  );
}
