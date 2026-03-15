import { describe, it, expect } from "vitest";
import { THEME_PRESETS, type PptxThemePreset } from "./theme-presets";
import { THEME_COLOR_SCHEME_KEYS } from "./theme";

describe("THEME_PRESETS", () => {
  it("contains at least 6 presets", () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it("all presets have unique IDs", () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all presets have unique names", () => {
    const names = THEME_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(THEME_PRESETS.map((p) => [p.id, p] as [string, PptxThemePreset]))(
    "preset %s has all 12 colour scheme keys",
    (_id, preset) => {
      for (const key of THEME_COLOR_SCHEME_KEYS) {
        const value = preset.colorScheme[key];
        expect(value).toBeDefined();
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    },
  );

  it.each(THEME_PRESETS.map((p) => [p.id, p] as [string, PptxThemePreset]))(
    "preset %s has font scheme with latin fonts",
    (_id, preset) => {
      expect(preset.fontScheme.majorFont?.latin).toBeTruthy();
      expect(preset.fontScheme.minorFont?.latin).toBeTruthy();
    },
  );

  it("includes the Office (default) preset", () => {
    const office = THEME_PRESETS.find((p) => p.id === "office");
    expect(office).toBeDefined();
    expect(office!.name).toBe("Office");
    expect(office!.colorScheme.accent1).toBe("#4472C4");
  });

  it("includes the Ion preset", () => {
    const ion = THEME_PRESETS.find((p) => p.id === "ion");
    expect(ion).toBeDefined();
    expect(ion!.name).toBe("Ion");
    expect(ion!.colorScheme.accent1).toBe("#B01513");
  });
});
