import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeThemeLoading
// ---------------------------------------------------------------------------

interface PptxThemeColorScheme {
  dk1: string;
  lt1: string;
  dk2: string;
  lt2: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
  hlink: string;
  folHlink: string;
}

interface PptxThemeFontScheme {
  majorFont: { latin?: string; eastAsia?: string; complexScript?: string };
  minorFont: { latin?: string; eastAsia?: string; complexScript?: string };
}

interface PptxTheme {
  colorScheme?: PptxThemeColorScheme;
  fontScheme?: PptxThemeFontScheme;
  formatScheme?: unknown;
}

/**
 * Extracted from buildThemeObject — builds a structured theme from maps.
 */
function buildThemeObject(
  themeColorMap: Record<string, string>,
  themeFontMap: Record<string, string>,
  themeFormatScheme: unknown | undefined,
): PptxTheme | undefined {
  const hasColors = Object.keys(themeColorMap).length > 0;
  const hasFonts = Object.keys(themeFontMap).length > 0;
  if (!hasColors && !hasFonts) return undefined;

  let colorScheme: PptxThemeColorScheme | undefined;
  if (hasColors) {
    colorScheme = {
      dk1: themeColorMap["dk1"] || "",
      lt1: themeColorMap["lt1"] || "",
      dk2: themeColorMap["dk2"] || "",
      lt2: themeColorMap["lt2"] || "",
      accent1: themeColorMap["accent1"] || "",
      accent2: themeColorMap["accent2"] || "",
      accent3: themeColorMap["accent3"] || "",
      accent4: themeColorMap["accent4"] || "",
      accent5: themeColorMap["accent5"] || "",
      accent6: themeColorMap["accent6"] || "",
      hlink: themeColorMap["hlink"] || "",
      folHlink: themeColorMap["folHlink"] || "",
    };
  }

  let fontScheme: PptxThemeFontScheme | undefined;
  if (hasFonts) {
    fontScheme = {
      majorFont: {
        latin: themeFontMap["mj-lt"],
        eastAsia: themeFontMap["mj-ea"],
        complexScript: themeFontMap["mj-cs"],
      },
      minorFont: {
        latin: themeFontMap["mn-lt"],
        eastAsia: themeFontMap["mn-ea"],
        complexScript: themeFontMap["mn-cs"],
      },
    };
  }

  return {
    colorScheme,
    fontScheme,
    formatScheme: themeFormatScheme,
  };
}

/**
 * Extracted from loadThemeData — sets up theme aliases.
 */
function buildThemeAliases(
  themeColorMap: Record<string, string>,
  defaultMap: Record<string, string>,
): void {
  themeColorMap["tx1"] = themeColorMap["dk1"] || defaultMap["dk1"];
  themeColorMap["bg1"] = themeColorMap["lt1"] || defaultMap["lt1"];
  themeColorMap["tx2"] = themeColorMap["dk2"] || defaultMap["dk2"];
  themeColorMap["bg2"] = themeColorMap["lt2"] || defaultMap["lt2"];
}

/**
 * Standard default scheme color map.
 */
function getDefaultSchemeColorMap(): Record<string, string> {
  return {
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
    tx1: "#000000",
    tx2: "#44546A",
    bg1: "#FFFFFF",
    bg2: "#E7E6E6",
  };
}

// ---------------------------------------------------------------------------
// Tests: buildThemeObject
// ---------------------------------------------------------------------------
describe("buildThemeObject", () => {
  it("should return undefined when both maps are empty", () => {
    expect(buildThemeObject({}, {}, undefined)).toBeUndefined();
  });

  it("should return theme with colorScheme when color map has entries", () => {
    const colorMap = {
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
    const result = buildThemeObject(colorMap, {}, undefined);
    expect(result).toBeDefined();
    expect(result!.colorScheme).toBeDefined();
    expect(result!.colorScheme!.dk1).toBe("#000000");
    expect(result!.colorScheme!.accent1).toBe("#4472C4");
    expect(result!.fontScheme).toBeUndefined();
  });

  it("should return theme with fontScheme when font map has entries", () => {
    const fontMap = {
      "mj-lt": "Calibri Light",
      "mn-lt": "Calibri",
    };
    const result = buildThemeObject({}, fontMap, undefined);
    expect(result).toBeDefined();
    expect(result!.fontScheme).toBeDefined();
    expect(result!.fontScheme!.majorFont.latin).toBe("Calibri Light");
    expect(result!.fontScheme!.minorFont.latin).toBe("Calibri");
    expect(result!.colorScheme).toBeUndefined();
  });

  it("should include all font scheme fields", () => {
    const fontMap = {
      "mj-lt": "Calibri Light",
      "mj-ea": "MS Gothic",
      "mj-cs": "Times New Roman",
      "mn-lt": "Calibri",
      "mn-ea": "MS Mincho",
      "mn-cs": "Arial",
    };
    const result = buildThemeObject({}, fontMap, undefined);
    expect(result!.fontScheme!.majorFont).toEqual({
      latin: "Calibri Light",
      eastAsia: "MS Gothic",
      complexScript: "Times New Roman",
    });
    expect(result!.fontScheme!.minorFont).toEqual({
      latin: "Calibri",
      eastAsia: "MS Mincho",
      complexScript: "Arial",
    });
  });

  it("should use empty string for missing color map keys", () => {
    const result = buildThemeObject({ dk1: "#000" }, {}, undefined);
    expect(result!.colorScheme!.dk1).toBe("#000");
    expect(result!.colorScheme!.lt1).toBe("");
    expect(result!.colorScheme!.accent1).toBe("");
  });

  it("should pass through formatScheme", () => {
    const scheme = { fillStyles: [] };
    const result = buildThemeObject({ dk1: "#000" }, {}, scheme);
    expect(result!.formatScheme).toBe(scheme);
  });

  it("should return both color and font schemes when both are populated", () => {
    const result = buildThemeObject(
      { dk1: "#000", lt1: "#fff" },
      { "mj-lt": "Arial" },
      undefined,
    );
    expect(result!.colorScheme).toBeDefined();
    expect(result!.fontScheme).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: buildThemeAliases
// ---------------------------------------------------------------------------
describe("buildThemeAliases", () => {
  it("should set aliases from theme color map", () => {
    const colorMap: Record<string, string> = {
      dk1: "#111",
      lt1: "#eee",
      dk2: "#222",
      lt2: "#ddd",
    };
    const defaultMap = getDefaultSchemeColorMap();
    buildThemeAliases(colorMap, defaultMap);

    expect(colorMap["tx1"]).toBe("#111");
    expect(colorMap["bg1"]).toBe("#eee");
    expect(colorMap["tx2"]).toBe("#222");
    expect(colorMap["bg2"]).toBe("#ddd");
  });

  it("should fall back to default map when theme color map lacks keys", () => {
    const colorMap: Record<string, string> = {};
    const defaultMap = getDefaultSchemeColorMap();
    buildThemeAliases(colorMap, defaultMap);

    expect(colorMap["tx1"]).toBe("#000000");
    expect(colorMap["bg1"]).toBe("#FFFFFF");
    expect(colorMap["tx2"]).toBe("#1F497D");
    expect(colorMap["bg2"]).toBe("#EEECE1");
  });

  it("should prefer theme map values over defaults", () => {
    const colorMap: Record<string, string> = { dk1: "#custom" };
    const defaultMap = getDefaultSchemeColorMap();
    buildThemeAliases(colorMap, defaultMap);

    expect(colorMap["tx1"]).toBe("#custom");
  });
});

// ---------------------------------------------------------------------------
// Tests: getDefaultSchemeColorMap
// ---------------------------------------------------------------------------
describe("getDefaultSchemeColorMap", () => {
  it("should return all 16 expected keys", () => {
    const map = getDefaultSchemeColorMap();
    expect(Object.keys(map)).toHaveLength(16);
  });

  it("should contain all required scheme keys", () => {
    const map = getDefaultSchemeColorMap();
    const requiredKeys = [
      "dk1", "lt1", "dk2", "lt2",
      "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
      "hlink", "folHlink",
      "tx1", "tx2", "bg1", "bg2",
    ];
    for (const key of requiredKeys) {
      expect(map).toHaveProperty(key);
      expect(typeof map[key]).toBe("string");
      expect(map[key].length).toBeGreaterThan(0);
    }
  });

  it("should have dk1 as black and lt1 as white", () => {
    const map = getDefaultSchemeColorMap();
    expect(map["dk1"]).toBe("#000000");
    expect(map["lt1"]).toBe("#FFFFFF");
  });

  it("should match tx1 to dk1 and bg1 to lt1", () => {
    const map = getDefaultSchemeColorMap();
    expect(map["tx1"]).toBe(map["dk1"]);
    expect(map["bg1"]).toBe(map["lt1"]);
  });

  it("should return a new object each time", () => {
    const a = getDefaultSchemeColorMap();
    const b = getDefaultSchemeColorMap();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
