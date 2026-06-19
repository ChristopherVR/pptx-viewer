/**
 * Types for the orthogonal connector router (shared across bindings).
 *
 * Two naming conventions are exported for the same underlying shapes so that
 * the React (`RouterPoint`/`RouterRect`) and Angular (`Point`/`Rect`) consumers
 * keep their exact import surface unchanged.
 */

/** A 2-D point in pixel space. */
export interface RouterPoint {
	x: number;
	y: number;
}

/** An axis-aligned bounding rectangle in pixel space. */
export interface RouterRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Alias of {@link RouterPoint} (Angular naming). */
export type Point = RouterPoint;

/** Alias of {@link RouterRect} (Angular naming). */
export type Rect = RouterRect;

/**
 * Options for {@link routeConnector} (React-style options object).
 */
export interface ConnectorRouterOptions {
	start: RouterPoint;
	end: RouterPoint;
	obstacles: ReadonlyArray<RouterRect>;
	canvasWidth: number;
	canvasHeight: number;
	/** Padding around obstacles (px). Default 12. */
	padding?: number;
	/** When true, only produce axis-aligned segments. Default true. */
	orthogonal?: boolean;
}

/** Options for {@link routeOrthogonalConnector} (Angular naming). */
export interface OrthogonalRouterOptions {
	/** Start point (absolute pixel coordinates). */
	start: RouterPoint;
	/** End point (absolute pixel coordinates). */
	end: RouterPoint;
	/** Obstacle bounding boxes the path must avoid. */
	obstacles: ReadonlyArray<RouterRect>;
	/** Width of the routing canvas. Defaults to a large sentinel when omitted. */
	canvasWidth?: number;
	/** Height of the routing canvas. Defaults to a large sentinel when omitted. */
	canvasHeight?: number;
	/** Padding (px) expanded around each obstacle. Default {@link PADDING_DEFAULT}. */
	padding?: number;
}

/** Default obstacle padding in pixels (React naming). */
export const PADDING_DEFAULT = 12;

/** Default obstacle padding in pixels (Angular naming). Same value. */
export const ROUTING_PADDING_DEFAULT = PADDING_DEFAULT;

/** Sentinel canvas size when a caller does not supply one. */
export const CANVAS_SENTINEL = 100_000;
