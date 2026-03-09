import { describe, it, expect } from "vitest";
import {
  resolveThemeFont,
  tintColor,
  shadeColor,
  buildThemeColorGrid,
  themeColorSchemeToSwatches,
  THEME_COLOR_TINT_ROWS,
  THEME_COLOR_LABELS,
} from "./theme";
import type {
  PptxThemeFontScheme,
  PptxThemeColorScheme,
  PptxTheme,
} from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// resolveThemeFont
// ---------------------------------------------------------------------------

describe("resolveThemeFont", () => {
  const fontScheme: PptxThemeFontScheme = {
    majorFont: {
      latin: "Calibri Light",
      eastAsia: "MS Gothic",
      complexScript: "Arial",
    },
    minorFont: {
      latin: "Calibri",
      eastAsia: "MS Mincho",
      complexScript: "Times New Roman",
    },
  };

  it("resolves +mj-lt to major latin font", () => {
    expect(resolveThemeFont("+mj-lt", fontScheme)).toBe("Calibri Light");
  });

  it("resolves +mj-ea to major east asia font", () => {
    expect(resolveThemeFont("+mj-ea", fontScheme)).toBe("MS Gothic");
  });

  it("resolves +mj-cs to major complex script font", () => {
    expect(resolveThemeFont("+mj-cs", fontScheme)).toBe("Arial");
  });

  it("resolves +mn-lt to minor latin font", () => {
    expect(resolveThemeFont("+mn-lt", fontScheme)).toBe("Calibri");
  });

  it("resolves +mn-ea to minor east asia font", () => {
    expect(resolveThemeFont("+mn-ea", fontScheme)).toBe("MS Mincho");
  });

  it("resolves +mn-cs to minor complex script font", () => {
    expect(resolveThemeFont("+mn-cs", fontScheme)).toBe("Times New Roman");
  });

  it("returns input unchanged for non-theme tokens", () => {
    expect(resolveThemeFont("Arial", fontScheme)).toBe("Arial");
    expect(resolveThemeFont("Verdana", fontScheme)).toBe("Verdana");
  });

  it("returns input unchanged for unknown + tokens", () => {
    expect(resolveThemeFont("+unknown", fontScheme)).toBe("+unknown");
  });

  it("returns undefined when fontFamily is undefined", () => {
    expect(resolveThemeFont(undefined, fontScheme)).toBeUndefined();
  });

  it("returns fontFamily when fontScheme is undefined", () => {
    expect(resolveThemeFont("+mj-lt", undefined)).toBe("+mj-lt");
  });

  it("is case-insensitive for theme tokens", () => {
    expect(resolveThemeFont("+MJ-LT", fontScheme)).toBe("Calibri Light");
    expect(resolveThemeFont("+Mn-Lt", fontScheme)).toBe("Calibri");
  });

  it("handles whitespace around font token", () => {
    expect(resolveThemeFont("  +mj-lt  ", fontScheme)).toBe("Calibri Light");
  });
});

// ---------------------------------------------------------------------------
// tintColor
// ---------------------------------------------------------------------------

describe("tintColor", () => {
  it("returns original colour when tint factor is 0", () => {
    expect(tintColor("#000000", 0)).toBe("#000000");
    expect(tintColor("#FF0000", 0)).toBe("#FF0000");
  });

  it("returns white when tint factor is 1", () => {
    expect(tintColor("#000000", 1)).toBe("#FFFFFF");
    expect(tintColor("#FF0000", 1)).toBe("#FFFFFF");
    expect(tintColor("#123456", 1)).toBe("#FFFFFF");
  });

  it("lightens a colour by 50%", () => {
    // #000000 with 0.5 tint: channel = 0 + (255 - 0) * 0.5 = 127.5 → 128
    const result = tintColor("#000000", 0.5);
    expect(result).toBe("#808080");
  });

  it("lightens red by 80%", () => {
    // R: 255 + (255-255)*0.8 = 255, G: 0 + 255*0.8 = 204, B: 0 + 255*0.8 = 204
    const result = tintColor("#FF0000", 0.8);
    expect(result).toBe("#FFCCCC");
  });

  it("does not change white", () => {
    expect(tintColor("#FFFFFF", 0.5)).toBe("#FFFFFF");
  });

  it("handles mid-grey at 40%", () => {
    // #808080: 128 + (255-128)*0.4 = 128 + 50.8 = 178.8 → 179 = B3
    const result = tintColor("#808080", 0.4);
    expect(result).toBe("#B3B3B3");
  });
});

// ---------------------------------------------------------------------------
// shadeColor
// ---------------------------------------------------------------------------

describe("shadeColor", () => {
  it("returns original colour when shade factor is 0", () => {
    expect(shadeColor("#FFFFFF", 0)).toBe("#FFFFFF");
    expect(shadeColor("#FF0000", 0)).toBe("#FF0000");
  });

  it("returns black when shade factor is 1", () => {
    expect(shadeColor("#FFFFFF", 1)).toBe("#000000");
    expect(shadeColor("#FF0000", 1)).toBe("#000000");
  });

  it("darkens a colour by 50%", () => {
    // #FFFFFF with 0.5 shade: channel = 255 * (1 - 0.5) = 127.5 → 128
    const result = shadeColor("#FFFFFF", 0.5);
    expect(result).toBe("#808080");
  });

  it("darkens red by 25%", () => {
    // R: 255 * 0.75 = 191.25 → 191 = BF, G: 0 * 0.75 = 0, B: 0 * 0.75 = 0
    const result = shadeColor("#FF0000", 0.25);
    expect(result).toBe("#BF0000");
  });

  it("does not change black", () => {
    expect(shadeColor("#000000", 0.5)).toBe("#000000");
  });

  it("handles colour without leading hash", () => {
    const result = shadeColor("FFFFFF", 0.5);
    expect(result).toBe("#808080");
  });
});

// ---------------------------------------------------------------------------
// THEME_COLOR_TINT_ROWS
// ---------------------------------------------------------------------------

describe("THEME_COLOR_TINT_ROWS", () => {
  it("has exactly 6 rows", () => {
    expect(THEME_COLOR_TINT_ROWS).toHaveLength(6);
  });

  it("first row is the base (identity transform)", () => {
    const base = THEME_COLOR_TINT_ROWS[0];
    expect(base.label).toBe("Base");
    expect(base.transform("#FF0000")).toBe("#FF0000");
  });

  it("lighter rows produce lighter colours than the base", () => {
    const baseColor = "#800000";
    const lighter80 = THEME_COLOR_TINT_ROWS[1].transform(baseColor);
    // lighter 80% of #800000 should be significantly lighter
    const rValue = parseInt(lighter80.slice(1, 3), 16);
    expect(rValue).toBeGreaterThan(0x80);
  });

  it("darker rows produce darker colours than the base", () => {
    const baseColor = "#FFFFFF";
    const darker25 = THEME_COLOR_TINT_ROWS[4].transform(baseColor);
    const rValue = parseInt(darker25.slice(1, 3), 16);
    expect(rValue).toBeLessThan(0xff);
  });
});

// ---------------------------------------------------------------------------
// THEME_COLOR_LABELS
// ---------------------------------------------------------------------------

describe("THEME_COLOR_LABELS", () => {
  it("contains all 12 scheme keys", () => {
    const keys = Object.keys(THEME_COLOR_LABELS);
    expect(keys).toContain("dk1");
    expect(keys).toContain("lt1");
    expect(keys).toContain("accent1");
    expect(keys).toContain("hlink");
    expect(keys).toContain("folHlink");
    expect(keys).toHaveLength(12);
  });

  it("has human-readable labels", () => {
    expect(THEME_COLOR_LABELS.dk1).toBe("Dark 1");
    expect(THEME_COLOR_LABELS.accent1).toBe("Accent 1");
    expect(THEME_COLOR_LABELS.hlink).toBe("Hyperlink");
  });
});

// ---------------------------------------------------------------------------
// buildThemeColorGrid
// ---------------------------------------------------------------------------

describe("buildThemeColorGrid", () => {
  const colorScheme: PptxThemeColorScheme = {
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

  it("returns 6 rows", () => {
    const grid = buildThemeColorGrid(colorScheme);
    expect(grid).toHaveLength(6);
  });

  it("each row has 12 columns (one per scheme key)", () => {
    const grid = buildThemeColorGrid(colorScheme);
    for (const row of grid) {
      expect(row).toHaveLength(12);
    }
  });

  it("first row contains base colours", () => {
    const grid = buildThemeColorGrid(colorScheme);
    const firstRow = grid[0];
    expect(firstRow[0].hex).toBe("#000000");
    expect(firstRow[0].schemeKey).toBe("dk1");
    expect(firstRow[0].rowLabel).toBe("Base");
  });

  it("each cell has hex, schemeKey, rowLabel, and colLabel", () => {
    const grid = buildThemeColorGrid(colorScheme);
    const cell = grid[0][0];
    expect(cell).toHaveProperty("hex");
    expect(cell).toHaveProperty("schemeKey");
    expect(cell).toHaveProperty("rowLabel");
    expect(cell).toHaveProperty("colLabel");
  });

  it("subsequent rows apply tint/shade transforms", () => {
    const grid = buildThemeColorGrid(colorScheme);
    // Row 1 is 80% tint of accent1 (#4472C4)
    const accent1Tinted = grid[1][4]; // accent1 is the 5th key
    expect(accent1Tinted.schemeKey).toBe("accent1");
    expect(accent1Tinted.rowLabel).toBe("Lighter 80%");
    // Tinted should be lighter than base
    const baseR = parseInt(colorScheme.accent1.slice(1, 3), 16);
    const tintedR = parseInt(accent1Tinted.hex.slice(1, 3), 16);
    expect(tintedR).toBeGreaterThan(baseR);
  });

  it("darker rows darken the base colours", () => {
    const grid = buildThemeColorGrid(colorScheme);
    // Row 5 is 50% shade
    const lt1Shaded = grid[5][1]; // lt1 is the 2nd key
    expect(lt1Shaded.schemeKey).toBe("lt1");
    expect(lt1Shaded.rowLabel).toBe("Darker 50%");
    const baseR = parseInt(colorScheme.lt1.slice(1, 3), 16);
    const shadedR = parseInt(lt1Shaded.hex.slice(1, 3), 16);
    expect(shadedR).toBeLessThan(baseR);
  });
});

// ---------------------------------------------------------------------------
// themeColorSchemeToSwatches
// ---------------------------------------------------------------------------

describe("themeColorSchemeToSwatches", () => {
  it("returns empty array when theme is undefined", () => {
    expect(themeColorSchemeToSwatches(undefined)).toEqual([]);
  });

  it("returns empty array when colorScheme is missing", () => {
    const theme = {} as PptxTheme;
    expect(themeColorSchemeToSwatches(theme)).toEqual([]);
  });

  it("returns 12 swatches from a valid colour scheme", () => {
    const theme = {
      colorScheme: {
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
      },
    } as PptxTheme;
    const swatches = themeColorSchemeToSwatches(theme);
    expect(swatches).toHaveLength(12);
    expect(swatches[0]).toBe("#000000");
    expect(swatches[1]).toBe("#FFFFFF");
  });
});
