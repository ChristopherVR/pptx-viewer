/**
 * `connector-endpoints`: attaching and detaching a connector's ends on canvas.
 *
 * `connector-reroute` keeps a BOUND connector following its shapes and
 * `connector-authoring` turns a site-to-site drag into a new connector. Neither
 * lets the user change an existing connector's bindings, which is what
 * PowerPoint's two endpoint handles do: drag one onto a shape and it gains an
 * `a:stCxn` / `a:endCxn` and starts following that shape; drag it onto empty
 * canvas and the binding is removed and the end stays where it is dropped.
 *
 * That was implemented in no binding at all. React shipped a `ConnectorOverlay`
 * for the site-to-site creation gesture, but nothing ever passed the
 * `connectorCreationMode` / `onCreateConnector` props that mount it, so the
 * whole path was unreachable; the other four had no overlay in the first place.
 *
 * Everything here is slide-pixel space and free of framework imports: a binding
 * supplies pointer positions already converted out of screen space, and applies
 * the returned descriptor.
 *
 * @module render/connector-endpoints
 */
import type { PptxElement } from 'pptx-viewer-core';

import { getShapeConnectionSites } from './connector-reroute';
import type { ConnectorConnectionRef } from './connector-reroute';

/** Which end of a connector a gesture is moving. */
export type ConnectorEndpointKind = 'start' | 'end';

/** One draggable endpoint of a selected connector, in slide px. */
export interface ConnectorEndpointHandle {
	kind: ConnectorEndpointKind;
	x: number;
	y: number;
	/** True when the end carries an `a:stCxn` / `a:endCxn` binding. */
	attached: boolean;
}

/** A connection site a dragged endpoint can be dropped onto, in slide px. */
export interface ConnectorSiteCandidate {
	/** The target element's model id (what a canvas has in hand). */
	elementId: string;
	/** The id the binding must reference: `p:cNvPr/@id` when the deck has one. */
	shapeId: string;
	siteIndex: number;
	x: number;
	y: number;
}

/** Structural view of the connector fields this module reads and writes. */
interface ConnectorStyleFields {
	connectorStartConnection?: ConnectorConnectionRef;
	connectorEndConnection?: ConnectorConnectionRef;
}

/** Default snap radius in slide px, matching the site dot's own hit area. */
export const CONNECTOR_SITE_SNAP_PX = 14;

function connectorStyleOf(connector: PptxElement): ConnectorStyleFields {
	// `shapeStyle` is absent from some members of the `PptxElement` union (a
	// table has none), so it is read structurally rather than off the union.
	return ((connector as { shapeStyle?: unknown }).shapeStyle ?? {}) as ConnectorStyleFields;
}

/**
 * The two endpoints of `connector`, in slide px.
 *
 * The flip flags decide which corner of the bounding box each end sits on:
 * `getConnectorPathGeometry` derives the line's direction from them, so a
 * connector drawn right-to-left has its START at `x + width`. Reading the
 * corners any other way puts the handles on the wrong ends and an endpoint drag
 * silently reverses the arrowhead.
 */
export function getConnectorEndpointHandles(connector: PptxElement): ConnectorEndpointHandle[] {
	const style = connectorStyleOf(connector);
	const left = connector.x;
	const top = connector.y;
	const right = connector.x + connector.width;
	const bottom = connector.y + connector.height;
	const startX = connector.flipHorizontal ? right : left;
	const startY = connector.flipVertical ? bottom : top;
	return [
		{
			kind: 'start',
			x: startX,
			y: startY,
			attached: style.connectorStartConnection?.shapeId !== undefined,
		},
		{
			kind: 'end',
			x: connector.flipHorizontal ? left : right,
			y: connector.flipVertical ? top : bottom,
			attached: style.connectorEndConnection?.shapeId !== undefined,
		},
	];
}

/**
 * Every connection site on the slide a connector end could bind to.
 *
 * Resolved through `getShapeConnectionSites`, the SAME list the reroute reads,
 * so a site dot is drawn exactly where the connector will land. React's overlay
 * used the four-edge-midpoint fallback instead, which meant that on any shape
 * carrying a real `a:cxnLst` the dots were drawn in one place and the connector
 * jumped to another the first time the shape moved.
 */
export function collectConnectorSiteCandidates(
	elements: readonly PptxElement[],
): ConnectorSiteCandidate[] {
	const candidates: ConnectorSiteCandidate[] = [];
	for (const element of elements) {
		if (element.type === 'connector' || element.type === 'ink') {
			continue;
		}
		for (const site of getShapeConnectionSites(element)) {
			candidates.push({
				elementId: element.id,
				shapeId: element.shapeId ?? element.id,
				siteIndex: site.index,
				x: element.x + site.x,
				y: element.y + site.y,
			});
		}
	}
	return candidates;
}

/** The nearest candidate within `radius` slide px of the point, or `null`. */
export function findConnectorSiteNear(
	candidates: readonly ConnectorSiteCandidate[],
	x: number,
	y: number,
	radius: number = CONNECTOR_SITE_SNAP_PX,
): ConnectorSiteCandidate | null {
	let best: ConnectorSiteCandidate | null = null;
	let bestDistance = radius;
	for (const candidate of candidates) {
		const distance = Math.hypot(candidate.x - x, candidate.y - y);
		if (distance <= bestDistance) {
			bestDistance = distance;
			best = candidate;
		}
	}
	return best;
}

/** The geometry + bindings a connector takes after one of its ends is moved. */
export interface ConnectorEndpointUpdate {
	x: number;
	y: number;
	width: number;
	height: number;
	flipHorizontal: boolean;
	flipVertical: boolean;
	/** `undefined` means DETACHED: the binding must be removed, not kept. */
	startConnection?: { shapeId: string; connectionSiteIndex: number };
	endConnection?: { shapeId: string; connectionSiteIndex: number };
}

/** Where an end currently sits, following its binding when it has one. */
function resolveExistingEnd(
	connector: PptxElement,
	kind: ConnectorEndpointKind,
	elements: readonly PptxElement[],
): { x: number; y: number } {
	const style = connectorStyleOf(connector);
	const ref = kind === 'start' ? style.connectorStartConnection : style.connectorEndConnection;
	if (ref?.shapeId) {
		const target = elements.find(
			(element) => element.shapeId === ref.shapeId || element.id === ref.shapeId,
		);
		if (target) {
			const sites = getShapeConnectionSites(target);
			const site = sites[ref.connectionSiteIndex ?? 0] ?? sites[0];
			return { x: target.x + site.x, y: target.y + site.y };
		}
	}
	const handle = getConnectorEndpointHandles(connector).find((h) => h.kind === kind);
	return { x: handle?.x ?? connector.x, y: handle?.y ?? connector.y };
}

/**
 * The connector that results from dropping `kind` at `point`.
 *
 * `target` is the connection site the drop snapped to, or `null` for a drop on
 * empty canvas, which DETACHES that end: the returned update omits the binding
 * so the caller deletes it rather than leaving a stale `a:stCxn` pointing at a
 * shape the line no longer touches.
 */
export function resolveConnectorEndpointUpdate(
	connector: PptxElement,
	elements: readonly PptxElement[],
	kind: ConnectorEndpointKind,
	point: { x: number; y: number },
	target: ConnectorSiteCandidate | null,
): ConnectorEndpointUpdate {
	const style = connectorStyleOf(connector);
	const moved = target ? { x: target.x, y: target.y } : point;
	const other = resolveExistingEnd(connector, kind === 'start' ? 'end' : 'start', elements);
	const start = kind === 'start' ? moved : other;
	const end = kind === 'start' ? other : moved;

	const binding = target
		? { shapeId: target.shapeId, connectionSiteIndex: target.siteIndex }
		: undefined;
	const keep = (ref: ConnectorConnectionRef | undefined) =>
		ref?.shapeId !== undefined
			? { shapeId: ref.shapeId, connectionSiteIndex: ref.connectionSiteIndex ?? 0 }
			: undefined;

	return {
		x: Math.min(start.x, end.x),
		y: Math.min(start.y, end.y),
		// A purely horizontal or vertical connector has one zero dimension, which
		// would collapse its SVG viewBox; one pixel keeps it paintable.
		width: Math.abs(end.x - start.x) || 1,
		height: Math.abs(end.y - start.y) || 1,
		flipHorizontal: end.x < start.x,
		flipVertical: end.y < start.y,
		startConnection: kind === 'start' ? binding : keep(style.connectorStartConnection),
		endConnection: kind === 'end' ? binding : keep(style.connectorEndConnection),
	};
}

/**
 * `connector` with an endpoint update applied.
 *
 * Shared so no binding re-implements the spread, and so a DETACHED end really
 * loses its `connectorStartConnection` / `connectorEndConnection` key instead of
 * keeping an undefined one that later code would treat as still bound.
 */
export function withConnectorEndpointUpdate(
	connector: PptxElement,
	update: ConnectorEndpointUpdate,
): PptxElement {
	const style = {
		...((connector as { shapeStyle?: Record<string, unknown> }).shapeStyle ?? {}),
	} as Record<string, unknown>;
	if (update.startConnection) {
		style.connectorStartConnection = update.startConnection;
	} else {
		delete style.connectorStartConnection;
	}
	if (update.endConnection) {
		style.connectorEndConnection = update.endConnection;
	} else {
		delete style.connectorEndConnection;
	}
	return {
		...connector,
		x: update.x,
		y: update.y,
		width: update.width,
		height: update.height,
		flipHorizontal: update.flipHorizontal,
		flipVertical: update.flipVertical,
		shapeStyle: style,
	} as unknown as PptxElement;
}
