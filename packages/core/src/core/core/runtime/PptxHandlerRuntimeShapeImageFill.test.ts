import { describe, it, expect } from "vitest";
import type { TextStyle } from "../../types";

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeShapeImageFill
// Pure re-implementations of textVerticalAlignFromDrawingValue and
// textDirectionFromDrawingValue for direct testing.
// ---------------------------------------------------------------------------

function textVerticalAlignFromDrawingValue(
  value: unknown,
): TextStyle["vAlign"] | undefined {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized.length === 0) return undefined;
  if (normalized === "t" || normalized === "top") return "top";
  if (normalized === "ctr" || normalized === "center") return "middle";
  if (normalized === "b" || normalized === "bottom") return "bottom";
  if (normalized === "dist" || normalized === "just") return "middle";
  return undefined;
}

function textDirectionFromDrawingValue(
  value: unknown,
): TextStyle["textDirection"] | undefined {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized.length === 0 || normalized === "horz") return undefined;
  if (normalized === "vert270" || normalized === "wordartvertrtl") {
    return "vertical270";
  }
  if (
    normalized === "vert" ||
    normalized === "eavert" ||
    normalized === "mongolianvert" ||
    normalized === "wordartvert"
  ) {
    return "vertical";
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// textVerticalAlignFromDrawingValue
// ---------------------------------------------------------------------------
describe("textVerticalAlignFromDrawingValue", () => {
  it("should return undefined for undefined value", () => {
    expect(textVerticalAlignFromDrawingValue(undefined)).toBeUndefined();
  });

  it("should return undefined for null", () => {
    expect(textVerticalAlignFromDrawingValue(null)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(textVerticalAlignFromDrawingValue("")).toBeUndefined();
  });

  it("should return 'top' for 't'", () => {
    expect(textVerticalAlignFromDrawingValue("t")).toBe("top");
  });

  it("should return 'top' for 'top'", () => {
    expect(textVerticalAlignFromDrawingValue("top")).toBe("top");
  });

  it("should return 'middle' for 'ctr'", () => {
    expect(textVerticalAlignFromDrawingValue("ctr")).toBe("middle");
  });

  it("should return 'middle' for 'center'", () => {
    expect(textVerticalAlignFromDrawingValue("center")).toBe("middle");
  });

  it("should return 'bottom' for 'b'", () => {
    expect(textVerticalAlignFromDrawingValue("b")).toBe("bottom");
  });

  it("should return 'bottom' for 'bottom'", () => {
    expect(textVerticalAlignFromDrawingValue("bottom")).toBe("bottom");
  });

  it("should return 'middle' for 'dist' (distributed)", () => {
    expect(textVerticalAlignFromDrawingValue("dist")).toBe("middle");
  });

  it("should return 'middle' for 'just' (justified)", () => {
    expect(textVerticalAlignFromDrawingValue("just")).toBe("middle");
  });

  it("should return undefined for unknown value", () => {
    expect(textVerticalAlignFromDrawingValue("unknown")).toBeUndefined();
  });

  it("should be case-insensitive", () => {
    expect(textVerticalAlignFromDrawingValue("T")).toBe("top");
    expect(textVerticalAlignFromDrawingValue("CTR")).toBe("middle");
    expect(textVerticalAlignFromDrawingValue("B")).toBe("bottom");
  });

  it("should handle whitespace around values", () => {
    expect(textVerticalAlignFromDrawingValue("  t  ")).toBe("top");
    expect(textVerticalAlignFromDrawingValue(" ctr ")).toBe("middle");
  });
});

// ---------------------------------------------------------------------------
// textDirectionFromDrawingValue
// ---------------------------------------------------------------------------
describe("textDirectionFromDrawingValue", () => {
  it("should return undefined for undefined value", () => {
    expect(textDirectionFromDrawingValue(undefined)).toBeUndefined();
  });

  it("should return undefined for null", () => {
    expect(textDirectionFromDrawingValue(null)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(textDirectionFromDrawingValue("")).toBeUndefined();
  });

  it("should return undefined for 'horz' (horizontal, default)", () => {
    expect(textDirectionFromDrawingValue("horz")).toBeUndefined();
  });

  it("should return 'vertical270' for 'vert270'", () => {
    expect(textDirectionFromDrawingValue("vert270")).toBe("vertical270");
  });

  it("should return 'vertical270' for 'wordArtVertRtl'", () => {
    expect(textDirectionFromDrawingValue("wordArtVertRtl")).toBe(
      "vertical270",
    );
  });

  it("should return 'vertical' for 'vert'", () => {
    expect(textDirectionFromDrawingValue("vert")).toBe("vertical");
  });

  it("should return 'vertical' for 'eaVert'", () => {
    expect(textDirectionFromDrawingValue("eaVert")).toBe("vertical");
  });

  it("should return 'vertical' for 'mongolianVert'", () => {
    expect(textDirectionFromDrawingValue("mongolianVert")).toBe("vertical");
  });

  it("should return 'vertical' for 'wordArtVert'", () => {
    expect(textDirectionFromDrawingValue("wordArtVert")).toBe("vertical");
  });

  it("should return undefined for unknown direction", () => {
    expect(textDirectionFromDrawingValue("diagonal")).toBeUndefined();
  });

  it("should be case-insensitive", () => {
    expect(textDirectionFromDrawingValue("VERT")).toBe("vertical");
    expect(textDirectionFromDrawingValue("Vert270")).toBe("vertical270");
  });
});
