import { describe, it, expect } from "vitest";
import {
  HEADING,
  CARD,
  INPUT,
  BTN,
  CELL_INPUT,
  CHART_TYPE_OPTIONS,
  GROUPING_OPTIONS,
  LEGEND_POSITION_OPTIONS,
  GROUPING_SUPPORTED_TYPES,
} from "./chart-panel-constants";

// ---------------------------------------------------------------------------
// CSS class strings
// ---------------------------------------------------------------------------

describe("CSS class strings", () => {
  it("HEADING is a non-empty string", () => {
    expect(HEADING).toBeTruthy();
    expect(typeof HEADING).toBe("string");
  });

  it("CARD is a non-empty string", () => {
    expect(CARD).toBeTruthy();
    expect(typeof CARD).toBe("string");
  });

  it("INPUT is a non-empty string", () => {
    expect(INPUT).toBeTruthy();
    expect(typeof INPUT).toBe("string");
  });

  it("BTN is a non-empty string", () => {
    expect(BTN).toBeTruthy();
    expect(typeof BTN).toBe("string");
  });

  it("CELL_INPUT is a non-empty string", () => {
    expect(CELL_INPUT).toBeTruthy();
    expect(typeof CELL_INPUT).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// CHART_TYPE_OPTIONS
// ---------------------------------------------------------------------------

describe("CHART_TYPE_OPTIONS", () => {
  it("has 11 chart types", () => {
    expect(CHART_TYPE_OPTIONS).toHaveLength(11);
  });

  it("contains bar, line, pie", () => {
    const values = CHART_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain("bar");
    expect(values).toContain("line");
    expect(values).toContain("pie");
  });

  it("contains scatter, bubble, radar", () => {
    const values = CHART_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain("scatter");
    expect(values).toContain("bubble");
    expect(values).toContain("radar");
  });

  it("every item has a non-empty value and labelKey", () => {
    for (const opt of CHART_TYPE_OPTIONS) {
      expect(opt.value).toBeTruthy();
      expect(opt.labelKey).toBeTruthy();
      expect(typeof opt.labelKey).toBe("string");
    }
  });

  it("has no duplicate values", () => {
    const values = CHART_TYPE_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// GROUPING_OPTIONS
// ---------------------------------------------------------------------------

describe("GROUPING_OPTIONS", () => {
  it("has exactly 3 options", () => {
    expect(GROUPING_OPTIONS).toHaveLength(3);
  });

  it("contains clustered, stacked, percentStacked", () => {
    const values = GROUPING_OPTIONS.map((o) => o.value);
    expect(values).toContain("clustered");
    expect(values).toContain("stacked");
    expect(values).toContain("percentStacked");
  });

  it("every item has a non-empty labelKey", () => {
    for (const opt of GROUPING_OPTIONS) {
      expect(opt.labelKey).toBeTruthy();
    }
  });

  it("has no duplicate values", () => {
    const values = GROUPING_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// LEGEND_POSITION_OPTIONS
// ---------------------------------------------------------------------------

describe("LEGEND_POSITION_OPTIONS", () => {
  it("has exactly 4 positions", () => {
    expect(LEGEND_POSITION_OPTIONS).toHaveLength(4);
  });

  it("contains t, b, l, r", () => {
    const values = LEGEND_POSITION_OPTIONS.map((o) => o.value);
    expect(values).toContain("t");
    expect(values).toContain("b");
    expect(values).toContain("l");
    expect(values).toContain("r");
  });

  it("every item has a non-empty labelKey", () => {
    for (const opt of LEGEND_POSITION_OPTIONS) {
      expect(opt.labelKey).toBeTruthy();
    }
  });

  it("has no duplicate values", () => {
    const values = LEGEND_POSITION_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// GROUPING_SUPPORTED_TYPES
// ---------------------------------------------------------------------------

describe("GROUPING_SUPPORTED_TYPES", () => {
  it("is a Set", () => {
    expect(GROUPING_SUPPORTED_TYPES).toBeInstanceOf(Set);
  });

  it("contains bar, line, area", () => {
    expect(GROUPING_SUPPORTED_TYPES.has("bar")).toBe(true);
    expect(GROUPING_SUPPORTED_TYPES.has("line")).toBe(true);
    expect(GROUPING_SUPPORTED_TYPES.has("area")).toBe(true);
  });

  it("does not contain pie or scatter", () => {
    expect(GROUPING_SUPPORTED_TYPES.has("pie" as any)).toBe(false);
    expect(GROUPING_SUPPORTED_TYPES.has("scatter" as any)).toBe(false);
  });

  it("has exactly 3 entries", () => {
    expect(GROUPING_SUPPORTED_TYPES.size).toBe(3);
  });
});
