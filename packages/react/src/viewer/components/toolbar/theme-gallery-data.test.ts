import { describe, it, expect } from "vitest";
import { BUILT_IN_THEMES } from "./theme-gallery-data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const COLOR_SCHEME_KEYS = [
  "dk1", "lt1", "dk2", "lt2",
  "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
  "hlink", "folHlink",
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("theme-gallery-data", () => {
  describe("BUILT_IN_THEMES", () => {
    it("is a non-empty array", () => {
      expect(Array.isArray(BUILT_IN_THEMES)).toBe(true);
      expect(BUILT_IN_THEMES.length).toBeGreaterThan(0);
    });

    it("has no duplicate theme ids", () => {
      const ids = BUILT_IN_THEMES.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("has no duplicate theme names", () => {
      const names = BUILT_IN_THEMES.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("every theme has a non-empty id", () => {
      for (const theme of BUILT_IN_THEMES) {
        expect(typeof theme.id).toBe("string");
        expect(theme.id.length).toBeGreaterThan(0);
      }
    });

    it("every theme has a non-empty name", () => {
      for (const theme of BUILT_IN_THEMES) {
        expect(typeof theme.name).toBe("string");
        expect(theme.name.length).toBeGreaterThan(0);
      }
    });

    it("every theme has all 12 color scheme keys", () => {
      for (const theme of BUILT_IN_THEMES) {
        for (const key of COLOR_SCHEME_KEYS) {
          expect(
            theme.colorScheme[key],
            `${theme.id} missing colorScheme.${key}`,
          ).toBeDefined();
        }
      }
    });

    it("every color value is a valid 6-digit hex color", () => {
      for (const theme of BUILT_IN_THEMES) {
        for (const key of COLOR_SCHEME_KEYS) {
          const color = theme.colorScheme[key];
          expect(color, `${theme.id}.colorScheme.${key}`).toMatch(HEX_COLOR_RE);
        }
      }
    });

    it("every theme has a fontScheme with majorFont and minorFont", () => {
      for (const theme of BUILT_IN_THEMES) {
        expect(typeof theme.fontScheme.majorFont).toBe("string");
        expect(theme.fontScheme.majorFont.length).toBeGreaterThan(0);
        expect(typeof theme.fontScheme.minorFont).toBe("string");
        expect(theme.fontScheme.minorFont.length).toBeGreaterThan(0);
      }
    });

    it("the first theme is 'Office'", () => {
      expect(BUILT_IN_THEMES[0].id).toBe("office");
      expect(BUILT_IN_THEMES[0].name).toBe("Office");
    });

    it("Office theme has expected accent1 color", () => {
      const office = BUILT_IN_THEMES.find((t) => t.id === "office");
      expect(office).toBeDefined();
      expect(office!.colorScheme.accent1).toBe("#4472C4");
    });

    it("every theme's dk1 is black (#000000)", () => {
      for (const theme of BUILT_IN_THEMES) {
        expect(theme.colorScheme.dk1).toBe("#000000");
      }
    });

    it("every theme's lt1 is white (#FFFFFF)", () => {
      for (const theme of BUILT_IN_THEMES) {
        expect(theme.colorScheme.lt1).toBe("#FFFFFF");
      }
    });
  });
});
