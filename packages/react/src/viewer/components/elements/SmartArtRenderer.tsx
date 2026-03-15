import React from "react";

import type {
  PptxElement,
  PptxSmartArtNode,
  PptxSmartArtDrawingShape,
  PptxSmartArtChrome,
  SmartArtStyle,
} from "pptx-viewer-core";
import {
  resolvePalette,
  resolveStyle,
  colour,
  nodeOpacity,
  styleShadow,
  styleStroke,
  truncate,
  buildTree,
  treeWidth,
  treeDepth,
  layoutToCategory,
  type TreeNode,
} from "../../utils/smartart-helpers";
import {
  renderStepDownProcess,
  renderAlternatingFlow,
  renderDescendingProcess,
  renderPictureAccentList,
  renderVerticalBlockList,
  renderGroupedList,
  renderPyramidList,
  renderHorizontalPictureList,
  renderAccentProcess,
  renderVerticalChevronList,
} from "../../utils/smartart-layouts-extra";

/**
 * SmartArtRenderer — Phase 2 Implementation
 *
 * Renders SmartArt diagrams with proper positioned shapes, styling,
 * connector lines between nodes, and layout-specific shape rendering.
 *
 * Features:
 * - Pre-computed drawing shape rendering (from PowerPoint's layout engine)
 * - Proper SVG-based rendering for all layout categories
 * - Connector lines between parent-child nodes in hierarchy layouts
 * - Chevron/arrow shapes for process layouts
 * - Concentric rings for cycle/radial layouts
 * - Pyramid trapezoids for pyramid layouts
 * - Rounded rectangles with shadows for professional appearance
 * - Text scaled to fit within each node
 * - Chrome wrapper for background/outline styling
 * - Support for all layout categories: list, process, cycle, hierarchy,
 *   relationship, matrix, pyramid, funnel, target, gear, timeline, venn
 */

interface SmartArtRendererProps {
  /** The SmartArt element to render */
  element: PptxElement;
  /** Optional className for styling */
  className?: string;
}

/**
 * Phase 2 SmartArt renderer component.
 *
 * Renders SmartArt nodes using SVG with proper positioning, styling,
 * and connector lines based on the layout type.
 */
export function SmartArtRenderer({
  element,
  className = "",
}: SmartArtRendererProps): React.ReactElement {
  if (element.type !== "smartArt" || !element.smartArtData) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none ${className}`}
      >
        SmartArt
      </div>
    );
  }

  const { nodes, drawingShapes, chrome } = element.smartArtData;

  if (nodes.length === 0) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none ${className}`}
      >
        SmartArt
      </div>
    );
  }

  const palette = resolvePalette(element);
  const style = resolveStyle(element);

  // Prefer pre-computed drawing shapes when available — these reflect
  // PowerPoint's actual layout engine output and are the most accurate.
  if (drawingShapes && drawingShapes.length > 0) {
    return wrapChrome(
      chrome,
      <DrawingShapeRenderer
        elementId={element.id}
        shapes={drawingShapes}
        style={style}
        palette={palette}
      />,
      className,
    );
  }

  // Determine the layout category for algorithmic rendering
  const namedLayout = element.smartArtData.layout;
  const layoutType = namedLayout
    ? layoutToCategory(namedLayout)
    : (element.smartArtData.resolvedLayoutType ??
      element.smartArtData.layoutType ??
      "list"
    ).toLowerCase();

  const content = renderLayout(
    layoutType,
    element,
    nodes,
    palette,
    style,
  );

  return wrapChrome(chrome, content, className);
}

// ── Chrome wrapper ──────────────────────────────────────────────────────────

function wrapChrome(
  chrome: PptxSmartArtChrome | undefined,
  content: React.ReactElement,
  className: string,
): React.ReactElement {
  const wrapperStyle: React.CSSProperties = {};
  if (chrome?.backgroundColor) {
    wrapperStyle.backgroundColor = chrome.backgroundColor;
  }
  if (chrome?.outlineColor) {
    wrapperStyle.border = `${chrome.outlineWidth ?? 1}px solid ${chrome.outlineColor}`;
  }

  return (
    <div
      className={`w-full h-full ${className}`}
      style={wrapperStyle}
    >
      {content}
    </div>
  );
}

// ── Layout dispatch ─────────────────────────────────────────────────────────

function renderLayout(
  layoutType: string,
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactElement {
  if (layoutType.includes("hierarchy") || layoutType.includes("org")) {
    return (
      <HierarchyRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("process") || layoutType.includes("chevron") || layoutType.includes("arrow")) {
    return (
      <ProcessRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("cycle") || layoutType.includes("radial")) {
    return (
      <CycleRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("matrix")) {
    return (
      <MatrixRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("pyramid")) {
    return (
      <PyramidRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("venn")) {
    return (
      <VennRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("funnel")) {
    return (
      <FunnelRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("target") || layoutType.includes("bullseye")) {
    return (
      <TargetRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("gear")) {
    return (
      <GearRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("timeline") || layoutType.includes("linear")) {
    return (
      <TimelineRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  if (layoutType.includes("bending") || layoutType.includes("snake")) {
    return (
      <BendingProcessRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }
  // ── New layout types ──────────────────────────────────────────────────
  if (layoutType.includes("stepdown")) {
    return <>{renderStepDownProcess(element, nodes, palette, style)}</>;
  }
  if (layoutType.includes("alternatingflow") || layoutType.includes("alternating")) {
    return <>{renderAlternatingFlow(element, nodes, palette, style)}</>;
  }
  if (layoutType.includes("descending")) {
    return <>{renderDescendingProcess(element, nodes, palette, style)}</>;
  }
  if (layoutType.includes("pictureaccent")) {
    return <>{renderPictureAccentList(element, nodes, palette, style)}</>;
  }
  if (layoutType.includes("verticalblock")) {
    return <>{renderVerticalBlockList(element, nodes, palette, style)}</>;
  }
  if (layoutType.includes("grouped")) {
    return <>{renderGroupedList(element, nodes, palette, style)}</>;
  }
  if (layoutType.includes("pyramidlist")) {
    return <>{renderPyramidList(element, nodes, palette, style)}</>;
  }
  if (layoutType.includes("horizontalpicture")) {
    return <>{renderHorizontalPictureList(element, nodes, palette, style)}</>;
  }
  if (layoutType.includes("accentprocess")) {
    return <>{renderAccentProcess(element, nodes, palette, style)}</>;
  }
  if (layoutType.includes("verticalchevron")) {
    return <>{renderVerticalChevronList(element, nodes, palette, style)}</>;
  }
  // Default: list layout
  return (
    <ListRenderer
      element={element}
      nodes={nodes}
      palette={palette}
      style={style}
    />
  );
}

// ── Common types & utilities ────────────────────────────────────────────────

interface LayoutRendererProps {
  element: PptxElement;
  nodes: PptxSmartArtNode[];
  palette: string[];
  style: SmartArtStyle;
}

/** Compute font size that fits text within a given width. */
function fitFontSize(
  text: string,
  maxWidth: number,
  maxHeight: number,
  baseSize: number,
): number {
  // Approximate: each character is ~0.6x the font size in width
  const charWidthRatio = 0.6;
  const maxByWidth = maxWidth / (text.length * charWidthRatio);
  const maxByHeight = maxHeight * 0.5;
  return Math.max(6, Math.min(baseSize, maxByWidth, maxByHeight));
}

// ── Pre-computed Drawing Shape Renderer ─────────────────────────────────────

interface DrawingShapeRendererProps {
  elementId: string;
  shapes: PptxSmartArtDrawingShape[];
  style: SmartArtStyle;
  palette: string[];
}

function DrawingShapeRenderer({
  elementId,
  shapes,
  style,
  palette,
}: DrawingShapeRendererProps): React.ReactElement {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x + s.width > maxX) maxX = s.x + s.width;
    if (s.y + s.height > maxY) maxY = s.y + s.height;
  }

  const drawingW = maxX - minX || 1;
  const drawingH = maxY - minY || 1;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      viewBox={`0 0 ${drawingW} ${drawingH}`}
      className="w-full h-full pointer-events-none"
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-drawing-shapes"
    >
      {shapes.map((shape, i) => {
        const fill = shape.fillColor ?? colour(i, palette);
        const relX = shape.x - minX;
        const relY = shape.y - minY;
        const rx =
          shape.shapeType === "roundRect"
            ? Math.min(shape.width, shape.height) * 0.1
            : 0;
        const isEllipse = shape.shapeType === "ellipse";
        const isChevron = shape.shapeType === "chevron" || shape.shapeType === "homePlate";
        const rotation = shape.rotation
          ? `rotate(${shape.rotation} ${relX + shape.width / 2} ${relY + shape.height / 2})`
          : undefined;
        const strokeCol =
          shape.strokeColor ??
          (sw > 0 ? "rgba(255,255,255,0.3)" : "none");
        const strokeW = shape.strokeWidth ?? sw;
        const fontSize =
          shape.fontSize ??
          fitFontSize(
            shape.text ?? "",
            shape.width * 0.85,
            shape.height,
            14,
          );

        return (
          <g
            key={`${elementId}-dsp-${shape.id}-${i}`}
            style={{ filter: shadow }}
          >
            {isEllipse ? (
              <ellipse
                cx={relX + shape.width / 2}
                cy={relY + shape.height / 2}
                rx={shape.width / 2}
                ry={shape.height / 2}
                fill={fill}
                stroke={strokeCol}
                strokeWidth={strokeW}
                transform={rotation}
              />
            ) : isChevron ? (
              <polygon
                points={chevronPoints(relX, relY, shape.width, shape.height)}
                fill={fill}
                stroke={strokeCol}
                strokeWidth={strokeW}
                transform={rotation}
              />
            ) : (
              <rect
                x={relX}
                y={relY}
                width={shape.width}
                height={shape.height}
                rx={rx}
                fill={fill}
                stroke={strokeCol}
                strokeWidth={strokeW}
                transform={rotation}
              />
            )}
            {shape.text ? (
              <text
                x={relX + shape.width / 2}
                y={relY + shape.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={shape.fontColor ?? "white"}
                fontSize={fontSize}
                className="pointer-events-none"
              >
                {truncate(shape.text, 40)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Generate chevron polygon points for a given bounding box. */
function chevronPoints(
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const depth = Math.min(w * 0.2, h * 0.4);
  return [
    `${x},${y}`,
    `${x + w - depth},${y}`,
    `${x + w},${y + h / 2}`,
    `${x + w - depth},${y + h}`,
    `${x},${y + h}`,
    `${x + depth},${y + h / 2}`,
  ].join(" ");
}

// ── List Renderer ───────────────────────────────────────────────────────────

function ListRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 4;
  const usableH = h - pad * 2;
  const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const itemW = w - pad * 2;
  const rx = Math.min(6, itemH * 0.15);
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-list"
    >
      {nodes.map((node, i) => {
        const y = pad + i * (itemH + gap);
        const fontSize = fitFontSize(node.text, itemW * 0.9, itemH, 12);
        return (
          <g
            key={`${element.id}-list-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <rect
              x={pad}
              y={y}
              width={itemW}
              height={itemH}
              rx={rx}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={pad + itemW / 2}
              y={y + itemH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 40)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Process Renderer (Chevron) ──────────────────────────────────────────────

function ProcessRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 4;
  const chevronDepth = Math.min(16, w * 0.04);
  const usableW = w - pad * 2;
  const itemW = (usableW - gap * (nodes.length - 1)) / nodes.length;
  const itemH = Math.min(h - pad * 2, h * 0.6);
  const yMid = h / 2;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-process"
    >
      {nodes.map((node, i) => {
        const x = pad + i * (itemW + gap);
        const halfH = itemH / 2;
        const isFirst = i === 0;
        const isLast = i === nodes.length - 1;

        // Build chevron shape points
        const points = isFirst
          ? `${x},${yMid - halfH} ${x + itemW - chevronDepth},${yMid - halfH} ${x + itemW},${yMid} ${x + itemW - chevronDepth},${yMid + halfH} ${x},${yMid + halfH}`
          : isLast
            ? `${x},${yMid - halfH} ${x + itemW},${yMid - halfH} ${x + itemW},${yMid + halfH} ${x},${yMid + halfH} ${x + chevronDepth},${yMid}`
            : `${x},${yMid - halfH} ${x + itemW - chevronDepth},${yMid - halfH} ${x + itemW},${yMid} ${x + itemW - chevronDepth},${yMid + halfH} ${x},${yMid + halfH} ${x + chevronDepth},${yMid}`;

        const fontSize = fitFontSize(node.text, itemW * 0.7, itemH, 12);

        return (
          <g
            key={`${element.id}-process-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <polygon
              points={points}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={x + itemW / 2}
              y={yMid}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 25)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Cycle Renderer ──────────────────────────────────────────────────────────

function CycleRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const size = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const radius = size * 0.35;
  const nodeR = Math.max(size * 0.06, Math.min(size * 0.12, 200 / nodes.length));
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-cycle"
    >
      {/* Connector arc lines between consecutive nodes */}
      {nodes.map((_node, i) => {
        const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const nx = cx + radius * Math.cos(angle);
        const ny = cy + radius * Math.sin(angle);
        const nextI = (i + 1) % nodes.length;
        const nextAngle = (nextI / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const nextX = cx + radius * Math.cos(nextAngle);
        const nextY = cy + radius * Math.sin(nextAngle);

        // Draw curved connector arc
        const midAngle = (angle + nextAngle) / 2;
        // Handle wrap-around for last->first connector
        const adjustedMidAngle =
          i === nodes.length - 1
            ? (angle + nextAngle + Math.PI * 2) / 2
            : midAngle;
        const arcBulge = radius * 0.15;
        const controlX = cx + (radius + arcBulge) * Math.cos(adjustedMidAngle);
        const controlY = cy + (radius + arcBulge) * Math.sin(adjustedMidAngle);

        return (
          <path
            key={`${element.id}-cycle-conn-${i}`}
            d={`M${nx},${ny} Q${controlX},${controlY} ${nextX},${nextY}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.5}
            opacity={0.5}
            markerEnd={undefined}
          />
        );
      })}
      {/* Node circles */}
      {nodes.map((node, i) => {
        const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const nx = cx + radius * Math.cos(angle);
        const ny = cy + radius * Math.sin(angle);
        const fontSize = fitFontSize(node.text, nodeR * 1.4, nodeR * 2, 11);

        return (
          <g
            key={`${element.id}-cycle-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <circle
              cx={nx}
              cy={ny}
              r={nodeR}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={nx}
              y={ny}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Hierarchy Renderer ──────────────────────────────────────────────────────

function HierarchyRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const roots = buildTree(nodes);
  if (roots.length === 0) {
    // Fall back to flat list if tree parsing fails
    return (
      <ListRenderer
        element={element}
        nodes={nodes}
        palette={palette}
        style={style}
      />
    );
  }

  const totalLeaves = roots.reduce((s, r) => s + treeWidth(r), 0);
  const depth = Math.max(...roots.map(treeDepth));
  const svgW = element.width;
  const svgH = element.height;
  const cellW = svgW / totalLeaves;
  const cellH = svgH / Math.max(depth, 1);
  const boxW = Math.min(cellW * 0.8, 140);
  const boxH = Math.min(cellH * 0.4, 36);
  const rx = Math.min(6, boxH * 0.15);
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  const elements: React.ReactNode[] = [];
  let colourIdx = 0;

  function renderTreeNode(t: TreeNode, xOffset: number, level: number): number {
    const w = treeWidth(t);
    const nodeCx = (xOffset + w / 2) * cellW;
    const nodeCy = level * cellH + cellH / 2;
    const ci = colourIdx++;
    const fontSize = fitFontSize(t.node.text, boxW * 0.9, boxH, 11);

    // Draw connector lines to children first (so they appear behind boxes)
    for (const child of t.children) {
      const childW = treeWidth(child);
      let childOffset = xOffset;
      // Compute child's actual offset
      for (const c of t.children) {
        if (c === child) break;
        childOffset += treeWidth(c);
      }
      const childCx = (childOffset + childW / 2) * cellW;
      const childCy = (level + 1) * cellH + cellH / 2;

      // Draw an L-shaped connector: vertical down from parent, horizontal to child, vertical down to child
      const midY = nodeCy + boxH / 2 + (childCy - boxH / 2 - (nodeCy + boxH / 2)) / 2;
      elements.push(
        <path
          key={`${element.id}-hier-conn-${t.node.id}-${child.node.id}`}
          d={`M${nodeCx},${nodeCy + boxH / 2} L${nodeCx},${midY} L${childCx},${midY} L${childCx},${childCy - boxH / 2}`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.5}
          opacity={0.5}
        />,
      );
    }

    // Draw the box with rounded corners and shadow
    elements.push(
      <g
        key={`${element.id}-hier-group-${t.node.id}`}
        style={{ filter: shadow }}
      >
        <rect
          x={nodeCx - boxW / 2}
          y={nodeCy - boxH / 2}
          width={boxW}
          height={boxH}
          rx={rx}
          fill={colour(ci, palette)}
          opacity={nodeOpacity(ci, nodes.length, style)}
          stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
          strokeWidth={sw}
        />
        <text
          x={nodeCx}
          y={nodeCy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={fontSize}
          className="pointer-events-none"
        >
          {truncate(t.node.text, 40)}
        </text>
      </g>,
    );

    let childOffset = xOffset;
    for (const child of t.children) {
      renderTreeNode(child, childOffset, level + 1);
      childOffset += treeWidth(child);
    }
    return w;
  }

  let offset = 0;
  for (const root of roots) {
    offset += renderTreeNode(root, offset, 0);
  }

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-hierarchy"
    >
      {elements}
    </svg>
  );
}

// ── Matrix Renderer ─────────────────────────────────────────────────────────

function MatrixRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / cols);
  const pad = 8;
  const gap = 6;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const cellW = (usableW - gap * (cols - 1)) / cols;
  const cellH = (usableH - gap * (rows - 1)) / rows;
  const rx = Math.min(6, Math.min(cellW, cellH) * 0.1);
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-matrix"
    >
      {nodes.map((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = pad + col * (cellW + gap);
        const y = pad + row * (cellH + gap);
        const fontSize = fitFontSize(node.text, cellW * 0.85, cellH, 12);

        return (
          <g
            key={`${element.id}-matrix-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <rect
              x={x}
              y={y}
              width={cellW}
              height={cellH}
              rx={rx}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={x + cellW / 2}
              y={y + cellH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              fontWeight={500}
              className="pointer-events-none"
            >
              {truncate(node.text, 30)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Pyramid Renderer ────────────────────────────────────────────────────────

function PyramidRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 3;
  const usableH = h - pad * 2;
  const bandH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const maxW = w - pad * 2;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-pyramid"
    >
      {nodes.map((node, i) => {
        // Top band is narrowest, bottom is widest (pyramid shape)
        const topWidthFrac = 0.3 + (i / Math.max(nodes.length - 1, 1)) * 0.7;
        const bottomWidthFrac =
          i < nodes.length - 1
            ? 0.3 + ((i + 1) / Math.max(nodes.length - 1, 1)) * 0.7
            : 1.0;
        const topW = maxW * topWidthFrac;
        const bottomW = maxW * bottomWidthFrac;
        const y = pad + i * (bandH + gap);

        const topLeft = (w - topW) / 2;
        const topRight = topLeft + topW;
        const bottomLeft = (w - bottomW) / 2;
        const bottomRight = bottomLeft + bottomW;

        const points = [
          `${topLeft},${y}`,
          `${topRight},${y}`,
          `${bottomRight},${y + bandH}`,
          `${bottomLeft},${y + bandH}`,
        ].join(" ");

        const fontSize = fitFontSize(node.text, topW * 0.85, bandH, 12);

        return (
          <g
            key={`${element.id}-pyramid-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <polygon
              points={points}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={w / 2}
              y={y + bandH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 30)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Venn Renderer ───────────────────────────────────────────────────────────

function VennRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const shadow = styleShadow(style);

  if (nodes.length <= 4) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.28;
    const spread = r * 0.55;

    return (
      <svg
        className="w-full h-full pointer-events-none"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        data-testid="smartart-venn"
      >
        {nodes.map((node, i) => {
          const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          const nx = cx + spread * Math.cos(angle);
          const ny = cy + spread * Math.sin(angle);
          const fontSize = fitFontSize(node.text, r * 1.2, r * 2, 11);

          return (
            <g
              key={`${element.id}-venn-${node.id}-${i}`}
              style={{ filter: shadow }}
            >
              <circle
                cx={nx}
                cy={ny}
                r={r}
                fill={colour(i, palette)}
                opacity={0.35}
              />
              <text
                x={nx}
                y={ny}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={fontSize}
                fontWeight="bold"
                className="pointer-events-none"
              >
                {truncate(node.text, 20)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  // 5+ nodes: horizontal row of overlapping circles
  const r = Math.min(h * 0.38, w / (nodes.length * 0.9));
  const overlap = r * 0.5;
  const totalW = nodes.length * (r * 2 - overlap) + overlap;
  const offsetX = (w - totalW) / 2 + r;
  const cy = h / 2;

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-venn"
    >
      {nodes.map((node, i) => {
        const nx = offsetX + i * (r * 2 - overlap);
        const fontSize = fitFontSize(node.text, r * 1.2, r * 2, 10);

        return (
          <g
            key={`${element.id}-venn-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <circle cx={nx} cy={cy} r={r} fill={colour(i, palette)} opacity={0.35} />
            <text
              x={nx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              fontWeight="bold"
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Funnel Renderer ─────────────────────────────────────────────────────────

function FunnelRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const usableW = w - pad * 2;
  const stageH = (h - pad * 2) / nodes.length;
  const shadow = styleShadow(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-funnel"
    >
      {nodes.map((node, i) => {
        const topWidth = usableW * (1 - i / nodes.length);
        const bottomWidth = usableW * (1 - (i + 1) / nodes.length);
        const y = pad + i * stageH;

        const topLeft = (w - topWidth) / 2;
        const topRight = topLeft + topWidth;
        const bottomLeft = (w - bottomWidth) / 2;
        const bottomRight = bottomLeft + bottomWidth;

        const points = [
          `${topLeft},${y}`,
          `${topRight},${y}`,
          `${bottomRight},${y + stageH}`,
          `${bottomLeft},${y + stageH}`,
        ].join(" ");

        const fontSize = fitFontSize(node.text, topWidth * 0.85, stageH, 11);

        return (
          <g
            key={`${element.id}-funnel-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <polygon
              points={points}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <text
              x={w / 2}
              y={y + stageH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 30)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Target Renderer ─────────────────────────────────────────────────────────

function TargetRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const cx = w * 0.4;
  const cy = h / 2;
  const maxR = Math.min(cx - 8, cy - 8);
  const fontSize = Math.max(7, Math.min(10, maxR / (nodes.length + 1)));
  const labelX = cx + maxR + 8;
  const shadow = styleShadow(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-target"
    >
      {nodes.map((node, i) => {
        const r = maxR * ((nodes.length - i) / nodes.length);
        return (
          <g
            key={`${element.id}-target-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={Math.max(r, 4)}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <line
              x1={cx + Math.max(r, 4)}
              y1={cy}
              x2={labelX - 2}
              y2={8 + i * (fontSize + 6)}
              stroke={colour(i, palette)}
              strokeWidth={1}
              opacity={0.6}
            />
            <text
              x={labelX}
              y={8 + i * (fontSize + 6) + fontSize / 2}
              textAnchor="start"
              dominantBaseline="central"
              fill={colour(i, palette)}
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 30)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Gear Renderer ───────────────────────────────────────────────────────────

/** Generate SVG path for gear shape with teeth. */
function gearPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  teeth: number,
): string {
  const segments: string[] = [];
  const step = (Math.PI * 2) / (teeth * 2);

  for (let i = 0; i < teeth * 2; i++) {
    const angle = i * step - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    segments.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
  }
  segments.push("Z");
  return segments.join(" ");
}

function GearRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const gearNodes = nodes.slice(0, 3);
  const extraNodes = nodes.slice(3);
  const gearCount = gearNodes.length;
  const gearAreaW = extraNodes.length > 0 ? w * 0.7 : w;
  const spacing = gearAreaW / (gearCount + 1);
  const gearR = Math.min(spacing * 0.4, h * 0.35);
  const innerR = gearR * 0.7;
  const teethCount = 8;
  const shadow = styleShadow(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-gear"
    >
      {gearNodes.map((node, i) => {
        const gx = spacing * (i + 1);
        const gy = h / 2 + (i % 2 === 0 ? 0 : gearR * 0.35);
        const fontSize = fitFontSize(node.text, innerR * 1.2, innerR * 2, 11);

        return (
          <g
            key={`${element.id}-gear-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <path
              d={gearPath(gx, gy, gearR, innerR, teethCount)}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <circle cx={gx} cy={gy} r={innerR * 0.5} fill="white" opacity={0.25} />
            <text
              x={gx}
              y={gy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              fontWeight="bold"
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
          </g>
        );
      })}
      {extraNodes.map((node, i) => {
        const lx = gearAreaW + 10;
        const ly = 14 + i * 18;
        return (
          <g key={`${element.id}-gear-extra-${node.id}-${i}`}>
            <circle
              cx={lx}
              cy={ly}
              r={3}
              fill={colour(gearCount + i, palette)}
              opacity={nodeOpacity(gearCount + i, nodes.length, style)}
            />
            <text
              x={lx + 8}
              y={ly}
              textAnchor="start"
              dominantBaseline="central"
              fill={colour(gearCount + i, palette)}
              fontSize={10}
              className="pointer-events-none"
            >
              {truncate(node.text, 30)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Timeline Renderer ───────────────────────────────────────────────────────

function TimelineRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const w = element.width;
  const h = element.height;
  const padX = 24;
  const lineY = h / 2;
  const lineStartX = padX;
  const lineEndX = w - padX;
  const lineLen = lineEndX - lineStartX;
  const dotR = Math.max(4, Math.min(8, lineLen / (nodes.length * 4)));
  const labelOffset = Math.min(h * 0.28, 40);
  const shadow = styleShadow(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-timeline"
    >
      {/* Main timeline axis */}
      <line
        x1={lineStartX}
        y1={lineY}
        x2={lineEndX}
        y2={lineY}
        stroke="#94a3b8"
        strokeWidth={2}
      />
      {/* Arrow at end */}
      <polygon
        points={`${lineEndX - 6},${lineY - 4} ${lineEndX},${lineY} ${lineEndX - 6},${lineY + 4}`}
        fill="#94a3b8"
      />
      {nodes.map((node, i) => {
        const x =
          nodes.length === 1
            ? (lineStartX + lineEndX) / 2
            : lineStartX + (i / (nodes.length - 1)) * lineLen;
        const above = i % 2 === 0;
        const textY = above ? lineY - labelOffset : lineY + labelOffset;
        const stemEndY = above ? lineY - dotR - 2 : lineY + dotR + 2;
        const fontSize = fitFontSize(node.text, lineLen / nodes.length * 0.9, labelOffset, 10);

        return (
          <g
            key={`${element.id}-timeline-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            <line
              x1={x}
              y1={stemEndY}
              x2={x}
              y2={textY + (above ? fontSize : -fontSize)}
              stroke={colour(i, palette)}
              strokeWidth={1}
              opacity={0.5}
            />
            <circle
              cx={x}
              cy={lineY}
              r={dotR}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <text
              x={x}
              y={textY}
              textAnchor="middle"
              dominantBaseline={above ? "auto" : "hanging"}
              fill={colour(i, palette)}
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Bending Process (Snake) Renderer ────────────────────────────────────────

function BendingProcessRenderer({
  element,
  nodes,
  palette,
  style,
}: LayoutRendererProps): React.ReactElement {
  const COLS = 4;
  const w = element.width;
  const h = element.height;
  const rowsCount = Math.ceil(nodes.length / COLS);
  const padX = 8;
  const padY = 8;
  const cellW = (w - padX * 2) / COLS;
  const cellH = (h - padY * 2) / Math.max(rowsCount, 1);
  const boxW = cellW * 0.8;
  const boxH = Math.min(cellH * 0.6, 32);
  const rx = Math.min(5, boxH * 0.15);
  const arrowSize = 6;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="smartart-bending"
    >
      {nodes.map((node, i) => {
        const row = Math.floor(i / COLS);
        const colInRow = i % COLS;
        const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;

        const nodeCx = padX + col * cellW + cellW / 2;
        const nodeCy = padY + row * cellH + cellH / 2;
        const fontSize = fitFontSize(node.text, boxW * 0.85, boxH, 10);

        let arrow: React.ReactNode = null;
        if (i < nodes.length - 1) {
          const nextRow = Math.floor((i + 1) / COLS);
          const nextColInRow = (i + 1) % COLS;
          const nextCol =
            nextRow % 2 === 0 ? nextColInRow : COLS - 1 - nextColInRow;
          const nextCx = padX + nextCol * cellW + cellW / 2;
          const nextCy = padY + nextRow * cellH + cellH / 2;

          if (nextRow === row) {
            const dir = nextCx > nodeCx ? 1 : -1;
            const startX = nodeCx + dir * (boxW / 2 + 2);
            const endX = nextCx - dir * (boxW / 2 + 2);
            arrow = (
              <g key={`${element.id}-snake-arrow-${i}`}>
                <line
                  x1={startX}
                  y1={nodeCy}
                  x2={endX}
                  y2={nodeCy}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
                <polygon
                  points={`${endX},${nodeCy - arrowSize / 2} ${endX + dir * arrowSize},${nodeCy} ${endX},${nodeCy + arrowSize / 2}`}
                  fill="#94a3b8"
                />
              </g>
            );
          } else {
            const startY = nodeCy + boxH / 2 + 2;
            const endY = nextCy - boxH / 2 - 2;
            arrow = (
              <g key={`${element.id}-snake-arrow-${i}`}>
                <line
                  x1={nodeCx}
                  y1={startY}
                  x2={nextCx}
                  y2={endY}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
                <polygon
                  points={`${nextCx - arrowSize / 2},${endY} ${nextCx},${endY + arrowSize} ${nextCx + arrowSize / 2},${endY}`}
                  fill="#94a3b8"
                />
              </g>
            );
          }
        }

        return (
          <g
            key={`${element.id}-snake-${node.id}-${i}`}
            style={{ filter: shadow }}
          >
            {arrow}
            <rect
              x={nodeCx - boxW / 2}
              y={nodeCy - boxH / 2}
              width={boxW}
              height={boxH}
              rx={rx}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={nodeCx}
              y={nodeCy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Exported test utilities ─────────────────────────────────────────────────

/** @internal Exposed for testing */
export { fitFontSize, chevronPoints };
