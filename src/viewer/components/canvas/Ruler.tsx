/**
 * Ruler — Horizontal and vertical rulers for the PowerPoint slide canvas.
 *
 * Renders inch/centimetre tick marks adjacent to the slide area,
 * adapting to zoom level so marks remain readable. When an element
 * is selected its extent is highlighted on both rulers.
 *
 * Users can drag from a ruler to create a new drawing guide.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { CanvasSize } from "../../types-core";
import { RULER_THICKNESS, generateTicks } from "./ruler-utils";
import type { RulerUnit } from "./ruler-utils";
import { HorizontalRuler, VerticalRuler } from "./RulerStrips";

/* ------------------------------------------------------------------ */
/*  Re-exports for backwards compatibility                            */
/* ------------------------------------------------------------------ */

export { RULER_THICKNESS, generateTicks } from "./ruler-utils";
export type { RulerUnit, Tick } from "./ruler-utils";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface RulerProps {
  /** Slide dimensions in CSS pixels (un-scaled). */
  canvasSize: CanvasSize;
  /** Combined editor scale (fitScale × userZoom). */
  editorScale: number;
  /** Unit system for ruler labels. */
  unit: RulerUnit;
  /** Whether rulers should be visible. */
  visible: boolean;
  /** Bounding box of the currently selected element (in slide-local CSS px, un-scaled). */
  selectedBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  /** Called when the user drags from a ruler to create a new guide. */
  onCreateGuideFromRuler?: (axis: "h" | "v", positionPx: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

/**
 * Ruler — renders a horizontal ruler, vertical ruler, and corner square.
 *
 * Designed to be placed as a sibling of the scaled canvas stage inside
 * the edit-wrapper. It is **not** scaled by the CSS transform; instead
 * it receives `editorScale` and computes positions itself.
 */
export function Ruler({
  canvasSize,
  editorScale,
  unit,
  visible,
  selectedBounds,
  onCreateGuideFromRuler,
}: RulerProps) {
  // -- Memoised tick arrays --
  const hTicks = useMemo(
    () => generateTicks(canvasSize.width, editorScale, unit),
    [canvasSize.width, editorScale, unit],
  );
  const vTicks = useMemo(
    () => generateTicks(canvasSize.height, editorScale, unit),
    [canvasSize.height, editorScale, unit],
  );

  // -- Highlight ranges for selected element --
  const hHighlight = useMemo(() => {
    if (!selectedBounds) return null;
    return {
      start: selectedBounds.x * editorScale,
      end: (selectedBounds.x + selectedBounds.width) * editorScale,
    };
  }, [selectedBounds, editorScale]);

  const vHighlight = useMemo(() => {
    if (!selectedBounds) return null;
    return {
      start: selectedBounds.y * editorScale,
      end: (selectedBounds.y + selectedBounds.height) * editorScale,
    };
  }, [selectedBounds, editorScale]);

  // -- Drag-from-ruler state --
  const [rulerDrag, setRulerDrag] = useState<{
    axis: "h" | "v";
    pointerId: number;
  } | null>(null);
  const hRulerRef = useRef<HTMLDivElement>(null);
  const vRulerRef = useRef<HTMLDivElement>(null);

  const handleHRulerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onCreateGuideFromRuler) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setRulerDrag({ axis: "h", pointerId: e.pointerId });
    },
    [onCreateGuideFromRuler],
  );

  const handleVRulerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onCreateGuideFromRuler) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setRulerDrag({ axis: "v", pointerId: e.pointerId });
    },
    [onCreateGuideFromRuler],
  );

  const handleRulerPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!rulerDrag || !onCreateGuideFromRuler) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(
          rulerDrag.pointerId,
        );
      } catch {
        // Capture may already be released
      }

      // Compute position in slide-local CSS px
      const scale = editorScale || 1;
      if (rulerDrag.axis === "h") {
        const rulerEl = hRulerRef.current;
        if (!rulerEl) {
          setRulerDrag(null);
          return;
        }
        const rect = rulerEl.getBoundingClientRect();
        const posScaled = e.clientY - rect.top;
        // Only create guide if pointer moved past the ruler boundary
        if (posScaled > RULER_THICKNESS) {
          const positionPx = (posScaled - RULER_THICKNESS) / scale;
          if (positionPx >= 0 && positionPx <= canvasSize.height) {
            onCreateGuideFromRuler("h", positionPx);
          }
        }
      } else {
        const rulerEl = vRulerRef.current;
        if (!rulerEl) {
          setRulerDrag(null);
          return;
        }
        const rect = rulerEl.getBoundingClientRect();
        const posScaled = e.clientX - rect.left;
        if (posScaled > RULER_THICKNESS) {
          const positionPx = (posScaled - RULER_THICKNESS) / scale;
          if (positionPx >= 0 && positionPx <= canvasSize.width) {
            onCreateGuideFromRuler("v", positionPx);
          }
        }
      }
      setRulerDrag(null);
    },
    [rulerDrag, onCreateGuideFromRuler, editorScale, canvasSize],
  );

  if (!visible) return null;

  const scaledWidth = canvasSize.width * editorScale;
  const scaledHeight = canvasSize.height * editorScale;

  return (
    <>
      {/* Corner square — sits at the intersection of the two rulers */}
      <div
        className="absolute z-[51] bg-gray-100 dark:bg-gray-800 border-r border-b border-border"
        style={{
          top: 0,
          left: 0,
          width: RULER_THICKNESS,
          height: RULER_THICKNESS,
        }}
      />
      {/* Horizontal ruler — across the top (drag down to create h-guide) */}
      <div
        ref={hRulerRef}
        className="absolute z-[50] overflow-visible"
        style={{
          top: 0,
          left: RULER_THICKNESS,
          width: scaledWidth,
          height: RULER_THICKNESS,
          cursor: onCreateGuideFromRuler ? "row-resize" : undefined,
        }}
        onPointerDown={handleHRulerPointerDown}
        onPointerUp={handleRulerPointerUp}
      >
        <HorizontalRuler
          ticks={hTicks}
          widthPx={scaledWidth}
          highlight={hHighlight}
        />
      </div>
      {/* Vertical ruler — down the left side (drag right to create v-guide) */}
      <div
        ref={vRulerRef}
        className="absolute z-[50] overflow-visible"
        style={{
          top: RULER_THICKNESS,
          left: 0,
          width: RULER_THICKNESS,
          height: scaledHeight,
          cursor: onCreateGuideFromRuler ? "col-resize" : undefined,
        }}
        onPointerDown={handleVRulerPointerDown}
        onPointerUp={handleRulerPointerUp}
      >
        <VerticalRuler
          ticks={vTicks}
          heightPx={scaledHeight}
          highlight={vHighlight}
        />
      </div>
    </>
  );
}
