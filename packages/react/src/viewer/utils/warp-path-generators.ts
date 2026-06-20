/**
 * SVG path generators for WordArt text warp presets.
 *
 * Thin re-export shim: the framework-agnostic path-generation logic now lives
 * in `pptx-viewer-shared` (`render/text-warp`) and is consumed by every binding.
 * Kept here so existing React import paths (`./warp-path-generators`) keep
 * working unchanged. The public symbols are identical to the previous local
 * implementation.
 */
export type { WarpPathGenerator } from 'pptx-viewer-shared';
export {
	SVG_WARP_PRESETS,
	WARP_PATH_GENERATORS,
	shouldUseSvgWarp,
	getWarpPath,
} from 'pptx-viewer-shared';
