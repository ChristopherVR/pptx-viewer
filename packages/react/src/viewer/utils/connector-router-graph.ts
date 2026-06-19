/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Graph-building helpers for the orthogonal connector router now live in
 * `pptx-viewer-shared` (`render/connector-router-graph`). This shim preserves
 * the historical import surface so colocated consumers/tests are unchanged.
 */
export {
	PADDING_DEFAULT,
	inflateRect,
	pointInRect,
	segmentIntersectsRect,
	directPathClear,
	heuristic,
	pointKey,
	buildGraphNodes,
} from 'pptx-viewer-shared';
