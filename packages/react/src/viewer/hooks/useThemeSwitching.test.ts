import { describe, it, expect } from "vitest";
import {
  THEME_PRESETS,
  type PptxThemePreset,
  type PptxThemeColorScheme,
} from "pptx-viewer-core";

/**
 * Unit tests for the theme switching hook.
 * These test the pure logic without rendering React components.
 * The hook itself is a thin wrapper around THEME_PRESETS and applyThemeToData.
 */

describe("THEME_PRESETS (used by useThemeSwitching)", () => {
  it("exports a non-empty readonly array", () => {
    expect(Array.isArray(THEME_PRESETS)).toBe(true);
    expect(THEME_PRESETS.length).toBeGreaterThan(0);
  });

  it("each preset has an id, name, colorScheme, and fontScheme", () => {
    for (const preset of THEME_PRESETS) {
      expect(typeof preset.id).toBe("string");
      expect(preset.id.length).toBeGreaterThan(0);
      expect(typeof preset.name).toBe("string");
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.colorScheme).toBeDefined();
      expect(preset.fontScheme).toBeDefined();
    }
  });

  it("all preset colour schemes have valid hex colours", () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    const keys: Array<keyof PptxThemeColorScheme> = [
      "dk1", "lt1", "dk2", "lt2",
      "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
      "hlink", "folHlink",
    ];
    for (const preset of THEME_PRESETS) {
      for (const key of keys) {
        expect(preset.colorScheme[key]).toMatch(hexRegex);
      }
    }
  });

  it("all preset font schemes have latin major and minor fonts", () => {
    for (const preset of THEME_PRESETS) {
      expect(typeof preset.fontScheme.majorFont?.latin).toBe("string");
      expect(typeof preset.fontScheme.minorFont?.latin).toBe("string");
    }
  });

  it("can find a preset by id", () => {
    const ion = THEME_PRESETS.find(
      (p: PptxThemePreset) => p.id === "ion",
    );
    expect(ion).toBeDefined();
    expect(ion!.name).toBe("Ion");
  });
});
