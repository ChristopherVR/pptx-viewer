import React from "react";
import { cn } from "../../utils";
import type {
  ResizeHandle,
  ShapeAdjustmentHandleDescriptor,
} from "../../types";

export interface ResizeHandlesProps {
  elementId: string;
  adjustmentHandleDescriptor: ShapeAdjustmentHandleDescriptor | null;
  onResizePointerDown: (
    elementId: string,
    e: React.MouseEvent,
    handle: string,
  ) => void;
  onAdjustmentPointerDown: (elementId: string, e: React.MouseEvent) => void;
  /** Whether to force pointerEvents: "auto" on buttons (needed inside pointer-events:none containers). */
  forcePointerEvents?: boolean;
}

export function ResizeHandles({
  elementId,
  adjustmentHandleDescriptor: adjH,
  onResizePointerDown,
  onAdjustmentPointerDown,
  forcePointerEvents,
}: ResizeHandlesProps) {
  return (
    <>
      {(["nw", "ne", "sw", "se"] as ResizeHandle[]).map((h) => (
        <button
          key={h}
          type="button"
          className={cn(
            // Base size: 12px (w-3 h-3); on mobile viewports: 22px (w-5.5 h-5.5)
            // with larger offset so they remain centered on the corner
            "absolute w-3 h-3 max-md:w-5.5 max-md:h-5.5 rounded-full border border-white bg-primary shadow z-10",
            h === "nw" && "-left-1.5 -top-1.5 max-md:-left-2.5 max-md:-top-2.5 cursor-nwse-resize",
            h === "ne" && "-right-1.5 -top-1.5 max-md:-right-2.5 max-md:-top-2.5 cursor-nesw-resize",
            h === "sw" && "-left-1.5 -bottom-1.5 max-md:-left-2.5 max-md:-bottom-2.5 cursor-nesw-resize",
            h === "se" && "-right-1.5 -bottom-1.5 max-md:-right-2.5 max-md:-bottom-2.5 cursor-nwse-resize",
          )}
          style={forcePointerEvents ? { pointerEvents: "auto" } : undefined}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizePointerDown(elementId, e, h);
          }}
        />
      ))}
      {adjH ? (
        <button
          type="button"
          className="absolute h-2.5 w-2.5 max-md:h-4 max-md:w-4 rotate-45 border border-amber-700 bg-amber-300 shadow z-10"
          style={{
            left: adjH.left - 5,
            top: adjH.top,
            cursor: adjH.cursor,
            ...(forcePointerEvents ? { pointerEvents: "auto" as const } : {}),
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onAdjustmentPointerDown(elementId, e);
          }}
        />
      ) : null}
    </>
  );
}
