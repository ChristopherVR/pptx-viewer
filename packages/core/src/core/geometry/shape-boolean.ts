/**
 * Shape boolean operations: union, intersect, subtract, fragment, combine.
 *
 * Implements polygon clipping using the Sutherland-Hodgman algorithm for
 * intersection and a vertex-insertion approach for union/subtract/fragment.
 * Operates on polygon-only geometry (line segments, no curves), which covers
 * the vast majority of real-world PowerPoint preset shapes.
 *
 * This file re-exports the public API from focused sub-modules:
 * - `shape-boolean-types` — Vec2 type and point-level helpers
 * - `shape-boolean-svg` — SVG path parsing / serialization
 * - `shape-boolean-clipping` — Sutherland-Hodgman and convex decomposition
 * - `shape-boolean-union` — Weiler-Atherton-inspired union walk
 * - `shape-boolean-ops` — High-level boolean operations on SVG paths
 *
 * @module geometry/shape-boolean
 */

// Types & point helpers
export type { Vec2 } from './shape-boolean-types';

// SVG path parsing / serialization
export { svgPathToPolygons, polygonsToSvgPath } from './shape-boolean-svg';

// Public boolean operations on SVG path strings
export {
	unionShapes,
	intersectShapes,
	subtractShapes,
	fragmentShapes,
	combineShapes,
	mergeShapes,
	unionPolygons,
	intersectPolygons,
	subtractPolygons,
	unionSvgPaths,
	intersectSvgPaths,
	subtractSvgPaths,
} from './shape-boolean-ops';
export type { MergeShapeOperation } from './shape-boolean-ops';
