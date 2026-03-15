import type {
  ContentPartPptxElement,
  InkPptxElement,
  OlePptxElement,
  OleObjectType,
  PptxElement,
} from "pptx-viewer-core";
import { DEFAULT_TEXT_COLOR, MIN_ELEMENT_SIZE } from "../../constants";
import {
  getElementTransform,
  getCropShapeClipPath,
  getImageRenderStyle,
  getImageTilingStyle,
  getShapeVisualStyle,
  getTextStyleForElement,
  isEditableTextElement,
  isImageTiled,
  renderTextSegments,
  renderVectorShape,
} from "../../utils";
import {
  extractPathPoints,
  generatePressureCircles,
  hasPressureVariation,
  pressuresToWidths,
  getInkReplayStyles,
  getContentPartReplayStyles,
  resolveInkColor,
  resolveInkWidth,
  resolveInkOpacity,
  INK_REPLAY_KEYFRAMES,
  type InkReplayConfig,
} from "../../utils/ink-rendering";
import { shapeParams } from "../ElementRenderer";

/**
 * Options for ink rendering.
 */
export interface InkRenderOptions {
  /** When true, animate strokes sequentially (ink replay). */
  replay?: boolean;
  /** Configuration for replay animation timing. */
  replayConfig?: InkReplayConfig;
  /** When true, render pressure-sensitive variable-width strokes. */
  pressureSensitive?: boolean;
}

/**
 * Render pressure-sensitive circles for a single ink stroke.
 * This produces a series of SVG `<circle>` elements with varying radii
 * to simulate pressure variation along the stroke.
 */
function renderPressureStroke(
  pathD: string,
  widths: number[],
  baseWidth: number,
  color: string,
  opacity: number,
  keyPrefix: string,
) {
  const points = extractPathPoints(pathD);
  const circles = generatePressureCircles(points, widths, {
    baseWidth,
    minRadius: 0.5,
    maxRadius: baseWidth * 1.5,
  });

  return (
    <g opacity={opacity}>
      {circles.map((c, j) => (
        <circle
          key={`${keyPrefix}-pc-${j}`}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill={color}
        />
      ))}
    </g>
  );
}

export function renderInk(el: InkPptxElement, options?: InkRenderOptions) {
  const replay = options?.replay ?? false;
  // Enable pressure-sensitive rendering by default when the element has
  // per-point pressure data with actual variation, or legacy per-point
  // width data with variation.
  const hasPointPressures =
    Boolean(el.inkPointPressures) && el.inkPointPressures!.length > 0;
  const hasLegacyPressure =
    Boolean(el.inkWidths) &&
    el.inkWidths!.length > 1 &&
    hasPressureVariation(el.inkWidths!);
  const hasPressure = hasPointPressures || hasLegacyPressure;
  const pressureSensitive = options?.pressureSensitive ?? hasPressure;
  const replayStyles = replay ? getInkReplayStyles(el, options?.replayConfig) : null;

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${Math.max(el.width, 1)} ${Math.max(el.height, 1)}`}
      preserveAspectRatio="none"
    >
      {replay && <style>{INK_REPLAY_KEYFRAMES}</style>}
      {el.inkPaths.map((d, i) => {
        const color = resolveInkColor(el.inkColors, i);
        const width = resolveInkWidth(el.inkWidths, i);
        const opacity = resolveInkOpacity(el.inkOpacities, i);

        // Pressure-sensitive rendering using per-point pressure data.
        if (pressureSensitive) {
          // Prefer inkPointPressures (per-point pressure from stylus).
          const pointPressures = el.inkPointPressures?.[i];
          if (pointPressures && pointPressures.length > 1 && hasPressureVariation(pointPressures)) {
            const pointWidths = pressuresToWidths(pointPressures, width);
            return (
              <g key={`${el.id}-ink-${i}`}>
                {renderPressureStroke(
                  d,
                  pointWidths,
                  width,
                  color,
                  opacity,
                  `${el.id}-ink-${i}`,
                )}
              </g>
            );
          }

          // Legacy fallback: use inkWidths array as per-point widths
          // (when it has more entries than paths and shows variation).
          if (
            el.inkWidths &&
            el.inkWidths.length > 1 &&
            hasPressureVariation(el.inkWidths)
          ) {
            return (
              <g key={`${el.id}-ink-${i}`}>
                {renderPressureStroke(
                  d,
                  el.inkWidths,
                  width,
                  color,
                  opacity,
                  `${el.id}-ink-${i}`,
                )}
              </g>
            );
          }
        }

        // Standard or replay-animated path rendering.
        const replayStyle = replayStyles?.[i];
        return (
          <path
            key={`${el.id}-ink-${i}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeOpacity={opacity}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            {...(replayStyle
              ? {
                  strokeDasharray: replayStyle.strokeDasharray,
                  strokeDashoffset: replayStyle.strokeDashoffset,
                  style: {
                    animation: replayStyle.animation,
                    ["--ink-path-length" as string]: replayStyle.pathLength,
                  },
                }
              : {})}
          />
        );
      })}
    </svg>
  );
}

export function renderGroup(children: PptxElement[]) {
  return (
    <div className="relative w-full h-full pointer-events-none">
      {children.map((c, childIndex) => {
        const { hf, fc, sw, sc } = shapeParams(c);
        const ss = getShapeVisualStyle(c, hf, fc, sw, sc);
        const vs = renderVectorShape(c, hf, fc, sw, sc);
        const ts = getTextStyleForElement(c, DEFAULT_TEXT_COLOR);
        const isTxt = isEditableTextElement(c);
        const isI = c.type === "picture" || c.type === "image";
        return (
          <div
            key={c.id}
            className="absolute"
            style={{
              left: c.x,
              top: c.y,
              width: Math.max(c.width, MIN_ELEMENT_SIZE),
              height: Math.max(c.height, MIN_ELEMENT_SIZE),
              transform: getElementTransform(c),
              transformOrigin: "center",
              overflow: isI ? "hidden" : undefined,
              clipPath: isI ? getCropShapeClipPath(c) : undefined,
              ...ss,
              // Explicit z-index preserves document order stacking within the
              // group: later children in the array (= later in p:grpSp XML)
              // render on top, matching PowerPoint's painter's algorithm.
              // Placed after ...ss to ensure it is never overwritten.
              zIndex: childIndex,
            }}
          >
            {isI &&
            (("svgData" in c && c.svgData) ||
              ("imageData" in c && c.imageData)) ? (
              isImageTiled(c) ? (
                <div
                  className="pointer-events-none select-none w-full h-full"
                  style={getImageTilingStyle(c)}
                />
              ) : (
                <img
                  src={
                    ("svgData" in c && c.svgData
                      ? c.svgData
                      : c.imageData) as string
                  }
                  alt="Group child"
                  className="pointer-events-none select-none"
                  style={getImageRenderStyle(c)}
                  draggable={false}
                />
              )
            ) : (
              <>
                {vs}
                {isTxt ? (
                  <div
                    className="relative z-10 w-full h-full pointer-events-none whitespace-pre-wrap break-words leading-[1.3]"
                    style={ts}
                  >
                    {renderTextSegments(c, DEFAULT_TEXT_COLOR)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function renderContentPart(
  el: ContentPartPptxElement,
  options?: InkRenderOptions,
) {
  if (el.inkStrokes && el.inkStrokes.length > 0) {
    const replay = options?.replay ?? false;
    const pressureSensitive = options?.pressureSensitive ?? true;
    const replayStyles = replay
      ? getContentPartReplayStyles(el.inkStrokes, options?.replayConfig)
      : null;

    return (
      <svg
        className="w-full h-full pointer-events-none"
        viewBox={`0 0 ${Math.max(el.width, 1)} ${Math.max(el.height, 1)}`}
        preserveAspectRatio="none"
      >
        {replay && <style>{INK_REPLAY_KEYFRAMES}</style>}
        {el.inkStrokes.map((stroke, i) => {
          // Pressure-sensitive rendering for content part strokes
          if (
            pressureSensitive &&
            stroke.pressures &&
            stroke.pressures.length > 1 &&
            hasPressureVariation(stroke.pressures)
          ) {
            const pointWidths = pressuresToWidths(
              stroke.pressures,
              stroke.width,
            );
            return (
              <g key={`${el.id}-cp-ink-${i}`}>
                {renderPressureStroke(
                  stroke.path,
                  pointWidths,
                  stroke.width,
                  stroke.color,
                  stroke.opacity,
                  `${el.id}-cp-ink-${i}`,
                )}
              </g>
            );
          }

          const replayStyle = replayStyles?.[i];
          return (
            <path
              key={`${el.id}-cp-ink-${i}`}
              d={stroke.path}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeOpacity={stroke.opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              {...(replayStyle
                ? {
                    strokeDasharray: replayStyle.strokeDasharray,
                    strokeDashoffset: replayStyle.strokeDashoffset,
                    style: {
                      animation: replayStyle.animation,
                      ["--ink-path-length" as string]: replayStyle.pathLength,
                    },
                  }
                : {})}
            />
          );
        })}
      </svg>
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
      Content Part
    </div>
  );
}

// ---------------------------------------------------------------------------
// OLE type resolution helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Resolved OLE type for rendering purposes. */
export type ResolvedOleType =
  | "excel"
  | "word"
  | "pdf"
  | "visio"
  | "mathtype"
  | "unknown";

/**
 * Resolve an OLE element's application type from its `oleObjectType` or by
 * heuristic matching against `oleProgId`.
 *
 * Returns a narrowed type suitable for choosing an icon and colour.
 */
export function resolveOleType(element: OlePptxElement): ResolvedOleType {
  // Prefer the pre-resolved oleObjectType when it is set and meaningful.
  if (element.oleObjectType && element.oleObjectType !== "package" && element.oleObjectType !== "unknown") {
    return element.oleObjectType as ResolvedOleType;
  }

  // Fall back to heuristic matching on progId.
  const progId = element.oleProgId?.toLowerCase() ?? "";
  if (progId.includes("excel")) return "excel";
  if (progId.includes("word")) return "word";
  if (progId.includes("acroexch") || progId.includes("acrobat") || progId.includes("pdf")) return "pdf";
  if (progId.includes("visio")) return "visio";
  if (progId.includes("equation") || progId.includes("mathtype")) return "mathtype";

  return "unknown";
}

/**
 * Return a branded colour associated with the given OLE type.
 */
export function getOleTypeColor(type: ResolvedOleType): string {
  switch (type) {
    case "excel":
      return "#217346";
    case "word":
      return "#2B579A";
    case "pdf":
      return "#D4272E";
    case "visio":
      return "#3955A3";
    case "mathtype":
      return "#7B2D8E";
    case "unknown":
    default:
      return "#666666";
  }
}

/**
 * Return a human-readable label for the given OLE type.
 */
export function getOleTypeLabel(type: ResolvedOleType): string {
  switch (type) {
    case "excel":
      return "Excel Spreadsheet";
    case "word":
      return "Word Document";
    case "pdf":
      return "PDF Document";
    case "visio":
      return "Visio Diagram";
    case "mathtype":
      return "Math Equation";
    case "unknown":
    default:
      return "Embedded Object";
  }
}

// ---------------------------------------------------------------------------
// Inline SVG icon functions (return JSX, not components)
// ---------------------------------------------------------------------------

/** Spreadsheet grid icon for Excel objects. */
export function ExcelIcon(color: string, size = 32) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Grid outline */}
      <rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Horizontal grid lines */}
      <line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth="1" />
      <line x1="3" y1="15" x2="21" y2="15" stroke={color} strokeWidth="1" />
      {/* Vertical grid lines */}
      <line x1="9" y1="3" x2="9" y2="21" stroke={color} strokeWidth="1" />
      <line x1="15" y1="3" x2="15" y2="21" stroke={color} strokeWidth="1" />
    </svg>
  );
}

/** Document with text lines icon for Word objects. */
export function WordIcon(color: string, size = 32) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Document outline */}
      <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Text lines */}
      <line x1="7" y1="7" x2="17" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="11" x2="17" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="15" x2="13" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Document with "PDF" text icon for PDF objects. */
export function PdfIcon(color: string, size = 32) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Document outline */}
      <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      {/* PDF text */}
      <text x="12" y="14" textAnchor="middle" fill={color} fontSize="7" fontWeight="bold">
        PDF
      </text>
    </svg>
  );
}

/** Simple hierarchy diagram icon for Visio objects. */
export function VisioIcon(color: string, size = 32) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top box */}
      <rect x="8" y="2" width="8" height="5" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Connector lines */}
      <line x1="12" y1="7" x2="12" y2="10" stroke={color} strokeWidth="1.5" />
      <line x1="6" y1="10" x2="18" y2="10" stroke={color} strokeWidth="1.5" />
      <line x1="6" y1="10" x2="6" y2="13" stroke={color} strokeWidth="1.5" />
      <line x1="18" y1="10" x2="18" y2="13" stroke={color} strokeWidth="1.5" />
      {/* Bottom boxes */}
      <rect x="2" y="13" width="8" height="5" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
      <rect x="14" y="13" width="8" height="5" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

/** f(x) text icon for MathType objects. */
export function MathIcon(color: string, size = 32) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Container */}
      <rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      {/* f(x) text */}
      <text x="12" y="15" textAnchor="middle" fill={color} fontSize="9" fontStyle="italic" fontWeight="bold">
        f(x)
      </text>
    </svg>
  );
}

/** Generic linked boxes icon for unrecognised OLE objects. */
export function GenericOleIcon(color: string, size = 32) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Left box */}
      <rect x="2" y="5" width="9" height="7" rx="1.5" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Right box */}
      <rect x="13" y="12" width="9" height="7" rx="1.5" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Linking line */}
      <line x1="11" y1="8.5" x2="13" y2="15.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Return the appropriate SVG icon JSX for the given OLE type.
 */
function getOleIcon(type: ResolvedOleType, color: string, size = 32) {
  switch (type) {
    case "excel":
      return ExcelIcon(color, size);
    case "word":
      return WordIcon(color, size);
    case "pdf":
      return PdfIcon(color, size);
    case "visio":
      return VisioIcon(color, size);
    case "mathtype":
      return MathIcon(color, size);
    case "unknown":
    default:
      return GenericOleIcon(color, size);
  }
}

/**
 * Build an accessible aria-label for the OLE element.
 */
export function getOleAriaLabel(el: OlePptxElement): string {
  const oleType = resolveOleType(el);
  const typeLabel = getOleTypeLabel(oleType);
  if (el.fileName) {
    return `${typeLabel}: ${el.fileName}`;
  }
  return typeLabel;
}

/**
 * Render an OLE badge overlay for preview images.
 */
function renderOleBadge(oleType: ResolvedOleType) {
  const color = getOleTypeColor(oleType);
  const shortLabel = oleType === "unknown" ? "OLE" : oleType.toUpperCase();
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="absolute bottom-1 right-1 z-10"
    >
      <rect x="2" y="2" width="20" height="20" rx="3" fill={color} />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="white"
        fontSize={shortLabel.length > 4 ? "6" : "10"}
        fontWeight="bold"
      >
        {shortLabel}
      </text>
    </svg>
  );
}

export function renderOleElement(el: OlePptxElement) {
  const oleType = resolveOleType(el);
  const ariaLabel = getOleAriaLabel(el);

  if (el.previewImageData) {
    return (
      <div
        className="relative w-full h-full"
        role="img"
        aria-label={ariaLabel}
        title="Double-click to open"
      >
        <img
          src={el.previewImageData}
          alt={ariaLabel}
          className="pointer-events-none select-none w-full h-full object-contain"
          draggable={false}
        />
        {renderOleBadge(oleType)}
      </div>
    );
  }

  // No preview image — render a type-specific styled placeholder.
  const color = getOleTypeColor(oleType);
  const label = getOleTypeLabel(oleType);
  const displayName = el.fileName ?? label;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center pointer-events-none"
      role="img"
      aria-label={ariaLabel}
      title="Double-click to open"
      style={{
        border: `2px solid ${color}33`,
        borderRadius: 6,
        backgroundColor: `${color}0D`,
      }}
    >
      {getOleIcon(oleType, color, 36)}
      <span
        className="mt-2 text-[12px] font-medium max-w-[90%] truncate"
        style={{ color }}
      >
        {displayName}
      </span>
      {el.fileName && (
        <span className="mt-0.5 text-[10px] text-white/50 max-w-[90%] truncate">
          {label}
        </span>
      )}
    </div>
  );
}
