import { describe, it, expect } from "vitest";
import {
  PRESET_SHAPE_DEFINITIONS,
  PRESET_SHAPE_CATEGORY_LABELS,
  PRIMARY_SHAPE_DEFINITIONS,
  EXTENDED_SHAPE_DEFINITIONS,
} from "./preset-shape-definitions";
import type { PresetShapeCategory } from "./preset-shape-types";

// ---------------------------------------------------------------------------
// PRESET_SHAPE_DEFINITIONS
// ---------------------------------------------------------------------------

describe("PRESET_SHAPE_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(PRESET_SHAPE_DEFINITIONS)).toBe(true);
    expect(PRESET_SHAPE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("is the union of primary and extended definitions", () => {
    expect(PRESET_SHAPE_DEFINITIONS.length).toBe(
      PRIMARY_SHAPE_DEFINITIONS.length + EXTENDED_SHAPE_DEFINITIONS.length,
    );
  });

  it("every definition has a non-empty name", () => {
    for (const def of PRESET_SHAPE_DEFINITIONS) {
      expect(def.name.length).toBeGreaterThan(0);
    }
  });

  it("every definition has a non-empty label", () => {
    for (const def of PRESET_SHAPE_DEFINITIONS) {
      expect(def.label.length).toBeGreaterThan(0);
    }
  });

  it("every definition has a valid category", () => {
    const validCategories: PresetShapeCategory[] = [
      "basic",
      "rectangles",
      "arrows",
      "stars",
      "callouts",
      "flowchart",
      "math",
      "action",
      "other",
    ];
    for (const def of PRESET_SHAPE_DEFINITIONS) {
      expect(validCategories).toContain(def.category);
    }
  });

  it("has no duplicate names", () => {
    const names = PRESET_SHAPE_DEFINITIONS.map((d) => d.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("contains the fundamental shape types", () => {
    const names = new Set(PRESET_SHAPE_DEFINITIONS.map((d) => d.name));
    expect(names.has("rect")).toBe(true);
    expect(names.has("roundRect")).toBe(true);
    expect(names.has("ellipse")).toBe(true);
    expect(names.has("triangle")).toBe(true);
    expect(names.has("diamond")).toBe(true);
  });

  it("clip-path values are either undefined or non-empty strings", () => {
    for (const def of PRESET_SHAPE_DEFINITIONS) {
      if (def.clipPath !== undefined) {
        expect(typeof def.clipPath).toBe("string");
        expect(def.clipPath.length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// PRIMARY_SHAPE_DEFINITIONS
// ---------------------------------------------------------------------------

describe("PRIMARY_SHAPE_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(PRIMARY_SHAPE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("contains basic shapes", () => {
    const names = new Set(PRIMARY_SHAPE_DEFINITIONS.map((d) => d.name));
    expect(names.has("rect")).toBe(true);
    expect(names.has("ellipse")).toBe(true);
    expect(names.has("triangle")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EXTENDED_SHAPE_DEFINITIONS
// ---------------------------------------------------------------------------

describe("EXTENDED_SHAPE_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(EXTENDED_SHAPE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("contains arrow and callout shapes", () => {
    const categories = new Set(
      EXTENDED_SHAPE_DEFINITIONS.map((d) => d.category),
    );
    expect(categories.has("arrows")).toBe(true);
    expect(categories.has("callouts")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PRESET_SHAPE_CATEGORY_LABELS
// ---------------------------------------------------------------------------

describe("PRESET_SHAPE_CATEGORY_LABELS", () => {
  it("has a label for every category", () => {
    const categories: PresetShapeCategory[] = [
      "basic",
      "rectangles",
      "arrows",
      "stars",
      "callouts",
      "flowchart",
      "math",
      "action",
      "other",
    ];
    for (const cat of categories) {
      expect(PRESET_SHAPE_CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof PRESET_SHAPE_CATEGORY_LABELS[cat]).toBe("string");
      expect(PRESET_SHAPE_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });

  it("maps basic to 'Basic Shapes'", () => {
    expect(PRESET_SHAPE_CATEGORY_LABELS.basic).toBe("Basic Shapes");
  });

  it("maps flowchart to 'Flowchart'", () => {
    expect(PRESET_SHAPE_CATEGORY_LABELS.flowchart).toBe("Flowchart");
  });

  it("maps action to 'Action Buttons'", () => {
    expect(PRESET_SHAPE_CATEGORY_LABELS.action).toBe("Action Buttons");
  });

  it("covers all categories used in shape definitions", () => {
    const usedCategories = new Set(
      PRESET_SHAPE_DEFINITIONS.map((d) => d.category),
    );
    for (const cat of usedCategories) {
      expect(PRESET_SHAPE_CATEGORY_LABELS[cat]).toBeDefined();
    }
  });
});
