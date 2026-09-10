import { GIF_POST_CAPTURE_MAX_SIDE } from './gif-encoder';

/**
 * Export formats whose slide capture is governed by
 * {@link resolveExportCaptureDecision}. Both rasterise every slide to a
 * canvas up front (unlike PNG/PDF, which have their own per-call
 * `scale`/`imageExportScale` plumbing already wired through
 * `resolveImageResolutionScale`), so GIF and video are the two formats that
 * drifted per-binding before this module existed.
 */
export type ExportCaptureFormat = 'gif' | 'video';

/** The capture-scale + post-capture sizing decision for a GIF/video export. */
export interface ExportCaptureDecision {
	/** Raster scale multiplier to capture each slide at, before encoding. */
	scale: number;
	/**
	 * Longest allowed frame side in pixels after capture, or `undefined` when
	 * the format has no post-capture cap. Video has none: `MediaRecorder`
	 * streams the captured resolution directly, so there is no per-frame
	 * palette-quantisation cost to bound the way GIF has.
	 */
	postCaptureMaxSide?: number;
}

/**
 * Baseline capture-scale multiplier before the Options > Advanced > Default
 * Resolution factor, matching PNG/PDF export's own baseline (see
 * `resolveImageResolutionScale` in `render/options/viewer-options-apply.ts`
 * and every binding's `2 * resolveImageResolutionScale(options)` PNG/PDF
 * scale) so a deck captured for GIF/video looks as sharp, at the same
 * Options setting, as one captured for PNG/PDF.
 */
const EXPORT_CAPTURE_BASE_SCALE = 2;

/**
 * Pure decision function for GIF/video slide capture.
 *
 * The same File > Options > Advanced > Default Resolution setting that
 * governs PNG/PDF export should also govern how sharp a GIF/video frame
 * capture is: `imageResolutionScale` is the caller's already-resolved
 * `resolveImageResolutionScale(options)` multiplier (1 at the default "High
 * fidelity" preset). GIF's per-frame 256-colour palette quantisation cost
 * should still be bounded by a post-capture downscale
 * (`clampGifDimensions`/`GIF_POST_CAPTURE_MAX_SIDE`) no matter how high the
 * capture scale ends up; video has no such cap.
 *
 * Every binding should call this once per GIF/video export instead of
 * hardcoding its own capture scale or omitting the post-capture cap: before
 * this function existed, React and Angular captured GIF/video at fixed
 * scales that ignored the Default Resolution option entirely, and only
 * some bindings applied the post-capture GIF cap (and one that did used a
 * different cap value than the others).
 */
export function resolveExportCaptureDecision(
	imageResolutionScale: number,
	format: ExportCaptureFormat,
): ExportCaptureDecision {
	const scale = EXPORT_CAPTURE_BASE_SCALE * imageResolutionScale;
	if (format === 'gif') {
		return { scale, postCaptureMaxSide: GIF_POST_CAPTURE_MAX_SIDE };
	}
	return { scale };
}
