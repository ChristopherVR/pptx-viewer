import { describe, it, expect } from "vitest";
import {
  INPUT_CLS,
  SELECT_CLS,
  ENTRANCE_PRESETS,
  EXIT_PRESETS,
  EMPHASIS_PRESETS,
  TRIGGER_OPTIONS,
  TIMING_CURVE_OPTIONS,
  REPEAT_MODE_OPTIONS,
  DIRECTION_OPTIONS,
  SEQUENCE_OPTIONS,
  DIRECTIONAL_PRESETS,
} from "./animation-panel-constants";

// ---------------------------------------------------------------------------
// CSS class strings
// ---------------------------------------------------------------------------

describe("INPUT_CLS", () => {
  it("is a non-empty string", () => {
    expect(INPUT_CLS).toBeTruthy();
    expect(typeof INPUT_CLS).toBe("string");
  });
});

describe("SELECT_CLS", () => {
  it("is a non-empty string", () => {
    expect(SELECT_CLS).toBeTruthy();
    expect(typeof SELECT_CLS).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// ENTRANCE_PRESETS
// ---------------------------------------------------------------------------

describe("ENTRANCE_PRESETS", () => {
  it("contains fadeIn", () => {
    expect(ENTRANCE_PRESETS.some((o) => o.value === "fadeIn")).toBe(true);
  });

  it("contains flyIn", () => {
    expect(ENTRANCE_PRESETS.some((o) => o.value === "flyIn")).toBe(true);
  });

  it("contains zoomIn", () => {
    expect(ENTRANCE_PRESETS.some((o) => o.value === "zoomIn")).toBe(true);
  });

  it("has exactly 3 items", () => {
    expect(ENTRANCE_PRESETS).toHaveLength(3);
  });

  it("every item has a non-empty value and label", () => {
    for (const opt of ENTRANCE_PRESETS) {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
    }
  });

  it("has no duplicate values", () => {
    const values = ENTRANCE_PRESETS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// EXIT_PRESETS
// ---------------------------------------------------------------------------

describe("EXIT_PRESETS", () => {
  it("contains fadeOut", () => {
    expect(EXIT_PRESETS.some((o) => o.value === "fadeOut")).toBe(true);
  });

  it("contains flyOut", () => {
    expect(EXIT_PRESETS.some((o) => o.value === "flyOut")).toBe(true);
  });

  it("contains zoomOut", () => {
    expect(EXIT_PRESETS.some((o) => o.value === "zoomOut")).toBe(true);
  });

  it("has exactly 3 items", () => {
    expect(EXIT_PRESETS).toHaveLength(3);
  });

  it("has no duplicate values", () => {
    const values = EXIT_PRESETS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// EMPHASIS_PRESETS
// ---------------------------------------------------------------------------

describe("EMPHASIS_PRESETS", () => {
  it("contains spin", () => {
    expect(EMPHASIS_PRESETS.some((o) => o.value === "spin")).toBe(true);
  });

  it("contains pulse", () => {
    expect(EMPHASIS_PRESETS.some((o) => o.value === "pulse")).toBe(true);
  });

  it("contains bounce", () => {
    expect(EMPHASIS_PRESETS.some((o) => o.value === "bounce")).toBe(true);
  });

  it("contains flash", () => {
    expect(EMPHASIS_PRESETS.some((o) => o.value === "flash")).toBe(true);
  });

  it("contains growShrink", () => {
    expect(EMPHASIS_PRESETS.some((o) => o.value === "growShrink")).toBe(true);
  });

  it("contains teeter", () => {
    expect(EMPHASIS_PRESETS.some((o) => o.value === "teeter")).toBe(true);
  });

  it("has no duplicate values", () => {
    const values = EMPHASIS_PRESETS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("every item has a non-empty label", () => {
    for (const opt of EMPHASIS_PRESETS) {
      expect(opt.label).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// TRIGGER_OPTIONS
// ---------------------------------------------------------------------------

describe("TRIGGER_OPTIONS", () => {
  it("has exactly 5 trigger types", () => {
    expect(TRIGGER_OPTIONS).toHaveLength(5);
  });

  it("contains onClick, onShapeClick, onHover, afterPrevious, withPrevious", () => {
    const values = TRIGGER_OPTIONS.map((o) => o.value);
    expect(values).toContain("onClick");
    expect(values).toContain("onShapeClick");
    expect(values).toContain("onHover");
    expect(values).toContain("afterPrevious");
    expect(values).toContain("withPrevious");
  });

  it("every item has a non-empty value and labelKey", () => {
    for (const opt of TRIGGER_OPTIONS) {
      expect(opt.value).toBeTruthy();
      expect(opt.labelKey).toBeTruthy();
      expect(typeof opt.labelKey).toBe("string");
    }
  });

  it("has no duplicate values", () => {
    const values = TRIGGER_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// TIMING_CURVE_OPTIONS
// ---------------------------------------------------------------------------

describe("TIMING_CURVE_OPTIONS", () => {
  it("has exactly 4 items", () => {
    expect(TIMING_CURVE_OPTIONS).toHaveLength(4);
  });

  it("contains ease, ease-in, ease-out, linear", () => {
    const values = TIMING_CURVE_OPTIONS.map((o) => o.value);
    expect(values).toContain("ease");
    expect(values).toContain("ease-in");
    expect(values).toContain("ease-out");
    expect(values).toContain("linear");
  });

  it("every item has a non-empty labelKey", () => {
    for (const opt of TIMING_CURVE_OPTIONS) {
      expect(opt.labelKey).toBeTruthy();
    }
  });

  it("has no duplicate values", () => {
    const values = TIMING_CURVE_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// REPEAT_MODE_OPTIONS
// ---------------------------------------------------------------------------

describe("REPEAT_MODE_OPTIONS", () => {
  it("has 3 items", () => {
    expect(REPEAT_MODE_OPTIONS).toHaveLength(3);
  });

  it("contains none", () => {
    expect(REPEAT_MODE_OPTIONS.some((o) => o.value === "none")).toBe(true);
  });

  it("contains untilNextClick", () => {
    expect(REPEAT_MODE_OPTIONS.some((o) => o.value === "untilNextClick")).toBe(
      true,
    );
  });

  it("contains untilEndOfSlide", () => {
    expect(REPEAT_MODE_OPTIONS.some((o) => o.value === "untilEndOfSlide")).toBe(
      true,
    );
  });

  it("every item has a non-empty labelKey", () => {
    for (const opt of REPEAT_MODE_OPTIONS) {
      expect(opt.labelKey).toBeTruthy();
    }
  });

  it("has no duplicate values", () => {
    const values = REPEAT_MODE_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// DIRECTION_OPTIONS
// ---------------------------------------------------------------------------

describe("DIRECTION_OPTIONS", () => {
  it("has exactly 4 items", () => {
    expect(DIRECTION_OPTIONS).toHaveLength(4);
  });

  it("contains fromTop, fromBottom, fromLeft, fromRight", () => {
    const values = DIRECTION_OPTIONS.map((o) => o.value);
    expect(values).toContain("fromTop");
    expect(values).toContain("fromBottom");
    expect(values).toContain("fromLeft");
    expect(values).toContain("fromRight");
  });

  it("every item has an icon property", () => {
    for (const opt of DIRECTION_OPTIONS) {
      expect(opt.icon).toBeDefined();
      expect(typeof opt.icon).toBe("function");
    }
  });

  it("has no duplicate values", () => {
    const values = DIRECTION_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// SEQUENCE_OPTIONS
// ---------------------------------------------------------------------------

describe("SEQUENCE_OPTIONS", () => {
  it("has exactly 4 items", () => {
    expect(SEQUENCE_OPTIONS).toHaveLength(4);
  });

  it("contains asOne, byParagraph, byWord, byLetter", () => {
    const values = SEQUENCE_OPTIONS.map((o) => o.value);
    expect(values).toContain("asOne");
    expect(values).toContain("byParagraph");
    expect(values).toContain("byWord");
    expect(values).toContain("byLetter");
  });

  it("has no duplicate values", () => {
    const values = SEQUENCE_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// DIRECTIONAL_PRESETS
// ---------------------------------------------------------------------------

describe("DIRECTIONAL_PRESETS", () => {
  it("is a Set", () => {
    expect(DIRECTIONAL_PRESETS).toBeInstanceOf(Set);
  });

  it("contains flyIn and flyOut", () => {
    expect(DIRECTIONAL_PRESETS.has("flyIn")).toBe(true);
    expect(DIRECTIONAL_PRESETS.has("flyOut")).toBe(true);
  });

  it("has exactly 2 entries", () => {
    expect(DIRECTIONAL_PRESETS.size).toBe(2);
  });
});
