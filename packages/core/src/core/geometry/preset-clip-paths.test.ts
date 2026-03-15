/**
 * Tests for the preset shape clip-path registry.
 *
 * Verifies:
 * 1. All OOXML ST_ShapeType enumeration values have entries in the clip-path maps
 * 2. Clip-path strings are syntactically valid CSS clip-path values
 * 3. Shape definition entries have corresponding clip-path entries
 * 4. The lookup function works correctly for all registered shapes
 */
import { describe, it, expect } from "vitest";
import { CLIP_PATHS_CORE } from "./preset-clip-paths-core";
import { CLIP_PATHS_EXTENDED } from "./preset-clip-paths-extended";
import {
  PRESET_SHAPE_CLIP_PATHS,
  getPresetShapeClipPath,
} from "./preset-shape-clip-paths";
import { PRESET_SHAPE_DEFINITIONS } from "./preset-shape-definitions";

// ---------------------------------------------------------------------------
// Full OOXML ST_ShapeType enumeration (ECMA-376 Section 20.1.10.56)
// ---------------------------------------------------------------------------

/**
 * Complete list of all preset geometry names from the OOXML specification.
 * Each value corresponds to an `a:ST_ShapeType` enumeration member.
 */
const OOXML_PRESET_SHAPE_NAMES = [
  // Lines
  "line",
  "lineInv",
  // Basic Shapes
  "rect",
  "roundRect",
  "ellipse",
  "triangle",
  "rtTriangle",
  "rightTriangle",
  "diamond",
  "parallelogram",
  "trapezoid",
  "nonIsoscelesTrapezoid",
  "pentagon",
  "hexagon",
  "heptagon",
  "octagon",
  "decagon",
  "dodecagon",
  "star4",
  "star5",
  "star6",
  "star7",
  "star8",
  "star10",
  "star12",
  "star16",
  "star24",
  "star32",
  "round1Rect",
  "round2SameRect",
  "round2DiagRect",
  "snipRoundRect",
  "snip1Rect",
  "snip2SameRect",
  "snip2DiagRect",
  "plaque",
  "ellipse",
  "teardrop",
  "homePlate",
  "chevron",
  "pieWedge",
  "pie",
  "blockArc",
  "donut",
  "noSmoking",
  "rightArrow",
  "leftArrow",
  "upArrow",
  "downArrow",
  "stripedRightArrow",
  "notchedRightArrow",
  "bentUpArrow",
  "leftRightArrow",
  "upDownArrow",
  "leftUpArrow",
  "leftRightUpArrow",
  "quadArrow",
  "leftArrowCallout",
  "rightArrowCallout",
  "upArrowCallout",
  "downArrowCallout",
  "leftRightArrowCallout",
  "upDownArrowCallout",
  "quadArrowCallout",
  "bentArrow",
  "uturnArrow",
  "circularArrow",
  "leftCircularArrow",
  "leftRightCircularArrow",
  "curvedRightArrow",
  "curvedLeftArrow",
  "curvedUpArrow",
  "curvedDownArrow",
  "swooshArrow",
  "cube",
  "can",
  "lightningBolt",
  "heart",
  "sun",
  "moon",
  "smileyFace",
  "irregularSeal1",
  "irregularSeal2",
  "foldedCorner",
  "bevel",
  "frame",
  "halfFrame",
  "corner",
  "diagStripe",
  "chord",
  "arc",
  "leftBracket",
  "rightBracket",
  "leftBrace",
  "rightBrace",
  "bracketPair",
  "bracePair",
  // Connectors
  "straightConnector1",
  "bentConnector2",
  "bentConnector3",
  "bentConnector4",
  "bentConnector5",
  "curvedConnector2",
  "curvedConnector3",
  "curvedConnector4",
  "curvedConnector5",
  // Callouts
  "callout1",
  "callout2",
  "callout3",
  "accentCallout1",
  "accentCallout2",
  "accentCallout3",
  "borderCallout1",
  "borderCallout2",
  "borderCallout3",
  "accentBorderCallout1",
  "accentBorderCallout2",
  "accentBorderCallout3",
  "wedgeRectCallout",
  "wedgeRoundRectCallout",
  "wedgeEllipseCallout",
  "cloudCallout",
  // Banners & Ribbons
  "cloud",
  "ribbon",
  "ribbon2",
  "ellipseRibbon",
  "ellipseRibbon2",
  "leftRightRibbon",
  "verticalScroll",
  "horizontalScroll",
  "wave",
  "doubleWave",
  "plus",
  // Flowchart
  "flowChartProcess",
  "flowChartDecision",
  "flowChartInputOutput",
  "flowChartPredefinedProcess",
  "flowChartInternalStorage",
  "flowChartDocument",
  "flowChartMultidocument",
  "flowChartTerminator",
  "flowChartPreparation",
  "flowChartManualInput",
  "flowChartManualOperation",
  "flowChartConnector",
  "flowChartPunchedCard",
  "flowChartPunchedTape",
  "flowChartSummingJunction",
  "flowChartOr",
  "flowChartCollate",
  "flowChartSort",
  "flowChartExtract",
  "flowChartMerge",
  "flowChartOfflineStorage",
  "flowChartOnlineStorage",
  "flowChartMagneticTape",
  "flowChartMagneticDisk",
  "flowChartMagneticDrum",
  "flowChartDisplay",
  "flowChartDelay",
  "flowChartAlternateProcess",
  "flowChartOffpageConnector",
  // Action Buttons
  "actionButtonBlank",
  "actionButtonHome",
  "actionButtonHelp",
  "actionButtonInformation",
  "actionButtonForwardNext",
  "actionButtonBackPrevious",
  "actionButtonEnd",
  "actionButtonBeginning",
  "actionButtonReturn",
  "actionButtonDocument",
  "actionButtonSound",
  "actionButtonMovie",
  // Misc
  "gear6",
  "gear9",
  "funnel",
  "mathPlus",
  "mathMinus",
  "mathMultiply",
  "mathDivide",
  "mathEqual",
  "mathNotEqual",
  "cornerTabs",
  "squareTabs",
  "plaqueTabs",
  "chartX",
  "chartStar",
  "chartPlus",
] as const;

// ---------------------------------------------------------------------------
// Regex patterns for CSS clip-path syntax validation
// ---------------------------------------------------------------------------

/** Matches a valid CSS `polygon(...)` expression with percentage coordinates. */
const POLYGON_RE = /^polygon\(\s*(\d+(\.\d+)?%\s+\d+(\.\d+)?%\s*,?\s*)+\)$/;

/** Matches a valid CSS `ellipse(...)` expression. */
const ELLIPSE_RE = /^ellipse\(\s*\d+(\.\d+)?%\s+\d+(\.\d+)?%\s+at\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%\s*\)$/;

/** Matches a valid CSS `circle(...)` expression. */
const CIRCLE_RE = /^circle\(\s*\d+(\.\d+)?%\s+at\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%\s*\)$/;

/** Matches a valid CSS `inset(...)` expression. */
const INSET_RE = /^inset\(/;

/**
 * Returns true if the given string is a syntactically plausible CSS
 * clip-path value (polygon, ellipse, circle, or inset).
 */
function isValidClipPath(value: string): boolean {
  return (
    POLYGON_RE.test(value) ||
    ELLIPSE_RE.test(value) ||
    CIRCLE_RE.test(value) ||
    INSET_RE.test(value)
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OOXML spec coverage", () => {
  it("has clip-path entries for all OOXML ST_ShapeType values", () => {
    const missing: string[] = [];
    for (const name of OOXML_PRESET_SHAPE_NAMES) {
      const key = name.toLowerCase();
      if (!(key in PRESET_SHAPE_CLIP_PATHS)) {
        missing.push(name);
      }
    }
    expect(
      missing,
      `Missing clip-path entries for OOXML shapes: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("covers the spec naming variants for action buttons", () => {
    // The spec uses both "ForwardNext" and "ForwardOrNext" naming
    expect("actionbuttonforwardnext" in PRESET_SHAPE_CLIP_PATHS).toBe(true);
    expect("actionbuttonforwardornext" in PRESET_SHAPE_CLIP_PATHS).toBe(true);
    expect("actionbuttonbackprevious" in PRESET_SHAPE_CLIP_PATHS).toBe(true);
    expect("actionbuttonbackorprevious" in PRESET_SHAPE_CLIP_PATHS).toBe(true);
  });

  it("has entries for common aliases", () => {
    // "oval" is an alias for "ellipse"
    expect("oval" in PRESET_SHAPE_CLIP_PATHS).toBe(true);
    // "rtarrow" is an alias for "rightarrow"
    expect("rtarrow" in PRESET_SHAPE_CLIP_PATHS).toBe(true);
    // explosion aliases
    expect("explosion1" in PRESET_SHAPE_CLIP_PATHS).toBe(true);
    expect("explosion2" in PRESET_SHAPE_CLIP_PATHS).toBe(true);
    // rightTriangle alias for rtTriangle
    expect("righttriangle" in PRESET_SHAPE_CLIP_PATHS).toBe(true);
  });
});

describe("clip-path syntax validation", () => {
  const allEntries = Object.entries(PRESET_SHAPE_CLIP_PATHS);

  it("has entries in the master map", () => {
    expect(allEntries.length).toBeGreaterThan(150);
  });

  it.each(
    allEntries
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => [name, value!] as const),
  )("%s has a syntactically valid clip-path", (name, value) => {
    expect(
      isValidClipPath(value),
      `Invalid clip-path for "${name}": ${value}`,
    ).toBe(true);
  });

  it("polygon entries use percentage coordinates", () => {
    for (const [name, value] of allEntries) {
      if (value && value.startsWith("polygon(")) {
        // Check that coordinates use % not px or other units
        const inner = value.slice(8, -1); // strip polygon( ... )
        const coords = inner.split(",").map((s) => s.trim());
        for (const coord of coords) {
          const parts = coord.split(/\s+/);
          for (const part of parts) {
            if (part) {
              expect(
                part.endsWith("%"),
                `Non-percentage coordinate in "${name}": ${part}`,
              ).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("core and extended maps", () => {
  it("core map has entries for basic shapes", () => {
    const basicShapes = [
      "rect",
      "ellipse",
      "triangle",
      "diamond",
      "pentagon",
      "hexagon",
      "octagon",
      "heart",
      "sun",
      "moon",
      "arc",
    ];
    for (const shape of basicShapes) {
      expect(
        shape in CLIP_PATHS_CORE,
        `Basic shape "${shape}" missing from core map`,
      ).toBe(true);
    }
  });

  it("core map has entries for arrows", () => {
    const arrows = [
      "rightarrow",
      "leftarrow",
      "uparrow",
      "downarrow",
      "leftrightarrow",
      "updownarrow",
      "chevron",
      "homeplate",
    ];
    for (const arrow of arrows) {
      expect(
        arrow in CLIP_PATHS_CORE,
        `Arrow "${arrow}" missing from core map`,
      ).toBe(true);
    }
  });

  it("extended map has entries for stars", () => {
    const stars = [
      "star4",
      "star5",
      "star6",
      "star8",
      "star10",
      "star12",
      "star16",
      "star24",
      "star32",
    ];
    for (const star of stars) {
      expect(
        star in CLIP_PATHS_EXTENDED,
        `Star "${star}" missing from extended map`,
      ).toBe(true);
    }
  });

  it("extended map has entries for flowchart shapes", () => {
    const flowcharts = [
      "flowchartprocess",
      "flowchartdecision",
      "flowchartdocument",
      "flowchartterminator",
      "flowchartconnector",
      "flowchartdata",
      "flowchartstoreddata",
    ];
    for (const fc of flowcharts) {
      expect(
        fc in CLIP_PATHS_EXTENDED,
        `Flowchart shape "${fc}" missing from extended map`,
      ).toBe(true);
    }
  });

  it("extended map has entries for all action buttons", () => {
    const buttons = [
      "actionbuttonblank",
      "actionbuttonhome",
      "actionbuttonhelp",
      "actionbuttoninformation",
      "actionbuttonbeginning",
      "actionbuttonend",
      "actionbuttonreturn",
      "actionbuttondocument",
      "actionbuttonsound",
      "actionbuttonmovie",
    ];
    for (const btn of buttons) {
      expect(
        btn in CLIP_PATHS_EXTENDED,
        `Action button "${btn}" missing from extended map`,
      ).toBe(true);
    }
  });

  it("extended map has chart marker shapes", () => {
    expect("chartx" in CLIP_PATHS_EXTENDED).toBe(true);
    expect("chartstar" in CLIP_PATHS_EXTENDED).toBe(true);
    expect("chartplus" in CLIP_PATHS_EXTENDED).toBe(true);
  });

  it("extended map has connector entries", () => {
    expect("straightconnector1" in CLIP_PATHS_EXTENDED).toBe(true);
    expect("bentconnector3" in CLIP_PATHS_EXTENDED).toBe(true);
    expect("curvedconnector3" in CLIP_PATHS_EXTENDED).toBe(true);
  });

  it("core and extended do not have overlapping keys", () => {
    const coreKeys = new Set(Object.keys(CLIP_PATHS_CORE));
    const extendedKeys = Object.keys(CLIP_PATHS_EXTENDED);
    const overlapping = extendedKeys.filter((k) => coreKeys.has(k));
    expect(
      overlapping,
      `Overlapping keys: ${overlapping.join(", ")}`,
    ).toEqual([]);
  });
});

describe("getPresetShapeClipPath", () => {
  it("returns undefined for undefined input", () => {
    expect(getPresetShapeClipPath(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getPresetShapeClipPath("")).toBeUndefined();
  });

  it("is case-insensitive", () => {
    const lower = getPresetShapeClipPath("triangle");
    const upper = getPresetShapeClipPath("TRIANGLE");
    const mixed = getPresetShapeClipPath("Triangle");
    expect(lower).toBeDefined();
    expect(lower).toBe(upper);
    expect(lower).toBe(mixed);
  });

  it("returns a clip-path for polygon shapes", () => {
    const result = getPresetShapeClipPath("pentagon");
    expect(result).toBeDefined();
    expect(result!.startsWith("polygon(")).toBe(true);
  });

  it("returns an ellipse clip-path for ellipse shapes", () => {
    const result = getPresetShapeClipPath("ellipse");
    expect(result).toBeDefined();
    expect(result!.startsWith("ellipse(")).toBe(true);
  });

  it("returns undefined for rect (no clipping needed)", () => {
    expect(getPresetShapeClipPath("rect")).toBeUndefined();
  });

  it("returns undefined for connector shapes (rendered by connector engine)", () => {
    expect(getPresetShapeClipPath("straightConnector1")).toBeUndefined();
    expect(getPresetShapeClipPath("bentConnector3")).toBeUndefined();
  });

  it("returns a clip-path for newly added shapes", () => {
    expect(getPresetShapeClipPath("arc")).toBeDefined();
    expect(getPresetShapeClipPath("ellipseRibbon")).toBeDefined();
    expect(getPresetShapeClipPath("ellipseRibbon2")).toBeDefined();
    expect(getPresetShapeClipPath("chartX")).toBeDefined();
    expect(getPresetShapeClipPath("chartStar")).toBeDefined();
    expect(getPresetShapeClipPath("chartPlus")).toBeDefined();
    expect(getPresetShapeClipPath("cornerTabs")).toBeDefined();
    expect(getPresetShapeClipPath("flowChartStoredData")).toBeDefined();
  });
});

describe("shape definitions coverage", () => {
  it("all shape definitions have corresponding clip-path entries", () => {
    const missing: string[] = [];
    for (const def of PRESET_SHAPE_DEFINITIONS) {
      const key = def.name.toLowerCase();
      if (!(key in PRESET_SHAPE_CLIP_PATHS)) {
        missing.push(def.name);
      }
    }
    expect(
      missing,
      `Shape definitions without clip-path entries: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("includes arc in shape definitions", () => {
    const arcDef = PRESET_SHAPE_DEFINITIONS.find((d) => d.name === "arc");
    expect(arcDef).toBeDefined();
    expect(arcDef!.category).toBe("basic");
  });

  it("includes chord in shape definitions", () => {
    const chordDef = PRESET_SHAPE_DEFINITIONS.find((d) => d.name === "chord");
    expect(chordDef).toBeDefined();
    expect(chordDef!.category).toBe("basic");
  });

  it("includes ellipseRibbon shapes in shape definitions", () => {
    const er1 = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "ellipseRibbon",
    );
    const er2 = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "ellipseRibbon2",
    );
    expect(er1).toBeDefined();
    expect(er2).toBeDefined();
    expect(er1!.category).toBe("stars");
    expect(er2!.category).toBe("stars");
  });

  it("includes chart marker shapes in shape definitions", () => {
    const chartX = PRESET_SHAPE_DEFINITIONS.find((d) => d.name === "chartX");
    const chartStar = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "chartStar",
    );
    const chartPlus = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "chartPlus",
    );
    expect(chartX).toBeDefined();
    expect(chartStar).toBeDefined();
    expect(chartPlus).toBeDefined();
  });

  it("includes circular arrow shapes in shape definitions", () => {
    const ca = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "circularArrow",
    );
    const lca = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "leftCircularArrow",
    );
    const lrca = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "leftRightCircularArrow",
    );
    expect(ca).toBeDefined();
    expect(lca).toBeDefined();
    expect(lrca).toBeDefined();
    expect(ca!.category).toBe("arrows");
  });

  it("includes flowChartStoredData in shape definitions", () => {
    const fsd = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "flowChartStoredData",
    );
    expect(fsd).toBeDefined();
    expect(fsd!.category).toBe("flowchart");
  });

  it("includes cornerTabs in shape definitions", () => {
    const ct = PRESET_SHAPE_DEFINITIONS.find((d) => d.name === "cornerTabs");
    expect(ct).toBeDefined();
    expect(ct!.category).toBe("other");
  });

  it("includes line shapes in shape definitions", () => {
    const line = PRESET_SHAPE_DEFINITIONS.find((d) => d.name === "line");
    const lineInv = PRESET_SHAPE_DEFINITIONS.find((d) => d.name === "lineInv");
    expect(line).toBeDefined();
    expect(lineInv).toBeDefined();
  });

  it("includes squareTabs and plaqueTabs in shape definitions", () => {
    const sq = PRESET_SHAPE_DEFINITIONS.find((d) => d.name === "squareTabs");
    const pl = PRESET_SHAPE_DEFINITIONS.find((d) => d.name === "plaqueTabs");
    expect(sq).toBeDefined();
    expect(pl).toBeDefined();
  });

  it("includes plus and rightTriangle in shape definitions", () => {
    const plus = PRESET_SHAPE_DEFINITIONS.find((d) => d.name === "plus");
    const rt = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "rightTriangle",
    );
    expect(plus).toBeDefined();
    expect(rt).toBeDefined();
  });

  it("includes straightConnector1 in shape definitions", () => {
    const sc = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "straightConnector1",
    );
    expect(sc).toBeDefined();
  });

  it("includes actionButtonBackPrevious and actionButtonForwardNext", () => {
    const back = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "actionButtonBackPrevious",
    );
    const fwd = PRESET_SHAPE_DEFINITIONS.find(
      (d) => d.name === "actionButtonForwardNext",
    );
    expect(back).toBeDefined();
    expect(fwd).toBeDefined();
    expect(back!.category).toBe("action");
    expect(fwd!.category).toBe("action");
  });
});
