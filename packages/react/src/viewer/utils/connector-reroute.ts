/**
 * Connector dynamic rerouting — recalculates connector endpoints when
 * connected shapes are moved or resized.
 *
 * Connectors reference shapes via `shapeStyle.connectorStartConnection` and
 * `shapeStyle.connectorEndConnection`, each containing a `shapeId` and a
 * `connectionSiteIndex`. When the referenced shape moves or resizes, the
 * connector's position and dimensions must be updated to follow.
 */

import type { PptxElement } from "pptx-viewer-core";
import { getConnectionSites } from "./connector-path";

/**
 * Describes the updated geometry for a connector after rerouting.
 */
export interface ReroutedConnector {
  /** The connector element ID. */
  id: string;
  /** New x position. */
  x: number;
  /** New y position. */
  y: number;
  /** New width. */
  width: number;
  /** New height. */
  height: number;
}

/**
 * Find all connectors on the slide that reference any of the given element IDs
 * via `connectorStartConnection` or `connectorEndConnection`, and recalculate
 * their positions based on the current shape positions.
 *
 * @param elements - All elements on the current slide (after moves have been applied).
 * @param movedElementIds - Set of element IDs that were moved or resized.
 * @returns Array of rerouted connector descriptors with updated geometry.
 */
export function rerouteConnectorsForMovedElements(
  elements: PptxElement[],
  movedElementIds: Set<string>,
): ReroutedConnector[] {
  if (movedElementIds.size === 0) return [];

  // Build a lookup map for quick element access
  const elementMap = new Map<string, PptxElement>();
  for (const el of elements) {
    elementMap.set(el.id, el);
  }

  const rerouted: ReroutedConnector[] = [];

  for (const el of elements) {
    if (el.type !== "connector") continue;

    const style = (el as { shapeStyle?: PptxElement["shapeStyle"] }).shapeStyle;
    if (!style) continue;

    const ss = style as {
      connectorStartConnection?: { shapeId?: string; connectionSiteIndex?: number };
      connectorEndConnection?: { shapeId?: string; connectionSiteIndex?: number };
    };

    const startConn = ss.connectorStartConnection;
    const endConn = ss.connectorEndConnection;

    // Skip connectors that don't reference any moved elements
    const startAffected = startConn?.shapeId && movedElementIds.has(startConn.shapeId);
    const endAffected = endConn?.shapeId && movedElementIds.has(endConn.shapeId);
    if (!startAffected && !endAffected) continue;

    // Also skip connectors that are themselves being moved (they move with the drag)
    if (movedElementIds.has(el.id)) continue;

    const result = computeConnectorGeometry(el, startConn, endConn, elementMap);
    if (result) {
      rerouted.push(result);
    }
  }

  return rerouted;
}

/**
 * Compute the new geometry for a single connector given its connection
 * references and the current element positions.
 *
 * Returns null if the referenced shapes cannot be found.
 */
export function computeConnectorGeometry(
  connector: PptxElement,
  startConn: { shapeId?: string; connectionSiteIndex?: number } | undefined,
  endConn: { shapeId?: string; connectionSiteIndex?: number } | undefined,
  elementMap: Map<string, PptxElement>,
): ReroutedConnector | null {
  // Resolve start point
  let sx: number;
  let sy: number;
  if (startConn?.shapeId) {
    const startShape = elementMap.get(startConn.shapeId);
    if (!startShape) return null;
    const sites = getConnectionSites(startShape.width, startShape.height);
    const siteIndex = startConn.connectionSiteIndex ?? 0;
    const site = sites[siteIndex] ?? sites[0];
    sx = startShape.x + site.x;
    sy = startShape.y + site.y;
  } else {
    // No start connection — keep existing start position
    sx = connector.x;
    sy = connector.y;
  }

  // Resolve end point
  let ex: number;
  let ey: number;
  if (endConn?.shapeId) {
    const endShape = elementMap.get(endConn.shapeId);
    if (!endShape) return null;
    const sites = getConnectionSites(endShape.width, endShape.height);
    const siteIndex = endConn.connectionSiteIndex ?? 0;
    const site = sites[siteIndex] ?? sites[0];
    ex = endShape.x + site.x;
    ey = endShape.y + site.y;
  } else {
    // No end connection — keep existing end position
    ex = connector.x + connector.width;
    ey = connector.y + connector.height;
  }

  return {
    id: connector.id,
    x: Math.min(sx, ex),
    y: Math.min(sy, ey),
    width: Math.abs(ex - sx) || 1,
    height: Math.abs(ey - sy) || 1,
  };
}

/**
 * Apply rerouted connector positions to a slide's element array.
 * Returns a new array with updated connector positions.
 */
export function applyReroutedConnectors(
  elements: PptxElement[],
  rerouted: ReroutedConnector[],
): PptxElement[] {
  if (rerouted.length === 0) return elements;

  const rerouteMap = new Map<string, ReroutedConnector>();
  for (const r of rerouted) {
    rerouteMap.set(r.id, r);
  }

  return elements.map((el) => {
    const update = rerouteMap.get(el.id);
    if (!update) return el;
    return {
      ...el,
      x: update.x,
      y: update.y,
      width: update.width,
      height: update.height,
    } as PptxElement;
  });
}
