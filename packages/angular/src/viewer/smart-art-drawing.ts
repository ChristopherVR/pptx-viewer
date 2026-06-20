/**
 * Thin re-export shim → vendored `pptx-viewer-shared` (`render/smartart-drawing`).
 *
 * The drawing-shape view-model helpers (palette resolution, chrome style,
 * viewBox fitting, `RenderedShape` projection) were extracted to shared and are
 * consumed by every binding. This shim preserves the historical Angular import
 * surface.
 *
 * Shared exports the SmartArt default palette as `SMARTART_DEFAULT_PALETTE`
 * (the bare `DEFAULT_PALETTE` is taken by the chart palette in shared); it is
 * re-aliased back to `DEFAULT_PALETTE` here so this binding's import sites and
 * the colocated tests are unchanged.
 */

export type { RenderedShape, DrawingViewBox } from '../internal/shared';

export {
	PALETTES,
	SMARTART_DEFAULT_PALETTE as DEFAULT_PALETTE,
	paletteColour,
	resolvePalette,
	buildChromeStyle,
	computeDrawingViewBox,
	projectDrawingShapes,
	styleShadowFilter,
} from '../internal/shared';
