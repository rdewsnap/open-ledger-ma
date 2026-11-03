import { COLORS } from '../../lib/flowModel';

/** Neutral marker for highlighted nodes: a small filled moss dot with a paper ring. */
export function HighlightDot({ size = 8, onDark = false, title }: { size?: number; onDark?: boolean; title?: string }) {
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: COLORS.moss,
        boxShadow: `0 0 0 1.5px ${onDark ? COLORS.paper : 'rgba(247,243,234,0.9)'}`,
      }}
    />
  );
}
