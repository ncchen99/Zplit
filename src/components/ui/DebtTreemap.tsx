import { useMemo, useRef, useEffect, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DebtEntry {
  memberId: string;
  name: string;
  avatarUrl?: string | null;
  /** Absolute value of amount owed (always positive) */
  owed: number;
}

interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
  entry: DebtEntry;
  area: number;
}

interface Props {
  data: DebtEntry[];
  /** Override height in px. When omitted the component auto-sizes based on layout. */
  height?: number;
  /** Format the displayed amount string */
  formatAmount?: (amount: number) => string;
  /** Called when a block is clicked */
  onBlockClick?: (entry: DebtEntry) => void;
}

/* ------------------------------------------------------------------ */
/*  Squarified Treemap Algorithm                                       */
/* ------------------------------------------------------------------ */

function worst(row: number[], sideLength: number): number {
  if (row.length === 0 || sideLength <= 0) return Infinity;
  const rowSum = row.reduce((a, b) => a + b, 0);
  const s2 = sideLength * sideLength;
  const rMax = Math.max(...row);
  const rMin = Math.min(...row);
  const sum2 = rowSum * rowSum;
  return Math.max((s2 * rMax) / sum2, sum2 / (s2 * rMin));
}

interface LayoutItem {
  entry: DebtEntry;
  area: number;
}

function layoutRow(
  row: LayoutItem[],
  rect: { x: number; y: number; w: number; h: number },
): { rects: TreemapRect[]; remaining: { x: number; y: number; w: number; h: number } } {
  if (row.length === 0) return { rects: [], remaining: rect };

  const rowArea = row.reduce((s, r) => s + r.area, 0);
  const isHorizontal = rect.w >= rect.h;
  const side = isHorizontal ? rect.h : rect.w;
  const thickness = side > 0 ? rowArea / side : 0;

  const rects: TreemapRect[] = [];
  let offset = 0;

  for (const item of row) {
    const len = thickness > 0 ? item.area / thickness : 0;
    if (isHorizontal) {
      rects.push({
        x: rect.x, y: rect.y + offset, w: thickness, h: len,
        entry: item.entry, area: item.area,
      });
    } else {
      rects.push({
        x: rect.x + offset, y: rect.y, w: len, h: thickness,
        entry: item.entry, area: item.area,
      });
    }
    offset += len;
  }

  const remaining = isHorizontal
    ? { x: rect.x + thickness, y: rect.y, w: rect.w - thickness, h: rect.h }
    : { x: rect.x, y: rect.y + thickness, w: rect.w, h: rect.h - thickness };

  return { rects, remaining };
}

function squarify(
  items: LayoutItem[],
  container: { x: number; y: number; w: number; h: number },
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ ...container, entry: items[0].entry, area: items[0].area }];
  }

  const results: TreemapRect[] = [];
  let remaining = [...items];
  let rect = { ...container };

  while (remaining.length > 0) {
    const side = Math.min(rect.w, rect.h);

    if (remaining.length === 1) {
      results.push({ ...rect, entry: remaining[0].entry, area: remaining[0].area });
      break;
    }

    const row: LayoutItem[] = [remaining[0]];
    let rowAreas = [remaining[0].area];

    for (let i = 1; i < remaining.length; i++) {
      const candidate = remaining[i];
      const newAreas = [...rowAreas, candidate.area];
      if (worst(newAreas, side) <= worst(rowAreas, side)) {
        row.push(candidate);
        rowAreas = newAreas;
      } else {
        break;
      }
    }

    const { rects: laid, remaining: newRect } = layoutRow(row, rect);
    results.push(...laid);
    rect = newRect;
    remaining = remaining.slice(row.length);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Adaptive height                                                    */
/* ------------------------------------------------------------------ */

/**
 * Simple count-based height:
 *   1 debtor  →  72px   (single wide bar)
 *   2 debtors → 100px
 *   3 debtors → 130px
 *   4 debtors → 150px
 *   5+        → 180px
 */
function computeAdaptiveHeight(n: number): number {
  if (n <= 1) return 72;
  if (n === 2) return 100;
  if (n === 3) return 130;
  if (n === 4) return 150;
  return 180;
}

/* ------------------------------------------------------------------ */
/*  Colour helpers — soft pastel palette                               */
/* ------------------------------------------------------------------ */

/**
 * Soft pastel heatmap: 0 → pale cream, 1 → muted rose/salmon
 * Deliberately low saturation for a gentle look.
 */
function heatColor(t: number): string {
  // hue: 40 (warm cream) → 0 (rose)
  const hue = Math.round(40 * (1 - t));
  // saturation: 20% → 55%
  const sat = Math.round(20 + 35 * t);
  // lightness: 95% → 72%
  const light = Math.round(95 - 23 * t);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function textColorForHeat(t: number): string {
  const light = 95 - 23 * t;
  return light < 60 ? '#ffffff' : '#2d2d2d';
}

function subTextColorForHeat(t: number): string {
  const light = 95 - 23 * t;
  return light < 60 ? 'rgba(255,255,255,0.8)' : 'rgba(45,45,45,0.55)';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const GAP = 2;
const BASE_NAME_SIZE = 14;
const BASE_AMOUNT_SIZE = 12;
const SMALL_NAME_SIZE = 11;
const SMALL_AMOUNT_SIZE = 10;

export function DebtTreemap({ data, height: heightProp, formatAmount, onBlockClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const fmt = (amount: number) =>
    formatAmount ? formatAmount(amount) : `-$${amount.toLocaleString()}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = heightProp ?? computeAdaptiveHeight(data.length);

  const rects = useMemo(() => {
    if (containerWidth <= 0 || data.length === 0) return [];

    const totalArea = containerWidth * height;
    const maxOwed = Math.max(...data.map((d) => d.owed));

    const sorted = data.slice().sort((a, b) => b.owed - a.owed);
    const rawWeights = sorted.map((d) => {
      const norm = maxOwed > 0 ? d.owed / maxOwed : 1;
      return Math.max(Math.pow(norm, 0.65), 0.12);
    });
    const weightSum = rawWeights.reduce((a, b) => a + b, 0);

    const items: LayoutItem[] = sorted.map((entry, i) => ({
      entry,
      area: (rawWeights[i] / weightSum) * totalArea,
    }));

    return squarify(items, { x: 0, y: 0, w: containerWidth, h: height });
  }, [data, containerWidth, height]);

  const maxOwed = useMemo(() => Math.max(...data.map((d) => d.owed), 1), [data]);

  if (data.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl"
      style={{ height }}
    >
      {rects.map((rect) => {
        const innerW = rect.w - GAP;
        const innerH = rect.h - GAP;
        if (innerW <= 0 || innerH <= 0) return null;

        const t = maxOwed > 0 ? rect.entry.owed / maxOwed : 0;
        const bg = heatColor(t);
        const fg = textColorForHeat(t);
        const fgSub = subTextColorForHeat(t);

        const area = innerW * innerH;
        const showFull = area > 2400 && innerW > 50 && innerH > 36;
        const showSmall = !showFull && area > 1200 && innerW > 40 && innerH > 30;
        const showInitial = !showFull && !showSmall && area > 400 && Math.min(innerW, innerH) > 20;

        return (
          <button
            key={rect.entry.memberId}
            type="button"
            className="absolute flex items-center justify-center overflow-hidden active:brightness-90 transition-[filter]"
            style={{
              left: rect.x + GAP / 2,
              top: rect.y + GAP / 2,
              width: innerW,
              height: innerH,
              backgroundColor: bg,
            }}
            onClick={() => onBlockClick?.(rect.entry)}
          >
            {showFull && (
              <div className="flex flex-col items-center justify-center px-2 text-center">
                <span
                  className="font-semibold leading-tight truncate max-w-full"
                  style={{ color: fg, fontSize: BASE_NAME_SIZE }}
                >
                  {rect.entry.name}
                </span>
                <span
                  className="leading-tight truncate max-w-full mt-0.5"
                  style={{ color: fgSub, fontSize: BASE_AMOUNT_SIZE }}
                >
                  {fmt(rect.entry.owed)}
                </span>
              </div>
            )}
            {showSmall && (
              <div className="flex flex-col items-center justify-center px-1 text-center">
                <span
                  className="font-semibold leading-tight truncate max-w-full"
                  style={{ color: fg, fontSize: SMALL_NAME_SIZE }}
                >
                  {rect.entry.name}
                </span>
                <span
                  className="leading-tight truncate max-w-full mt-0.5"
                  style={{ color: fgSub, fontSize: SMALL_AMOUNT_SIZE }}
                >
                  {fmt(rect.entry.owed)}
                </span>
              </div>
            )}
            {showInitial && (
              <span className="font-bold" style={{ color: fg, fontSize: SMALL_NAME_SIZE }}>
                {rect.entry.name.charAt(0)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
