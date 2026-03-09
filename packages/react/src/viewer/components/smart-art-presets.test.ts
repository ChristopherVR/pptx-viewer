import { describe, it, expect } from "vitest";
import { PRESETS, CATEGORIES } from "./smart-art-presets";
import type { SmartArtCategory } from "./smart-art-presets";

const EXPECTED_CATEGORIES: SmartArtCategory[] = [
  "list",
  "process",
  "cycle",
  "hierarchy",
  "relationship",
];

describe("PRESETS", () => {
  it("is a non-empty array", () => {
    expect(PRESETS.length).toBeGreaterThan(0);
  });

  describe("each preset has required properties", () => {
    for (const preset of PRESETS) {
      describe(`preset: ${preset.label}`, () => {
        it("has a non-empty layout string", () => {
          expect(preset.layout).toBeTruthy();
          expect(typeof preset.layout).toBe("string");
        });

        it("has a non-empty label string", () => {
          expect(preset.label).toBeTruthy();
          expect(typeof preset.label).toBe("string");
        });

        it("has a valid category", () => {
          expect(EXPECTED_CATEGORIES).toContain(preset.category);
        });

        it("has a non-empty defaultItems array", () => {
          expect(Array.isArray(preset.defaultItems)).toBe(true);
          expect(preset.defaultItems.length).toBeGreaterThan(0);
        });

        it("defaultItems are all non-empty strings", () => {
          for (const item of preset.defaultItems) {
            expect(item).toBeTruthy();
            expect(typeof item).toBe("string");
          }
        });
      });
    }
  });

  it("all layouts are unique", () => {
    const layouts = PRESETS.map((p) => p.layout);
    expect(new Set(layouts).size).toBe(layouts.length);
  });

  it("categories include all expected categories", () => {
    const usedCategories = new Set(PRESETS.map((p) => p.category));
    for (const cat of EXPECTED_CATEGORIES) {
      expect(usedCategories.has(cat)).toBe(true);
    }
  });

  it('contains "Basic Block List" preset', () => {
    expect(PRESETS.some((p) => p.label === "Basic Block List")).toBe(true);
  });

  it('contains "Chevron Process" preset', () => {
    expect(PRESETS.some((p) => p.label === "Chevron Process")).toBe(true);
  });

  it('contains "Basic Cycle" preset', () => {
    expect(PRESETS.some((p) => p.label === "Basic Cycle")).toBe(true);
  });

  it('contains "Hierarchy" preset', () => {
    expect(PRESETS.some((p) => p.label === "Hierarchy")).toBe(true);
  });

  it('contains "Basic Venn" preset', () => {
    expect(PRESETS.some((p) => p.label === "Basic Venn")).toBe(true);
  });
});

describe("CATEGORIES", () => {
  it("has exactly 5 categories", () => {
    expect(CATEGORIES).toHaveLength(5);
  });

  it("ids match all expected categories", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(EXPECTED_CATEGORIES);
  });

  it("every category has a non-empty label", () => {
    for (const cat of CATEGORIES) {
      expect(cat.label).toBeTruthy();
      expect(typeof cat.label).toBe("string");
    }
  });

  it("has no duplicate ids", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
