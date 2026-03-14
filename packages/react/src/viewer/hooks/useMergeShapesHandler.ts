/**
 * useMergeShapesHandler — Merge shapes (boolean operations) handler.
 *
 * Provides handlers for PowerPoint-style Merge Shapes operations:
 * Union, Intersect, Subtract, Fragment, and Combine.
 *
 * These operations take two or more selected shape elements and produce
 * new shape(s) with custom geometry derived from the boolean operation.
 */
import {
  type PptxElement,
  type PptxSlide,
  type ShapePptxElement,
  type MergeShapeOperation,
  mergeShapes,
  getPresetShapeClipPath,
  svgPathToPolygons,
  polygonsToSvgPath,
} from "pptx-viewer-core";
import { generateElementId } from "../utils/generate-id";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";

/** Input for the merge shapes handler. */
export interface MergeShapesHandlerInput {
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  selectedElements: PptxElement[];
  effectiveSelectedIds: string[];
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  ops: ElementOperations;
  history: EditorHistoryResult;
}

/** Handlers returned by the merge shapes hook. */
export interface MergeShapesHandlers {
  handleMergeShapes: (operation: MergeShapeOperation) => void;
  canMergeShapes: boolean;
}

/**
 * Check whether an element is a shape-like element that can participate
 * in merge operations (has geometry).
 */
function isShapeLike(
  el: PptxElement,
): el is PptxElement & { type: "shape" | "image" | "picture" } {
  return el.type === "shape" || el.type === "image" || el.type === "picture";
}

/**
 * Resolve the SVG path data for a shape element.
 *
 * Tries in order:
 * 1. Explicit `pathData` on the element (custom geometry)
 * 2. Clip-path from preset shape type (converted to SVG path)
 * 3. Default rectangle from element bounds
 */
function resolveShapePath(el: PptxElement): string {
  // 1. Custom path data
  if ("pathData" in el && typeof el.pathData === "string" && el.pathData) {
    return el.pathData;
  }

  // 2. Preset shape clip-path
  if ("shapeType" in el && typeof el.shapeType === "string") {
    const clipPath = getPresetShapeClipPath(el.shapeType);
    if (clipPath) {
      // Try to convert polygon() clip-path to SVG path
      const svgPath = clipPathToSvgPath(clipPath, el.width, el.height);
      if (svgPath) return svgPath;
    }
  }

  // 3. Default: treat as rectangle in local coordinate space
  return `M 0 0 L ${el.width} 0 L ${el.width} ${el.height} L 0 ${el.height} Z`;
}

/**
 * Convert a CSS polygon() clip-path to an SVG path string.
 * Handles `polygon(x1% y1%, x2% y2%, ...)` format.
 */
function clipPathToSvgPath(
  clipPath: string,
  width: number,
  height: number,
): string | null {
  const match = clipPath.match(/polygon\(([^)]+)\)/i);
  if (!match) return null;

  const pairs = match[1].split(",").map((s) => s.trim());
  const points: Array<{ x: number; y: number }> = [];

  for (const pair of pairs) {
    const parts = pair.split(/\s+/);
    if (parts.length < 2) continue;

    const xStr = parts[0];
    const yStr = parts[1];

    let x: number;
    let y: number;

    if (xStr.endsWith("%")) {
      x = (parseFloat(xStr) / 100) * width;
    } else {
      x = parseFloat(xStr);
    }

    if (yStr.endsWith("%")) {
      y = (parseFloat(yStr) / 100) * height;
    } else {
      y = parseFloat(yStr);
    }

    if (!isNaN(x) && !isNaN(y)) {
      points.push({ x, y });
    }
  }

  if (points.length < 3) return null;

  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i].x} ${points[i].y}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

/**
 * Transform an SVG path from element-local coordinates to slide-global coordinates.
 */
function transformPathToGlobal(
  pathData: string,
  el: PptxElement,
): string {
  const polys = svgPathToPolygons(pathData);
  if (polys.length === 0) return pathData;

  // Determine path coordinate space
  let pathW = el.width;
  let pathH = el.height;
  if ("pathWidth" in el && typeof el.pathWidth === "number") pathW = el.pathWidth;
  if ("pathHeight" in el && typeof el.pathHeight === "number") pathH = el.pathHeight;

  const scaleX = pathW > 0 ? el.width / pathW : 1;
  const scaleY = pathH > 0 ? el.height / pathH : 1;

  const transformed = polys.map((poly) =>
    poly.map((pt) => ({
      x: pt.x * scaleX + el.x,
      y: pt.y * scaleY + el.y,
    })),
  );

  return polygonsToSvgPath(transformed);
}

/**
 * Transform an SVG path from slide-global coordinates back to element-local coordinates.
 */
function transformPathToLocal(
  pathData: string,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const polys = svgPathToPolygons(pathData);
  if (polys.length === 0) return pathData;

  const transformed = polys.map((poly) =>
    poly.map((pt) => ({
      x: pt.x - x,
      y: pt.y - y,
    })),
  );

  return polygonsToSvgPath(transformed);
}

/**
 * Compute the bounding box of an SVG path.
 */
function pathBounds(pathData: string): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const polys = svgPathToPolygons(pathData);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const poly of polys) {
    for (const pt of poly) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function useMergeShapesHandler(
  input: MergeShapesHandlerInput,
): MergeShapesHandlers {
  const {
    activeSlide,
    activeSlideIndex,
    selectedElements,
    effectiveSelectedIds,
    setSelectedElementIds,
    ops,
    history,
  } = input;

  // At least 2 shape-like elements must be selected
  const shapeLikeElements = selectedElements.filter(isShapeLike);
  const canMergeShapes = shapeLikeElements.length >= 2;

  const handleMergeShapes = (operation: MergeShapeOperation) => {
    if (!canMergeShapes || !activeSlide) return;

    const targets = shapeLikeElements;
    if (targets.length < 2) return;

    // Resolve SVG paths in global (slide) coordinate space
    const globalPaths = targets.map((el) => {
      const localPath = resolveShapePath(el);
      return transformPathToGlobal(localPath, el);
    });

    // Apply boolean operation sequentially:
    // For union/intersect/subtract/combine, reduce from left to right.
    // For fragment, process the first two shapes.
    if (operation === "fragment") {
      // Fragment: split into non-overlapping pieces
      let allFragments: string[] = [];

      // Process pairs and accumulate fragments
      let remaining = globalPaths[0];
      for (let i = 1; i < globalPaths.length; i++) {
        const frags = mergeShapes("fragment", remaining, globalPaths[i]);
        if (Array.isArray(frags)) {
          allFragments = frags;
        }
        // For subsequent shapes, fragment against all current fragments
        if (i < globalPaths.length - 1 && allFragments.length > 0) {
          remaining = allFragments[0];
        }
      }

      if (allFragments.length === 0) return;

      // Create new shape elements for each fragment
      const idSet = new Set(effectiveSelectedIds);
      const newElements: PptxElement[] = [];

      for (const frag of allFragments) {
        if (!frag) continue;
        const bounds = pathBounds(frag);
        if (bounds.width <= 0 || bounds.height <= 0) continue;

        const localPath = transformPathToLocal(
          frag,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
        );

        const newEl: ShapePptxElement = {
          id: generateElementId(),
          type: "shape",
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          rotation: 0,
          flipHorizontal: false,
          flipVertical: false,
          hidden: false,
          opacity: targets[0].opacity ?? 1,
          rawXml: {},
          shapeStyle: {
            ...(targets[0] as ShapePptxElement).shapeStyle,
          },
          shapeType: "custGeom",
          pathData: localPath,
          pathWidth: bounds.width,
          pathHeight: bounds.height,
        };

        newElements.push(newEl);
      }

      if (newElements.length === 0) return;

      ops.updateSlides((prev) =>
        prev.map((s, i) =>
          i === activeSlideIndex
            ? {
                ...s,
                elements: [
                  ...s.elements.filter((el) => !idSet.has(el.id)),
                  ...newElements,
                ],
              }
            : s,
        ),
      );

      setSelectedElementIds(newElements.map((el) => el.id));
      history.markDirty();
    } else {
      // Union, intersect, subtract, combine: reduce to a single shape
      let resultPath = globalPaths[0];
      for (let i = 1; i < globalPaths.length; i++) {
        const result = mergeShapes(operation, resultPath, globalPaths[i]);
        if (typeof result === "string") {
          resultPath = result;
        }
      }

      if (!resultPath) return;

      const bounds = pathBounds(resultPath);
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const localPath = transformPathToLocal(
        resultPath,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
      );

      // Create new merged shape inheriting style from the first selected element
      const primary = targets[0] as ShapePptxElement;
      const newEl: ShapePptxElement = {
        id: generateElementId(),
        type: "shape",
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rotation: 0,
        flipHorizontal: false,
        flipVertical: false,
        hidden: false,
        opacity: primary.opacity ?? 1,
        rawXml: {},
        shapeStyle: { ...primary.shapeStyle },
        shapeType: "custGeom",
        pathData: localPath,
        pathWidth: bounds.width,
        pathHeight: bounds.height,
      };

      const idSet = new Set(effectiveSelectedIds);

      ops.updateSlides((prev) =>
        prev.map((s, i) =>
          i === activeSlideIndex
            ? {
                ...s,
                elements: [
                  ...s.elements.filter((el) => !idSet.has(el.id)),
                  newEl,
                ],
              }
            : s,
        ),
      );

      ops.applySelection(newEl.id);
      history.markDirty();
    }
  };

  return {
    handleMergeShapes,
    canMergeShapes,
  };
}
