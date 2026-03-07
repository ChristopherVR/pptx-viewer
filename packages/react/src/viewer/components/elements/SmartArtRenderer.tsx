import React from "react";

import type {
  PptxElement,
  PptxSmartArtNode,
} from "pptx-viewer-core";

/**
 * SmartArtRenderer — Phase 1 Basic Implementation
 *
 * Renders SmartArt diagrams from parsed node data with simple layout algorithms.
 *
 * Phase 1 Scope:
 * - Basic node rendering (boxes with text)
 * - Simple layout: horizontal row, vertical column, or grid
 * - Basic color cycling from palette
 * - No complex layout algorithms (defer to Phase 2)
 *
 * Phase 2+ (Future):
 * - Full layout algorithm implementation (constraints, rules)
 * - Advanced styling (3D effects, shadows, gradients)
 * - Interactive editing (text editing, add/remove nodes)
 * - Color and style pickers
 */

interface SmartArtRendererProps {
  /** The SmartArt element to render */
  element: PptxElement;
  /** Optional className for styling */
  className?: string;
}

// ── Color Palettes ───────────────────────────────────────────────────────────

const DEFAULT_PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#eab308",
  "#a855f7",
  "#ec4899",
];

/**
 * SmartArt basic renderer component.
 *
 * Renders SmartArt nodes in a simple layout based on the detected layout type.
 */
export function SmartArtRenderer({
  element,
  className = "",
}: SmartArtRendererProps): React.ReactElement {
  // Validate element type
  if (element.type !== "smartArt" || !element.smartArtData) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center text-sm text-gray-400 ${className}`}
      >
        SmartArt (No Data)
      </div>
    );
  }

  const { nodes, resolvedLayoutType } = element.smartArtData;

  if (nodes.length === 0) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center text-sm text-gray-400 ${className}`}
      >
        SmartArt (Empty)
      </div>
    );
  }

  // Phase 1: Simple layout dispatch based on category
  const layoutType = resolvedLayoutType || "list";

  return (
    <div className={`w-full h-full ${className}`}>
      {layoutType === "hierarchy" && <HierarchyLayout nodes={nodes} />}
      {layoutType === "process" && <ProcessLayout nodes={nodes} />}
      {layoutType === "cycle" && <CycleLayout nodes={nodes} />}
      {layoutType === "matrix" && <MatrixLayout nodes={nodes} />}
      {layoutType === "pyramid" && <PyramidLayout nodes={nodes} />}
      {layoutType === "list" && <ListLayout nodes={nodes} />}
      {!["hierarchy", "process", "cycle", "matrix", "pyramid", "list"].includes(
        layoutType,
      ) && <ListLayout nodes={nodes} />}
    </div>
  );
}

// ── Phase 1 Layout Implementations ───────────────────────────────────────────
// These are intentionally simple for Phase 1 — just get nodes rendering!

interface LayoutProps {
  nodes: PptxSmartArtNode[];
}

/**
 * Hierarchy layout (org chart style).
 * Phase 1: Render as vertical tree with simple positioning.
 */
function HierarchyLayout({ nodes }: LayoutProps): React.ReactElement {
  // Build simple tree structure
  const roots = nodes.filter((n) => !n.parentId);
  const children = nodes.filter((n) => n.parentId);

  return (
    <div className="w-full h-full flex flex-col items-center justify-start gap-4 p-4 overflow-hidden">
      {/* Root nodes */}
      {roots.map((node, index) => (
        <div key={node.id} className="flex flex-col items-center gap-2">
          <NodeBox node={node} index={index} />
          {/* Children */}
          <div className="flex flex-row gap-2">
            {children
              .filter((c) => c.parentId === node.id)
              .map((child, childIndex) => (
                <NodeBox
                  key={child.id}
                  node={child}
                  index={childIndex + roots.length}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Process layout (horizontal flow).
 * Phase 1: Render as horizontal row of boxes.
 */
function ProcessLayout({ nodes }: LayoutProps): React.ReactElement {
  return (
    <div className="w-full h-full flex flex-row items-center justify-center gap-3 p-4 overflow-hidden">
      {nodes.map((node, index) => (
        <React.Fragment key={node.id}>
          <NodeBox node={node} index={index} />
          {index < nodes.length - 1 && <ArrowRight className="flex-shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Cycle layout (circular arrangement).
 * Phase 1: Render as circular arrangement of boxes.
 */
function CycleLayout({ nodes }: LayoutProps): React.ReactElement {
  const angleStep = (2 * Math.PI) / nodes.length;

  return (
    <div className="w-full h-full relative p-8">
      {nodes.map((node, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const radius = 35; // Percentage
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);

        return (
          <div
            key={node.id}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <NodeBox node={node} index={index} size="compact" />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Matrix layout (grid arrangement).
 * Phase 1: Render as 2×2 or 3×3 grid.
 */
function MatrixLayout({ nodes }: LayoutProps): React.ReactElement {
  const cols = Math.ceil(Math.sqrt(nodes.length));

  return (
    <div className="w-full h-full p-4">
      <div
        className="grid gap-3 h-full"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {nodes.map((node, index) => (
          <NodeBox key={node.id} node={node} index={index} />
        ))}
      </div>
    </div>
  );
}

/**
 * Pyramid layout (stacked levels).
 * Phase 1: Render as centered stacked rows.
 */
function PyramidLayout({ nodes }: LayoutProps): React.ReactElement {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
      {nodes.map((node, index) => (
        <NodeBox
          key={node.id}
          node={node}
          index={index}
          style={{
            width: `${100 - index * (80 / nodes.length)}%`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * List layout (vertical list).
 * Phase 1: Render as simple vertical list of boxes.
 */
function ListLayout({ nodes }: LayoutProps): React.ReactElement {
  return (
    <div className="w-full h-full flex flex-col items-stretch justify-center gap-2 p-4 overflow-auto">
      {nodes.map((node, index) => (
        <NodeBox key={node.id} node={node} index={index} />
      ))}
    </div>
  );
}

// ── Node Rendering Components ─────────────────────────────────────────────────

interface NodeBoxProps {
  node: PptxSmartArtNode;
  index: number;
  size?: "normal" | "compact";
  style?: React.CSSProperties;
}

/**
 * Basic node box component.
 * Phase 1: Simple colored box with text.
 */
function NodeBox({
  node,
  index,
  size = "normal",
  style = {},
}: NodeBoxProps): React.ReactElement {
  const color = DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];

  const sizeClasses =
    size === "compact"
      ? "px-3 py-2 text-xs min-w-[80px]"
      : "px-4 py-3 text-sm min-w-[120px]";

  return (
    <div
      className={`${sizeClasses} rounded-lg flex items-center justify-center text-center text-white font-medium shadow-md`}
      style={{
        backgroundColor: color,
        ...style,
      }}
    >
      <span className="truncate">{truncateText(node.text, 30)}</span>
    </div>
  );
}

/**
 * Simple arrow connector for process layouts.
 */
function ArrowRight({
  className = "",
}: {
  className?: string;
}): React.ReactElement {
  return (
    <svg
      className={`w-6 h-6 text-gray-400 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Truncate text to max length with ellipsis.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}
