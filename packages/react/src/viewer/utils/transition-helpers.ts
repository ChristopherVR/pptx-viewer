/**
 * Thin re-export shim: the direction/orientation resolvers and the
 * `RANDOM_ELIGIBLE_TYPES` / `INSTANT` constants now live in
 * `pptx-viewer-shared`. Kept so existing importers (`transition-resolver`,
 * tests) resolve unchanged.
 */
export type { ResolvedDirection, ResolvedDirection8 } from 'pptx-viewer-shared';
export {
	resolveDirection,
	resolveDirection8,
	resolveOrientation,
	RANDOM_ELIGIBLE_TYPES,
	INSTANT,
} from 'pptx-viewer-shared';
