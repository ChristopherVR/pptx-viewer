/**
 * Core color utility functions for the PowerPoint viewer/editor: thin
 * re-export shim over `pptx-viewer-shared`.
 *
 * The low-level hex/rgb/opacity primitives and the CSS shadow/glow/reflection
 * builders now live in `pptx-viewer-shared` (`fill-style` + `visual-effects`),
 * consumed identically by the Vue and Angular bindings. This module preserves
 * the React package's historical public symbol surface so its ~18 importers and
 * colocated tests keep importing unchanged names.
 *
 * Note on the `normalizeHexColor` default-fallback divergence: shared's
 * `normalizeHexColor` now takes an *optional* `fallback` defaulting to
 * `DEFAULT_TEXT_COLOR` (`#111827`, identical to this binding's constant), so the
 * React single-arg call sites that relied on a default keep working from the
 * single canonical implementation: no duplicate definition, no barrel clash.
 */
export {
	createArrayBufferCopy,
	normalizeHexColor,
	clampUnitInterval,
	hexToRgbChannels,
	colorWithOpacity,
	clampCropValue,
	buildShadowCssFromShapeStyle,
	buildInnerShadowCssFromShapeStyle,
	buildMultiLayerShadowCss,
	buildGlowBoxShadow,
	buildReflectionCss,
} from 'pptx-viewer-shared';
