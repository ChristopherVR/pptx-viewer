import { describe, it, expect } from "vitest";
import { gmx, gmy, gmw, gmh, activateGdiMappingMode } from "./emf-gdi-coord";
import type { EmfGdiReplayCtx } from "./emf-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal EmfGdiReplayCtx for coordinate mapping tests. */
function makeCtx(overrides: Partial<EmfGdiReplayCtx> = {}): EmfGdiReplayCtx {
  return {
    // Provide stubs for all required fields; tests only care about
    // the coordinate-related subset.
    ctx: {} as any,
    view: {} as any,
    objectTable: new Map(),
    state: {} as any,
    stateStack: [],
    inPath: false,
    windowOrg: { x: 0, y: 0 },
    windowExt: { cx: 1, cy: 1 },
    viewportOrg: { x: 0, y: 0 },
    viewportExt: { cx: 1, cy: 1 },
    useMappingMode: false,
    clipSaveDepth: 0,
    bounds: { left: 0, top: 0, right: 100, bottom: 100 },
    canvasW: 200,
    canvasH: 200,
    sx: 2,
    sy: 2,
    ...overrides,
  } as EmfGdiReplayCtx;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("emf-gdi-coord", () => {
  // -----------------------------------------------------------------------
  // Simple bounds-based mapping (useMappingMode = false)
  // -----------------------------------------------------------------------
  describe("bounds-based mapping (useMappingMode = false)", () => {
    it("gmx scales x by sx and subtracts bounds.left", () => {
      const r = makeCtx({ bounds: { left: 10, top: 0, right: 110, bottom: 100 }, sx: 2 });
      // (50 - 10) * 2 = 80
      expect(gmx(r, 50)).toBe(80);
    });

    it("gmy scales y by sy and subtracts bounds.top", () => {
      const r = makeCtx({ bounds: { left: 0, top: 20, right: 100, bottom: 120 }, sy: 3 });
      // (60 - 20) * 3 = 120
      expect(gmy(r, 60)).toBe(120);
    });

    it("gmw scales width by sx", () => {
      const r = makeCtx({ sx: 2.5 });
      expect(gmw(r, 40)).toBe(100);
    });

    it("gmh scales height by sy", () => {
      const r = makeCtx({ sy: 0.5 });
      expect(gmh(r, 100)).toBe(50);
    });

    it("identity scaling (sx=1, sy=1, bounds at origin)", () => {
      const r = makeCtx({
        bounds: { left: 0, top: 0, right: 100, bottom: 100 },
        sx: 1,
        sy: 1,
      });
      expect(gmx(r, 42)).toBe(42);
      expect(gmy(r, 77)).toBe(77);
      expect(gmw(r, 10)).toBe(10);
      expect(gmh(r, 20)).toBe(20);
    });

    it("handles zero coordinates", () => {
      const r = makeCtx({ sx: 3, sy: 4, bounds: { left: 0, top: 0, right: 100, bottom: 100 } });
      expect(gmx(r, 0)).toBe(0);
      expect(gmy(r, 0)).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Window/viewport mapping (useMappingMode = true)
  // -----------------------------------------------------------------------
  describe("window/viewport mapping (useMappingMode = true)", () => {
    it("maps x through window/viewport transform", () => {
      const r = makeCtx({
        useMappingMode: true,
        windowOrg: { x: 0, y: 0 },
        windowExt: { cx: 100, cy: 100 },
        viewportOrg: { x: 0, y: 0 },
        viewportExt: { cx: 200, cy: 200 },
      });
      // (50 - 0) / 100 * 200 + 0 = 100
      expect(gmx(r, 50)).toBe(100);
    });

    it("maps y through window/viewport transform", () => {
      const r = makeCtx({
        useMappingMode: true,
        windowOrg: { x: 0, y: 0 },
        windowExt: { cx: 100, cy: 50 },
        viewportOrg: { x: 0, y: 0 },
        viewportExt: { cx: 200, cy: 300 },
      });
      // (25 - 0) / 50 * 300 + 0 = 150
      expect(gmy(r, 25)).toBe(150);
    });

    it("applies window origin offset", () => {
      const r = makeCtx({
        useMappingMode: true,
        windowOrg: { x: 10, y: 20 },
        windowExt: { cx: 100, cy: 100 },
        viewportOrg: { x: 0, y: 0 },
        viewportExt: { cx: 100, cy: 100 },
      });
      // (50 - 10) / 100 * 100 + 0 = 40
      expect(gmx(r, 50)).toBe(40);
      // (70 - 20) / 100 * 100 + 0 = 50
      expect(gmy(r, 70)).toBe(50);
    });

    it("applies viewport origin offset", () => {
      const r = makeCtx({
        useMappingMode: true,
        windowOrg: { x: 0, y: 0 },
        windowExt: { cx: 100, cy: 100 },
        viewportOrg: { x: 50, y: 30 },
        viewportExt: { cx: 100, cy: 100 },
      });
      // (60 - 0) / 100 * 100 + 50 = 110
      expect(gmx(r, 60)).toBe(110);
      // (40 - 0) / 100 * 100 + 30 = 70
      expect(gmy(r, 40)).toBe(70);
    });

    it("gmw maps width through window/viewport extent ratio", () => {
      const r = makeCtx({
        useMappingMode: true,
        windowExt: { cx: 200, cy: 100 },
        viewportExt: { cx: 400, cy: 300 },
      });
      // 100 / 200 * 400 = 200
      expect(gmw(r, 100)).toBe(200);
    });

    it("gmh maps height through window/viewport extent ratio", () => {
      const r = makeCtx({
        useMappingMode: true,
        windowExt: { cx: 200, cy: 100 },
        viewportExt: { cx: 400, cy: 300 },
      });
      // 50 / 100 * 300 = 150
      expect(gmh(r, 50)).toBe(150);
    });

    it("handles identity mapping (window == viewport)", () => {
      const r = makeCtx({
        useMappingMode: true,
        windowOrg: { x: 0, y: 0 },
        windowExt: { cx: 100, cy: 100 },
        viewportOrg: { x: 0, y: 0 },
        viewportExt: { cx: 100, cy: 100 },
      });
      expect(gmx(r, 42)).toBe(42);
      expect(gmy(r, 77)).toBe(77);
      expect(gmw(r, 10)).toBe(10);
      expect(gmh(r, 20)).toBe(20);
    });
  });

  // -----------------------------------------------------------------------
  // activateGdiMappingMode
  // -----------------------------------------------------------------------
  describe("activateGdiMappingMode()", () => {
    it("sets useMappingMode to true", () => {
      const r = makeCtx({ useMappingMode: false });
      activateGdiMappingMode(r);
      expect(r.useMappingMode).toBe(true);
    });

    it("remains true if already activated", () => {
      const r = makeCtx({ useMappingMode: true });
      activateGdiMappingMode(r);
      expect(r.useMappingMode).toBe(true);
    });
  });
});
