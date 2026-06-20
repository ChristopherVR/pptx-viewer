/**
 * SVG path generators for WordArt text warp presets.
 *
 * The path-generator implementations (`getWarpPath`, `WARP_PATH_GENERATORS`,
 * `WarpPathGenerator`) are mathematically identical to the framework-agnostic
 * versions in `pptx-viewer-shared` (`render/text-warp.ts`), so they are
 * re-exported from the vendored shared barrel rather than duplicated here.
 *
 * `SVG_WARP_PRESETS` / `shouldUseSvgWarp` are kept LOCAL on purpose: the Angular
 * renderer (`text-warp.ts`) treats only this *narrow* set as `<textPath>`-routed
 * presets and CSS-approximates the envelope/simple families. Shared's
 * `SVG_WARP_PRESETS` is a broader set (every path-renderable preset), so it must
 * not be substituted here; doing so would route envelope/simple presets to
 * `<textPath>` and break the css-strategy routing (and its tests).
 */
import type { PptxTextWarpPreset } from 'pptx-viewer-core';

export { getWarpPath, WARP_PATH_GENERATORS } from '../internal/shared';
export type { WarpPathGenerator } from '../internal/shared';

/**
 * Presets that the Angular renderer draws with SVG `<textPath>` along a
 * curved/circular path. Envelope (inflate/deflate/can) and simple (slant/fade/
 * cascade) presets are intentionally absent; they are CSS-approximated by
 * `text-warp.ts`. This set must stay in sync with that file's `PATH_PRESETS`.
 */
export const SVG_WARP_PRESETS: ReadonlySet<string> = new Set([
	'textArchUp',
	'textArchDown',
	'textCircle',
	'textWave1',
	'textWave2',
	'textWave4',
	'textDoubleWave1',
	'textCurveUp',
	'textCurveDown',
	'textArchUpPour',
	'textArchDownPour',
	'textCirclePour',
	'textButton',
	'textButtonPour',
	'textRingInside',
	'textRingOutside',
	'textTriangle',
	'textTriangleInverted',
	'textChevron',
	'textChevronInverted',
	'textStop',
]);

/** Returns `true` when the preset should use SVG `<textPath>` rendering. */
export function shouldUseSvgWarp(preset: PptxTextWarpPreset | undefined): boolean {
	if (!preset || preset === 'textNoShape' || preset === 'textPlain') {
		return false;
	}
	return SVG_WARP_PRESETS.has(preset);
}
