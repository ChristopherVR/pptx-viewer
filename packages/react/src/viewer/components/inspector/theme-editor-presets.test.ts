import { describe, it, expect } from "vitest";
import { PRESET_THEMES, COMMON_FONTS } from "./theme-editor-presets";
import type { PresetTheme } from "./theme-editor-presets";

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const COLOR_SCHEME_KEYS = [
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
] as const;

describe("PRESET_THEMES", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(PRESET_THEMES)).toBe(true);
    expect(PRESET_THEMES.length).toBeGreaterThan(0);
  });

  it("contains the Office theme", () => {
    const office = PRESET_THEMES.find((t) => t.name === "Office");
    expect(office).toBeDefined();
  });

  it("contains the Facet theme", () => {
    const facet = PRESET_THEMES.find((t) => t.name === "Facet");
    expect(facet).toBeDefined();
  });

  it("contains the Integral theme", () => {
    const integral = PRESET_THEMES.find((t) => t.name === "Integral");
    expect(integral).toBeDefined();
  });

  it("has no duplicate theme names", () => {
    const names = PRESET_THEMES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  // Per-theme structural checks
  describe("each theme has required properties", () => {
    for (const theme of PRESET_THEMES) {
      describe(`theme: ${theme.name}`, () => {
        it("has a non-empty name", () => {
          expect(theme.name).toBeTruthy();
          expect(typeof theme.name).toBe("string");
        });

        it("has a non-empty majorFont", () => {
          expect(theme.majorFont).toBeTruthy();
          expect(typeof theme.majorFont).toBe("string");
        });

        it("has a non-empty minorFont", () => {
          expect(theme.minorFont).toBeTruthy();
          expect(typeof theme.minorFont).toBe("string");
        });

        it("has all 12 color scheme keys", () => {
          for (const key of COLOR_SCHEME_KEYS) {
            expect(theme.colorScheme).toHaveProperty(key);
          }
        });

        it("all color values are valid hex colors", () => {
          for (const key of COLOR_SCHEME_KEYS) {
            const color = theme.colorScheme[key];
            expect(color).toMatch(HEX_COLOR_RE);
          }
        });
      });
    }
  });

  // Office theme specific color checks
  describe("Office theme colors", () => {
    let office: PresetTheme;

    it("has dk1 = #000000", () => {
      office = PRESET_THEMES.find((t) => t.name === "Office")!;
      expect(office.colorScheme.dk1).toBe("#000000");
    });

    it("has lt1 = #FFFFFF", () => {
      office = PRESET_THEMES.find((t) => t.name === "Office")!;
      expect(office.colorScheme.lt1).toBe("#FFFFFF");
    });

    it("has accent1 = #4472C4", () => {
      office = PRESET_THEMES.find((t) => t.name === "Office")!;
      expect(office.colorScheme.accent1).toBe("#4472C4");
    });

    it("has hlink = #0563C1", () => {
      office = PRESET_THEMES.find((t) => t.name === "Office")!;
      expect(office.colorScheme.hlink).toBe("#0563C1");
    });
  });
});

describe("COMMON_FONTS", () => {
  it("is a non-empty array", () => {
    expect(COMMON_FONTS.length).toBeGreaterThan(0);
  });

  it("contains well-known fonts", () => {
    expect(COMMON_FONTS).toContain("Arial");
    expect(COMMON_FONTS).toContain("Calibri");
    expect(COMMON_FONTS).toContain("Times New Roman");
    expect(COMMON_FONTS).toContain("Georgia");
  });

  it("every entry is a non-empty string", () => {
    for (const font of COMMON_FONTS) {
      expect(font).toBeTruthy();
      expect(typeof font).toBe("string");
    }
  });

  it("has no duplicates", () => {
    expect(new Set(COMMON_FONTS).size).toBe(COMMON_FONTS.length);
  });
});
