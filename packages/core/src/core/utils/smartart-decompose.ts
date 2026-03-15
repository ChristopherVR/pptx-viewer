/**
 * SmartArt decomposition engine.
 *
 * Converts SmartArt data-model nodes into standard PptxElement[] shapes
 * that can be rendered by the existing shape/text renderer rather than
 * relying on a special-purpose SVG overlay.
 *
 * Layout algorithms live in `./smartart-layouts.ts` and
 * `./smartart-layouts-tree.ts`; shared helpers in `./smartart-helpers.ts`.
 *
 * When a parsed layout definition is available, the constraint-driven
 * layout engine in `./smartart-layout-engine.ts` is used for more
 * accurate positioning before falling back to the simpler heuristic layouts.
 */

import type {
  PptxElement,
  PptxSmartArtData,
  PptxSmartArtNode,
  PptxSmartArtDrawingShape,
  PptxSmartArtQuickStyle,
  SmartArtLayoutType,
} from "../types";
import {
  DEFAULT_ACCENT_COLORS,
  nextId,
  makeShapeElement,
  getContentNodes,
} from "./smartart-helpers";
import {
  layoutList,
  layoutProcess,
  layoutCycle,
  layoutMatrix,
  layoutPyramid,
} from "./smartart-layouts";
import { layoutHierarchy, layoutRelationship } from "./smartart-layouts-tree";
import {
  computeSmartArtLayout,
  layoutEngineShapesToDrawingShapes,
  type ParsedLayoutDef,
} from "./smartart-layout-engine";

// Re-export public API from helpers so existing consumers don't break.
export { resetDecomposeCounter } from "./smartart-helpers";
export type { ContainerBounds } from "./smartart-helpers";

// ── Pre-computed drawing shape conversion ────────────────────────────────

/**
 * Convert pre-computed drawing shapes (from `ppt/diagrams/drawing*.xml`)
 * into standard PptxElement[] shapes. These are preferred over layout
 * algorithms because they reflect PowerPoint's actual computed positions.
 *
 * The drawing shapes use absolute EMU coordinates, so we offset them
 * relative to the graphic frame's container bounds.
 */
interface DrawingBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute a stroke-width multiplier based on SmartArt quick-style effect
 * intensity.  Subtle → thinner outlines, intense → heavier outlines.
 */
function quickStyleStrokeScale(
  quickStyle: PptxSmartArtQuickStyle | undefined,
): number {
  if (!quickStyle?.effectIntensity) return 1;
  switch (quickStyle.effectIntensity) {
    case "subtle":
      return 0.5;
    case "intense":
      return 2;
    default:
      return 1;
  }
}

function convertDrawingShapes(
  drawingShapes: PptxSmartArtDrawingShape[],
  containerBounds: DrawingBounds,
  colorTransformFills?: string[],
  quickStyle?: PptxSmartArtQuickStyle,
): PptxElement[] {
  const strokeScale = quickStyleStrokeScale(quickStyle);
  // Compute the bounding box of all drawing shapes to determine the offset
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ds of drawingShapes) {
    if (ds.x < minX) minX = ds.x;
    if (ds.y < minY) minY = ds.y;
    if (ds.x + ds.width > maxX) maxX = ds.x + ds.width;
    if (ds.y + ds.height > maxY) maxY = ds.y + ds.height;
  }

  const drawingW = maxX - minX || 1;
  const drawingH = maxY - minY || 1;
  const scaleX = containerBounds.width / drawingW;
  const scaleY = containerBounds.height / drawingH;

  return drawingShapes.map((ds, index) => {
    const fill =
      ds.fillColor ??
      (colorTransformFills && colorTransformFills.length > 0
        ? colorTransformFills[index % colorTransformFills.length]
        : DEFAULT_ACCENT_COLORS[index % DEFAULT_ACCENT_COLORS.length]);

    return makeShapeElement(
      nextId("sa-draw"),
      containerBounds.x + (ds.x - minX) * scaleX,
      containerBounds.y + (ds.y - minY) * scaleY,
      ds.width * scaleX,
      ds.height * scaleY,
      ds.shapeType ?? "rect",
      fill,
      ds.text ?? "",
      {
        rotation: ds.rotation,
        strokeColor: ds.strokeColor,
        strokeWidth:
          ds.strokeWidth !== undefined
            ? ds.strokeWidth * strokeScale
            : undefined,
        fontSize: ds.fontSize,
        fontColor: ds.fontColor ?? "#FFFFFF",
      },
    );
  });
}

// ── Main decomposition entry point ──────────────────────────────────────

/**
 * Decompose a SmartArt data model into an array of standard PptxElements.
 *
 * @param smartArtData Parsed SmartArt data model from the PptxHandler.
 * @param containerBounds The bounding box of the SmartArt graphic frame on the slide.
 * @param themeColorMap Optional theme colour map (accent1-accent6 keys) for colour cycling.
 * @param layoutDef Optional parsed layout definition for constraint-driven layout engine.
 * @returns An array of PptxElements (shapes + connectors), or `undefined` when decomposition is not possible.
 */
export function decomposeSmartArt(
  smartArtData: PptxSmartArtData,
  containerBounds: DrawingBounds,
  themeColorMap?: Record<string, string>,
  layoutDef?: ParsedLayoutDef,
): PptxElement[] | undefined {
  const nodes = smartArtData.nodes;
  if (!nodes || nodes.length === 0) return undefined;

  // Prefer pre-computed drawing shapes when available — these reflect
  // PowerPoint's actual layout engine output and are the most accurate.
  if (smartArtData.drawingShapes && smartArtData.drawingShapes.length > 0) {
    const colorFills = smartArtData.colorTransform?.fillColors;
    return convertDrawingShapes(
      smartArtData.drawingShapes,
      containerBounds,
      colorFills,
      smartArtData.quickStyle,
    );
  }

  // When a parsed layout definition is available, use the constraint-driven
  // layout engine for more accurate positioning.
  if (layoutDef) {
    const engineShapes = computeSmartArtLayout(
      smartArtData,
      containerBounds,
      layoutDef,
    );
    if (engineShapes && engineShapes.length > 0) {
      const layoutType: SmartArtLayoutType =
        smartArtData.resolvedLayoutType ??
        resolveLayoutFromRawType(smartArtData.layoutType);
      const drawingShapes = layoutEngineShapesToDrawingShapes(
        engineShapes,
        nodes,
        layoutType,
      );
      const colorFills = smartArtData.colorTransform?.fillColors;
      return convertDrawingShapes(
        drawingShapes,
        containerBounds,
        colorFills,
        smartArtData.quickStyle,
      );
    }
  }

  // Apply colour-transform fill colours to the theme map when available
  const effectiveThemeMap = buildEffectiveThemeMap(
    themeColorMap,
    smartArtData.colorTransform?.fillColors,
  );

  const layoutType: SmartArtLayoutType =
    smartArtData.resolvedLayoutType ??
    resolveLayoutFromRawType(smartArtData.layoutType);

  switch (layoutType) {
    case "list":
      return layoutList(nodes, containerBounds, effectiveThemeMap);
    case "process":
      return layoutProcess(nodes, containerBounds, effectiveThemeMap);
    case "cycle":
      return layoutCycle(nodes, containerBounds, effectiveThemeMap);
    case "hierarchy":
      return layoutHierarchy(nodes, containerBounds, effectiveThemeMap);
    case "relationship":
      return layoutRelationship(nodes, containerBounds, effectiveThemeMap);
    case "matrix":
      return layoutMatrix(nodes, containerBounds, effectiveThemeMap);
    case "pyramid":
      return layoutPyramid(nodes, containerBounds, effectiveThemeMap);
    default:
      // For unknown layouts, try a sensible default based on structure
      return layoutWithHeuristic(nodes, containerBounds, effectiveThemeMap);
  }
}

// ── Internal helpers ────────────────────────────────────────────────────

/**
 * Build an effective theme colour map by overlaying color-transform fills
 * onto the accent1-accent6 theme keys.
 */
function buildEffectiveThemeMap(
  themeColorMap?: Record<string, string>,
  colorTransformFills?: string[],
): Record<string, string> | undefined {
  if (!colorTransformFills || colorTransformFills.length === 0) {
    return themeColorMap;
  }
  const merged: Record<string, string> = { ...(themeColorMap ?? {}) };
  for (let i = 0; i < colorTransformFills.length && i < 6; i++) {
    merged[`accent${i + 1}`] = colorTransformFills[i];
  }
  return merged;
}

/**
 * Heuristic layout choice when the layout type is unknown.
 *
 * Looks at the node structure to pick the most appropriate algorithm.
 */
function layoutWithHeuristic(
  nodes: PptxSmartArtNode[],
  bounds: DrawingBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] | undefined {
  const contentNodes = getContentNodes(nodes);
  if (contentNodes.length === 0) return undefined;

  // If any node has children, use hierarchy
  const hasChildren = contentNodes.some((n) => (n.children?.length ?? 0) > 0);
  if (hasChildren) {
    return layoutHierarchy(contentNodes, bounds, themeColorMap);
  }

  // Small number of nodes → list, larger → process
  if (contentNodes.length <= 4) {
    return layoutList(contentNodes, bounds, themeColorMap);
  }
  return layoutProcess(contentNodes, bounds, themeColorMap);
}

/**
 * Resolve a raw layout type string to a SmartArtLayoutType.
 * This mirrors the logic in PptxHandler.resolveSmartArtLayoutType but
 * is available without a PptxHandler instance.
 */
function resolveLayoutFromRawType(
  layoutType: string | undefined,
): SmartArtLayoutType {
  if (!layoutType) return "unknown";
  const lower = layoutType.toLowerCase();

  if (lower.includes("hierarchy") || lower.includes("org")) return "hierarchy";
  if (lower.includes("cycle") || lower.includes("radial")) return "cycle";
  if (
    lower.includes("process") ||
    lower.includes("chevron") ||
    lower.includes("arrow")
  )
    return "process";
  if (lower.includes("venn")) return "relationship";
  if (lower.includes("matrix")) return "matrix";
  if (lower.includes("pyramid")) return "pyramid";
  if (lower.includes("list") || lower.includes("block")) return "list";
  if (lower.includes("relationship")) return "relationship";

  return "unknown";
}
