import { describe, it, expect } from "vitest";
import {
  detectOleObjectType,
  inferOleExtensionFromTarget,
  getOleObjectTypeLabel,
} from "./ole-utils";

// ---------------------------------------------------------------------------
// detectOleObjectType
// ---------------------------------------------------------------------------

describe("detectOleObjectType", () => {
  it("detects Excel from progId", () => {
    const result = detectOleObjectType("Excel.Sheet.12", undefined);
    expect(result.oleObjectType).toBe("excel");
    expect(result.oleFileExtension).toBe("xlsx");
  });

  it("detects Word from progId", () => {
    const result = detectOleObjectType("Word.Document.12", undefined);
    expect(result.oleObjectType).toBe("word");
    expect(result.oleFileExtension).toBe("docx");
  });

  it("detects Visio from progId", () => {
    const result = detectOleObjectType("Visio.Drawing", undefined);
    expect(result.oleObjectType).toBe("visio");
    expect(result.oleFileExtension).toBe("vsdx");
  });

  it("detects Equation from progId", () => {
    const result = detectOleObjectType("Equation.3", undefined);
    expect(result.oleObjectType).toBe("mathtype");
    expect(result.oleFileExtension).toBe("wmf");
  });

  it("detects MathType from progId", () => {
    const result = detectOleObjectType("MathType 6.0 Equation", undefined);
    expect(result.oleObjectType).toBe("mathtype");
    expect(result.oleFileExtension).toBe("wmf");
  });

  it("detects PDF from AcroExch progId", () => {
    const result = detectOleObjectType("AcroExch.Document", undefined);
    expect(result.oleObjectType).toBe("pdf");
    expect(result.oleFileExtension).toBe("pdf");
  });

  it("detects Package from progId", () => {
    const result = detectOleObjectType("Package", undefined);
    expect(result.oleObjectType).toBe("package");
    expect(result.oleFileExtension).toBe("bin");
  });

  it("falls back to CLSID when progId is undefined", () => {
    const result = detectOleObjectType(
      undefined,
      "00020820-0000-0000-C000-000000000046",
    );
    expect(result.oleObjectType).toBe("excel");
    expect(result.oleFileExtension).toBe("xls");
  });

  it("normalises CLSID with braces", () => {
    const result = detectOleObjectType(
      undefined,
      "{00020906-0000-0000-C000-000000000046}",
    );
    expect(result.oleObjectType).toBe("word");
    expect(result.oleFileExtension).toBe("doc");
  });

  it("returns unknown for unrecognised progId and clsId", () => {
    const result = detectOleObjectType("SomeUnknown.App", "unknown-clsid");
    expect(result.oleObjectType).toBe("unknown");
    expect(result.oleFileExtension).toBe("bin");
  });

  it("returns unknown when both are undefined", () => {
    const result = detectOleObjectType(undefined, undefined);
    expect(result.oleObjectType).toBe("unknown");
    expect(result.oleFileExtension).toBe("bin");
  });

  it("progId takes priority over clsId", () => {
    // Excel progId + Word CLSID => should use Excel from progId
    const result = detectOleObjectType(
      "Excel.Sheet.12",
      "00020906-0000-0000-C000-000000000046",
    );
    expect(result.oleObjectType).toBe("excel");
  });

  it("is case-insensitive for progId matching", () => {
    const result = detectOleObjectType("excel.sheet.8", undefined);
    expect(result.oleObjectType).toBe("excel");
  });
});

// ---------------------------------------------------------------------------
// inferOleExtensionFromTarget
// ---------------------------------------------------------------------------

describe("inferOleExtensionFromTarget", () => {
  it("extracts xlsx extension from target path", () => {
    expect(inferOleExtensionFromTarget("../embeddings/oleObject1.xlsx")).toBe(
      "xlsx",
    );
  });

  it("extracts pdf extension", () => {
    expect(inferOleExtensionFromTarget("embeddings/document.pdf")).toBe("pdf");
  });

  it("returns lowercase extension", () => {
    expect(inferOleExtensionFromTarget("file.DOCX")).toBe("docx");
  });

  it("returns undefined for path with no extension", () => {
    expect(inferOleExtensionFromTarget("embeddings/oleObject1")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(inferOleExtensionFromTarget(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(inferOleExtensionFromTarget("")).toBeUndefined();
  });

  it("returns undefined for extension longer than 10 chars", () => {
    expect(
      inferOleExtensionFromTarget("file.verylongextension"),
    ).toBeUndefined();
  });

  it("handles dotfiles without extension", () => {
    // ".hidden" has extension "hidden" which is 6 chars
    expect(inferOleExtensionFromTarget(".hidden")).toBe("hidden");
  });
});

// ---------------------------------------------------------------------------
// getOleObjectTypeLabel
// ---------------------------------------------------------------------------

describe("getOleObjectTypeLabel", () => {
  it("returns correct label for excel", () => {
    expect(getOleObjectTypeLabel("excel")).toBe("Microsoft Excel");
  });

  it("returns correct label for word", () => {
    expect(getOleObjectTypeLabel("word")).toBe("Microsoft Word");
  });

  it("returns correct label for pdf", () => {
    expect(getOleObjectTypeLabel("pdf")).toBe("PDF Document");
  });

  it("returns correct label for visio", () => {
    expect(getOleObjectTypeLabel("visio")).toBe("Microsoft Visio");
  });

  it("returns correct label for mathtype", () => {
    expect(getOleObjectTypeLabel("mathtype")).toBe("Equation");
  });

  it("returns correct label for package", () => {
    expect(getOleObjectTypeLabel("package")).toBe("Embedded File");
  });

  it("returns default label for undefined", () => {
    expect(getOleObjectTypeLabel(undefined)).toBe("Embedded Object");
  });

  it("returns default label for unknown type", () => {
    expect(getOleObjectTypeLabel("unknown" as any)).toBe("Embedded Object");
  });
});
