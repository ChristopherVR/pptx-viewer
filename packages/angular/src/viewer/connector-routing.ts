/**
 * Thin re-export shim → vendored `pptx-viewer-shared`.
 *
 * The pure orthogonal A* connector router was extracted to `pptx-viewer-shared`
 * (`render/connector-router*`) and is consumed by every binding. This shim
 * preserves the historical Angular import surface so `connector-path.ts`,
 * `ConnectorRendererComponent`, `ElementRendererComponent`, the viewer barrel
 * and the colocated tests are unchanged.
 *
 * Naming note: shared uses `RouterPoint` / `RouterRect`; Angular historically
 * uses `Point` / `Rect`, so they are aliased here. `routeOrthogonalConnector`
 * (positional API) and `waypointsToPathD` (comma-separated SVG path) come
 * straight through from shared.
 */

export type {
	RouterPoint as Point,
	RouterRect as Rect,
	OrthogonalRouterOptions,
} from '../internal/shared';

export {
	ROUTING_PADDING_DEFAULT,
	inflateRect,
	pointInRect,
	segmentIntersectsRect,
	directPathClear,
	heuristic,
	pointKey,
	buildGraphNodes,
	aStarOrthogonal,
	simplifyPath,
	routeOrthogonalConnector,
	waypointsToPathD,
} from '../internal/shared';
