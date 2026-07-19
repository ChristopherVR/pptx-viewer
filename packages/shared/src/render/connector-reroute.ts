/**
 * Connector dynamic rerouting — recalculates connector endpoints when
 * connected shapes are moved or resized. Pure (no framework imports).
 *
 * Connectors reference shapes via `shapeStyle.connectorStartConnection` and
 * `shapeStyle.connectorEndConnection`, each containing a `shapeId` and a
 * `connectionSiteIndex`. When the referenced shape moves or resizes, the
 * connector's position and dimensions must be updated to follow.
 */

import { createBuiltinVariables, resolveCoordinate } from 'pptx-viewer-core';
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
 *
 * This is the fallback used for shapes whose real connection sites are
 * unknown (preset shapes without a parsed `a:cxnLst`).
 */
export function getConnectionSites(width: number, height: number): ConnectionSite[] {
	return [
		{ x: width / 2, y: 0, index: 0 }, // top center
		{ x: width, y: height / 2, index: 1 }, // right center
		{ x: width / 2, y: height, index: 2 }, // bottom center
		{ x: 0, y: height / 2, index: 3 }, // left center
	];
}

/** Structural view of the custom-geometry fields we read off a shape element. */
interface ShapeGeometryFields {
	customGeometryConnectionSites?: Array<{ posX?: string; posY?: string; ang?: string }>;
	pathWidth?: number;
	pathHeight?: number;
}

/**
 * Resolve the connection sites of a shape element in element-local pixel
 * coordinates.
 *
 * When the shape carries typed custom-geometry connection sites (parsed from
 * `a:custGeom/a:cxnLst/a:cxn`), each `a:pos` formula is evaluated against the
 * shape's path coordinate space and scaled to the element's pixel box, so a
 * connector referencing `stCxn/@idx` on a non-rectangular shape attaches near
 * the real site rather than collapsing to an edge midpoint. Shapes with no
 * known sites fall back to the four edge midpoints.
 */
export function getShapeConnectionSites(shape: PptxElement): ConnectionSite[] {
	const geo = shape as PptxElement & ShapeGeometryFields;
	const cxn = geo.customGeometryConnectionSites;
	if (!cxn || cxn.length === 0) {
		return getConnectionSites(shape.width, shape.height);
	}

	// Path coordinate space the `a:pos` formulas are expressed in. Fall back to
	// the element's pixel dimensions (scale factor 1) when unavailable.
	const pathW = geo.pathWidth && geo.pathWidth > 0 ? geo.pathWidth : shape.width;
	const pathH = geo.pathHeight && geo.pathHeight > 0 ? geo.pathHeight : shape.height;
	const vars = createBuiltinVariables({ w: pathW, h: pathH });
	const scaleX = pathW > 0 ? shape.width / pathW : 1;
	const scaleY = pathH > 0 ? shape.height / pathH : 1;

	return cxn.map((site, index) => ({
		x: resolveCoordinate(site.posX, vars) * scaleX,
		y: resolveCoordinate(site.posY, vars) * scaleY,
		index,
	}));
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
	/**
	 * Recomputed horizontal flip flag. True when the resolved end point is to
	 * the left of the start point, matching how `getConnectorPathGeometry`
	 * derives the start/end corners (and thus arrowhead direction) from the
	 * flip flags. Omitted only when produced outside {@link computeConnectorGeometry}.
	 */
	flipHorizontal?: boolean;
	/** Recomputed vertical flip flag. True when the end point is above the start. */
	flipVertical?: boolean;
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
		const sites = getShapeConnectionSites(startShape);
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
		const sites = getShapeConnectionSites(endShape);
		const siteIndex = endConn.connectionSiteIndex ?? 0;
		const site = sites[siteIndex] ?? sites[0];
		ex = endShape.x + site.x;
		ey = endShape.y + site.y;
	} else {
		ex = connector.x + connector.width;
		ey = connector.y + connector.height;
	}

	// Recompute the flip flags from the relative order of the resolved
	// endpoints. `getConnectorPathGeometry` derives the start/end corners
	// (and hence line direction / arrowheads) from these flags:
	//   flipH => start at local x=width, end at x=0
	//   flipV => start at local y=height, end at y=0
	// Since the bounding box is anchored at min(sx,ex)/min(sy,ey), a start that
	// sits to the right of / below the end must be drawn from the far corner,
	// i.e. flipH when ex < sx and flipV when ey < sy. Equal coordinates keep the
	// flag false so a purely vertical / horizontal line is not spuriously flipped.
	const flipHorizontal = ex < sx;
	const flipVertical = ey < sy;

	return {
		id: connector.id,
		x: Math.min(sx, ex),
		y: Math.min(sy, ey),
		width: Math.abs(ex - sx) || 1,
		height: Math.abs(ey - sy) || 1,
		flipHorizontal,
		flipVertical,
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
		const next: Record<string, unknown> = {
			...el,
			x: update.x,
			y: update.y,
			width: update.width,
			height: update.height,
		};
		// Only overwrite the flip flags when the reroute recomputed them, so
		// callers that build ReroutedConnector without flip data (e.g. tests or
		// non-endpoint updates) leave the connector's existing flags intact.
		if (update.flipHorizontal !== undefined) {
			next.flipHorizontal = update.flipHorizontal;
		}
		if (update.flipVertical !== undefined) {
			next.flipVertical = update.flipVertical;
		}
		return next as unknown as PptxElement;
	});
}
