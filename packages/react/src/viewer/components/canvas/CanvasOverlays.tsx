/**
 * Small overlay sub-components rendered inside the SlideCanvas stage.
 *
 * Extracted to keep the main SlideCanvas file under 300 lines.
 */
import type { MarqueeSelectionState } from "../../types";

/* ------------------------------------------------------------------ */
/*  Guide lines                                                        */
/* ------------------------------------------------------------------ */

interface CanvasGuidesProps {
  guides: Array<{ id: string; axis: "h" | "v"; position: number }>;
  onDeleteGuide?: (guideId: string) => void;
  onStartGuideDrag: (info: {
    id: string;
    axis: "h" | "v";
    pointerId: number;
  }) => void;
}

export function CanvasGuides({
  guides,
  onDeleteGuide,
  onStartGuideDrag,
}: CanvasGuidesProps) {
  return (
    <>
      {guides.map((guide) => (
        <div
          key={guide.id}
          className="absolute z-[49] pointer-events-auto"
          style={
            guide.axis === "h"
              ? {
                  left: 0,
                  right: 0,
                  top: guide.position,
                  height: 1,
                  backgroundColor: "rgba(250, 204, 21, 0.9)",
                  cursor: "row-resize",
                }
              : {
                  top: 0,
                  bottom: 0,
                  left: guide.position,
                  width: 1,
                  backgroundColor: "rgba(250, 204, 21, 0.9)",
                  cursor: "col-resize",
                }
          }
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDeleteGuide?.(guide.id);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onStartGuideDrag({
              id: guide.id,
              axis: guide.axis,
              pointerId: e.pointerId,
            });
          }}
          title="Drag guide. Double-click to remove."
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Slide background (image + gradient)                                */
/* ------------------------------------------------------------------ */

interface SlideBackgroundProps {
  backgroundImage?: string;
  backgroundGradient?: string;
}

export function SlideBackground({
  backgroundImage,
  backgroundGradient,
}: SlideBackgroundProps) {
  return (
    <>
      {backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      )}
      {backgroundGradient && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: backgroundGradient }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Marquee selection rectangle                                        */
/* ------------------------------------------------------------------ */

interface MarqueeOverlayProps {
  marqueeSelectionState: MarqueeSelectionState | null;
}

export function MarqueeOverlay({ marqueeSelectionState }: MarqueeOverlayProps) {
  if (!marqueeSelectionState) return null;
  return (
    <div
      className="absolute border border-primary bg-primary/10 pointer-events-none z-50"
      style={{
        left: Math.min(
          marqueeSelectionState.startX,
          marqueeSelectionState.currentX,
        ),
        top: Math.min(
          marqueeSelectionState.startY,
          marqueeSelectionState.currentY,
        ),
        width: Math.abs(
          marqueeSelectionState.currentX - marqueeSelectionState.startX,
        ),
        height: Math.abs(
          marqueeSelectionState.currentY - marqueeSelectionState.startY,
        ),
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Snap lines                                                         */
/* ------------------------------------------------------------------ */

interface SnapLinesOverlayProps {
  snapLines: Array<{ axis: string; position: number }>;
}

export function SnapLinesOverlay({ snapLines }: SnapLinesOverlayProps) {
  return (
    <>
      {snapLines.map((line, i) => (
        <div
          key={i}
          className="absolute bg-red-500 pointer-events-none z-50"
          style={
            line.axis === "x"
              ? {
                  left: line.position,
                  top: 0,
                  width: 1,
                  height: "100%",
                }
              : {
                  left: 0,
                  top: line.position,
                  width: "100%",
                  height: 1,
                }
          }
        />
      ))}
    </>
  );
}
