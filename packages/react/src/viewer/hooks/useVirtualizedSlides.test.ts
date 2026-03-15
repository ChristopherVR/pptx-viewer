import { describe, it, expect } from "vitest";
import { computeVirtualRange } from "./useVirtualizedSlides";

// ---------------------------------------------------------------------------
// computeVirtualRange — pure function tests
// ---------------------------------------------------------------------------

describe("computeVirtualRange", () => {
  // ── Empty list ──

  it("returns empty range for totalItems = 0", () => {
    const r = computeVirtualRange(0, 100, 0, 600, 5);
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(-1);
    expect(r.totalHeight).toBe(0);
    expect(r.offsetY).toBe(0);
    expect(r.visibleRange.start).toBe(0);
    expect(r.visibleRange.end).toBe(-1);
  });

  // ── Total height ──

  it("calculates totalHeight as totalItems * itemHeight", () => {
    expect(computeVirtualRange(100, 120, 0, 600, 5).totalHeight).toBe(12000);
    expect(computeVirtualRange(500, 80, 0, 400, 3).totalHeight).toBe(40000);
    expect(computeVirtualRange(1, 200, 0, 200, 0).totalHeight).toBe(200);
  });

  // ── Safe item height (floors at 1) ──

  it("clamps itemHeight of 0 to minimum of 1", () => {
    const r = computeVirtualRange(10, 0, 0, 100, 0);
    // totalHeight = 10 * 1 = 10
    expect(r.totalHeight).toBe(10);
  });

  it("clamps negative itemHeight to minimum of 1", () => {
    const r = computeVirtualRange(5, -50, 0, 100, 0);
    expect(r.totalHeight).toBe(5);
  });

  // ── Visible range at top (scrollTop=0) ──

  it("calculates visible range at scroll top with no overscan", () => {
    // viewport=600, itemHeight=100 → visible items 0..6
    const r = computeVirtualRange(50, 100, 0, 600, 0);
    expect(r.visibleRange.start).toBe(0);
    expect(r.visibleRange.end).toBe(6);
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(6);
    expect(r.offsetY).toBe(0);
  });

  // ── Visible range with overscan at top ──

  it("overscan does not push startIndex below 0", () => {
    // At scroll top, overscan=5 cannot go below 0
    const r = computeVirtualRange(100, 100, 0, 300, 5);
    expect(r.startIndex).toBe(0);
    // visibleEnd = floor((0+300)/100) = 3, endIndex = min(99, 3+5) = 8
    expect(r.endIndex).toBe(8);
  });

  // ── Visible range in the middle ──

  it("calculates correct range when scrolled to middle", () => {
    // scrollTop=5000, viewport=600, itemHeight=100
    // visibleStart = floor(5000/100) = 50
    // visibleEnd = floor((5000+600)/100) = 56
    const r = computeVirtualRange(200, 100, 5000, 600, 3);
    expect(r.visibleRange.start).toBe(50);
    expect(r.visibleRange.end).toBe(56);
    expect(r.startIndex).toBe(47); // 50 - 3
    expect(r.endIndex).toBe(59); // 56 + 3
    expect(r.offsetY).toBe(47 * 100);
  });

  // ── Visible range near bottom ──

  it("clamps endIndex to totalItems - 1 at the bottom", () => {
    // 20 items, itemHeight=100, scrollTop=1500, viewport=600
    // visibleStart=15, visibleEnd = min(19, floor(2100/100)) = min(19, 21) = 19
    // overscan=5: endIndex = min(19, 19+5) = 19
    const r = computeVirtualRange(20, 100, 1500, 600, 5);
    expect(r.endIndex).toBe(19);
    expect(r.visibleRange.end).toBe(19);
  });

  // ── Single item ──

  it("handles single item", () => {
    const r = computeVirtualRange(1, 150, 0, 600, 5);
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(0);
    expect(r.totalHeight).toBe(150);
    expect(r.offsetY).toBe(0);
  });

  // ── Overscan boundary cases ──

  it("respects overscan=0 (rendered equals visible)", () => {
    const r = computeVirtualRange(100, 100, 2000, 500, 0);
    expect(r.startIndex).toBe(r.visibleRange.start);
    expect(r.endIndex).toBe(r.visibleRange.end);
  });

  it("large overscan with small list does not exceed bounds", () => {
    const r = computeVirtualRange(3, 100, 0, 300, 100);
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(2);
  });

  // ── Rendering a much smaller subset than total ──

  it("with 1000 items, rendered range is much smaller than total", () => {
    // viewport=800, itemHeight=120, overscan=5
    // visibleEnd = floor(800/120) = 6, endIndex = 6+5 = 11
    const r = computeVirtualRange(1000, 120, 0, 800, 5);
    const renderedCount = r.endIndex - r.startIndex + 1;
    expect(renderedCount).toBeLessThan(20);
    expect(renderedCount).toBeGreaterThan(0);
    // totalHeight still reflects all 1000 items
    expect(r.totalHeight).toBe(120000);
  });

  it("with 2000 items scrolled to middle, still renders small window", () => {
    const r = computeVirtualRange(2000, 100, 100000, 600, 5);
    const count = r.endIndex - r.startIndex + 1;
    expect(count).toBeLessThan(30);
    expect(r.startIndex).toBeGreaterThan(900);
    expect(r.endIndex).toBeLessThan(1100);
  });

  // ── offsetY consistency ──

  it("offsetY always equals startIndex * itemHeight", () => {
    for (const scroll of [0, 500, 3000, 9999]) {
      const r = computeVirtualRange(200, 80, scroll, 600, 5);
      expect(r.offsetY).toBe(r.startIndex * 80);
    }
  });

  // ── Index ordering invariants ──

  it("startIndex <= endIndex for non-empty lists", () => {
    for (const n of [1, 5, 50, 500]) {
      const r = computeVirtualRange(n, 100, 0, 400, 3);
      expect(r.startIndex).toBeLessThanOrEqual(r.endIndex);
    }
  });

  it("visibleRange.start <= visibleRange.end for non-empty lists", () => {
    const r = computeVirtualRange(100, 100, 0, 800, 0);
    expect(r.visibleRange.start).toBeLessThanOrEqual(r.visibleRange.end);
  });

  // ── Viewport smaller than one item ──

  it("handles viewport smaller than one item height", () => {
    const r = computeVirtualRange(50, 200, 0, 50, 2);
    // visibleStart=0, visibleEnd = floor(50/200) = 0
    expect(r.visibleRange.start).toBe(0);
    expect(r.visibleRange.end).toBe(0);
    // With overscan: start=0, end=min(49,0+2)=2
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(2);
  });

  // ── Zero viewport (not yet measured) ──

  it("handles viewport height of 0 (container not yet measured)", () => {
    const r = computeVirtualRange(100, 100, 0, 0, 5);
    // visibleEnd = floor((0+0)/100) = 0
    expect(r.visibleRange.start).toBe(0);
    expect(r.visibleRange.end).toBe(0);
    // Still renders overscan items
    expect(r.endIndex).toBe(5);
  });

  // ── Default overscan ──

  it("uses default overscan of 5 when omitted", () => {
    const r = computeVirtualRange(100, 100, 0, 300);
    // visibleEnd = floor(300/100) = 3
    // endIndex = min(99, 3+5) = 8
    expect(r.endIndex).toBe(8);
    expect(r.startIndex).toBe(0);
  });
});
