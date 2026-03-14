import { describe, it, expect, vi } from "vitest";
import {
  INPUT_CLS,
  COLOR_CLS,
  STYLE_TOGGLES,
  ALIGN_OPTIONS,
  UNDERLINE_STYLES,
  TEXT_DIRECTIONS,
  BASELINE_TOGGLES,
  createNumericChangeHandler,
} from "./TextPropertiesHelpers";

// ---------------------------------------------------------------------------
// CSS class tokens
// ---------------------------------------------------------------------------

describe("CSS class tokens", () => {
  it("INPUT_CLS is a non-empty string", () => {
    expect(typeof INPUT_CLS).toBe("string");
    expect(INPUT_CLS.length).toBeGreaterThan(0);
  });

  it("COLOR_CLS is a non-empty string", () => {
    expect(typeof COLOR_CLS).toBe("string");
    expect(COLOR_CLS.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// STYLE_TOGGLES
// ---------------------------------------------------------------------------

describe("STYLE_TOGGLES", () => {
  it("has exactly 4 items", () => {
    expect(STYLE_TOGGLES).toHaveLength(4);
  });

  it("contains bold, italic, underline, strikethrough", () => {
    const keys = STYLE_TOGGLES.map((t) => t.key);
    expect(keys).toEqual(["bold", "italic", "underline", "strikethrough"]);
  });

  it("every item has a non-empty label", () => {
    for (const toggle of STYLE_TOGGLES) {
      expect(typeof toggle.label).toBe("string");
      expect(toggle.label.length).toBeGreaterThan(0);
    }
  });

  it("every item has an Icon component", () => {
    for (const toggle of STYLE_TOGGLES) {
      expect(toggle.Icon).toBeDefined();
    }
  });

  it("has no duplicate keys", () => {
    const keys = STYLE_TOGGLES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// ALIGN_OPTIONS
// ---------------------------------------------------------------------------

describe("ALIGN_OPTIONS", () => {
  it("has exactly 4 items", () => {
    expect(ALIGN_OPTIONS).toHaveLength(4);
  });

  it("contains left, center, right, justify", () => {
    const values = ALIGN_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["left", "center", "right", "justify"]);
  });

  it("every item has an Icon component", () => {
    for (const opt of ALIGN_OPTIONS) {
      expect(opt.Icon).toBeDefined();
    }
  });

  it("has no duplicate values", () => {
    const values = ALIGN_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// UNDERLINE_STYLES
// ---------------------------------------------------------------------------

describe("UNDERLINE_STYLES", () => {
  it("is a non-empty array", () => {
    expect(UNDERLINE_STYLES.length).toBeGreaterThan(0);
  });

  it("has 17 underline styles", () => {
    expect(UNDERLINE_STYLES).toHaveLength(17);
  });

  it("every entry is a [value, label] tuple", () => {
    for (const entry of UNDERLINE_STYLES) {
      expect(entry).toHaveLength(2);
      expect(typeof entry[0]).toBe("string");
      expect(typeof entry[1]).toBe("string");
      expect(entry[0].length).toBeGreaterThan(0);
      expect(entry[1].length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate values", () => {
    const values = UNDERLINE_STYLES.map(([v]) => v);
    expect(new Set(values).size).toBe(values.length);
  });

  it("contains sng (Single) and none", () => {
    const values = UNDERLINE_STYLES.map(([v]) => v);
    expect(values).toContain("sng");
    expect(values).toContain("none");
  });

  it("contains dbl (Double) and heavy", () => {
    const values = UNDERLINE_STYLES.map(([v]) => v);
    expect(values).toContain("dbl");
    expect(values).toContain("heavy");
  });
});

// ---------------------------------------------------------------------------
// TEXT_DIRECTIONS
// ---------------------------------------------------------------------------

describe("TEXT_DIRECTIONS", () => {
  it("has exactly 3 items", () => {
    expect(TEXT_DIRECTIONS).toHaveLength(3);
  });

  it("contains horizontal, vertical, vertical270", () => {
    const values = TEXT_DIRECTIONS.map(([v]) => v);
    expect(values).toEqual(["horizontal", "vertical", "vertical270"]);
  });

  it("every entry is a [value, label] tuple", () => {
    for (const entry of TEXT_DIRECTIONS) {
      expect(entry).toHaveLength(2);
      expect(typeof entry[0]).toBe("string");
      expect(typeof entry[1]).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// BASELINE_TOGGLES
// ---------------------------------------------------------------------------

describe("BASELINE_TOGGLES", () => {
  it("has exactly 2 items", () => {
    expect(BASELINE_TOGGLES).toHaveLength(2);
  });

  it("contains Superscript and Subscript", () => {
    const labels = BASELINE_TOGGLES.map(([label]) => label);
    expect(labels).toContain("Superscript");
    expect(labels).toContain("Subscript");
  });

  it("Superscript has a positive baseline value", () => {
    const sup = BASELINE_TOGGLES.find(([l]) => l === "Superscript")!;
    expect(sup[1]).toBeGreaterThan(0);
  });

  it("Subscript has a negative baseline value", () => {
    const sub = BASELINE_TOGGLES.find(([l]) => l === "Subscript")!;
    expect(sub[1]).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// createNumericChangeHandler
// ---------------------------------------------------------------------------

describe("createNumericChangeHandler", () => {
  it("calls onUpdateTextStyle with the result of fn when value is finite", () => {
    const onUpdate = vi.fn();
    const handler = createNumericChangeHandler(onUpdate);
    const changeHandler = handler((v) => ({ characterSpacing: v }));

    changeHandler({
      target: { value: "42" },
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    expect(onUpdate).toHaveBeenCalledWith({ characterSpacing: 42 });
  });

  it("does not call onUpdateTextStyle when value is NaN", () => {
    const onUpdate = vi.fn();
    const handler = createNumericChangeHandler(onUpdate);
    const changeHandler = handler((v) => ({ characterSpacing: v }));

    changeHandler({
      target: { value: "abc" },
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("handles zero as a valid finite number", () => {
    const onUpdate = vi.fn();
    const handler = createNumericChangeHandler(onUpdate);
    const changeHandler = handler((v) => ({ fontSize: v }));

    changeHandler({
      target: { value: "0" },
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    expect(onUpdate).toHaveBeenCalledWith({ fontSize: 0 });
  });

  it("handles negative numbers", () => {
    const onUpdate = vi.fn();
    const handler = createNumericChangeHandler(onUpdate);
    const changeHandler = handler((v) => ({ paragraphIndent: v }));

    changeHandler({
      target: { value: "-100" },
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    expect(onUpdate).toHaveBeenCalledWith({ paragraphIndent: -100 });
  });

  it("handles float values", () => {
    const onUpdate = vi.fn();
    const handler = createNumericChangeHandler(onUpdate);
    const changeHandler = handler((v) => ({ characterSpacing: v }));

    changeHandler({
      target: { value: "3.14" },
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    expect(onUpdate).toHaveBeenCalledWith({ characterSpacing: 3.14 });
  });

  it("does not call onUpdateTextStyle for Infinity", () => {
    const onUpdate = vi.fn();
    const handler = createNumericChangeHandler(onUpdate);
    const changeHandler = handler((v) => ({ characterSpacing: v }));

    changeHandler({
      target: { value: "Infinity" },
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
