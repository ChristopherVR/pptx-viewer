import { describe, it, expect } from "vitest";
import {
  SEL,
  NUM,
  LBL,
  SECTION_HEADING,
  FILL_MODE_OPTIONS,
  GRADIENT_TYPE_OPTIONS,
  PATTERN_OPTIONS,
} from "./table-cell-advanced-fill-constants";

describe("table-cell-advanced-fill-constants", () => {
  describe("CSS class tokens", () => {
    it("SEL is a non-empty string", () => {
      expect(typeof SEL).toBe("string");
      expect(SEL.length).toBeGreaterThan(0);
    });

    it("NUM is a non-empty string", () => {
      expect(typeof NUM).toBe("string");
      expect(NUM.length).toBeGreaterThan(0);
    });

    it("LBL is a non-empty string", () => {
      expect(typeof LBL).toBe("string");
      expect(LBL.length).toBeGreaterThan(0);
    });

    it("SECTION_HEADING is a non-empty string", () => {
      expect(typeof SECTION_HEADING).toBe("string");
      expect(SECTION_HEADING.length).toBeGreaterThan(0);
    });
  });

  describe("FILL_MODE_OPTIONS", () => {
    it("is a non-empty array", () => {
      expect(Array.isArray(FILL_MODE_OPTIONS)).toBe(true);
      expect(FILL_MODE_OPTIONS.length).toBeGreaterThan(0);
    });

    it("has no duplicate values", () => {
      const values = FILL_MODE_OPTIONS.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("has no duplicate i18nKeys", () => {
      const keys = FILL_MODE_OPTIONS.map((o) => o.i18nKey);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("every entry has value and i18nKey", () => {
      for (const opt of FILL_MODE_OPTIONS) {
        expect(typeof opt.value).toBe("string");
        expect(opt.value.length).toBeGreaterThan(0);
        expect(typeof opt.i18nKey).toBe("string");
        expect(opt.i18nKey.length).toBeGreaterThan(0);
      }
    });

    it("contains expected fill modes", () => {
      const values = FILL_MODE_OPTIONS.map((o) => o.value);
      expect(values).toContain("solid");
      expect(values).toContain("gradient");
      expect(values).toContain("pattern");
      expect(values).toContain("none");
    });
  });

  describe("GRADIENT_TYPE_OPTIONS", () => {
    it("is a non-empty array", () => {
      expect(Array.isArray(GRADIENT_TYPE_OPTIONS)).toBe(true);
      expect(GRADIENT_TYPE_OPTIONS.length).toBeGreaterThan(0);
    });

    it("has no duplicate values", () => {
      const values = GRADIENT_TYPE_OPTIONS.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("contains linear and radial", () => {
      const values = GRADIENT_TYPE_OPTIONS.map((o) => o.value);
      expect(values).toContain("linear");
      expect(values).toContain("radial");
    });

    it("every entry has value and i18nKey", () => {
      for (const opt of GRADIENT_TYPE_OPTIONS) {
        expect(typeof opt.value).toBe("string");
        expect(typeof opt.i18nKey).toBe("string");
      }
    });
  });

  describe("PATTERN_OPTIONS", () => {
    it("is an array with at most 20 items", () => {
      expect(Array.isArray(PATTERN_OPTIONS)).toBe(true);
      expect(PATTERN_OPTIONS.length).toBeLessThanOrEqual(20);
    });

    it("is non-empty", () => {
      expect(PATTERN_OPTIONS.length).toBeGreaterThan(0);
    });
  });
});
