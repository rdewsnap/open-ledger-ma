type Option<T> = { value: T; label: string; disabled?: boolean };

type Props<T> = {
  label: string;
  value: T;
  options: Option<T>[];
  onPick: (v: T) => void;
};

/** A row of plain text choices; the active one is underlined in clay. */
export function TextPicker<T extends string | number>({ label, value, options, onPick }: Props<T>) {
  return (
    <div className="flex items-baseline gap-2.5" role="group" aria-label={label}>
      <span className="text-[0.875rem] text-ink-2">{label}</span>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            disabled={o.disabled}
            onClick={() => onPick(o.value)}
            className={`text-[0.92rem] underline-offset-[5px] transition-colors duration-200 disabled:cursor-not-allowed disabled:text-ink-2/40 ${
              on ? 'font-semibold text-ink underline decoration-clay decoration-2' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
