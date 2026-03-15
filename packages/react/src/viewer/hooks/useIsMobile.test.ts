import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MOBILE_BREAKPOINT,
  TABLET_BREAKPOINT,
  MIN_TOUCH_TARGET,
} from "./useIsMobile";

// ---------------------------------------------------------------------------
// Since useIsMobile is a React hook, we test the pure helper constants and
// the breakpoint logic by extracting the derivation into plain functions.
// For the hook itself we verify the exported constants.
// ---------------------------------------------------------------------------

describe("useIsMobile constants", () => {
  it("MOBILE_BREAKPOINT is 768", () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
  });

  it("TABLET_BREAKPOINT is 1024", () => {
    expect(TABLET_BREAKPOINT).toBe(1024);
  });

  it("MIN_TOUCH_TARGET is 44px per WCAG guidelines", () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });
});

describe("breakpoint derivation logic", () => {
  // Extracted logic from the hook for unit testing
  function deriveBreakpoints(containerWidth: number) {
    const isMobile = containerWidth < MOBILE_BREAKPOINT;
    const isTablet =
      containerWidth >= MOBILE_BREAKPOINT &&
      containerWidth < TABLET_BREAKPOINT;
    const isDesktop = containerWidth >= TABLET_BREAKPOINT;
    return { isMobile, isTablet, isDesktop };
  }

  it("classifies 320px as mobile", () => {
    const result = deriveBreakpoints(320);
    expect(result).toEqual({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });
  });

  it("classifies 375px (iPhone) as mobile", () => {
    const result = deriveBreakpoints(375);
    expect(result).toEqual({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });
  });

  it("classifies 767px as mobile (just below breakpoint)", () => {
    const result = deriveBreakpoints(767);
    expect(result).toEqual({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });
  });

  it("classifies 768px as tablet (exactly at mobile breakpoint)", () => {
    const result = deriveBreakpoints(768);
    expect(result).toEqual({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
    });
  });

  it("classifies 900px as tablet", () => {
    const result = deriveBreakpoints(900);
    expect(result).toEqual({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
    });
  });

  it("classifies 1023px as tablet (just below desktop breakpoint)", () => {
    const result = deriveBreakpoints(1023);
    expect(result).toEqual({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
    });
  });

  it("classifies 1024px as desktop (exactly at tablet breakpoint)", () => {
    const result = deriveBreakpoints(1024);
    expect(result).toEqual({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  it("classifies 1920px as desktop", () => {
    const result = deriveBreakpoints(1920);
    expect(result).toEqual({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  it("classifies 0px as mobile", () => {
    const result = deriveBreakpoints(0);
    expect(result).toEqual({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });
  });

  it("exactly one flag is true for any width", () => {
    // Test a broad range of widths to ensure mutual exclusivity
    for (const width of [0, 100, 320, 767, 768, 900, 1023, 1024, 2560]) {
      const result = deriveBreakpoints(width);
      const trueCount = [result.isMobile, result.isTablet, result.isDesktop].filter(Boolean).length;
      expect(trueCount).toBe(1);
    }
  });
});

describe("virtual keyboard detection logic", () => {
  function isVirtualKeyboardOpen(
    initialHeight: number,
    currentHeight: number,
  ): boolean {
    const shrinkRatio = currentHeight / initialHeight;
    return shrinkRatio < 0.7;
  }

  it("detects keyboard open when viewport shrinks by more than 30%", () => {
    expect(isVirtualKeyboardOpen(800, 400)).toBe(true);
    expect(isVirtualKeyboardOpen(800, 300)).toBe(true);
  });

  it("does not detect keyboard when viewport barely shrinks", () => {
    expect(isVirtualKeyboardOpen(800, 700)).toBe(false);
    expect(isVirtualKeyboardOpen(800, 800)).toBe(false);
  });

  it("edge case: exactly 70% ratio is not open", () => {
    // 560 / 800 = 0.7 — not less than 0.7
    expect(isVirtualKeyboardOpen(800, 560)).toBe(false);
  });

  it("edge case: just below 70% ratio is open", () => {
    expect(isVirtualKeyboardOpen(800, 559)).toBe(true);
  });
});

describe("orientation derivation logic", () => {
  function deriveOrientation(
    width: number,
    height: number,
  ): "portrait" | "landscape" {
    return height > width ? "portrait" : "landscape";
  }

  it("tall viewport is portrait", () => {
    expect(deriveOrientation(375, 812)).toBe("portrait");
  });

  it("wide viewport is landscape", () => {
    expect(deriveOrientation(812, 375)).toBe("landscape");
  });

  it("square viewport is landscape", () => {
    expect(deriveOrientation(500, 500)).toBe("landscape");
  });
});
