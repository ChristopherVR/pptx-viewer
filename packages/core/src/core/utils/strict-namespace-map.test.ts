import { describe, it, expect } from "vitest";
import {
  normalizeNamespaceUri,
  isStrictNamespaceUri,
  detectStrictConformance,
  normalizeStrictXml,
} from "./strict-namespace-map";

// ---------------------------------------------------------------------------
// normalizeNamespaceUri
// ---------------------------------------------------------------------------

describe("normalizeNamespaceUri", () => {
  it("converts Strict PresentationML URI to Transitional", () => {
    expect(normalizeNamespaceUri("http://purl.oclc.org/ooxml/presentationml/main"))
      .toBe("http://schemas.openxmlformats.org/presentationml/2006/main");
  });

  it("converts Strict DrawingML URI to Transitional", () => {
    expect(normalizeNamespaceUri("http://purl.oclc.org/ooxml/drawingml/main"))
      .toBe("http://schemas.openxmlformats.org/drawingml/2006/main");
  });

  it("converts Strict Relationships URI to Transitional", () => {
    expect(normalizeNamespaceUri("http://purl.oclc.org/ooxml/officeDocument/relationships"))
      .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships");
  });

  it("returns Transitional URI unchanged", () => {
    const uri = "http://schemas.openxmlformats.org/presentationml/2006/main";
    expect(normalizeNamespaceUri(uri)).toBe(uri);
  });

  it("returns unknown URIs unchanged", () => {
    const uri = "http://example.com/custom-namespace";
    expect(normalizeNamespaceUri(uri)).toBe(uri);
  });

  it("converts Strict SpreadsheetML URI", () => {
    expect(normalizeNamespaceUri("http://purl.oclc.org/ooxml/spreadsheetml/main"))
      .toBe("http://schemas.openxmlformats.org/spreadsheetml/2006/main");
  });

  it("converts Strict WordprocessingML URI", () => {
    expect(normalizeNamespaceUri("http://purl.oclc.org/ooxml/wordprocessingml/main"))
      .toBe("http://schemas.openxmlformats.org/wordprocessingml/2006/main");
  });

  it("converts Strict image relationship URI", () => {
    expect(normalizeNamespaceUri("http://purl.oclc.org/ooxml/officeDocument/relationships/image"))
      .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/image");
  });
});

// ---------------------------------------------------------------------------
// isStrictNamespaceUri
// ---------------------------------------------------------------------------

describe("isStrictNamespaceUri", () => {
  it("returns true for Strict namespace URIs", () => {
    expect(isStrictNamespaceUri("http://purl.oclc.org/ooxml/presentationml/main")).toBe(true);
    expect(isStrictNamespaceUri("http://purl.oclc.org/ooxml/drawingml/main")).toBe(true);
  });

  it("returns false for Transitional namespace URIs", () => {
    expect(isStrictNamespaceUri("http://schemas.openxmlformats.org/presentationml/2006/main")).toBe(false);
  });

  it("returns false for arbitrary URIs", () => {
    expect(isStrictNamespaceUri("http://example.com/ns")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isStrictNamespaceUri("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectStrictConformance
// ---------------------------------------------------------------------------

describe("detectStrictConformance", () => {
  it("returns true when root element has Strict namespace", () => {
    const xml = {
      "p:presentation": {
        "@_xmlns:p": "http://purl.oclc.org/ooxml/presentationml/main",
      },
    };
    expect(detectStrictConformance(xml)).toBe(true);
  });

  it("returns false when root element has Transitional namespace", () => {
    const xml = {
      "p:presentation": {
        "@_xmlns:p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      },
    };
    expect(detectStrictConformance(xml)).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(detectStrictConformance({})).toBe(false);
  });

  it("returns true when @_xmlns (default namespace) is Strict", () => {
    const xml = {
      "p:presentation": {
        "@_xmlns": "http://purl.oclc.org/ooxml/presentationml/main",
      },
    };
    expect(detectStrictConformance(xml)).toBe(true);
  });

  it("ignores non-xmlns attributes", () => {
    const xml = {
      "p:presentation": {
        "@_id": "http://purl.oclc.org/ooxml/drawingml/main",
      },
    };
    expect(detectStrictConformance(xml)).toBe(false);
  });

  it("detects Strict in any xmlns attribute", () => {
    const xml = {
      "p:presentation": {
        "@_xmlns:a": "http://purl.oclc.org/ooxml/drawingml/main",
        "@_xmlns:p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      },
    };
    expect(detectStrictConformance(xml)).toBe(true);
  });

  it("skips ?xml declaration and array children", () => {
    const xml = {
      "?xml": { "@_version": "1.0" },
      "p:sld": {
        "@_xmlns:p": "http://schemas.openxmlformats.org/presentationml/2006/main",
      },
    };
    expect(detectStrictConformance(xml)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeStrictXml
// ---------------------------------------------------------------------------

describe("normalizeStrictXml", () => {
  it("normalizes xmlns attributes in-place", () => {
    const xml: Record<string, unknown> = {
      "@_xmlns:p": "http://purl.oclc.org/ooxml/presentationml/main",
    };
    normalizeStrictXml(xml);
    expect(xml["@_xmlns:p"]).toBe("http://schemas.openxmlformats.org/presentationml/2006/main");
  });

  it("normalizes @_Type attributes (relationship types)", () => {
    const xml: Record<string, unknown> = {
      "@_Type": "http://purl.oclc.org/ooxml/officeDocument/relationships/slide",
    };
    normalizeStrictXml(xml);
    expect(xml["@_Type"]).toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide");
  });

  it("normalizes @_uri attributes", () => {
    const xml: Record<string, unknown> = {
      "@_uri": "http://purl.oclc.org/ooxml/drawingml/main",
    };
    normalizeStrictXml(xml);
    expect(xml["@_uri"]).toBe("http://schemas.openxmlformats.org/drawingml/2006/main");
  });

  it("does not modify Transitional URIs", () => {
    const xml: Record<string, unknown> = {
      "@_xmlns:p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    };
    normalizeStrictXml(xml);
    expect(xml["@_xmlns:p"]).toBe("http://schemas.openxmlformats.org/presentationml/2006/main");
  });

  it("recurses into child objects", () => {
    const xml: Record<string, unknown> = {
      "child": {
        "@_xmlns:a": "http://purl.oclc.org/ooxml/drawingml/main",
      },
    };
    normalizeStrictXml(xml);
    expect((xml["child"] as Record<string, unknown>)["@_xmlns:a"])
      .toBe("http://schemas.openxmlformats.org/drawingml/2006/main");
  });

  it("recurses into arrays of objects", () => {
    const xml: Record<string, unknown> = {
      "items": [
        { "@_xmlns:p": "http://purl.oclc.org/ooxml/presentationml/main" },
        { "@_xmlns:a": "http://purl.oclc.org/ooxml/drawingml/main" },
      ],
    };
    normalizeStrictXml(xml);
    const items = xml["items"] as Record<string, unknown>[];
    expect(items[0]["@_xmlns:p"]).toBe("http://schemas.openxmlformats.org/presentationml/2006/main");
    expect(items[1]["@_xmlns:a"]).toBe("http://schemas.openxmlformats.org/drawingml/2006/main");
  });

  it("returns the input node", () => {
    const xml: Record<string, unknown> = { "@_id": "1" };
    const result = normalizeStrictXml(xml);
    expect(result).toBe(xml);
  });

  it("skips non-xmlns scalar attributes", () => {
    const xml: Record<string, unknown> = {
      "@_id": "http://purl.oclc.org/ooxml/presentationml/main",
      "@_name": "test",
    };
    normalizeStrictXml(xml);
    // @_id is not xmlns/Type/uri so it should remain unchanged
    expect(xml["@_id"]).toBe("http://purl.oclc.org/ooxml/presentationml/main");
  });
});
