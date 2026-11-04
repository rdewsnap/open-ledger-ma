/** "55 items" on an "Other {Department}" row: how many smaller line items it adds together. */
export function BucketTag({ accounts }: { accounts: number | null }) {
  return (
    <span
      title={`${accounts ?? 'Several'} smaller line item${accounts === 1 ? '' : 's'} in this department, added together`}
      className="shrink-0 rounded-[3px] border border-rule px-1 text-[0.75rem] leading-[1.35] whitespace-nowrap text-ink-2"
    >
      {accounts ? `${accounts} item${accounts === 1 ? '' : 's'}` : 'grouped'}
    </span>
  );
}

