import { useCallback, useState } from "react";
import React from "react";
import type {
  ConnectorPptxElement,
  PptxSlide,
} from "pptx-viewer-core";
import { getConnectionSites } from "../../utils/shape-connector";
import type { ZoomViewport } from "./canvas-types";

/* ------------------------------------------------------------------ */
/*  State type                                                         */
/* ------------------------------------------------------------------ */

export interface ConnectorDragState {
  startElementId: string;
  startSiteIndex: number;
  currentX: number;
  currentY: number;
}

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface ConnectorCreationState {
  connectorDragState: ConnectorDragState | null;
  handleConnectionSiteDown: (
    elementId: string,
    siteIndex: number,
    e: React.MouseEvent,
  ) => void;
  handleConnectorDragMove: (e: React.MouseEvent) => void;
  handleConnectionSiteDrop: (
    targetElementId: string,
    targetSiteIndex: number,
  ) => void;
  handleConnectorDragEnd: () => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useConnectorCreation({
  activeSlide,
  zoom: _zoom,
  onCreateConnector,
}: {
  activeSlide: PptxSlide | undefined;
  zoom: ZoomViewport;
  onCreateConnector?: (connector: ConnectorPptxElement) => void;
}): ConnectorCreationState {
  const [connectorDragState, setConnectorDragState] =
    useState<ConnectorDragState | null>(null);

  /** Start dragging a connector from a connection site. */
  const handleConnectionSiteDown = useCallback(
    (elementId: string, siteIndex: number, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setConnectorDragState({
        startElementId: elementId,
        startSiteIndex: siteIndex,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    },
    [],
  );

  /** Handle mouse move during connector drag. */
  const handleConnectorDragMove = useCallback(
    (e: React.MouseEvent) => {
      if (!connectorDragState) return;
      setConnectorDragState((prev) =>
        prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null,
      );
    },
    [connectorDragState],
  );

  /** Finish connector creation by dropping on a target connection site. */
  const handleConnectionSiteDrop = useCallback(
    (targetElementId: string, targetSiteIndex: number) => {
      if (!connectorDragState || !onCreateConnector) return;
      if (connectorDragState.startElementId === targetElementId) {
        setConnectorDragState(null);
        return;
      }

      const startEl = activeSlide?.elements.find(
        (el) => el.id === connectorDragState.startElementId,
      );
      const endEl = activeSlide?.elements.find(
        (el) => el.id === targetElementId,
      );
      if (!startEl || !endEl) {
        setConnectorDragState(null);
        return;
      }

      const startSites = getConnectionSites(startEl.width, startEl.height);
      const endSites = getConnectionSites(endEl.width, endEl.height);
      const startSite =
        startSites[connectorDragState.startSiteIndex] ?? startSites[0];
      const endSite = endSites[targetSiteIndex] ?? endSites[0];

      const sx = startEl.x + startSite.x;
      const sy = startEl.y + startSite.y;
      const ex = endEl.x + endSite.x;
      const ey = endEl.y + endSite.y;

      const dx = Math.abs(ex - sx);
      const dy = Math.abs(ey - sy);
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Auto-select connector type
      const shapeType =
        dist < 100
          ? "straightConnector1"
          : dist < 300
            ? "bentConnector3"
            : "curvedConnector3";

      const newConnector: ConnectorPptxElement = {
        id: `conn-new-${Date.now()}`,
        type: "connector",
        x: Math.min(sx, ex),
        y: Math.min(sy, ey),
        width: Math.abs(ex - sx) || 1,
        height: Math.abs(ey - sy) || 1,
        shapeType,
        shapeStyle: {
          strokeColor: "#4472C4",
          strokeWidth: 2,
          connectorStartConnection: {
            shapeId: connectorDragState.startElementId,
            connectionSiteIndex: connectorDragState.startSiteIndex,
          },
          connectorEndConnection: {
            shapeId: targetElementId,
            connectionSiteIndex: targetSiteIndex,
          },
        },
      };

      onCreateConnector(newConnector);
      setConnectorDragState(null);
    },
    [connectorDragState, onCreateConnector, activeSlide?.elements],
  );

  /** Cancel connector drag on mouse up over empty space. */
  const handleConnectorDragEnd = useCallback(() => {
    setConnectorDragState(null);
  }, []);

  return {
    connectorDragState,
    handleConnectionSiteDown,
    handleConnectorDragMove,
    handleConnectionSiteDrop,
    handleConnectorDragEnd,
  };
}
