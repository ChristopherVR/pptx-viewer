/**
 * Tests for pure logic extracted from useAnnotationHandlers.
 *
 * The stroke-to-ink-element conversion (bounding-box calculation, SVG path
 * generation, tool-type determination) is testable without React state.
 */
import { describe, it, expect } from "vitest";

import type { InkPptxElement } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Types mirroring the hook's internal AnnotationStroke
// ---------------------------------------------------------------------------

interface AnnotationStroke {
  id: string;
  color: string;
  width: number;
  opacity: number;
  points: Array<{ x: number; y: number }>;
}

// ---------------------------------------------------------------------------
// Extracted pure conversion — mirrors handleKeepAnnotations' inner map
// ---------------------------------------------------------------------------

function strokeToInkElement(stroke: AnnotationStroke): InkPptxElement {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of stroke.points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }
  const bboxWidth = Math.max(maxX - minX, 1);
  const bboxHeight = Math.max(maxY - minY, 1);
  const pathParts: string[] = [];
  for (let i = 0; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
    const rx = pt.x - minX;
    const ry = pt.y - minY;
    pathParts.push(i === 0 ? `M ${rx} ${ry}` : `L ${rx} ${ry}`);
  }
  const inkTool: "pen" | "highlighter" = stroke.opacity < 1 ? "highlighter" : "pen";
  return {
    id: `ink-annotation-${stroke.id}`,
    type: "ink" as const,
    x: minX,
    y: minY,
    width: bboxWidth,
    height: bboxHeight,
    inkPaths: [pathParts.join(" ")],
    inkColors: [stroke.color],
    inkWidths: [stroke.width],
    inkOpacities: [stroke.opacity],
    inkTool,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAnnotationHandlers — strokeToInkElement", () => {
  // ── Bounding box ──────────────────────────────────────────────────
  describe("bounding box", () => {
    it("should compute bounding box from stroke points", () => {
      const stroke: AnnotationStroke = {
        id: "s1",
        color: "#ff0000",
        width: 3,
        opacity: 1,
        points: [
          { x: 10, y: 20 },
          { x: 50, y: 60 },
          { x: 30, y: 40 },
        ],
      };
      const ink = strokeToInkElement(stroke);
      expect(ink.x).toBe(10);
      expect(ink.y).toBe(20);
      expect(ink.width).toBe(40); // 50 - 10
      expect(ink.height).toBe(40); // 60 - 20
    });

    it("should enforce minimum size of 1 for single-point strokes", () => {
      const stroke: AnnotationStroke = {
        id: "s2",
        color: "#000000",
        width: 2,
        opacity: 1,
        points: [{ x: 100, y: 200 }],
      };
      const ink = strokeToInkElement(stroke);
      expect(ink.width).toBe(1);
      expect(ink.height).toBe(1);
    });

    it("should handle points with same x but different y", () => {
      const stroke: AnnotationStroke = {
        id: "s3",
        color: "#000",
        width: 1,
        opacity: 1,
        points: [
          { x: 50, y: 10 },
          { x: 50, y: 90 },
        ],
      };
      const ink = strokeToInkElement(stroke);
      expect(ink.x).toBe(50);
      expect(ink.width).toBe(1); // min(max(0, 1)) = 1 for zero-width
      expect(ink.height).toBe(80);
    });
  });

  // ── SVG path ──────────────────────────────────────────────────────
  describe("SVG path generation", () => {
    it("should generate M command for first point and L for rest", () => {
      const stroke: AnnotationStroke = {
        id: "p1",
        color: "#000",
        width: 1,
        opacity: 1,
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
          { x: 50, y: 60 },
        ],
      };
      const ink = strokeToInkElement(stroke);
      expect(ink.inkPaths[0]).toBe("M 0 0 L 20 20 L 40 40");
    });

    it("should produce a single M command for single point", () => {
      const stroke: AnnotationStroke = {
        id: "p2",
        color: "#000",
        width: 1,
        opacity: 1,
        points: [{ x: 100, y: 200 }],
      };
      const ink = strokeToInkElement(stroke);
      expect(ink.inkPaths[0]).toBe("M 0 0");
    });

    it("should normalize coordinates relative to bounding box origin", () => {
      const stroke: AnnotationStroke = {
        id: "p3",
        color: "#000",
        width: 1,
        opacity: 1,
        points: [
          { x: 100, y: 200 },
          { x: 150, y: 250 },
        ],
      };
      const ink = strokeToInkElement(stroke);
      // First point should be (0, 0) relative, second (50, 50)
      expect(ink.inkPaths[0]).toBe("M 0 0 L 50 50");
    });
  });

  // ── Ink tool type ─────────────────────────────────────────────────
  describe("ink tool type", () => {
    it("should be 'pen' when opacity is 1", () => {
      const stroke: AnnotationStroke = {
        id: "t1",
        color: "#000",
        width: 1,
        opacity: 1,
        points: [{ x: 0, y: 0 }],
      };
      expect(strokeToInkElement(stroke).inkTool).toBe("pen");
    });

    it("should be 'highlighter' when opacity is less than 1", () => {
      const stroke: AnnotationStroke = {
        id: "t2",
        color: "#ffff00",
        width: 10,
        opacity: 0.5,
        points: [{ x: 0, y: 0 }],
      };
      expect(strokeToInkElement(stroke).inkTool).toBe("highlighter");
    });

    it("should be 'highlighter' for very low opacity", () => {
      const stroke: AnnotationStroke = {
        id: "t3",
        color: "#000",
        width: 1,
        opacity: 0.01,
        points: [{ x: 0, y: 0 }],
      };
      expect(strokeToInkElement(stroke).inkTool).toBe("highlighter");
    });
  });

  // ── id / color / width / opacity pass-through ─────────────────────
  describe("pass-through properties", () => {
    it("should set correct id from stroke id", () => {
      const stroke: AnnotationStroke = {
        id: "abc-123",
        color: "#ff0000",
        width: 5,
        opacity: 0.8,
        points: [{ x: 0, y: 0 }],
      };
      const ink = strokeToInkElement(stroke);
      expect(ink.id).toBe("ink-annotation-abc-123");
      expect(ink.type).toBe("ink");
      expect(ink.inkColors).toEqual(["#ff0000"]);
      expect(ink.inkWidths).toEqual([5]);
      expect(ink.inkOpacities).toEqual([0.8]);
    });
  });
});
