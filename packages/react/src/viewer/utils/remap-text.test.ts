/**
 * Tests for the remapTextToSegments utility.
 *
 * This function maps edited plain-text back onto rich-text segments,
 * preserving per-segment styles.
 */
import { describe, it, expect } from "vitest";

import { remapTextToSegments } from "./remap-text";
import type { TextSegment, TextStyle } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seg(text: string, style: TextStyle = {}): TextSegment {
  return { text, style };
}

function breakSeg(style: TextStyle = {}): TextSegment {
  return { text: "\n", style, isParagraphBreak: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("remapTextToSegments", () => {
  describe("fallback behaviour", () => {
    it("should return single segment with fallback style when no original segments", () => {
      const result = remapTextToSegments("Hello", undefined, { bold: true });
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Hello");
      expect(result[0].style.bold).toBe(true);
    });

    it("should return single segment when original segments array is empty", () => {
      const result = remapTextToSegments("Hello", [], { italic: true });
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Hello");
      expect(result[0].style.italic).toBe(true);
    });

    it("should use empty style when no elementTextStyle provided", () => {
      const result = remapTextToSegments("Hello", undefined, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Hello");
    });
  });

  describe("single paragraph remapping", () => {
    it("should preserve styles from original segments", () => {
      const original = [
        seg("Hello", { bold: true }),
        seg(" World", { italic: true }),
      ];
      const result = remapTextToSegments("Hello World", original, {});
      expect(result).toHaveLength(2);
      expect(result[0].style.bold).toBe(true);
      expect(result[1].style.italic).toBe(true);
    });

    it("should distribute text proportionally across segments", () => {
      const original = [
        seg("AB", { bold: true }),
        seg("CDE", { italic: true }),
      ];
      // New text is the same length
      const result = remapTextToSegments("XYZWQ", original, {});
      // First segment gets 2 chars (same as original), last gets rest
      expect(result[0].text).toBe("XY");
      expect(result[1].text).toBe("ZWQ");
    });

    it("should handle shorter new text", () => {
      const original = [
        seg("Hello", { bold: true }),
        seg(" World", { italic: true }),
      ];
      const result = remapTextToSegments("Hi", original, {});
      // "Hi" is only 2 chars; first orig is 5, so we get all in first segment
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].text).toBe("Hi");
      expect(result[0].style.bold).toBe(true);
    });

    it("should handle empty new text", () => {
      const original = [seg("Hello", { bold: true })];
      const result = remapTextToSegments("", original, {});
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("");
    });

    it("should handle original segments with empty text", () => {
      const original = [seg("", { bold: true })];
      const result = remapTextToSegments("New text", original, {});
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("New text");
      expect(result[0].style.bold).toBe(true);
    });
  });

  describe("multi-paragraph remapping", () => {
    it("should split new text by newlines and remap each paragraph", () => {
      const original = [
        seg("Line 1", { bold: true }),
        breakSeg(),
        seg("Line 2", { italic: true }),
      ];
      const result = remapTextToSegments("AAA\nBBB", original, {});
      // Should have segments for paragraph 1, a break, and paragraph 2
      const texts = result.map((s) => s.text);
      expect(texts).toContain("\n");
      // First paragraph
      expect(result[0].text).toBe("AAA");
      expect(result[0].style.bold).toBe(true);
      // Break
      expect(result[1].isParagraphBreak).toBe(true);
      // Second paragraph
      expect(result[2].text).toBe("BBB");
      expect(result[2].style.italic).toBe(true);
    });

    it("should handle more new paragraphs than original", () => {
      const original = [seg("One", { bold: true })];
      const result = remapTextToSegments("A\nB\nC", original, {});
      // Should produce 3 paragraphs with breaks in between
      const breaks = result.filter((s) => s.isParagraphBreak);
      expect(breaks).toHaveLength(2);
    });

    it("should handle fewer new paragraphs than original", () => {
      const original = [
        seg("P1", { bold: true }),
        breakSeg(),
        seg("P2", { italic: true }),
        breakSeg(),
        seg("P3", {}),
      ];
      const result = remapTextToSegments("OnlyOne", original, {});
      // No breaks since only 1 paragraph
      const breaks = result.filter((s) => s.isParagraphBreak);
      expect(breaks).toHaveLength(0);
      expect(result[0].text).toBe("OnlyOne");
    });
  });

  describe("bullet info preservation", () => {
    it("should preserve bulletInfo on the first segment of a paragraph", () => {
      const bulletInfo = { type: "numbered" };
      const original: TextSegment[] = [
        { text: "Item 1", style: { bold: true }, bulletInfo },
      ];
      const result = remapTextToSegments("New item", original, {});
      expect(result[0].bulletInfo).toEqual(bulletInfo);
    });
  });
});
