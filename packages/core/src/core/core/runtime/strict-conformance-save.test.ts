import { describe, it, expect } from "vitest";
import {
  convertXmlToStrict,
  normalizeStrictXml,
  detectStrictConformance,
  isStrictNamespaceUri,
} from "../../utils/strict-namespace-map";
import { createPptxSaveConstants } from "../factories";

/**
 * Tests for the strict conformance round-trip save pipeline.
 *
 * These tests verify the end-to-end behavior of:
 * 1. Loading a Strict OOXML file (namespace normalization)
 * 2. Saving it back with strict namespace URIs preserved
 * 3. Converting between strict and transitional conformance
 */

// ---------------------------------------------------------------------------
// Save constants integration
// ---------------------------------------------------------------------------

describe("save constants with strict conformance", () => {
  it("strict constants have matching URIs from the namespace map", () => {
    const strictConstants = createPptxSaveConstants("strict");

    // All relationship type URIs should be Strict (purl.oclc.org)
    expect(isStrictNamespaceUri(strictConstants.slideRelationshipType)).toBe(true);
    expect(isStrictNamespaceUri(strictConstants.slideLayoutRelationshipType)).toBe(true);
    expect(isStrictNamespaceUri(strictConstants.slideImageRelationshipType)).toBe(true);
    expect(isStrictNamespaceUri(strictConstants.slideMediaRelationshipType)).toBe(true);
    expect(isStrictNamespaceUri(strictConstants.slideVideoRelationshipType)).toBe(true);
    expect(isStrictNamespaceUri(strictConstants.slideAudioRelationshipType)).toBe(true);
    expect(isStrictNamespaceUri(strictConstants.slideCommentRelationshipType)).toBe(true);
    expect(isStrictNamespaceUri(strictConstants.slideNotesRelationshipType)).toBe(true);
    expect(isStrictNamespaceUri(strictConstants.relationshipsNamespace)).toBe(true);
  });

  it("transitional constants have no strict URIs", () => {
    const transitionalConstants = createPptxSaveConstants("transitional");

    expect(isStrictNamespaceUri(transitionalConstants.slideRelationshipType)).toBe(false);
    expect(isStrictNamespaceUri(transitionalConstants.slideLayoutRelationshipType)).toBe(false);
    expect(isStrictNamespaceUri(transitionalConstants.slideImageRelationshipType)).toBe(false);
    expect(isStrictNamespaceUri(transitionalConstants.relationshipsNamespace)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Simulated strict OOXML load-save round-trip
// ---------------------------------------------------------------------------

describe("simulated strict OOXML round-trip", () => {
  /**
   * Simulate what happens during a load-save cycle for a strict file:
   *
   * 1. Parse strict XML
   * 2. Detect strict conformance
   * 3. Normalize to transitional (for internal processing)
   * 4. [... internal processing happens with transitional URIs ...]
   * 5. Convert back to strict for save
   * 6. Verify result is valid strict XML
   */
  it("preserves strict namespaces through a load-save cycle for presentation.xml", () => {
    // Simulated parsed presentation.xml from a Strict OOXML file
    const parsedPresentation: Record<string, unknown> = {
      "?xml": { "@_version": "1.0", "@_encoding": "UTF-8", "@_standalone": "yes" },
      "p:presentation": {
        "@_xmlns:a": "http://purl.oclc.org/ooxml/drawingml/main",
        "@_xmlns:r": "http://purl.oclc.org/ooxml/officeDocument/relationships",
        "@_xmlns:p": "http://purl.oclc.org/ooxml/presentationml/main",
        "@_conformance": "strict",
        "p:sldMasterIdLst": {
          "p:sldMasterId": { "@_id": "2147483648", "@_r:id": "rId1" },
        },
        "p:sldIdLst": {
          "p:sldId": { "@_id": "256", "@_r:id": "rId2" },
        },
        "p:sldSz": { "@_cx": "9144000", "@_cy": "6858000" },
        "p:notesSz": { "@_cx": "6858000", "@_cy": "9144000" },
      },
    };

    // Step 1: Detect strict conformance
    expect(detectStrictConformance(parsedPresentation)).toBe(true);

    // Step 2: Normalize to transitional (what happens during load)
    normalizeStrictXml(parsedPresentation);

    const p = parsedPresentation["p:presentation"] as Record<string, unknown>;
    expect(p["@_xmlns:a"]).toBe("http://schemas.openxmlformats.org/drawingml/2006/main");
    expect(p["@_xmlns:r"]).toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships");
    expect(p["@_xmlns:p"]).toBe("http://schemas.openxmlformats.org/presentationml/2006/main");

    // Step 3: Convert back to strict (what happens during save)
    convertXmlToStrict(parsedPresentation, true);

    expect(p["@_xmlns:a"]).toBe("http://purl.oclc.org/ooxml/drawingml/main");
    expect(p["@_xmlns:r"]).toBe("http://purl.oclc.org/ooxml/officeDocument/relationships");
    expect(p["@_xmlns:p"]).toBe("http://purl.oclc.org/ooxml/presentationml/main");
    expect(p["@_conformance"]).toBe("strict");

    // Structural data should be unaffected
    expect((p["p:sldSz"] as Record<string, unknown>)["@_cx"]).toBe("9144000");
  });

  it("preserves strict namespaces through a load-save cycle for .rels", () => {
    // Simulated _rels/.rels from a Strict OOXML file
    const parsedRels: Record<string, unknown> = {
      "Relationships": {
        "@_xmlns": "http://purl.oclc.org/ooxml/package/relationships",
        "Relationship": [
          {
            "@_Id": "rId1",
            "@_Type": "http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument",
            "@_Target": "ppt/presentation.xml",
          },
          {
            "@_Id": "rId2",
            "@_Type": "http://purl.oclc.org/ooxml/package/relationships/metadata/core-properties",
            "@_Target": "docProps/core.xml",
          },
          {
            "@_Id": "rId3",
            "@_Type": "http://purl.oclc.org/ooxml/officeDocument/relationships/extended-properties",
            "@_Target": "docProps/app.xml",
          },
        ],
      },
    };

    // Deep clone for comparison
    const originalClone = JSON.parse(JSON.stringify(parsedRels));

    // Normalize to transitional
    normalizeStrictXml(parsedRels);
    const root = parsedRels["Relationships"] as Record<string, unknown>;
    expect(root["@_xmlns"]).toBe("http://schemas.openxmlformats.org/package/2006/relationships");
    const rels = root["Relationship"] as Record<string, unknown>[];
    expect(rels[0]["@_Type"]).toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument");

    // Convert back to strict
    convertXmlToStrict(parsedRels);

    // Should match the original
    expect(JSON.stringify(parsedRels)).toBe(JSON.stringify(originalClone));
  });

  it("preserves strict namespaces through a load-save cycle for slide XML", () => {
    const parsedSlide: Record<string, unknown> = {
      "p:sld": {
        "@_xmlns:a": "http://purl.oclc.org/ooxml/drawingml/main",
        "@_xmlns:r": "http://purl.oclc.org/ooxml/officeDocument/relationships",
        "@_xmlns:p": "http://purl.oclc.org/ooxml/presentationml/main",
        "p:cSld": {
          "p:spTree": {
            "p:nvGrpSpPr": {
              "p:cNvPr": { "@_id": "1", "@_name": "" },
              "p:cNvGrpSpPr": {},
              "p:nvPr": {},
            },
            "p:grpSpPr": {},
            "p:sp": {
              "p:nvSpPr": {
                "p:cNvPr": { "@_id": "2", "@_name": "Title 1" },
                "p:cNvSpPr": {},
                "p:nvPr": {
                  "p:ph": { "@_type": "title" },
                },
              },
              "p:spPr": {},
              "p:txBody": {
                "a:bodyPr": {},
                "a:p": {
                  "a:r": {
                    "a:rPr": { "@_lang": "en-US" },
                    "a:t": "Hello World",
                  },
                },
              },
            },
          },
        },
      },
    };

    const originalClone = JSON.parse(JSON.stringify(parsedSlide));

    // Normalize then convert back
    normalizeStrictXml(parsedSlide);
    convertXmlToStrict(parsedSlide);

    expect(JSON.stringify(parsedSlide)).toBe(JSON.stringify(originalClone));
  });

  it("preserves strict namespaces through a load-save cycle for slide .rels", () => {
    const parsedSlideRels: Record<string, unknown> = {
      "Relationships": {
        "@_xmlns": "http://purl.oclc.org/ooxml/package/relationships",
        "Relationship": [
          {
            "@_Id": "rId1",
            "@_Type": "http://purl.oclc.org/ooxml/officeDocument/relationships/slideLayout",
            "@_Target": "../slideLayouts/slideLayout1.xml",
          },
          {
            "@_Id": "rId2",
            "@_Type": "http://purl.oclc.org/ooxml/officeDocument/relationships/image",
            "@_Target": "../media/image1.png",
          },
          {
            "@_Id": "rId3",
            "@_Type": "http://purl.oclc.org/ooxml/officeDocument/relationships/notesSlide",
            "@_Target": "../notesSlides/notesSlide1.xml",
          },
        ],
      },
    };

    const originalClone = JSON.parse(JSON.stringify(parsedSlideRels));

    normalizeStrictXml(parsedSlideRels);
    convertXmlToStrict(parsedSlideRels);

    expect(JSON.stringify(parsedSlideRels)).toBe(JSON.stringify(originalClone));
  });
});

// ---------------------------------------------------------------------------
// Conversion from transitional to strict (forced conformance change)
// ---------------------------------------------------------------------------

describe("forced conformance conversion: transitional to strict", () => {
  it("converts a transitional presentation.xml to strict", () => {
    const xml: Record<string, unknown> = {
      "p:presentation": {
        "@_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "@_xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "@_xmlns:p": "http://schemas.openxmlformats.org/presentationml/2006/main",
        "p:sldSz": { "@_cx": "9144000", "@_cy": "6858000" },
      },
    };

    convertXmlToStrict(xml, true);

    const p = xml["p:presentation"] as Record<string, unknown>;
    expect(p["@_conformance"]).toBe("strict");
    expect(p["@_xmlns:a"]).toBe("http://purl.oclc.org/ooxml/drawingml/main");
    expect(p["@_xmlns:r"]).toBe("http://purl.oclc.org/ooxml/officeDocument/relationships");
    expect(p["@_xmlns:p"]).toBe("http://purl.oclc.org/ooxml/presentationml/main");
    // Non-namespace attributes should be untouched
    expect((p["p:sldSz"] as Record<string, unknown>)["@_cx"]).toBe("9144000");
  });

  it("converts newly created empty slide XML to strict", () => {
    // This is what createEmptySlideXml produces (transitional namespaces)
    const xml: Record<string, unknown> = {
      "p:sld": {
        "@_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "@_xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "@_xmlns:p": "http://schemas.openxmlformats.org/presentationml/2006/main",
        "p:cSld": {
          "p:spTree": {
            "p:nvGrpSpPr": {
              "p:cNvPr": { "@_id": "1", "@_name": "" },
            },
          },
        },
      },
    };

    convertXmlToStrict(xml);

    const slide = xml["p:sld"] as Record<string, unknown>;
    expect(slide["@_xmlns:a"]).toBe("http://purl.oclc.org/ooxml/drawingml/main");
    expect(slide["@_xmlns:r"]).toBe("http://purl.oclc.org/ooxml/officeDocument/relationships");
    expect(slide["@_xmlns:p"]).toBe("http://purl.oclc.org/ooxml/presentationml/main");
  });

  it("converts newly created tag XML to strict", () => {
    // Tags created in applyTagCollectionChanges use transitional URIs
    const xml: Record<string, unknown> = {
      "p:tagLst": {
        "@_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "@_xmlns:p": "http://schemas.openxmlformats.org/presentationml/2006/main",
        "@_xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "p:tag": [
          { "@_name": "key1", "@_val": "value1" },
          { "@_name": "key2", "@_val": "value2" },
        ],
      },
    };

    convertXmlToStrict(xml);

    const tagLst = xml["p:tagLst"] as Record<string, unknown>;
    expect(tagLst["@_xmlns:a"]).toBe("http://purl.oclc.org/ooxml/drawingml/main");
    expect(tagLst["@_xmlns:p"]).toBe("http://purl.oclc.org/ooxml/presentationml/main");
    expect(tagLst["@_xmlns:r"]).toBe("http://purl.oclc.org/ooxml/officeDocument/relationships");

    // Tag data should be unaffected
    const tags = tagLst["p:tag"] as Record<string, unknown>[];
    expect(tags[0]["@_name"]).toBe("key1");
    expect(tags[0]["@_val"]).toBe("value1");
  });

  it("converts newly created presentationPr XML to strict", () => {
    const xml: Record<string, unknown> = {
      "p:presentationPr": {
        "@_xmlns:p": "http://schemas.openxmlformats.org/presentationml/2006/main",
        "@_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      },
    };

    convertXmlToStrict(xml);

    const pr = xml["p:presentationPr"] as Record<string, unknown>;
    expect(pr["@_xmlns:p"]).toBe("http://purl.oclc.org/ooxml/presentationml/main");
    expect(pr["@_xmlns:a"]).toBe("http://purl.oclc.org/ooxml/drawingml/main");
  });
});

// ---------------------------------------------------------------------------
// Mixed content preservation
// ---------------------------------------------------------------------------

describe("mixed content preservation", () => {
  it("preserves Microsoft extension URIs that are not in the mapping", () => {
    const xml: Record<string, unknown> = {
      "p:sld": {
        "@_xmlns:p": "http://schemas.openxmlformats.org/presentationml/2006/main",
        "@_xmlns:p14": "http://schemas.microsoft.com/office/powerpoint/2010/main",
        "@_xmlns:p15": "http://schemas.microsoft.com/office/powerpoint/2012/main",
        "@_xmlns:mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
      },
    };

    convertXmlToStrict(xml);

    const slide = xml["p:sld"] as Record<string, unknown>;
    // Mapped namespace gets converted
    expect(slide["@_xmlns:p"]).toBe("http://purl.oclc.org/ooxml/presentationml/main");
    // Markup compatibility gets converted
    expect(slide["@_xmlns:mc"]).toBe("http://purl.oclc.org/ooxml/markup-compatibility/2006");
    // Microsoft extension namespaces are NOT in the mapping and should be preserved
    expect(slide["@_xmlns:p14"]).toBe("http://schemas.microsoft.com/office/powerpoint/2010/main");
    expect(slide["@_xmlns:p15"]).toBe("http://schemas.microsoft.com/office/powerpoint/2012/main");
  });

  it("preserves dc/dcterms/dcmitype namespaces in core properties", () => {
    const xml: Record<string, unknown> = {
      "cp:coreProperties": {
        "@_xmlns:cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
        "@_xmlns:dc": "http://purl.org/dc/elements/1.1/",
        "@_xmlns:dcterms": "http://purl.org/dc/terms/",
        "dc:title": "My Presentation",
        "dc:creator": "Author Name",
      },
    };

    convertXmlToStrict(xml);

    const cp = xml["cp:coreProperties"] as Record<string, unknown>;
    // dc/dcterms are NOT OOXML namespaces — they should be preserved as-is
    expect(cp["@_xmlns:dc"]).toBe("http://purl.org/dc/elements/1.1/");
    expect(cp["@_xmlns:dcterms"]).toBe("http://purl.org/dc/terms/");
    // Content should be untouched
    expect(cp["dc:title"]).toBe("My Presentation");
  });

  it("handles VBA relationship types (Microsoft-specific, not in mapping)", () => {
    const xml: Record<string, unknown> = {
      "Relationships": {
        "@_xmlns": "http://schemas.openxmlformats.org/package/2006/relationships",
        "Relationship": [
          {
            "@_Id": "rId1",
            "@_Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
            "@_Target": "slides/slide1.xml",
          },
          {
            "@_Id": "rId2",
            "@_Type": "http://schemas.microsoft.com/office/2006/relationships/vbaProject",
            "@_Target": "vbaProject.bin",
          },
        ],
      },
    };

    convertXmlToStrict(xml);

    const root = xml["Relationships"] as Record<string, unknown>;
    expect(root["@_xmlns"]).toBe("http://purl.oclc.org/ooxml/package/relationships");
    const rels = root["Relationship"] as Record<string, unknown>[];
    // OOXML relationship gets converted
    expect(rels[0]["@_Type"]).toBe("http://purl.oclc.org/ooxml/officeDocument/relationships/slide");
    // VBA relationship is Microsoft-specific and not in the mapping — preserved as-is
    expect(rels[1]["@_Type"]).toBe("http://schemas.microsoft.com/office/2006/relationships/vbaProject");
  });
});
