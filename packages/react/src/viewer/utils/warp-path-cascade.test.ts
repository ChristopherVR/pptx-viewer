import { describe, it, expect } from "vitest";
import { cascadeUpPath, cascadeDownPath } from "./warp-path-cascade";

describe("cascadeUpPath", () => {
  it("generates an SVG path string", () => {
    const path = cascadeUpPath(200, 100, 0);
    expect(path).toMatch(/^M\s/);
    expect(path).toContain("L");
  });

  it("starts at x=0 and ends at x=width", () => {
    const path = cascadeUpPath(300, 100, 0.5);
    // Format: "M 0,{yStart} L {w},{yEnd}"
    expect(path).toMatch(/^M 0,/);
    expect(path).toContain("L 300,");
  });

  it("yEnd is lower than yStart (lines go up to the right)", () => {
    const w = 200,
      h = 100,
      t = 0.5;
    const path = cascadeUpPath(w, h, t);
    const match = path.match(
      /M 0,(\d+\.?\d*)\s+L\s+\d+\.?\d*,(\d+\.?\d*)/,
    );
    expect(match).not.toBeNull();
    const yStart = parseFloat(match![1]);
    const yEnd = parseFloat(match![2]);
    expect(yStart).toBeGreaterThan(yEnd);
  });

  it("varies y positions with t parameter", () => {
    const path0 = cascadeUpPath(200, 100, 0);
    const path1 = cascadeUpPath(200, 100, 1);
    expect(path0).not.toBe(path1);
  });

  it("produces different results for different heights", () => {
    const p1 = cascadeUpPath(200, 100, 0.5);
    const p2 = cascadeUpPath(200, 200, 0.5);
    expect(p1).not.toBe(p2);
  });

  it("handles t=0", () => {
    const path = cascadeUpPath(100, 100, 0);
    expect(path).toBeDefined();
    expect(path.length).toBeGreaterThan(0);
  });

  it("handles t=1", () => {
    const path = cascadeUpPath(100, 100, 1);
    expect(path).toBeDefined();
    expect(path.length).toBeGreaterThan(0);
  });
});

describe("cascadeDownPath", () => {
  it("generates an SVG path string", () => {
    const path = cascadeDownPath(200, 100, 0);
    expect(path).toMatch(/^M\s/);
    expect(path).toContain("L");
  });

  it("starts at x=0 and ends at x=width", () => {
    const path = cascadeDownPath(300, 100, 0.5);
    expect(path).toMatch(/^M 0,/);
    expect(path).toContain("L 300,");
  });

  it("yEnd is higher than yStart (lines go down to the right)", () => {
    const w = 200,
      h = 100,
      t = 0.5;
    const path = cascadeDownPath(w, h, t);
    const match = path.match(
      /M 0,(\d+\.?\d*)\s+L\s+\d+\.?\d*,(\d+\.?\d*)/,
    );
    expect(match).not.toBeNull();
    const yStart = parseFloat(match![1]);
    const yEnd = parseFloat(match![2]);
    expect(yEnd).toBeGreaterThan(yStart);
  });

  it("varies y positions with t parameter", () => {
    const path0 = cascadeDownPath(200, 100, 0);
    const path1 = cascadeDownPath(200, 100, 1);
    expect(path0).not.toBe(path1);
  });

  it("is the reverse of cascadeUpPath (y-start/y-end swapped)", () => {
    const w = 200,
      h = 100,
      t = 0.5;
    const upPath = cascadeUpPath(w, h, t);
    const downPath = cascadeDownPath(w, h, t);
    const upMatch = upPath.match(
      /M 0,(\d+\.?\d*)\s+L\s+\d+\.?\d*,(\d+\.?\d*)/,
    );
    const downMatch = downPath.match(
      /M 0,(\d+\.?\d*)\s+L\s+\d+\.?\d*,(\d+\.?\d*)/,
    );
    // Up: yStart > yEnd, Down: yStart < yEnd
    // And the start of up = end of down and vice versa
    const upStart = parseFloat(upMatch![1]);
    const upEnd = parseFloat(upMatch![2]);
    const downStart = parseFloat(downMatch![1]);
    const downEnd = parseFloat(downMatch![2]);
    expect(upStart).toBeCloseTo(downEnd, 5);
    expect(upEnd).toBeCloseTo(downStart, 5);
  });

  it("handles t=0", () => {
    const path = cascadeDownPath(100, 100, 0);
    expect(path).toBeDefined();
  });

  it("handles t=1", () => {
    const path = cascadeDownPath(100, 100, 1);
    expect(path).toBeDefined();
  });
});

describe("cascade adjustment values", () => {
  it("cascadeUpPath: adj controls tilt amount", () => {
    const pathDefault = cascadeUpPath(200, 100, 0.5);
    const pathLarge = cascadeUpPath(200, 100, 0.5, 88888);
    expect(pathDefault).not.toBe(pathLarge);
  });

  it("cascadeDownPath: adj controls tilt amount", () => {
    const pathDefault = cascadeDownPath(200, 100, 0.5);
    const pathLarge = cascadeDownPath(200, 100, 0.5, 88888);
    expect(pathDefault).not.toBe(pathLarge);
  });

  it("cascadeUpPath: adj=0 produces a flat line", () => {
    const path = cascadeUpPath(200, 100, 0.5, 0);
    const match = path.match(
      /M 0,(\d+\.?\d*)\s+L\s+\d+\.?\d*,(\d+\.?\d*)/,
    );
    expect(match).not.toBeNull();
    const yStart = parseFloat(match![1]);
    const yEnd = parseFloat(match![2]);
    expect(yStart).toBeCloseTo(yEnd, 5);
  });

  it("cascadeDownPath: adj=0 produces a flat line", () => {
    const path = cascadeDownPath(200, 100, 0.5, 0);
    const match = path.match(
      /M 0,(\d+\.?\d*)\s+L\s+\d+\.?\d*,(\d+\.?\d*)/,
    );
    expect(match).not.toBeNull();
    const yStart = parseFloat(match![1]);
    const yEnd = parseFloat(match![2]);
    expect(yStart).toBeCloseTo(yEnd, 5);
  });
});
