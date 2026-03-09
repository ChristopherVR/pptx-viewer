import { describe, it, expect } from "vitest";
import {
  extractTextFromPoint,
  collectLocalTextValues,
  extractParagraphText,
  getLocalName,
} from "./smart-art-text-helpers";
import type { XmlObject } from "../../types";

// ---------------------------------------------------------------------------
// getLocalName
// ---------------------------------------------------------------------------

describe("getLocalName", () => {
  it("strips namespace prefix from qualified name", () => {
    expect(getLocalName("dgm:pt")).toBe("pt");
    expect(getLocalName("a:p")).toBe("p");
    expect(getLocalName("a:r")).toBe("r");
  });

  it("returns the name unchanged when no colon is present", () => {
    expect(getLocalName("body")).toBe("body");
    expect(getLocalName("text")).toBe("text");
  });

  it("handles empty string", () => {
    expect(getLocalName("")).toBe("");
  });

  it("handles name with multiple colons (takes after first colon)", () => {
    expect(getLocalName("ns:sub:item")).toBe("sub:item");
  });
});

// ---------------------------------------------------------------------------
// extractParagraphText
// ---------------------------------------------------------------------------

describe("extractParagraphText", () => {
  it("extracts text from a single run", () => {
    const paragraph: XmlObject = {
      "a:r": { "a:t": "Hello" },
    };
    const out: string[] = [];
    extractParagraphText(paragraph, out);
    expect(out).toEqual(["Hello"]);
  });

  it("extracts text from multiple runs", () => {
    const paragraph: XmlObject = {
      "a:r": [
        { "a:t": "Hello" },
        { "a:t": " World" },
      ],
    };
    const out: string[] = [];
    extractParagraphText(paragraph, out);
    expect(out).toEqual(["Hello", " World"]);
  });

  it("handles a:p wrapper containing runs", () => {
    const paragraph: XmlObject = {
      "a:p": {
        "a:r": { "a:t": "Nested text" },
      },
    };
    const out: string[] = [];
    extractParagraphText(paragraph, out);
    expect(out).toEqual(["Nested text"]);
  });

  it("handles array of paragraphs", () => {
    const paragraphs = [
      { "a:r": { "a:t": "Para 1" } },
      { "a:r": { "a:t": "Para 2" } },
    ] as unknown as XmlObject;
    const out: string[] = [];
    extractParagraphText(paragraphs, out);
    expect(out).toEqual(["Para 1", "Para 2"]);
  });

  it("does nothing for undefined input", () => {
    const out: string[] = [];
    extractParagraphText(undefined, out);
    expect(out).toEqual([]);
  });

  it("does nothing for non-object input", () => {
    const out: string[] = [];
    extractParagraphText("string" as unknown as XmlObject, out);
    expect(out).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// collectLocalTextValues
// ---------------------------------------------------------------------------

describe("collectLocalTextValues", () => {
  it("collects text from nested element with matching local name", () => {
    const obj: XmlObject = {
      "dgm:t": {
        "a:p": {
          "a:r": { "a:t": "SmartArt text" },
        },
      },
    };
    const out: string[] = [];
    collectLocalTextValues(obj, "t", out);
    expect(out).toEqual(["SmartArt text"]);
  });

  it("recurses into nested objects to find target", () => {
    const obj: XmlObject = {
      "dgm:wrapper": {
        "dgm:t": {
          "a:p": {
            "a:r": { "a:t": "Deep text" },
          },
        },
      },
    };
    const out: string[] = [];
    collectLocalTextValues(obj, "t", out);
    expect(out).toEqual(["Deep text"]);
  });

  it("does nothing for undefined input", () => {
    const out: string[] = [];
    collectLocalTextValues(undefined, "t", out);
    expect(out).toEqual([]);
  });

  it("does nothing for non-object input", () => {
    const out: string[] = [];
    collectLocalTextValues(42 as unknown as XmlObject, "t", out);
    expect(out).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractTextFromPoint
// ---------------------------------------------------------------------------

describe("extractTextFromPoint", () => {
  it("extracts text from a SmartArt point with a:p/a:r/a:t structure", () => {
    const point: XmlObject = {
      "dgm:t": {
        "a:p": {
          "a:r": { "a:t": "Strategy" },
        },
      },
    };
    expect(extractTextFromPoint(point)).toBe("Strategy");
  });

  it("returns trimmed text", () => {
    const point: XmlObject = {
      "dgm:t": {
        "a:p": {
          "a:r": { "a:t": "  padded  " },
        },
      },
    };
    expect(extractTextFromPoint(point)).toBe("padded");
  });

  it("returns undefined when no text content is found", () => {
    const point: XmlObject = {};
    expect(extractTextFromPoint(point)).toBeUndefined();
  });

  it("returns undefined when text is only whitespace", () => {
    const point: XmlObject = {
      "dgm:t": {
        "a:p": {
          "a:r": { "a:t": "   " },
        },
      },
    };
    expect(extractTextFromPoint(point)).toBeUndefined();
  });

  it("returns the first non-empty text when multiple texts exist", () => {
    const point: XmlObject = {
      "dgm:t": {
        "a:p": [
          { "a:r": { "a:t": "" } },
          { "a:r": { "a:t": "Second" } },
        ],
      },
    };
    expect(extractTextFromPoint(point)).toBe("Second");
  });
});
