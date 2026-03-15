/**
 * CollaborationCursorOverlay — Reads from the collaboration context,
 * broadcasts local cursor position on mouse move, and renders
 * `RemoteUserCursors` for other participants.
 *
 * This component is only mounted when collaboration is enabled.
 * It is rendered inside the `SlideCanvas` stage div.
 *
 * @module collaboration/CollaborationCursorOverlay
 */
import React, { useCallback } from "react";

import { useCollaboration } from "./CollaborationProvider";
import { RemoteUserCursors } from "./RemoteUserCursors";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CollaborationCursorOverlayProps {
  activeSlideIndex: number;
  canvasWidth: number;
  canvasHeight: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollaborationCursorOverlay({
  activeSlideIndex,
  canvasWidth,
  canvasHeight,
}: CollaborationCursorOverlayProps): React.ReactElement | null {
  const collab = useCollaboration();

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!collab) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeight;
      collab.broadcastPresence({
        cursorX: x,
        cursorY: y,
        activeSlideIndex,
      });
    },
    [collab, canvasWidth, canvasHeight, activeSlideIndex],
  );

  if (!collab) return null;

  return (
    <>
      {/* Invisible pointer-tracking layer */}
      <div
        data-testid="collab-pointer-tracker"
        className="absolute inset-0"
        style={{ zIndex: 9998, pointerEvents: "auto" }}
        onPointerMove={handlePointerMove}
      />
      {/* Remote cursor SVG overlay */}
      <RemoteUserCursors
        remoteUsers={collab.remoteUsers}
        activeSlideIndex={activeSlideIndex}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
      />
    </>
  );
}
