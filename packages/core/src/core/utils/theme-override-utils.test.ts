import { describe, it, expect } from "vitest";
import {
  buildClrMapOverrideXml,
  mergeThemeColorOverride,
  hasNonTrivialOverride,
  DEFAULT_COLOR_MAP,
  COLOR_MAP_ALIAS_KEYS,
} from "./theme-override-utils";
import type { PptxThemeColorScheme, XmlObject } from "../types";

// ---------------------------------------------------------------------------
// buildClrMapOverrideXml
// ---------------------------------------------------------------------------

describe("buildClrMapOverrideXml", () => {
  it("returns masterClrMapping for null override", () => {
    const result = buildClrMapOverrideXml(null);
    expect(result["a:masterClrMapping"]).toBeDefined();
    expect(result["a:overrideClrMapping"]).toBeUndefined();
  });

  it("returns masterClrMapping for undefined override", () => {
    const result = buildClrMapOverrideXml(undefined);
    expect(result["a:masterClrMapping"]).toBeDefined();
  });

  it("returns masterClrMapping for empty object", () => {
    const result = buildClrMapOverrideXml({});
    expect(result["a:masterClrMapping"]).toBeDefined();
  });

  it("returns overrideClrMapping with all 12 alias keys when overrides are provided", () => {
    const override = { bg1: "dk1", tx1: "lt1" };
    const result = buildClrMapOverrideXml(override);
    expect(result["a:overrideClrMapping"]).toBeDefined();

    const mapping = result["a:overrideClrMapping"] as Record<string, string>;
    // Should have all 12 alias keys as attributes
    for (const key of COLOR_MAP_ALIAS_KEYS) {
      expect(mapping[`@_${key}`]).toBeDefined();
    }
  });

  it("uses override values when provided and defaults for missing keys", () => {
    const override = { bg1: "dk2" };
    const result = buildClrMapOverrideXml(override);
    const mapping = result["a:overrideClrMapping"] as Record<string, string>;
    expect(mapping["@_bg1"]).toBe("dk2");
    // tx1 should use default
    expect(mapping["@_tx1"]).toBe(DEFAULT_COLOR_MAP["tx1"]);
  });

  it("fills all 12 attributes even with single override", () => {
    const override = { accent1: "accent6" };
    const result = buildClrMapOverrideXml(override);
    const mapping = result["a:overrideClrMapping"] as Record<string, string>;
    expect(Object.keys(mapping).length).toBe(12);
    expect(mapping["@_accent1"]).toBe("accent6");
  });
});

// ---------------------------------------------------------------------------
// mergeThemeColorOverride
// ---------------------------------------------------------------------------

describe("mergeThemeColorOverride", () => {
  const baseScheme: PptxThemeColorScheme = {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#1F497D",
    lt2: "#EEECE1",
    accent1: "#4472C4",
    accent2: "#ED7D31",
    accent3: "#A5A5A5",
    accent4: "#FFC000",
    accent5: "#5B9BD5",
    accent6: "#70AD47",
    hlink: "#0563C1",
    folHlink: "#954F72",
  };

  it("returns a copy of base when override is null", () => {
    const result = mergeThemeColorOverride(baseScheme, null);
    expect(result).toEqual(baseScheme);
    expect(result).not.toBe(baseScheme);
  });

  it("returns a copy of base when override is undefined", () => {
    const result = mergeThemeColorOverride(baseScheme, undefined);
    expect(result).toEqual(baseScheme);
  });

  it("returns a copy of base when override is empty", () => {
    const result = mergeThemeColorOverride(baseScheme, {});
    expect(result).toEqual(baseScheme);
  });

  it("remaps bg1 alias to lt1 slot", () => {
    // bg1 -> dk1 means lt1 should now get the dk1 color
    const result = mergeThemeColorOverride(baseScheme, { bg1: "dk1" });
    expect(result.lt1).toBe("#000000");
  });

  it("remaps tx1 alias to dk1 slot", () => {
    // tx1 -> lt1 means dk1 should now get the lt1 color
    const result = mergeThemeColorOverride(baseScheme, { tx1: "lt1" });
    expect(result.dk1).toBe("#FFFFFF");
  });

  it("remaps accent overrides directly", () => {
    const result = mergeThemeColorOverride(baseScheme, { accent1: "accent6" });
    expect(result.accent1).toBe("#70AD47");
  });

  it("remaps hlink override", () => {
    const result = mergeThemeColorOverride(baseScheme, { hlink: "accent2" });
    expect(result.hlink).toBe("#ED7D31");
  });

  it("applies multiple overrides simultaneously", () => {
    const result = mergeThemeColorOverride(baseScheme, {
      bg1: "dk2",
      tx1: "lt2",
      accent1: "accent5",
    });
    expect(result.lt1).toBe("#1F497D");
    expect(result.dk1).toBe("#EEECE1");
    expect(result.accent1).toBe("#5B9BD5");
  });

  it("does not modify the base scheme", () => {
    const baseCopy = { ...baseScheme };
    mergeThemeColorOverride(baseScheme, { bg1: "dk1" });
    expect(baseScheme).toEqual(baseCopy);
  });
});

// ---------------------------------------------------------------------------
// hasNonTrivialOverride
// ---------------------------------------------------------------------------

describe("hasNonTrivialOverride", () => {
  it("returns false for null", () => {
    expect(hasNonTrivialOverride(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasNonTrivialOverride(undefined)).toBe(false);
  });

  it("returns false for the default identity mapping", () => {
    // The default mapping maps each alias to its canonical slot
    expect(hasNonTrivialOverride({ ...DEFAULT_COLOR_MAP })).toBe(false);
  });

  it("returns true when at least one alias is remapped", () => {
    const override = { ...DEFAULT_COLOR_MAP, bg1: "dk1" };
    expect(hasNonTrivialOverride(override)).toBe(true);
  });

  it("returns true for a single non-default mapping", () => {
    expect(hasNonTrivialOverride({ accent1: "accent6" })).toBe(true);
  });

  it("returns false for empty object", () => {
    expect(hasNonTrivialOverride({})).toBe(false);
  });

  it("returns false when overrides match defaults for the given keys", () => {
    expect(hasNonTrivialOverride({ bg1: "lt1", tx1: "dk1" })).toBe(false);
  });

  it("returns true when hlink is remapped", () => {
    expect(hasNonTrivialOverride({ hlink: "accent1" })).toBe(true);
  });
});
