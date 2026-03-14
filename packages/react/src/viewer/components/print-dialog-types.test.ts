import { describe, it, expect } from "vitest";
import { HANDOUT_OPTIONS, radioClass } from "./print-dialog-types";

// ---------------------------------------------------------------------------
// HANDOUT_OPTIONS
// ---------------------------------------------------------------------------

describe("HANDOUT_OPTIONS", () => {
  it("is an array of 6 options", () => {
    expect(HANDOUT_OPTIONS).toHaveLength(6);
  });

  it("contains values 1, 2, 3, 4, 6, 9", () => {
    expect(HANDOUT_OPTIONS).toEqual([1, 2, 3, 4, 6, 9]);
  });

  it("contains only positive integers", () => {
    for (const opt of HANDOUT_OPTIONS) {
      expect(Number.isInteger(opt)).toBe(true);
      expect(opt).toBeGreaterThan(0);
    }
  });

  it("is sorted in ascending order", () => {
    for (let i = 1; i < HANDOUT_OPTIONS.length; i++) {
      expect(HANDOUT_OPTIONS[i]).toBeGreaterThan(HANDOUT_OPTIONS[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// radioClass
// ---------------------------------------------------------------------------

describe("radioClass", () => {
  it("returns a string", () => {
    expect(typeof radioClass(true)).toBe("string");
    expect(typeof radioClass(false)).toBe("string");
  });

  it("includes active styling when active is true", () => {
    const cls = radioClass(true);
    expect(cls).toContain("border-primary");
    expect(cls).toContain("bg-primary/10");
    expect(cls).toContain("text-foreground");
  });

  it("includes inactive styling when active is false", () => {
    const cls = radioClass(false);
    expect(cls).toContain("border-border");
    expect(cls).toContain("bg-background");
    expect(cls).toContain("text-muted-foreground");
  });

  it("always includes shared base classes", () => {
    const activeClass = radioClass(true);
    const inactiveClass = radioClass(false);
    for (const cls of [activeClass, inactiveClass]) {
      expect(cls).toContain("flex");
      expect(cls).toContain("items-center");
      expect(cls).toContain("gap-2");
      expect(cls).toContain("rounded-lg");
      expect(cls).toContain("cursor-pointer");
    }
  });

  it("active and inactive classes are different", () => {
    expect(radioClass(true)).not.toBe(radioClass(false));
  });
});
