/**
 * `connector-authoring`: turning a drag between two connection sites into a
 * bound `p:cxnSp`.
 *
 * The counterpart to `connector-reroute`. That module keeps an existing
 * connector attached while its shapes move; this one decides what a NEW
 * connector looks like when the user drags from a site on one shape to a site
 * on another: which endpoints it spans, which preset carries it, and the
 * `a:stCxn` / `a:endCxn` bindings that make the reroute possible at all.
 *
 * It exists as a shared decision function because the snapping used to live
 * inside a React hook, and it disagreed with the reroute it fed: authoring
 * snapped to `getConnectionSites` (the four edge midpoints, the FALLBACK for a
 * shape whose real sites are unknown) while the reroute resolved the same index
 * through `getShapeConnectionSites` (the shape's parsed `a:cxnLst`). On any
 * non-rectangular shape the connector was therefore drawn to one point and then
 * jumped to a different one the first time the shape moved. Both paths now read
 * the same site list.
 *
 * @module render/connector-authoring
 */
import type { PptxElement } from 'pptx-viewer-core';

import { getShapeConnectionSites } from './connector-reroute';

/** A resolved endpoint: which shape, which of its connection sites. */
export interface ConnectorEndpointRef {
	element: PptxElement;
	siteIndex: number;
}

/** The geometry and bindings a new connector needs, in slide pixels. */
export interface AuthoredConnector {
	x: number;
	y: number;
	width: number;
	height: number;
	/** Preset chosen from the span; see {@link connectorPresetForSpan}. */
	shapeType: string;
	startConnection: { shapeId: string; connectionSiteIndex: number };
	endConnection: { shapeId: string; connectionSiteIndex: number };
}

/** Span below which a connector stays straight, in slide px. */
const STRAIGHT_MAX_SPAN = 100;
/** Span below which a connector elbows rather than curves, in slide px. */
const ELBOW_MAX_SPAN = 300;

/**
 * The preset a connector of this span should use.
 *
 * A short hop reads best as a straight rule, a medium one as an elbow, and a
 * long one as a curve, which is roughly what PowerPoint's own connector tool
 * produces when you drag between two shapes.
 */
export function connectorPresetForSpan(span: number): string {
	if (span < STRAIGHT_MAX_SPAN) {
		return 'straightConnector1';
	}
	return span < ELBOW_MAX_SPAN ? 'bentConnector3' : 'curvedConnector3';
}

/**
 * The id a connector endpoint should reference this element by.
 *
 * Prefers the OOXML `p:cNvPr/@id` the parser kept on `shapeId`, because that is
 * what `a:stCxn/@id` must contain for the saved package to be valid; falls back
 * to the model id for an element minted in the session, which has no cNvPr id
 * until save time. `connector-reroute` resolves both spellings.
 */
export function connectorEndpointId(element: PptxElement): string {
	return element.shapeId ?? element.id;
}

/**
 * The absolute slide-pixel point of one endpoint.
 *
 * Resolved through `getShapeConnectionSites`, so a site index means the same
 * thing here as it does to the reroute.
 */
export function connectorEndpointPoint(endpoint: ConnectorEndpointRef): { x: number; y: number } {
	const sites = getShapeConnectionSites(endpoint.element);
	const site = sites[endpoint.siteIndex] ?? sites[0];
	return { x: endpoint.element.x + site.x, y: endpoint.element.y + site.y };
}

/**
 * Describe the connector a drag from `start` to `end` should create, or `null`
 * when the drag does not describe one (no target, or both ends on one shape:
 * PowerPoint will not bind a connector to a single shape twice).
 */
export function authorConnectorBetweenSites(
	start: ConnectorEndpointRef,
	end: ConnectorEndpointRef,
): AuthoredConnector | null {
	if (start.element.id === end.element.id) {
		return null;
	}

	const from = connectorEndpointPoint(start);
	const to = connectorEndpointPoint(end);
	const dx = to.x - from.x;
	const dy = to.y - from.y;

	return {
		x: Math.min(from.x, to.x),
		y: Math.min(from.y, to.y),
		// A purely horizontal or vertical connector has one zero dimension, which
		// would collapse its SVG viewBox; one pixel keeps it paintable.
		width: Math.abs(dx) || 1,
		height: Math.abs(dy) || 1,
		shapeType: connectorPresetForSpan(Math.sqrt(dx * dx + dy * dy)),
		startConnection: {
			shapeId: connectorEndpointId(start.element),
			connectionSiteIndex: start.siteIndex,
		},
		endConnection: {
			shapeId: connectorEndpointId(end.element),
			connectionSiteIndex: end.siteIndex,
		},
	};
}
