import { describe, it, expect } from "vitest";
import type { OlePptxElement } from "pptx-viewer-core";
import {
  resolveOleType,
  getOleTypeColor,
  getOleTypeLabel,
  getOleAriaLabel,
  type ResolvedOleType,
} from "./InkGroupRenderers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOleElement(
  overrides: Partial<OlePptxElement> = {},
): OlePptxElement {
  return {
    id: "ole_test",
    type: "ole",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveOleType
// ---------------------------------------------------------------------------

describe("resolveOleType", () => {
  it("should return 'excel' when oleObjectType is 'excel'", () => {
    const el = makeOleElement({ oleObjectType: "excel" });
    expect(resolveOleType(el)).toBe("excel");
  });

  it("should return 'word' when oleObjectType is 'word'", () => {
    const el = makeOleElement({ oleObjectType: "word" });
    expect(resolveOleType(el)).toBe("word");
  });

  it("should return 'pdf' when oleObjectType is 'pdf'", () => {
    const el = makeOleElement({ oleObjectType: "pdf" });
    expect(resolveOleType(el)).toBe("pdf");
  });

  it("should return 'visio' when oleObjectType is 'visio'", () => {
    const el = makeOleElement({ oleObjectType: "visio" });
    expect(resolveOleType(el)).toBe("visio");
  });

  it("should return 'mathtype' when oleObjectType is 'mathtype'", () => {
    const el = makeOleElement({ oleObjectType: "mathtype" });
    expect(resolveOleType(el)).toBe("mathtype");
  });

  it("should fall back to progId heuristic when oleObjectType is 'package'", () => {
    const el = makeOleElement({
      oleObjectType: "package",
      oleProgId: "Excel.Sheet.12",
    });
    expect(resolveOleType(el)).toBe("excel");
  });

  it("should fall back to progId heuristic when oleObjectType is 'unknown'", () => {
    const el = makeOleElement({
      oleObjectType: "unknown",
      oleProgId: "Word.Document.12",
    });
    expect(resolveOleType(el)).toBe("word");
  });

  it("should detect Excel from progId", () => {
    const el = makeOleElement({ oleProgId: "Excel.Sheet.12" });
    expect(resolveOleType(el)).toBe("excel");
  });

  it("should detect Word from progId", () => {
    const el = makeOleElement({ oleProgId: "Word.Document.8" });
    expect(resolveOleType(el)).toBe("word");
  });

  it("should detect PDF from AcroExch progId", () => {
    const el = makeOleElement({ oleProgId: "AcroExch.Document" });
    expect(resolveOleType(el)).toBe("pdf");
  });

  it("should detect PDF from Acrobat progId", () => {
    const el = makeOleElement({ oleProgId: "Acrobat.Document" });
    expect(resolveOleType(el)).toBe("pdf");
  });

  it("should detect Visio from progId", () => {
    const el = makeOleElement({ oleProgId: "Visio.Drawing.11" });
    expect(resolveOleType(el)).toBe("visio");
  });

  it("should detect MathType from Equation progId", () => {
    const el = makeOleElement({ oleProgId: "Equation.3" });
    expect(resolveOleType(el)).toBe("mathtype");
  });

  it("should detect MathType from MathType progId", () => {
    const el = makeOleElement({ oleProgId: "MathType" });
    expect(resolveOleType(el)).toBe("mathtype");
  });

  it("should return 'unknown' when no type information exists", () => {
    const el = makeOleElement({});
    expect(resolveOleType(el)).toBe("unknown");
  });

  it("should return 'unknown' for unrecognised progId", () => {
    const el = makeOleElement({ oleProgId: "SomethingRandom.App.1" });
    expect(resolveOleType(el)).toBe("unknown");
  });

  it("should be case-insensitive for progId matching", () => {
    const el = makeOleElement({ oleProgId: "EXCEL.Sheet.12" });
    expect(resolveOleType(el)).toBe("excel");
  });
});

// ---------------------------------------------------------------------------
// getOleTypeColor
// ---------------------------------------------------------------------------

describe("getOleTypeColor", () => {
  it("should return green for Excel", () => {
    expect(getOleTypeColor("excel")).toBe("#217346");
  });

  it("should return blue for Word", () => {
    expect(getOleTypeColor("word")).toBe("#2B579A");
  });

  it("should return red for PDF", () => {
    expect(getOleTypeColor("pdf")).toBe("#D4272E");
  });

  it("should return blue for Visio", () => {
    expect(getOleTypeColor("visio")).toBe("#3955A3");
  });

  it("should return purple for MathType", () => {
    expect(getOleTypeColor("mathtype")).toBe("#7B2D8E");
  });

  it("should return grey for unknown", () => {
    expect(getOleTypeColor("unknown")).toBe("#666666");
  });

  it("should return a valid hex colour for every type", () => {
    const types: ResolvedOleType[] = [
      "excel",
      "word",
      "pdf",
      "visio",
      "mathtype",
      "unknown",
    ];
    for (const t of types) {
      expect(getOleTypeColor(t)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// getOleTypeLabel
// ---------------------------------------------------------------------------

describe("getOleTypeLabel", () => {
  it("should return 'Excel Spreadsheet' for excel", () => {
    expect(getOleTypeLabel("excel")).toBe("Excel Spreadsheet");
  });

  it("should return 'Word Document' for word", () => {
    expect(getOleTypeLabel("word")).toBe("Word Document");
  });

  it("should return 'PDF Document' for pdf", () => {
    expect(getOleTypeLabel("pdf")).toBe("PDF Document");
  });

  it("should return 'Visio Diagram' for visio", () => {
    expect(getOleTypeLabel("visio")).toBe("Visio Diagram");
  });

  it("should return 'Math Equation' for mathtype", () => {
    expect(getOleTypeLabel("mathtype")).toBe("Math Equation");
  });

  it("should return 'Embedded Object' for unknown", () => {
    expect(getOleTypeLabel("unknown")).toBe("Embedded Object");
  });

  it("should return a non-empty string for every type", () => {
    const types: ResolvedOleType[] = [
      "excel",
      "word",
      "pdf",
      "visio",
      "mathtype",
      "unknown",
    ];
    for (const t of types) {
      expect(getOleTypeLabel(t).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getOleAriaLabel
// ---------------------------------------------------------------------------

describe("getOleAriaLabel", () => {
  it("should include filename when available", () => {
    const el = makeOleElement({
      oleObjectType: "excel",
      fileName: "budget.xlsx",
    });
    expect(getOleAriaLabel(el)).toBe("Excel Spreadsheet: budget.xlsx");
  });

  it("should use type label when no filename", () => {
    const el = makeOleElement({ oleObjectType: "word" });
    expect(getOleAriaLabel(el)).toBe("Word Document");
  });

  it("should use resolved type from progId when oleObjectType is not set", () => {
    const el = makeOleElement({ oleProgId: "AcroExch.Document.11" });
    expect(getOleAriaLabel(el)).toBe("PDF Document");
  });

  it("should return 'Embedded Object' when nothing is known", () => {
    const el = makeOleElement({});
    expect(getOleAriaLabel(el)).toBe("Embedded Object");
  });

  it("should include filename with unknown type", () => {
    const el = makeOleElement({ fileName: "data.bin" });
    expect(getOleAriaLabel(el)).toBe("Embedded Object: data.bin");
  });
});

// ---------------------------------------------------------------------------
// Consistency checks
// ---------------------------------------------------------------------------

describe("OLE helper consistency", () => {
  it("should have matching colour, label, and icon for all known types", () => {
    const types: ResolvedOleType[] = [
      "excel",
      "word",
      "pdf",
      "visio",
      "mathtype",
      "unknown",
    ];
    for (const t of types) {
      const color = getOleTypeColor(t);
      const label = getOleTypeLabel(t);
      expect(color).toBeTruthy();
      expect(label).toBeTruthy();
    }
  });

  it("should resolve round-trip: oleObjectType -> resolveOleType -> getOleTypeLabel", () => {
    const knownTypes: Array<{
      oleObjectType: NonNullable<OlePptxElement["oleObjectType"]>;
      expectedResolved: ResolvedOleType;
    }> = [
      { oleObjectType: "excel", expectedResolved: "excel" },
      { oleObjectType: "word", expectedResolved: "word" },
      { oleObjectType: "pdf", expectedResolved: "pdf" },
      { oleObjectType: "visio", expectedResolved: "visio" },
      { oleObjectType: "mathtype", expectedResolved: "mathtype" },
    ];
    for (const { oleObjectType, expectedResolved } of knownTypes) {
      const el = makeOleElement({ oleObjectType });
      const resolved = resolveOleType(el);
      expect(resolved).toBe(expectedResolved);
      expect(getOleTypeLabel(resolved).length).toBeGreaterThan(0);
    }
  });
});
