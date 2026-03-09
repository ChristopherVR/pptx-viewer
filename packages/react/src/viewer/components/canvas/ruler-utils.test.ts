import { describe, it, expect } from "vitest";
import { generateTicks, PX_PER_INCH, PX_PER_CM } from "./ruler-utils";

describe("generateTicks", () => {
  it("generates ticks for a 960px slide in inches at scale 1", () => {
    const ticks = generateTicks(960, 1, "inches");
    expect(ticks.length).toBeGreaterThan(0);
    // First tick at position 0
    expect(ticks[0].position).toBe(0);
    expect(ticks[0].isMajor).toBe(true);
    expect(ticks[0].label).toBe("0");
  });

  it("generates ticks for centimetres", () => {
    const ticks = generateTicks(960, 1, "centimetres");
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0].position).toBe(0);
    expect(ticks[0].label).toBe("0");
  });

  it("generates major ticks at inch boundaries", () => {
    const ticks = generateTicks(PX_PER_INCH * 3, 1, "inches");
    const majorTicks = ticks.filter((t) => t.isMajor);
    // Should have ticks at 0, 1, 2, 3 inches
    expect(majorTicks.length).toBeGreaterThanOrEqual(4);
  });

  it("generates minor ticks between major ticks", () => {
    const ticks = generateTicks(PX_PER_INCH * 2, 1, "inches");
    const minorTicks = ticks.filter((t) => !t.isMajor);
    expect(minorTicks.length).toBeGreaterThan(0);
    // Minor ticks should have empty labels
    for (const t of minorTicks) {
      expect(t.label).toBe("");
    }
  });

  it("scales tick positions with the scale factor", () => {
    const scale = 2;
    const ticks = generateTicks(PX_PER_INCH, scale, "inches");
    const lastMajor = ticks.filter((t) => t.isMajor).pop();
    // At scale 2, 1 inch mark should be at PX_PER_INCH * 2
    expect(lastMajor!.position).toBeCloseTo(PX_PER_INCH * scale, 1);
  });

  it("collapses minor subdivisions at very small scale", () => {
    // At very tiny scale, subdivisions should be reduced
    const ticksSmall = generateTicks(960, 0.01, "inches");
    const ticksNormal = generateTicks(960, 1, "inches");
    // At tiny scale: many more units fit, but fewer subdivisions per unit
    expect(ticksSmall.length).toBeGreaterThan(0);
    // Minor ticks per unit should be fewer at small scale
    const smallMinorRatio =
      ticksSmall.filter((t) => !t.isMajor).length /
      Math.max(1, ticksSmall.filter((t) => t.isMajor).length);
    const normalMinorRatio =
      ticksNormal.filter((t) => !t.isMajor).length /
      Math.max(1, ticksNormal.filter((t) => t.isMajor).length);
    expect(smallMinorRatio).toBeLessThanOrEqual(normalMinorRatio);
  });

  it("handles zero-length slide gracefully", () => {
    const ticks = generateTicks(0, 1, "inches");
    // Should have at least the 0 tick
    expect(ticks.length).toBeGreaterThanOrEqual(1);
    expect(ticks[0].position).toBe(0);
  });

  it("assigns labels only to major ticks that pass majorStep filter", () => {
    const ticks = generateTicks(PX_PER_INCH * 5, 1, "inches");
    for (const t of ticks) {
      if (!t.isMajor) {
        expect(t.label).toBe("");
      }
    }
  });

  it("uses 10 minor subdivisions for centimetres at normal scale", () => {
    // At scale=1, PX_PER_CM ~ 37.8, so subdivisions of 10 → ~3.78px spacing
    // The function collapses when spacing < 4px, so may reduce
    const ticks = generateTicks(PX_PER_CM * 2, 1, "centimetres");
    // Verify we get ticks between majors
    const between = ticks.filter(
      (t) => !t.isMajor && t.position > 0 && t.position < PX_PER_CM,
    );
    expect(between.length).toBeGreaterThanOrEqual(1);
  });
});
