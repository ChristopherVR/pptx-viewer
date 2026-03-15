import { describe, it, expect } from "vitest";
import {
  calculateNotesPageLayout,
  wrapNotesText,
  NOTES_PAGE_W,
  NOTES_PAGE_H,
  NOTES_MARGIN,
  NOTES_SLIDE_FRACTION,
  NOTES_GAP,
  NOTES_FONT_SIZE,
  NOTES_LINE_HEIGHT,
} from "./pdf-builder";

// ===========================================================================
// calculateNotesPageLayout
// ===========================================================================

describe("calculateNotesPageLayout", () => {
  it("returns correct content dimensions for US Letter portrait", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    const expectedContentW = NOTES_PAGE_W - 2 * NOTES_MARGIN;
    const expectedContentH = NOTES_PAGE_H - 2 * NOTES_MARGIN;

    expect(layout.contentWidth).toBe(expectedContentW);
    expect(layout.contentHeight).toBe(expectedContentH);
  });

  it("allocates 2/3 of content height to slide area", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    const expectedContentH = NOTES_PAGE_H - 2 * NOTES_MARGIN;
    const expectedSlideArea = expectedContentH * NOTES_SLIDE_FRACTION;

    expect(layout.slideAreaHeight).toBeCloseTo(expectedSlideArea, 5);
  });

  it("allocates remaining height minus gap to notes area", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    const expectedNotesArea =
      layout.contentHeight - layout.slideAreaHeight - NOTES_GAP;

    expect(layout.notesAreaHeight).toBeCloseTo(expectedNotesArea, 5);
  });

  it("preserves aspect ratio for a standard 16:9 slide", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    const originalRatio = 1920 / 1080;
    const renderedRatio = layout.imageWidth / layout.imageHeight;

    expect(renderedRatio).toBeCloseTo(originalRatio, 3);
  });

  it("preserves aspect ratio for a 4:3 slide", () => {
    const layout = calculateNotesPageLayout(1024, 768);
    const originalRatio = 1024 / 768;
    const renderedRatio = layout.imageWidth / layout.imageHeight;

    expect(renderedRatio).toBeCloseTo(originalRatio, 3);
  });

  it("fits slide image within the slide area bounds", () => {
    const layout = calculateNotesPageLayout(1920, 1080);

    expect(layout.imageWidth).toBeLessThanOrEqual(layout.contentWidth + 0.01);
    expect(layout.imageHeight).toBeLessThanOrEqual(
      layout.slideAreaHeight + 0.01,
    );
  });

  it("centers the slide image horizontally", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    const leftGap = layout.imageX - NOTES_MARGIN;
    const rightGap =
      NOTES_PAGE_W - NOTES_MARGIN - (layout.imageX + layout.imageWidth);

    expect(leftGap).toBeCloseTo(rightGap, 3);
  });

  it("positions the image at the top of the content area", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    const slideAreaTop = NOTES_PAGE_H - NOTES_MARGIN;
    // Image Y + image height should equal the top of the content area
    expect(layout.imageY + layout.imageHeight).toBeCloseTo(slideAreaTop, 3);
  });

  it("positions notes text below the slide image with a gap", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    // Notes text Y should be image bottom - gap
    expect(layout.notesTextY).toBeCloseTo(layout.imageY - NOTES_GAP, 3);
  });

  it("calculates a positive number of max notes lines", () => {
    const layout = calculateNotesPageLayout(1920, 1080);

    expect(layout.maxNotesLines).toBeGreaterThan(0);
    // Verify the calculation matches
    const lineHeightPt = NOTES_FONT_SIZE * NOTES_LINE_HEIGHT;
    const expectedLines = Math.floor(layout.notesAreaHeight / lineHeightPt);
    expect(layout.maxNotesLines).toBe(expectedLines);
  });

  it("handles a very wide slide (ultrawide aspect ratio)", () => {
    const layout = calculateNotesPageLayout(3840, 1080);
    // Width-constrained: image should fill content width
    expect(layout.imageWidth).toBeCloseTo(layout.contentWidth, 3);
    expect(layout.imageHeight).toBeLessThanOrEqual(
      layout.slideAreaHeight + 0.01,
    );
  });

  it("handles a very tall slide (portrait aspect ratio)", () => {
    const layout = calculateNotesPageLayout(1080, 1920);
    // Height-constrained: image should fill slide area height
    expect(layout.imageHeight).toBeCloseTo(layout.slideAreaHeight, 3);
    expect(layout.imageWidth).toBeLessThanOrEqual(layout.contentWidth + 0.01);
  });

  it("handles a square slide", () => {
    const layout = calculateNotesPageLayout(1000, 1000);
    const squareRatio = layout.imageWidth / layout.imageHeight;
    expect(squareRatio).toBeCloseTo(1, 3);
  });
});

// ===========================================================================
// wrapNotesText
// ===========================================================================

describe("wrapNotesText", () => {
  it("returns empty array for empty string", () => {
    expect(wrapNotesText("", 540, 11)).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(wrapNotesText("   \n  ", 540, 11)).toEqual([]);
  });

  it("returns empty array for undefined-ish input", () => {
    expect(wrapNotesText(undefined as unknown as string, 540, 11)).toEqual([]);
  });

  it("keeps short text on a single line", () => {
    const lines = wrapNotesText("Hello world", 540, 11);
    expect(lines).toEqual(["Hello world"]);
  });

  it("wraps long text into multiple lines", () => {
    const longText =
      "This is a much longer piece of text that should definitely be wrapped " +
      "across multiple lines when rendered in the notes section of the PDF page.";
    const lines = wrapNotesText(longText, 540, 11);
    expect(lines.length).toBeGreaterThan(1);
    // Each line should be non-empty
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it("preserves explicit newlines as separate paragraphs", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    const lines = wrapNotesText(text, 540, 11);
    // Should have at least 3 entries: first paragraph, empty line, second paragraph
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines).toContain("");
  });

  it("handles Windows-style line endings (CRLF)", () => {
    const text = "Line one.\r\nLine two.";
    const lines = wrapNotesText(text, 540, 11);
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("Line one.");
    expect(lines[1]).toBe("Line two.");
  });

  it("respects maxWidth constraint on character count", () => {
    const avgCharWidth = 11 * 0.5; // font size * 0.5
    const maxWidth = 100; // Narrow width
    const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

    const lines = wrapNotesText(
      "word ".repeat(50).trim(),
      maxWidth,
      11,
    );
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(maxCharsPerLine + 10); // small tolerance for last word
    }
  });

  it("handles a single very long word", () => {
    const longWord = "supercalifragilisticexpialidocious";
    const lines = wrapNotesText(longWord, 540, 11);
    // A single word that fits should stay on one line
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe(longWord);
  });

  it("returns zero lines for zero maxWidth", () => {
    expect(wrapNotesText("Hello", 0, 11)).toEqual([]);
  });
});

// ===========================================================================
// Notes page layout integration (cross-checks)
// ===========================================================================

describe("notes page layout integration", () => {
  it("slide area + gap + notes area equals content height", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    const total = layout.slideAreaHeight + NOTES_GAP + layout.notesAreaHeight;

    expect(total).toBeCloseTo(layout.contentHeight, 5);
  });

  it("notes text Y is above the bottom margin", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    // notes text Y should be higher than the bottom margin
    expect(layout.notesTextY).toBeGreaterThan(NOTES_MARGIN);
  });

  it("image fits entirely within the page boundaries", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    // Image left edge >= left margin
    expect(layout.imageX).toBeGreaterThanOrEqual(NOTES_MARGIN - 0.01);
    // Image right edge <= right margin
    expect(layout.imageX + layout.imageWidth).toBeLessThanOrEqual(
      NOTES_PAGE_W - NOTES_MARGIN + 0.01,
    );
    // Image top edge <= top of page minus margin
    expect(layout.imageY + layout.imageHeight).toBeLessThanOrEqual(
      NOTES_PAGE_H - NOTES_MARGIN + 0.01,
    );
    // Image bottom edge >= 0
    expect(layout.imageY).toBeGreaterThanOrEqual(0);
  });

  it("wrapped notes fit within the max lines for a typical notes text", () => {
    const layout = calculateNotesPageLayout(1920, 1080);
    const typicalNotes =
      "These are speaker notes for the current slide. " +
      "They contain several sentences with useful information " +
      "for the presenter. This text should fit within the " +
      "notes area of the PDF page without being truncated.";
    const lines = wrapNotesText(typicalNotes, layout.contentWidth, NOTES_FONT_SIZE);

    expect(lines.length).toBeLessThanOrEqual(layout.maxNotesLines);
  });
});
