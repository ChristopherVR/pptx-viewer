import React from "react";

import type { PptxElement } from "pptx-viewer-core";
import {
  resolvePalette,
  resolveStyle,
  layoutToCategory,
  withChrome,
} from "./smartart-helpers";
import { renderDrawingShapes } from "./smartart-drawing";
import { renderBlockList } from "./smartart-list";
import { renderProcess } from "./smartart-process";
import { renderCycle } from "./smartart-cycle";
import { renderHierarchy } from "./smartart-hierarchy";
import {
  renderMatrix,
  renderPyramid,
  renderVenn,
  renderFunnel,
  renderTarget,
} from "./smartart-shapes";
import { renderGear } from "./smartart-gear";
import { renderTimeline, renderBendingProcess } from "./smartart-misc";

/**
 * Main entry point for SmartArt rendering.
 * Dispatches to the appropriate layout renderer.
 */
export function renderSmartArtElement(element: PptxElement): React.ReactNode {
  if (element.type !== "smartArt" || !element.smartArtData) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
        SmartArt
      </div>
    );
  }

  const nodes = element.smartArtData.nodes;
  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
        SmartArt
      </div>
    );
  }

  const palette = resolvePalette(element);
  const style = resolveStyle(element);
  const chrome = element.smartArtData.chrome;

  // Prefer pre-computed drawing shapes when available
  const drawingShapes = element.smartArtData.drawingShapes;
  if (drawingShapes && drawingShapes.length > 0) {
    return withChrome(
      chrome,
      renderDrawingShapes(element, drawingShapes, style, palette),
    );
  }

  // Determine the layout category
  const namedLayout = element.smartArtData.layout;
  const layoutType = namedLayout
    ? layoutToCategory(namedLayout)
    : (element.smartArtData.layoutType ?? "list").toLowerCase();

  // ── Cycle / Radial
  if (layoutType.includes("cycle") || layoutType.includes("radial")) {
    return withChrome(chrome, renderCycle(element, nodes, palette, style));
  }

  // ── Hierarchy / Org chart
  if (layoutType.includes("hierarchy") || layoutType.includes("org")) {
    return withChrome(chrome, renderHierarchy(element, nodes, palette, style));
  }

  // ── Matrix
  if (layoutType.includes("matrix")) {
    return withChrome(chrome, renderMatrix(element, nodes, palette, style));
  }

  // ── Pyramid
  if (layoutType.includes("pyramid")) {
    return withChrome(chrome, renderPyramid(element, nodes, palette, style));
  }

  // ── Process / Chevron
  if (
    layoutType.includes("process") ||
    layoutType.includes("chevron") ||
    layoutType.includes("arrow")
  ) {
    return withChrome(chrome, renderProcess(element, nodes, palette, style));
  }

  // ── Venn
  if (layoutType.includes("venn")) {
    return withChrome(chrome, renderVenn(element, nodes, palette, style));
  }

  // ── Funnel
  if (layoutType.includes("funnel")) {
    return withChrome(chrome, renderFunnel(element, nodes, palette, style));
  }

  // ── Target / Bullseye
  if (layoutType.includes("target") || layoutType.includes("bullseye")) {
    return withChrome(chrome, renderTarget(element, nodes, palette, style));
  }

  // ── Gear
  if (layoutType.includes("gear")) {
    return withChrome(chrome, renderGear(element, nodes, palette, style));
  }

  // ── Timeline / Linear
  if (layoutType.includes("timeline") || layoutType.includes("linear")) {
    return withChrome(chrome, renderTimeline(element, nodes, palette, style));
  }

  // ── Bending / Snake
  if (layoutType.includes("bending") || layoutType.includes("snake")) {
    return withChrome(
      chrome,
      renderBendingProcess(element, nodes, palette, style),
    );
  }

  // ── Default list layout
  return withChrome(chrome, renderBlockList(element, nodes, palette, style));
}
