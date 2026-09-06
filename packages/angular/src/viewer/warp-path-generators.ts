/**
 * SVG path generators for WordArt text warp presets.
 *
 * The path-generator implementations (`getWarpPath`, `WARP_PATH_GENERATORS`,
 * `WarpPathGenerator`) are mathematically identical to the framework-agnostic
 * versions in `pptx-viewer-shared` (`render/text-warp.ts`), so they are
 * re-exported from the vendored shared barrel rather than duplicated here.
 *
 * `SVG_WARP_PRESETS` / `shouldUseSvgWarp` used to be a LOCAL, deliberately
 * NARROWER copy: the Angular renderer (`text-warp.ts`) routed only this subset
 * to `<textPath>` and CSS-approximated the envelope/simple families for
 * everything else. That was a cross-binding parity bug, not an intentional
 * scope: React and Vanilla import shared's `shouldUseSvgWarp` directly (the
 * BROAD set, every path-renderable preset) and already rendered inflate/
 * deflate/can/slant/fade/cascade as true SVG textPath, so Angular silently
 * fell back to a flat CSS-transform approximation for the same presets. Now
 * re-exported straight from shared so Angular can never drift from it again.
 */
export {
	getWarpPath,
	WARP_PATH_GENERATORS,
	SVG_WARP_PRESETS,
	shouldUseSvgWarp,
} from '../internal/shared';
export type { WarpPathGenerator } from '../internal/shared';
