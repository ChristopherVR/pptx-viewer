/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The orthogonal connector router now lives in `pptx-viewer-shared`
 * (`render/connector-router*`). This shim preserves the historical React
 * import surface: `routeConnector` (options-object API) + `waypointsToPathData`
 * (space-separated SVG path), plus the geometry/A* helper re-exports.
 *
 * Note: shared also exports `routeOrthogonalConnector` / `waypointsToPathD`
 * (Angular-style positional API / comma-separated path), unused by React.
 */
export type { RouterPoint, RouterRect, ConnectorRouterOptions } from 'pptx-viewer-shared';

export {
	PADDING_DEFAULT,
	inflateRect,
	pointInRect,
	segmentIntersectsRect,
	directPathClear,
	heuristic,
	pointKey,
	buildGraphNodes,
	aStarOrthogonal,
	simplifyPath,
	routeConnector,
	waypointsToPathData,
} from 'pptx-viewer-shared';
