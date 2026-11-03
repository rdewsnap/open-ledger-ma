import { useEffect, useMemo, useState } from 'react';
import type { LabelFont, Measurer } from '../../lib/treemap';

/** Must match the label styles in Treemap.tsx. */
export const LABEL_FONTS: Record<LabelFont, string> = {
  name: '600 12.5px "Inter Variable", system-ui, sans-serif',
  tiny: '500 11px "Inter Variable", system-ui, sans-serif',
  amount: '400 11px "JetBrains Mono Variable", ui-monospace, monospace',
};

/**
 * Canvas text measurer for label fitting. Re-created once web fonts finish
 * loading, so labels are re-measured with the real metrics.
 */
export function useMeasurer(): Measurer {
  const [fontsReady, setFontsReady] = useState(() => typeof document === 'undefined' || document.fonts?.status === 'loaded');
  useEffect(() => {
    if (fontsReady || typeof document === 'undefined' || !document.fonts) return;
    let live = true;
    void document.fonts.ready.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, [fontsReady]);

  return useMemo(() => createMeasurer(fontsReady), [fontsReady]);
}

/** Canvas-backed, cached text measurer (falls back to an average glyph width). */
function createMeasurer(fontsReady: boolean): Measurer {
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const cache = new Map<string, number>();
  // Fallback (no canvas): a generous average glyph width.
  const fallback: Record<LabelFont, number> = { name: 7.2, tiny: 6.3, amount: 6.7 };
  return (text: string, font: LabelFont) => {
    const key = `${font}\u0000${text}\u0000${fontsReady ? 1 : 0}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let w: number;
    if (ctx) {
      ctx.font = LABEL_FONTS[font];
      w = ctx.measureText(text).width;
    } else w = text.length * fallback[font];
    cache.set(key, w);
    return w;
  };
}
