import type {
  ContentPartPptxElement,
  InkPptxElement,
  OlePptxElement,
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
  const pressureSensitive = options?.pressureSensitive ?? false;
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

        // Pressure-sensitive rendering: if the element has per-point
        // width data with variation, render circles instead of a single path.
        if (
          pressureSensitive &&
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

function getOleBadgeColor(oleProgId?: string): string {
  if (!oleProgId) return "#666";
  const pid = oleProgId.toLowerCase();
  if (pid.includes("excel")) return "#217346";
  if (pid.includes("word")) return "#2B579A";
  return "#666";
}

function renderOleBadge(oleProgId?: string) {
  const color = getOleBadgeColor(oleProgId);
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
        fontSize="10"
        fontWeight="bold"
      >
        OLE
      </text>
    </svg>
  );
}

export function renderOleElement(el: OlePptxElement) {
  if (el.previewImageData) {
    return (
      <div className="relative w-full h-full">
        <img
          src={el.previewImageData}
          alt="OLE preview"
          className="pointer-events-none select-none w-full h-full object-contain"
          draggable={false}
        />
        {renderOleBadge(el.oleProgId)}
      </div>
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
      Embedded Object
    </div>
  );
}
