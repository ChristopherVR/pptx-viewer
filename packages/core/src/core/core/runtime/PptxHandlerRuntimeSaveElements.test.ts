/**
 * Tests for PptxHandlerRuntimeSaveElements:
 *   - updateNotesXmlText logic (notes body shape finding, segment staleness)
 */
import { describe, it, expect } from "vitest";

import type { XmlObject, TextSegment } from "../../types";

// ---------------------------------------------------------------------------
// Reimplemented helpers from PptxHandlerRuntimeSaveElements
// ---------------------------------------------------------------------------

function findNotesBodyShape(shapes: XmlObject[]): XmlObject | undefined {
  return (
    shapes.find((shape) => {
      const placeholder = shape?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"] as
        | XmlObject
        | undefined;
      const placeholderType = String(placeholder?.["@_type"] || "")
        .trim()
        .toLowerCase();
      return placeholderType === "body";
    }) ||
    shapes.find((shape) => Boolean(shape?.["p:txBody"])) ||
    shapes[0]
  );
}

function computeEffectiveSegments(
  notesText: string | undefined,
  notesSegments: TextSegment[] | undefined,
): TextSegment[] | undefined {
  if (notesSegments && notesSegments.length > 0 && notesText !== undefined) {
    const segmentsText = notesSegments
      .map((s) => String(s.text ?? ""))
      .join("");
    if (segmentsText !== notesText) {
      return undefined;
    }
  }
  return notesSegments;
}

function canUpdateNotesXml(notesXmlObj: XmlObject): boolean {
  const notesRoot = notesXmlObj?.["p:notes"] as XmlObject | undefined;
  const spTree = notesRoot?.["p:cSld"]?.["p:spTree"] as XmlObject | undefined;
  if (!spTree) return false;

  const rawShapes = spTree["p:sp"];
  const shapes = Array.isArray(rawShapes)
    ? (rawShapes as XmlObject[])
    : rawShapes
      ? [rawShapes as XmlObject]
      : [];
  return shapes.length > 0;
}

// ---------------------------------------------------------------------------
// findNotesBodyShape
// ---------------------------------------------------------------------------
describe("findNotesBodyShape", () => {
  it("should find shape with body placeholder type", () => {
    const bodyShape: XmlObject = {
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {},
    };
    const otherShape: XmlObject = {
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "sldNum" } } },
    };
    const result = findNotesBodyShape([otherShape, bodyShape]);
    expect(result).toBe(bodyShape);
  });

  it("should match body type case-insensitively", () => {
    const shape: XmlObject = {
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "Body" } } },
    };
    const result = findNotesBodyShape([shape]);
    expect(result).toBe(shape);
  });

  it("should fallback to shape with txBody when no body placeholder", () => {
    const shape1: XmlObject = { "p:nvSpPr": { "p:nvPr": {} } };
    const shape2: XmlObject = {
      "p:nvSpPr": { "p:nvPr": {} },
      "p:txBody": { "a:p": {} },
    };
    const result = findNotesBodyShape([shape1, shape2]);
    expect(result).toBe(shape2);
  });

  it("should fallback to first shape when no body or txBody found", () => {
    const shape1: XmlObject = { "p:nvSpPr": { "p:nvPr": {} } };
    const shape2: XmlObject = { "p:nvSpPr": { "p:nvPr": {} } };
    const result = findNotesBodyShape([shape1, shape2]);
    expect(result).toBe(shape1);
  });
});

// ---------------------------------------------------------------------------
// computeEffectiveSegments
// ---------------------------------------------------------------------------
describe("computeEffectiveSegments", () => {
  it("should return segments when text matches segment concatenation", () => {
    const segments: TextSegment[] = [
      { text: "Hello " },
      { text: "World" },
    ];
    const result = computeEffectiveSegments("Hello World", segments);
    expect(result).toBe(segments);
  });

  it("should discard segments when text does not match", () => {
    const segments: TextSegment[] = [
      { text: "Old " },
      { text: "text" },
    ];
    const result = computeEffectiveSegments("New text", segments);
    expect(result).toBeUndefined();
  });

  it("should return segments unchanged when notesText is undefined", () => {
    const segments: TextSegment[] = [{ text: "data" }];
    const result = computeEffectiveSegments(undefined, segments);
    expect(result).toBe(segments);
  });

  it("should return undefined when segments is undefined", () => {
    const result = computeEffectiveSegments("text", undefined);
    expect(result).toBeUndefined();
  });

  it("should return empty segments unchanged when text is undefined", () => {
    const result = computeEffectiveSegments(undefined, []);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// canUpdateNotesXml
// ---------------------------------------------------------------------------
describe("canUpdateNotesXml", () => {
  it("should return true when spTree has shapes", () => {
    const xml: XmlObject = {
      "p:notes": {
        "p:cSld": {
          "p:spTree": {
            "p:sp": { "p:nvSpPr": {} },
          },
        },
      },
    };
    expect(canUpdateNotesXml(xml)).toBe(true);
  });

  it("should return true when spTree has array of shapes", () => {
    const xml: XmlObject = {
      "p:notes": {
        "p:cSld": {
          "p:spTree": {
            "p:sp": [{ "p:nvSpPr": {} }, { "p:nvSpPr": {} }],
          },
        },
      },
    };
    expect(canUpdateNotesXml(xml)).toBe(true);
  });

  it("should return false when p:notes is missing", () => {
    expect(canUpdateNotesXml({})).toBe(false);
  });

  it("should return false when spTree is missing", () => {
    const xml: XmlObject = {
      "p:notes": { "p:cSld": {} },
    };
    expect(canUpdateNotesXml(xml)).toBe(false);
  });

  it("should return false when spTree has no shapes", () => {
    const xml: XmlObject = {
      "p:notes": {
        "p:cSld": {
          "p:spTree": {},
        },
      },
    };
    expect(canUpdateNotesXml(xml)).toBe(false);
  });
});
