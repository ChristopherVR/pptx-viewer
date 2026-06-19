/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The A* orthogonal path search + path simplification now live in
 * `pptx-viewer-shared` (`render/connector-router-astar`). This shim preserves
 * the historical import surface (`aStarOrthogonal`, `simplifyPath`).
 */
export { aStarOrthogonal, simplifyPath } from 'pptx-viewer-shared';
