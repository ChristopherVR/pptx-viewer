import React from "react";

import type {
  PptxElement,
  PptxSmartArtDrawingShape,
  SmartArtStyle,
} from "pptx-viewer-core";
import { colour, styleShadow, styleStroke, truncate } from "./smartart-helpers";

/**
 * Render pre-computed drawing shapes from `ppt/diagrams/drawing*.xml`.
 * These are the shapes as computed by PowerPoint's layout engine.
 */
export function renderDrawingShapes(
  element: PptxElement,
  shapes: PptxSmartArtDrawingShape[],
  style: SmartArtStyle,
  palette: string[],
): React.ReactNode {
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

        return (
          <g
            key={`${element.id}-dsp-${shape.id}-${i}`}
            style={{ filter: shadow }}
          >
            {isEllipse ? (
              <ellipse
                cx={relX + shape.width / 2}
                cy={relY + shape.height / 2}
                rx={shape.width / 2}
                ry={shape.height / 2}
                fill={fill}
                stroke={
                  shape.strokeColor ??
                  (sw > 0 ? "rgba(255,255,255,0.3)" : "none")
                }
                strokeWidth={shape.strokeWidth ?? sw}
                transform={
                  shape.rotation
                    ? `rotate(${shape.rotation} ${relX + shape.width / 2} ${relY + shape.height / 2})`
                    : undefined
                }
              />
            ) : (
              <rect
                x={relX}
                y={relY}
                width={shape.width}
                height={shape.height}
                rx={rx}
                fill={fill}
                stroke={
                  shape.strokeColor ??
                  (sw > 0 ? "rgba(255,255,255,0.3)" : "none")
                }
                strokeWidth={shape.strokeWidth ?? sw}
                transform={
                  shape.rotation
                    ? `rotate(${shape.rotation} ${relX + shape.width / 2} ${relY + shape.height / 2})`
                    : undefined
                }
              />
            )}
            {shape.text ? (
              <text
                x={relX + shape.width / 2}
                y={relY + shape.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={shape.fontColor ?? "white"}
                fontSize={
                  shape.fontSize ??
                  Math.max(8, Math.min(14, shape.height * 0.2))
                }
                className="pointer-events-none"
              >
                {truncate(shape.text, 30)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
