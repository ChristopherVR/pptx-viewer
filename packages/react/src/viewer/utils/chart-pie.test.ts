import { describe, it, expect } from "vitest";
import { PALETTE } from "./chart-helpers";

/**
 * Tests for the pie chart computation logic used in chart-pie.tsx.
 *
 * The renderPieChart function computes slice angles, arc coordinates,
 * doughnut inner/outer radii, and data label positions. We test that
 * embedded math directly.
 */

describe("pie chart: slice angle computation", () => {
  function computeSliceAngles(values: number[]) {
    const total = values.reduce((sum, v) => sum + Math.abs(v), 0) || 1;
    let cumulativeAngle = -Math.PI / 2;
    return values.map((val) => {
      const sliceAngle = (Math.abs(val) / total) * Math.PI * 2;
      const startAngle = cumulativeAngle;
      cumulativeAngle += sliceAngle;
      const endAngle = cumulativeAngle;
      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      return { startAngle, endAngle, sliceAngle, largeArc };
    });
  }

  it("should start at -PI/2 (12 o'clock position)", () => {
    const slices = computeSliceAngles([50, 50]);
    expect(slices[0].startAngle).toBe(-Math.PI / 2);
  });

  it("should sum slice angles to full circle (2*PI)", () => {
    const slices = computeSliceAngles([10, 20, 30, 40]);
    const totalAngle = slices.reduce((sum, s) => sum + s.sliceAngle, 0);
    expect(totalAngle).toBeCloseTo(Math.PI * 2, 10);
  });

  it("should produce equal slices for equal values", () => {
    const slices = computeSliceAngles([25, 25, 25, 25]);
    const expectedAngle = Math.PI / 2;
    slices.forEach((s) => {
      expect(s.sliceAngle).toBeCloseTo(expectedAngle, 10);
    });
  });

  it("should set largeArc=1 for slices greater than PI", () => {
    // One slice takes 75% of the pie = 1.5*PI > PI
    const slices = computeSliceAngles([75, 25]);
    expect(slices[0].largeArc).toBe(1);
    expect(slices[1].largeArc).toBe(0);
  });

  it("should set largeArc=0 for slices equal to PI", () => {
    // Exactly half the pie
    const slices = computeSliceAngles([50, 50]);
    slices.forEach((s) => {
      expect(s.largeArc).toBe(0);
    });
  });

  it("should handle single value (full circle)", () => {
    const slices = computeSliceAngles([100]);
    expect(slices[0].sliceAngle).toBeCloseTo(Math.PI * 2, 10);
    expect(slices[0].largeArc).toBe(1);
  });

  it("should handle negative values by using absolute values", () => {
    const slices = computeSliceAngles([-30, -70]);
    const totalAngle = slices.reduce((sum, s) => sum + s.sliceAngle, 0);
    expect(totalAngle).toBeCloseTo(Math.PI * 2, 10);
  });

  it("should chain slices end-to-start consecutively", () => {
    const slices = computeSliceAngles([10, 20, 30]);
    for (let i = 1; i < slices.length; i++) {
      expect(slices[i].startAngle).toBeCloseTo(slices[i - 1].endAngle, 10);
    }
  });
});

describe("pie chart: radius and layout geometry", () => {
  function computePieGeometry(
    width: number,
    height: number,
    hasTitle: boolean,
    hasLegend: boolean,
    chartType: string,
  ) {
    const size = Math.min(width, height);
    const titleOffset = hasTitle ? 20 : 0;
    const legendOffset = hasLegend ? 20 : 0;
    const cx = size / 2;
    const cy = titleOffset + (size - titleOffset - legendOffset) / 2;
    const outerR = (size - titleOffset - legendOffset) * 0.42;
    const innerR = chartType === "doughnut" ? outerR * 0.55 : 0;
    return { size, cx, cy, outerR, innerR, titleOffset, legendOffset };
  }

  it("should use smaller dimension as size", () => {
    const geo = computePieGeometry(400, 300, false, false, "pie");
    expect(geo.size).toBe(300);
  });

  it("should center horizontally", () => {
    const geo = computePieGeometry(300, 300, false, false, "pie");
    expect(geo.cx).toBe(150);
  });

  it("should offset center vertically for title", () => {
    const withTitle = computePieGeometry(300, 300, true, false, "pie");
    const noTitle = computePieGeometry(300, 300, false, false, "pie");
    expect(withTitle.cy).toBeGreaterThan(noTitle.cy);
  });

  it("should compute zero innerR for pie type", () => {
    const geo = computePieGeometry(300, 300, false, false, "pie");
    expect(geo.innerR).toBe(0);
  });

  it("should compute positive innerR for doughnut type", () => {
    const geo = computePieGeometry(300, 300, false, false, "doughnut");
    expect(geo.innerR).toBeGreaterThan(0);
    expect(geo.innerR).toBe(geo.outerR * 0.55);
  });

  it("should reduce outerR when title and legend are present", () => {
    const plain = computePieGeometry(300, 300, false, false, "pie");
    const decorated = computePieGeometry(300, 300, true, true, "pie");
    expect(decorated.outerR).toBeLessThan(plain.outerR);
  });

  it("should produce non-negative radii", () => {
    const geo = computePieGeometry(50, 50, true, true, "doughnut");
    expect(geo.outerR).toBeGreaterThanOrEqual(0);
    expect(geo.innerR).toBeGreaterThanOrEqual(0);
  });
});

describe("pie chart: arc endpoint computation", () => {
  it("should compute correct arc start/end points on the circle", () => {
    const cx = 150;
    const cy = 150;
    const r = 100;
    const startAngle = -Math.PI / 2; // top
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    expect(x1).toBeCloseTo(150, 5);
    expect(y1).toBeCloseTo(50, 5); // top of circle
  });

  it("should compute correct point at 90 degrees (right side)", () => {
    const cx = 150;
    const cy = 150;
    const r = 100;
    const angle = 0; // cos(0)=1, sin(0)=0 => right
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    expect(x).toBeCloseTo(250, 5);
    expect(y).toBeCloseTo(150, 5);
  });

  it("should compute data label position at 70% of radius along mid-angle", () => {
    const cx = 150;
    const cy = 150;
    const outerR = 100;
    const labelR = outerR * 0.7;
    const midAngle = 0; // right side
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    expect(lx).toBeCloseTo(220, 5);
    expect(ly).toBeCloseTo(150, 5);
  });
});
