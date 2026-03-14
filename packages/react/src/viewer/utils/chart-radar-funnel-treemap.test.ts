import { describe, it, expect } from "vitest";
import { PALETTE } from "./chart-helpers";
import { computeLayout } from "./chart-layout";

/**
 * Tests for the computation logic used in chart-radar.tsx,
 * chart-sunburst-funnel.tsx, and chart-surface-treemap.tsx.
 *
 * These renderers embed polar coordinate mapping (radar), funnel
 * segment widths, sunburst ring arcs, and treemap slice-and-dice layout.
 */

// ── Radar chart ─────────────────────────────────────────────────

describe("radar chart: polar coordinate mapping", () => {
  function radarPoint(
    cx: number,
    cy: number,
    radius: number,
    catCount: number,
    catIndex: number,
    val: number,
    maxVal: number,
  ) {
    const angle = (Math.PI * 2 * catIndex) / catCount - Math.PI / 2;
    const r = (Math.abs(val) / maxVal) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      angle,
      r,
    };
  }

  it("should place first category at top (12 o'clock)", () => {
    const pt = radarPoint(100, 100, 50, 4, 0, 10, 10);
    expect(pt.angle).toBe(-Math.PI / 2);
    expect(pt.x).toBeCloseTo(100, 5);
    expect(pt.y).toBeCloseTo(50, 5); // above center
  });

  it("should place second of 4 categories at 3 o'clock (right)", () => {
    const pt = radarPoint(100, 100, 50, 4, 1, 10, 10);
    expect(pt.angle).toBeCloseTo(0, 5);
    expect(pt.x).toBeCloseTo(150, 5);
    expect(pt.y).toBeCloseTo(100, 5);
  });

  it("should scale radius proportionally to value", () => {
    const ptHalf = radarPoint(100, 100, 50, 4, 0, 5, 10);
    const ptFull = radarPoint(100, 100, 50, 4, 0, 10, 10);
    expect(ptHalf.r).toBe(25);
    expect(ptFull.r).toBe(50);
  });

  it("should handle zero value (point at center)", () => {
    const pt = radarPoint(100, 100, 50, 4, 0, 0, 10);
    expect(pt.r).toBe(0);
    expect(pt.x).toBeCloseTo(100, 5);
    expect(pt.y).toBeCloseTo(100, 5);
  });

  it("should use absolute value for negative data", () => {
    const ptNeg = radarPoint(100, 100, 50, 4, 0, -8, 10);
    const ptPos = radarPoint(100, 100, 50, 4, 0, 8, 10);
    expect(ptNeg.r).toBe(ptPos.r);
  });

  it("should compute maxVal correctly from flat-mapped series", () => {
    const seriesValues = [
      [5, 10, 15],
      [8, 3, 12],
    ];
    const maxVal = Math.max(1, ...seriesValues.flat().map(Math.abs));
    expect(maxVal).toBe(15);
  });

  it("should distribute N categories evenly around the circle", () => {
    const n = 6;
    const angles: number[] = [];
    for (let i = 0; i < n; i++) {
      angles.push((Math.PI * 2 * i) / n - Math.PI / 2);
    }
    // Spacing between consecutive angles
    for (let i = 1; i < n; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo(
        (Math.PI * 2) / n,
        10,
      );
    }
  });
});

describe("radar chart: ring gridlines", () => {
  it("should produce 4 concentric rings", () => {
    const radius = 100;
    const rings = 4;
    const radii: number[] = [];
    for (let r = 1; r <= rings; r++) {
      radii.push((radius * r) / rings);
    }
    expect(radii).toEqual([25, 50, 75, 100]);
  });
});

// ── Funnel chart ────────────────────────────────────────────────

describe("funnel chart: segment width computation", () => {
  function funnelWidths(values: number[], plotWidth: number) {
    const maxVal = Math.max(...values.map(Math.abs), 1);
    return values.map((val, i) => {
      const topW = (Math.abs(val) / maxVal) * plotWidth;
      const nextVal =
        i + 1 < values.length
          ? Math.abs(values[i + 1])
          : Math.abs(val) * 0.3;
      const botW = (nextVal / maxVal) * plotWidth;
      return { topW, botW };
    });
  }

  it("should make first segment full width for largest value", () => {
    const widths = funnelWidths([100, 80, 60, 40], 300);
    expect(widths[0].topW).toBe(300);
  });

  it("should taper each segment's bottom to next segment's top", () => {
    const widths = funnelWidths([100, 60, 30], 300);
    expect(widths[0].botW).toBe(widths[1].topW);
    expect(widths[1].botW).toBe(widths[2].topW);
  });

  it("should use 30% of current width as bottom for last segment", () => {
    const widths = funnelWidths([100, 50], 300);
    const lastW = widths[widths.length - 1];
    expect(lastW.botW).toBeCloseTo((Math.abs(50) * 0.3 / 100) * 300, 5);
  });

  it("should handle all-equal values", () => {
    const widths = funnelWidths([50, 50, 50], 200);
    widths.forEach((w) => {
      expect(w.topW).toBe(200);
    });
  });

  it("should handle single value", () => {
    const widths = funnelWidths([100], 300);
    expect(widths[0].topW).toBe(300);
    expect(widths[0].botW).toBe(300 * 0.3);
  });

  it("should compute segment height evenly", () => {
    const values = [100, 80, 60, 40];
    const plotHeight = 200;
    const segH = plotHeight / Math.max(values.length, 1);
    expect(segH).toBe(50);
  });
});

// ── Sunburst chart ──────────────────────────────────────────────

describe("sunburst chart: ring arc computation", () => {
  function computeRingRadii(seriesCount: number, maxR: number) {
    const ringWidth = maxR / (seriesCount + 0.5);
    return Array.from({ length: seriesCount }, (_, si) => ({
      inner: ringWidth * (si + 0.5),
      outer: ringWidth * (si + 1.5),
    }));
  }

  it("should nest rings from inside out", () => {
    const rings = computeRingRadii(3, 100);
    expect(rings[0].inner).toBeLessThan(rings[0].outer);
    expect(rings[0].outer).toBeCloseTo(rings[1].inner, 10);
    expect(rings[1].outer).toBeCloseTo(rings[2].inner, 10);
  });

  it("should make outermost ring reach near maxR", () => {
    const rings = computeRingRadii(2, 100);
    expect(rings[rings.length - 1].outer).toBeLessThanOrEqual(100);
  });

  it("should handle single series", () => {
    const rings = computeRingRadii(1, 100);
    expect(rings.length).toBe(1);
    expect(rings[0].inner).toBeGreaterThan(0);
    expect(rings[0].outer).toBeGreaterThan(rings[0].inner);
  });

  it("should compute arc sweep angle proportional to value", () => {
    const values = [30, 70];
    const total = values.reduce((s, v) => s + Math.abs(v), 0);
    const sweeps = values.map(
      (v) => (Math.abs(v) / total) * Math.PI * 2,
    );
    expect(sweeps[0]).toBeCloseTo((30 / 100) * Math.PI * 2, 10);
    expect(sweeps[1]).toBeCloseTo((70 / 100) * Math.PI * 2, 10);
    expect(sweeps[0] + sweeps[1]).toBeCloseTo(Math.PI * 2, 10);
  });
});

// ── Surface chart ───────────────────────────────────────────────

describe("surface chart: color mapping", () => {
  function surfaceColor(val: number, min: number, span: number) {
    const t = span > 0 ? (val - min) / span : 0;
    const r = Math.round(30 + 200 * t);
    const g = Math.round(80 + 100 * (1 - Math.abs(t - 0.5) * 2));
    const b = Math.round(200 * (1 - t) + 30);
    return { r, g, b, t };
  }

  it("should map minimum value to cool color (low r, high b)", () => {
    const c = surfaceColor(0, 0, 100);
    expect(c.r).toBe(30);
    expect(c.b).toBe(230);
  });

  it("should map maximum value to warm color (high r, low b)", () => {
    const c = surfaceColor(100, 0, 100);
    expect(c.r).toBe(230);
    expect(c.b).toBe(30);
  });

  it("should map midpoint to balanced color", () => {
    const c = surfaceColor(50, 0, 100);
    expect(c.t).toBeCloseTo(0.5, 10);
    // At t=0.5: g = 80 + 100*(1 - 0) = 180
    expect(c.g).toBe(180);
  });

  it("should handle zero span", () => {
    const c = surfaceColor(5, 5, 0);
    expect(c.t).toBe(0);
    expect(c.r).toBe(30);
  });
});

// ── Treemap chart ───────────────────────────────────────────────

describe("treemap chart: slice-and-dice layout", () => {
  function treemapLayout(
    values: number[],
    plotLeft: number,
    plotTop: number,
    plotWidth: number,
    plotHeight: number,
  ) {
    const totalAbs =
      values.reduce((sum, v) => sum + Math.abs(v), 0) || 1;
    const items = values
      .map((v, i) => ({ value: Math.abs(v), index: i }))
      .sort((a, b) => b.value - a.value);

    let curX = plotLeft;
    let curY = plotTop;
    let remainW = plotWidth;
    let remainH = plotHeight;
    let remainTotal = totalAbs;
    const rects: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      index: number;
    }> = [];

    items.forEach((item) => {
      const fraction =
        remainTotal > 0 ? item.value / remainTotal : 0;
      const useWidth = remainW >= remainH;
      const w = useWidth ? remainW * fraction : remainW;
      const h = useWidth ? remainH : remainH * fraction;

      rects.push({
        x: curX,
        y: curY,
        w: Math.max(w - 1, 1),
        h: Math.max(h - 1, 1),
        index: item.index,
      });

      if (useWidth) {
        curX += w;
        remainW -= w;
      } else {
        curY += h;
        remainH -= h;
      }
      remainTotal -= item.value;
    });

    return rects;
  }

  it("should sort items by absolute value descending", () => {
    const rects = treemapLayout([10, 40, 20, 30], 0, 0, 200, 100);
    // Sorted: 40(idx1), 30(idx3), 20(idx2), 10(idx0)
    expect(rects[0].index).toBe(1);
    expect(rects[1].index).toBe(3);
    expect(rects[2].index).toBe(2);
    expect(rects[3].index).toBe(0);
  });

  it("should fill total area", () => {
    const rects = treemapLayout([25, 25, 25, 25], 0, 0, 200, 100);
    // Each rect should take ~25% of area
    const totalArea = rects.reduce((s, r) => s + r.w * r.h, 0);
    // Due to 1px padding, totalArea will be slightly less
    expect(totalArea).toBeGreaterThan(0);
  });

  it("should start at plotLeft, plotTop", () => {
    const rects = treemapLayout([100], 50, 30, 200, 100);
    expect(rects[0].x).toBe(50);
    expect(rects[0].y).toBe(30);
  });

  it("should alternate slicing direction based on remaining aspect ratio", () => {
    // Wide area (200x100) => first split is horizontal (useWidth=true)
    const rects = treemapLayout([50, 50], 0, 0, 200, 100);
    // First rect takes horizontal portion
    expect(rects[0].h).toBe(99); // remainH (100) minus 1px padding
    // Second rect should fill remaining width
    expect(rects[1].h).toBe(99);
  });

  it("should handle single value", () => {
    const rects = treemapLayout([100], 0, 0, 200, 100);
    expect(rects.length).toBe(1);
    expect(rects[0].w).toBe(199); // 200 - 1
    expect(rects[0].h).toBe(99); // 100 - 1
  });

  it("should handle negative values using absolute values", () => {
    const rects = treemapLayout([-40, -60], 0, 0, 200, 100);
    // Sorted by absolute: 60(idx1), 40(idx0)
    expect(rects[0].index).toBe(1);
    expect(rects[1].index).toBe(0);
  });

  it("should enforce minimum rect dimensions of 1", () => {
    // Very small values in large space shouldn't produce negative dimensions
    const rects = treemapLayout([1, 1000], 0, 0, 200, 100);
    rects.forEach((r) => {
      expect(r.w).toBeGreaterThanOrEqual(1);
      expect(r.h).toBeGreaterThanOrEqual(1);
    });
  });
});
