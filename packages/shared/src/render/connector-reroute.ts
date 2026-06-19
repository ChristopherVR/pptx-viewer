/**
 * Connector dynamic rerouting — recalculates connector endpoints when
 * connected shapes are moved or resized. Pure (no framework imports).
 *
 * Connectors reference shapes via `shapeStyle.connectorStartConnection` and
 * `shapeStyle.connectorEndConnection`, each containing a `shapeId` and a
 * `connectionSiteIndex`. When the referenced shape moves or resizes, the
 * connector's position and dimensions must be updated to follow.
 */

import type { PptxElement } from 'pptx-viewer-core';

/** A single connection site on a shape's bounding box (element-local coords). */
export interface ConnectionSite {
	x: number;
	y: number;
	index: number;
}

/**
 * Compute connection sites for a rectangular bounding box. Returns the four
 * edge midpoints in element-local coordinates: top, right, bottom, left.
 */
export function getConnectionSites(width: number, height: number): ConnectionSite[] {
	return [
		{ x: width / 2, y: 0, index: 0 }, // top center
		{ x: width, y: height / 2, index: 1 }, // right center
		{ x: width / 2, y: height, index: 2 }, // bottom center
		{ x: 0, y: height / 2, index: 3 }, // left center
	];
}

/** Describes the updated geometry for a connector after rerouting. */
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

/** A connection reference (shape + site index) on a connector endpoint. */
export interface ConnectorConnectionRef {
	shapeId?: string;
	connectionSiteIndex?: number;
}

/**
 * Find all connectors on the slide that reference any of the given element IDs
 * via `connectorStartConnection`/`connectorEndConnection`, and recalculate
 * their positions based on the current shape positions.
 *
 * @param elements - All elements on the current slide (after moves applied).
 * @param movedElementIds - Set of element IDs that were moved or resized.
 * @returns Array of rerouted connector descriptors with updated geometry.
 */
export function rerouteConnectorsForMovedElements(
	elements: PptxElement[],
	movedElementIds: Set<string>,
): ReroutedConnector[] {
	if (movedElementIds.size === 0) {
		return [];
	}

	const elementMap = new Map<string, PptxElement>();
	for (const el of elements) {
		elementMap.set(el.id, el);
	}

	const rerouted: ReroutedConnector[] = [];

	for (const el of elements) {
		if (el.type !== 'connector') {
			continue;
		}

		const style = el.shapeStyle;
		if (!style) {
			continue;
		}

		const ss = style as {
			connectorStartConnection?: ConnectorConnectionRef;
			connectorEndConnection?: ConnectorConnectionRef;
		};

		const startConn = ss.connectorStartConnection;
		const endConn = ss.connectorEndConnection;

		const startAffected = startConn?.shapeId && movedElementIds.has(startConn.shapeId);
		const endAffected = endConn?.shapeId && movedElementIds.has(endConn.shapeId);
		if (!startAffected && !endAffected) {
			continue;
		}

		// Skip connectors that are themselves being moved (they move with the drag).
		if (movedElementIds.has(el.id)) {
			continue;
		}

		const result = computeConnectorGeometry(el, startConn, endConn, elementMap);
		if (result) {
			rerouted.push(result);
		}
	}

	return rerouted;
}

/**
 * Compute the new geometry for a single connector given its connection
 * references and the current element positions. Returns null if a referenced
 * shape cannot be found.
 */
export function computeConnectorGeometry(
	connector: PptxElement,
	startConn: ConnectorConnectionRef | undefined,
	endConn: ConnectorConnectionRef | undefined,
	elementMap: Map<string, PptxElement>,
): ReroutedConnector | null {
	// Resolve start point.
	let sx: number;
	let sy: number;
	if (startConn?.shapeId) {
		const startShape = elementMap.get(startConn.shapeId);
		if (!startShape) {
			return null;
		}
		const sites = getConnectionSites(startShape.width, startShape.height);
		const siteIndex = startConn.connectionSiteIndex ?? 0;
		const site = sites[siteIndex] ?? sites[0];
		sx = startShape.x + site.x;
		sy = startShape.y + site.y;
	} else {
		sx = connector.x;
		sy = connector.y;
	}

	// Resolve end point.
	let ex: number;
	let ey: number;
	if (endConn?.shapeId) {
		const endShape = elementMap.get(endConn.shapeId);
		if (!endShape) {
			return null;
		}
		const sites = getConnectionSites(endShape.width, endShape.height);
		const siteIndex = endConn.connectionSiteIndex ?? 0;
		const site = sites[siteIndex] ?? sites[0];
		ex = endShape.x + site.x;
		ey = endShape.y + site.y;
	} else {
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
 * Returns a new array with updated connector positions (or the same reference
 * when there is nothing to apply).
 */
export function applyReroutedConnectors(
	elements: PptxElement[],
	rerouted: ReroutedConnector[],
): PptxElement[] {
	if (rerouted.length === 0) {
		return elements;
	}

	const rerouteMap = new Map<string, ReroutedConnector>();
	for (const r of rerouted) {
		rerouteMap.set(r.id, r);
	}

	return elements.map((el) => {
		const update = rerouteMap.get(el.id);
		if (!update) {
			return el;
		}
		return {
			...el,
			x: update.x,
			y: update.y,
			width: update.width,
			height: update.height,
		} as PptxElement;
	});
}
