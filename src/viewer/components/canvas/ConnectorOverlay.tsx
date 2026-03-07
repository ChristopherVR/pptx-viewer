/**
 * Connector creation overlay — shows connection-site dots on shapes
 * and a live drag-preview line when drawing a new connector.
 */
import React from "react";
import type { PptxSlide } from "../../../core";
import { getConnectionSites } from "../../utils/shape-connector";
import type { ConnectorDragState } from "./useConnectorCreation";
import type { ZoomViewport } from "./canvas-types";
import type { CanvasSize } from "../../types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ConnectorOverlayProps {
  activeSlide: PptxSlide;
  canvasSize: CanvasSize;
  zoom: ZoomViewport;
  connectorDragState: ConnectorDragState | null;
  onConnectionSiteDown: (
    elementId: string,
    siteIndex: number,
    e: React.MouseEvent,
  ) => void;
  onConnectorDragMove: (e: React.MouseEvent) => void;
  onConnectionSiteDrop: (
    targetElementId: string,
    targetSiteIndex: number,
  ) => void;
  onConnectorDragEnd: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ConnectorOverlay({
  activeSlide,
  canvasSize,
  zoom,
  connectorDragState,
  onConnectionSiteDown,
  onConnectorDragMove,
  onConnectionSiteDrop,
  onConnectorDragEnd,
}: ConnectorOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-[55] pointer-events-none"
      onMouseMove={onConnectorDragMove}
      onMouseUp={onConnectorDragEnd}
      style={{ pointerEvents: connectorDragState ? "auto" : "none" }}
    >
      {activeSlide.elements
        .filter((el) => el.type !== "connector")
        .map((el) => {
          const sites = getConnectionSites(el.width, el.height);
          return sites.map((site) => (
            <div
              key={`${el.id}-site-${site.index}`}
              className="absolute rounded-full border-2 border-blue-500 bg-blue-400/60 hover:bg-blue-500 hover:scale-125 transition-transform cursor-crosshair"
              style={{
                left: el.x + site.x - 5,
                top: el.y + site.y - 5,
                width: 10,
                height: 10,
                pointerEvents: "auto",
                zIndex: 56,
              }}
              onMouseDown={(e) => onConnectionSiteDown(el.id, site.index, e)}
              onMouseUp={() =>
                connectorDragState
                  ? onConnectionSiteDrop(el.id, site.index)
                  : undefined
              }
            />
          ));
        })}

      {/* Live connector drag preview line */}
      {connectorDragState && (
        <ConnectorDragPreview
          activeSlide={activeSlide}
          canvasSize={canvasSize}
          zoom={zoom}
          connectorDragState={connectorDragState}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Drag preview sub-component                                         */
/* ------------------------------------------------------------------ */

function ConnectorDragPreview({
  activeSlide,
  canvasSize,
  zoom,
  connectorDragState,
}: {
  activeSlide: PptxSlide;
  canvasSize: CanvasSize;
  zoom: ZoomViewport;
  connectorDragState: ConnectorDragState;
}) {
  const startEl = activeSlide.elements.find(
    (el) => el.id === connectorDragState.startElementId,
  );
  if (!startEl) return null;

  const startSites = getConnectionSites(startEl.width, startEl.height);
  const startSite =
    startSites[connectorDragState.startSiteIndex] ?? startSites[0];
  const sx = startEl.x + startSite.x;
  const sy = startEl.y + startSite.y;

  const stage = zoom.canvasStageRef.current;
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  const scale = zoom.editorScale || 1;
  const ex = (connectorDragState.currentX - rect.left) / scale;
  const ey = (connectorDragState.currentY - rect.top) / scale;

  return (
    <svg
      className="absolute inset-0"
      style={{
        width: canvasSize.width,
        height: canvasSize.height,
        pointerEvents: "none",
      }}
      viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
    >
      <line
        x1={sx}
        y1={sy}
        x2={ex}
        y2={ey}
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
    </svg>
  );
}
