/**
 * Thin re-export shim over `pptx-viewer-shared`'s canvas image colour-change
 * (`<a:clrChange>` chroma keying). The pure pixel logic + cache now live in
 * shared (consumed identically by Vue and Angular); this module preserves the
 * React package's historical public symbol surface.
 *
 * @module image-effects
 */

export type { RgbColor, ColorChangeResult } from 'pptx-viewer-shared';
export {
	parseHexToRgb,
	colorDistance,
	MAX_COLOR_DISTANCE,
	toleranceToThreshold,
	replacePixels,
	DEFAULT_COLOR_CHANGE_TOLERANCE,
	applyColorChange,
	buildCacheKey,
	getCachedResult,
	setCachedResult,
} from 'pptx-viewer-shared';
