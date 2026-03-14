import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeDocProperties (protected methods)
// ---------------------------------------------------------------------------

/**
 * Extracted from `buildRelativeTargetPath` — computes a relative path
 * between two parts within the PPTX ZIP archive.
 */
function buildRelativeTargetPath(
  fromPartPath: string,
  toPartPath: string,
): string {
  const fromParts = fromPartPath.split("/");
  const toParts = toPartPath.split("/");
  // Remove file name from source part path.
  fromParts.pop();

  while (
    fromParts.length > 0 &&
    toParts.length > 0 &&
    fromParts[0] === toParts[0]
  ) {
    fromParts.shift();
    toParts.shift();
  }

  const upSegments = new Array(fromParts.length).fill("..");
  return [...upSegments, ...toParts].join("/");
}

/**
 * Extracted from parseAppProperties — helper to extract string properties.
 */
function extractStringProperty(
  props: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = props[key];
  if (v === undefined || v === null) return undefined;
  const raw = String(v).trim();
  return raw || undefined;
}

/**
 * Extracted from parseAppProperties — helper to extract numeric properties.
 */
function extractNumericProperty(
  props: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = props[key];
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Extracted from parseCoreProperties — helper to extract string from a
 * core property node that may carry #text.
 */
function extractCorePropertyString(
  coreProps: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = coreProps[key];
  if (v === undefined || v === null) return undefined;
  const raw =
    typeof v === "object" && v !== null
      ? String((v as Record<string, unknown>)["#text"] ?? "")
      : String(v);
  return raw.trim() || undefined;
}

/**
 * Extracted from parseCustomProperties — parse a single custom property
 * from an XML property node.
 */
function parseCustomProperty(
  prop: Record<string, unknown>,
): { name: string; value: string; type: string } | null {
  const name = String(prop["@_name"] || "").trim();
  if (!name) return null;

  let value = "";
  let type = "unknown";
  const vtTypes = [
    "vt:lpwstr",
    "vt:i4",
    "vt:bool",
    "vt:filetime",
    "vt:r8",
    "vt:i2",
    "vt:ui4",
    "vt:lpstr",
  ];
  for (const vt of vtTypes) {
    if (prop[vt] !== undefined) {
      value = String(prop[vt]);
      type = vt.replace("vt:", "");
      break;
    }
  }

  return { name, value, type };
}

// ---------------------------------------------------------------------------
// Tests: buildRelativeTargetPath
// ---------------------------------------------------------------------------
describe("buildRelativeTargetPath", () => {
  it("should compute relative path within same directory", () => {
    const result = buildRelativeTargetPath(
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/slideMasters/slideMaster2.xml",
    );
    expect(result).toBe("slideMaster2.xml");
  });

  it("should traverse up one directory level", () => {
    const result = buildRelativeTargetPath(
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/theme/theme1.xml",
    );
    expect(result).toBe("../theme/theme1.xml");
  });

  it("should traverse up multiple directory levels", () => {
    const result = buildRelativeTargetPath(
      "ppt/slides/nested/deep/slide1.xml",
      "ppt/theme/theme1.xml",
    );
    expect(result).toBe("../../../theme/theme1.xml");
  });

  it("should handle paths with common prefix", () => {
    const result = buildRelativeTargetPath(
      "ppt/slides/slide1.xml",
      "ppt/slides/slide2.xml",
    );
    expect(result).toBe("slide2.xml");
  });

  it("should handle completely different paths", () => {
    const result = buildRelativeTargetPath(
      "docProps/app.xml",
      "ppt/theme/theme1.xml",
    );
    expect(result).toBe("../ppt/theme/theme1.xml");
  });

  it("should handle target in root directory", () => {
    const result = buildRelativeTargetPath(
      "ppt/slides/slide1.xml",
      "[Content_Types].xml",
    );
    expect(result).toBe("../../[Content_Types].xml");
  });

  it("should handle source in root directory", () => {
    const result = buildRelativeTargetPath(
      "root.xml",
      "ppt/slides/slide1.xml",
    );
    expect(result).toBe("ppt/slides/slide1.xml");
  });
});

// ---------------------------------------------------------------------------
// Tests: extractStringProperty
// ---------------------------------------------------------------------------
describe("extractStringProperty", () => {
  it("should return the string value when present", () => {
    expect(extractStringProperty({ Application: "Microsoft Office PowerPoint" }, "Application")).toBe("Microsoft Office PowerPoint");
  });

  it("should return undefined for undefined value", () => {
    expect(extractStringProperty({}, "Application")).toBeUndefined();
  });

  it("should return undefined for null value", () => {
    expect(extractStringProperty({ Application: null }, "Application")).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(extractStringProperty({ Application: "" }, "Application")).toBeUndefined();
  });

  it("should return undefined for whitespace-only string", () => {
    expect(extractStringProperty({ Application: "   " }, "Application")).toBeUndefined();
  });

  it("should trim whitespace", () => {
    expect(extractStringProperty({ Application: "  Office  " }, "Application")).toBe("Office");
  });

  it("should convert numeric values to string", () => {
    expect(extractStringProperty({ Version: 16 }, "Version")).toBe("16");
  });
});

// ---------------------------------------------------------------------------
// Tests: extractNumericProperty
// ---------------------------------------------------------------------------
describe("extractNumericProperty", () => {
  it("should return the number when value is a number", () => {
    expect(extractNumericProperty({ Slides: 10 }, "Slides")).toBe(10);
  });

  it("should return the number when value is a numeric string", () => {
    expect(extractNumericProperty({ Slides: "10" }, "Slides")).toBe(10);
  });

  it("should return undefined for undefined value", () => {
    expect(extractNumericProperty({}, "Slides")).toBeUndefined();
  });

  it("should return undefined for null value", () => {
    expect(extractNumericProperty({ Slides: null }, "Slides")).toBeUndefined();
  });

  it("should return undefined for NaN-producing values", () => {
    expect(extractNumericProperty({ Slides: "not a number" }, "Slides")).toBeUndefined();
  });

  it("should return 0 for zero value", () => {
    expect(extractNumericProperty({ HiddenSlides: 0 }, "HiddenSlides")).toBe(0);
  });

  it("should return undefined for Infinity", () => {
    expect(extractNumericProperty({ Slides: Infinity }, "Slides")).toBeUndefined();
  });

  it("should handle negative numbers", () => {
    expect(extractNumericProperty({ TotalTime: -5 }, "TotalTime")).toBe(-5);
  });

  it("should handle floating point numbers", () => {
    expect(extractNumericProperty({ TotalTime: 3.14 }, "TotalTime")).toBeCloseTo(3.14);
  });
});

// ---------------------------------------------------------------------------
// Tests: extractCorePropertyString
// ---------------------------------------------------------------------------
describe("extractCorePropertyString", () => {
  it("should return simple string values", () => {
    expect(
      extractCorePropertyString({ "dc:title": "My Presentation" }, "dc:title"),
    ).toBe("My Presentation");
  });

  it("should return undefined for undefined value", () => {
    expect(extractCorePropertyString({}, "dc:title")).toBeUndefined();
  });

  it("should return undefined for null value", () => {
    expect(
      extractCorePropertyString({ "dc:title": null }, "dc:title"),
    ).toBeUndefined();
  });

  it("should extract #text from object values", () => {
    expect(
      extractCorePropertyString(
        { "dcterms:created": { "#text": "2024-01-15T10:00:00Z", "@_xsi:type": "dcterms:W3CDTF" } },
        "dcterms:created",
      ),
    ).toBe("2024-01-15T10:00:00Z");
  });

  it("should return undefined when #text is empty", () => {
    expect(
      extractCorePropertyString(
        { "dcterms:created": { "#text": "", "@_xsi:type": "dcterms:W3CDTF" } },
        "dcterms:created",
      ),
    ).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(
      extractCorePropertyString({ "dc:title": "" }, "dc:title"),
    ).toBeUndefined();
  });

  it("should trim whitespace", () => {
    expect(
      extractCorePropertyString({ "dc:creator": "  John Doe  " }, "dc:creator"),
    ).toBe("John Doe");
  });

  it("should handle object without #text (returns empty → undefined)", () => {
    expect(
      extractCorePropertyString(
        { "dcterms:created": { "@_xsi:type": "dcterms:W3CDTF" } },
        "dcterms:created",
      ),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: parseCustomProperty
// ---------------------------------------------------------------------------
describe("parseCustomProperty", () => {
  it("should parse a string custom property (vt:lpwstr)", () => {
    const result = parseCustomProperty({
      "@_name": "CustomField",
      "vt:lpwstr": "Hello World",
    });
    expect(result).toEqual({ name: "CustomField", value: "Hello World", type: "lpwstr" });
  });

  it("should parse an integer custom property (vt:i4)", () => {
    const result = parseCustomProperty({
      "@_name": "Revision",
      "vt:i4": 42,
    });
    expect(result).toEqual({ name: "Revision", value: "42", type: "i4" });
  });

  it("should parse a boolean custom property (vt:bool)", () => {
    const result = parseCustomProperty({
      "@_name": "IsPublished",
      "vt:bool": "true",
    });
    expect(result).toEqual({ name: "IsPublished", value: "true", type: "bool" });
  });

  it("should parse a filetime custom property", () => {
    const result = parseCustomProperty({
      "@_name": "LastSaved",
      "vt:filetime": "2024-01-15T10:00:00Z",
    });
    expect(result).toEqual({
      name: "LastSaved",
      value: "2024-01-15T10:00:00Z",
      type: "filetime",
    });
  });

  it("should return null when name is empty", () => {
    expect(parseCustomProperty({ "@_name": "", "vt:lpwstr": "value" })).toBeNull();
  });

  it("should return null when name is missing", () => {
    expect(parseCustomProperty({ "vt:lpwstr": "value" })).toBeNull();
  });

  it("should return unknown type when no VT type matches", () => {
    const result = parseCustomProperty({
      "@_name": "Mystery",
      "vt:unknown-type": "value",
    });
    expect(result).toEqual({ name: "Mystery", value: "", type: "unknown" });
  });

  it("should prefer the first matching VT type", () => {
    const result = parseCustomProperty({
      "@_name": "Multi",
      "vt:lpwstr": "string-value",
      "vt:i4": 999,
    });
    expect(result).toEqual({ name: "Multi", value: "string-value", type: "lpwstr" });
  });

  it("should trim the property name", () => {
    const result = parseCustomProperty({
      "@_name": "  SpacedName  ",
      "vt:lpwstr": "v",
    });
    expect(result!.name).toBe("SpacedName");
  });

  it("should parse vt:r8 (double) properties", () => {
    const result = parseCustomProperty({
      "@_name": "Score",
      "vt:r8": 3.14,
    });
    expect(result).toEqual({ name: "Score", value: "3.14", type: "r8" });
  });
});
