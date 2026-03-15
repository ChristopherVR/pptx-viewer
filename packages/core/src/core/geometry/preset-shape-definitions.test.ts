import { describe, it, expect } from "vitest";
import {
  PRESET_SHAPE_DEFINITIONS,
  PRESET_SHAPE_CATEGORY_LABELS,
  PRIMARY_SHAPE_DEFINITIONS,
  EXTENDED_SHAPE_DEFINITIONS,
} from "./preset-shape-definitions";
import type { PresetShapeCategory } from "./preset-shape-types";

// ---------------------------------------------------------------------------
// PRESET_SHAPE_DEFINITIONS
// ---------------------------------------------------------------------------

describe("PRESET_SHAPE_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(PRESET_SHAPE_DEFINITIONS)).toBe(true);
    expect(PRESET_SHAPE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("is the union of primary and extended definitions", () => {
    expect(PRESET_SHAPE_DEFINITIONS.length).toBe(
      PRIMARY_SHAPE_DEFINITIONS.length + EXTENDED_SHAPE_DEFINITIONS.length,
    );
  });

  it("every definition has a non-empty name", () => {
    for (const def of PRESET_SHAPE_DEFINITIONS) {
      expect(def.name.length).toBeGreaterThan(0);
    }
  });

  it("every definition has a non-empty label", () => {
    for (const def of PRESET_SHAPE_DEFINITIONS) {
      expect(def.label.length).toBeGreaterThan(0);
    }
  });

  it("every definition has a valid category", () => {
    const validCategories: PresetShapeCategory[] = [
      "basic",
      "rectangles",
      "arrows",
      "stars",
      "callouts",
      "flowchart",
      "math",
      "action",
      "other",
    ];
    for (const def of PRESET_SHAPE_DEFINITIONS) {
      expect(validCategories).toContain(def.category);
    }
  });

  it("has no duplicate names", () => {
    const names = PRESET_SHAPE_DEFINITIONS.map((d) => d.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("contains the fundamental shape types", () => {
    const names = new Set(PRESET_SHAPE_DEFINITIONS.map((d) => d.name));
    expect(names.has("rect")).toBe(true);
    expect(names.has("roundRect")).toBe(true);
    expect(names.has("ellipse")).toBe(true);
    expect(names.has("triangle")).toBe(true);
    expect(names.has("diamond")).toBe(true);
  });

  it("contains all 187 ECMA-376 preset shape definitions", () => {
    expect(PRESET_SHAPE_DEFINITIONS.length).toBe(187);
  });

  it("clip-path values are either undefined or non-empty strings", () => {
    for (const def of PRESET_SHAPE_DEFINITIONS) {
      if (def.clipPath !== undefined) {
        expect(typeof def.clipPath).toBe("string");
        expect(def.clipPath.length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// PRIMARY_SHAPE_DEFINITIONS
// ---------------------------------------------------------------------------

describe("PRIMARY_SHAPE_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(PRIMARY_SHAPE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("contains basic shapes", () => {
    const names = new Set(PRIMARY_SHAPE_DEFINITIONS.map((d) => d.name));
    expect(names.has("rect")).toBe(true);
    expect(names.has("ellipse")).toBe(true);
    expect(names.has("triangle")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EXTENDED_SHAPE_DEFINITIONS
// ---------------------------------------------------------------------------

describe("EXTENDED_SHAPE_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(EXTENDED_SHAPE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("contains arrow and callout shapes", () => {
    const categories = new Set(
      EXTENDED_SHAPE_DEFINITIONS.map((d) => d.category),
    );
    expect(categories.has("arrows")).toBe(true);
    expect(categories.has("callouts")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PRESET_SHAPE_CATEGORY_LABELS
// ---------------------------------------------------------------------------

describe("PRESET_SHAPE_CATEGORY_LABELS", () => {
  it("has a label for every category", () => {
    const categories: PresetShapeCategory[] = [
      "basic",
      "rectangles",
      "arrows",
      "stars",
      "callouts",
      "flowchart",
      "math",
      "action",
      "other",
    ];
    for (const cat of categories) {
      expect(PRESET_SHAPE_CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof PRESET_SHAPE_CATEGORY_LABELS[cat]).toBe("string");
      expect(PRESET_SHAPE_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });

  it("maps basic to 'Basic Shapes'", () => {
    expect(PRESET_SHAPE_CATEGORY_LABELS.basic).toBe("Basic Shapes");
  });

  it("maps flowchart to 'Flowchart'", () => {
    expect(PRESET_SHAPE_CATEGORY_LABELS.flowchart).toBe("Flowchart");
  });

  it("maps action to 'Action Buttons'", () => {
    expect(PRESET_SHAPE_CATEGORY_LABELS.action).toBe("Action Buttons");
  });

  it("covers all categories used in shape definitions", () => {
    const usedCategories = new Set(
      PRESET_SHAPE_DEFINITIONS.map((d) => d.category),
    );
    for (const cat of usedCategories) {
      expect(PRESET_SHAPE_CATEGORY_LABELS[cat]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// ECMA-376 completeness: newly added shapes
// ---------------------------------------------------------------------------

describe("ECMA-376 completeness", () => {
  const names = new Set(PRESET_SHAPE_DEFINITIONS.map((d) => d.name));

  it("includes line shapes", () => {
    expect(names.has("line")).toBe(true);
    expect(names.has("lineInv")).toBe(true);
  });

  it("includes straightConnector1", () => {
    expect(names.has("straightConnector1")).toBe(true);
  });

  it("includes plus shape (ECMA-376 alias of cross)", () => {
    expect(names.has("plus")).toBe(true);
    expect(names.has("cross")).toBe(true);
  });

  it("includes rightTriangle (ECMA-376 alias of rtTriangle)", () => {
    expect(names.has("rightTriangle")).toBe(true);
    expect(names.has("rtTriangle")).toBe(true);
  });

  it("includes squareTabs and plaqueTabs", () => {
    expect(names.has("squareTabs")).toBe(true);
    expect(names.has("plaqueTabs")).toBe(true);
  });

  it("includes actionButtonBackPrevious and actionButtonForwardNext", () => {
    expect(names.has("actionButtonBackPrevious")).toBe(true);
    expect(names.has("actionButtonForwardNext")).toBe(true);
  });

  it("covers all ECMA-376 preset geometry names", () => {
    const ecmaShapes = [
      "actionButtonBackPrevious", "actionButtonBeginning", "actionButtonBlank",
      "actionButtonDocument", "actionButtonEnd", "actionButtonForwardNext",
      "actionButtonHelp", "actionButtonHome", "actionButtonInformation",
      "actionButtonMovie", "actionButtonReturn", "actionButtonSound",
      "arc", "bentArrow", "bentUpArrow", "bevel", "blockArc",
      "borderCallout1", "borderCallout2", "borderCallout3",
      "bracePair", "bracketPair", "callout1", "callout2", "callout3",
      "can", "chevron", "chord", "circularArrow", "cloud", "cloudCallout",
      "corner", "cornerTabs", "cube", "curvedDownArrow", "curvedLeftArrow",
      "curvedRightArrow", "curvedUpArrow", "decagon", "diagStripe", "diamond",
      "dodecagon", "donut", "doubleWave", "downArrow", "downArrowCallout",
      "ellipse", "ellipseRibbon", "ellipseRibbon2",
      "flowChartAlternateProcess", "flowChartCollate", "flowChartConnector",
      "flowChartDecision", "flowChartDelay", "flowChartDisplay",
      "flowChartDocument", "flowChartExtract", "flowChartInputOutput",
      "flowChartInternalStorage", "flowChartMagneticDisk",
      "flowChartMagneticDrum", "flowChartMagneticTape",
      "flowChartManualInput", "flowChartManualOperation", "flowChartMerge",
      "flowChartMultidocument", "flowChartOfflineStorage",
      "flowChartOffpageConnector", "flowChartOnlineStorage", "flowChartOr",
      "flowChartPredefinedProcess", "flowChartPreparation", "flowChartProcess",
      "flowChartPunchedCard", "flowChartPunchedTape", "flowChartSort",
      "flowChartSummingJunction", "flowChartTerminator",
      "foldedCorner", "frame", "funnel", "gear6", "gear9",
      "halfFrame", "heart", "heptagon", "hexagon", "homePlate",
      "horizontalScroll", "irregularSeal1", "irregularSeal2",
      "leftArrow", "leftArrowCallout", "leftBrace", "leftBracket",
      "leftCircularArrow", "leftRightArrow", "leftRightArrowCallout",
      "leftRightCircularArrow", "leftRightRibbon", "leftRightUpArrow",
      "leftUpArrow", "lightningBolt", "line", "lineInv",
      "mathDivide", "mathEqual", "mathMinus", "mathMultiply",
      "mathNotEqual", "mathPlus", "moon", "noSmoking",
      "nonIsoscelesTrapezoid", "notchedRightArrow", "octagon",
      "parallelogram", "pentagon", "pie", "pieWedge", "plaque",
      "plaqueTabs", "plus", "quadArrow", "quadArrowCallout", "rect",
      "ribbon", "ribbon2", "rightArrow", "rightArrowCallout",
      "rightBrace", "rightBracket", "rightTriangle", "round1Rect",
      "round2DiagRect", "round2SameRect", "roundRect", "rtTriangle",
      "smileyFace", "snip1Rect", "snip2DiagRect", "snip2SameRect",
      "snipRoundRect", "squareTabs", "star10", "star12", "star16",
      "star24", "star32", "star4", "star5", "star6", "star7", "star8",
      "straightConnector1", "stripedRightArrow", "sun", "swooshArrow",
      "teardrop", "trapezoid", "triangle", "upArrow", "upArrowCallout",
      "upDownArrow", "upDownArrowCallout", "uturnArrow", "verticalScroll",
      "wave", "wedgeEllipseCallout", "wedgeRectCallout", "wedgeRoundRectCallout",
    ];
    const missing: string[] = [];
    for (const shape of ecmaShapes) {
      if (!names.has(shape)) {
        missing.push(shape);
      }
    }
    expect(
      missing,
      `Missing ECMA-376 shapes from definitions: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
