/**
 * Thin re-export shim over `pptx-viewer-shared`'s canvas duotone effect
 * (`<a:duotone>` luminance mapping). The pure pixel logic, cache, and presets
 * now live in shared (consumed identically by Vue and Angular); this module
 * preserves the React package's historical public symbol surface.
 *
 * @module duotone-effects
 */

export type { DuotonePreset } from 'pptx-viewer-shared';
export {
	mapDuotonePixels,
	applyDuotone,
	buildDuotoneCacheKey,
	getDuotoneCachedResult,
	setDuotoneCachedResult,
	DUOTONE_PRESETS,
} from 'pptx-viewer-shared';
