import { describe, it, expect } from "vitest";
import { BEVEL_TYPE_OPTIONS } from "./bevel-type-options";

const EXPECTED_BEVEL_VALUES = [
  "circle",
  "relaxedInset",
  "cross",
  "slope",
  "convex",
  "coolSlant",
  "angle",
  "softRound",
  "riblet",
  "hardEdge",
  "artDeco",
  "divot",
];

describe("BEVEL_TYPE_OPTIONS", () => {
  it("contains exactly 12 bevel types", () => {
    expect(BEVEL_TYPE_OPTIONS).toHaveLength(12);
  });

  it("contains all expected ST_BevelPresetType values", () => {
    const values = BEVEL_TYPE_OPTIONS.map((o) => o.value);
    for (const expected of EXPECTED_BEVEL_VALUES) {
      expect(values).toContain(expected);
    }
  });

  it("has the expected values in order", () => {
    const values = BEVEL_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(EXPECTED_BEVEL_VALUES);
  });

  it("every item has a non-empty value", () => {
    for (const opt of BEVEL_TYPE_OPTIONS) {
      expect(opt.value).toBeTruthy();
      expect(typeof opt.value).toBe("string");
    }
  });

  it("every item has a non-empty label", () => {
    for (const opt of BEVEL_TYPE_OPTIONS) {
      expect(opt.label).toBeTruthy();
      expect(typeof opt.label).toBe("string");
    }
  });

  it("has no duplicate values", () => {
    const values = BEVEL_TYPE_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("has no duplicate labels", () => {
    const labels = BEVEL_TYPE_OPTIONS.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("values are valid OOXML ST_BevelPresetType values", () => {
    const validBevelTypes = new Set([
      "angle",
      "artDeco",
      "circle",
      "convex",
      "coolSlant",
      "cross",
      "divot",
      "hardEdge",
      "relaxedInset",
      "riblet",
      "slope",
      "softRound",
    ]);
    for (const opt of BEVEL_TYPE_OPTIONS) {
      expect(validBevelTypes.has(opt.value)).toBe(true);
    }
  });
});
