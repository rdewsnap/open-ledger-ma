export function BucketTag() {
  return (
    <span
      title="Smaller line items in this department, summed"
      className="shrink-0 rounded-[3px] border border-rule px-1 text-[0.72rem] leading-[1.35] whitespace-nowrap text-ink-2"
    >
      bucket
    </span>
  );
}

/** Neutral marker for highlighted rows (the non-color signal next to the bar tint). */
export function HighlightDot() {
  return (
    <span role="img" aria-label="Highlighted" title="Highlighted" className="inline-block h-2 w-2 shrink-0 rounded-full bg-moss" />
  );
}
