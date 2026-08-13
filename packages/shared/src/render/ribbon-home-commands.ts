/**
 * `ribbon-home-commands` - the Home tab's three structurally-dead commands
 * (Reset, Shape Fill, Shape Outline) expressed as pure decision functions.
 *
 * WHY shared: React and Vue shipped all three as controls with the right label
 * and the right enabled state and no effect whatsoever. React's swatches wrote
 * `{ fill }` / `{ outlineColor }`, which are not fields of `ShapeStyle`
 * (`fillColor` / `strokeColor` are), so the buttons would still have done
 * nothing had the handler ever been passed down. Naming the change once here
 * is what stops a sixth spelling of the same two keys appearing.
 *
 * @module render/ribbon-home-commands
 */
import type { PptxSlide, ShapeStyle } from 'pptx-viewer-core';

/**
 * The layout PowerPoint's Home > Reset re-applies to the active slide,
 * restoring inherited placeholder geometry and formatting. Returns undefined
 * when the slide records no layout, in which case Reset has nothing to do and
 * the control must be inert rather than destructive.
 */
export function resetSlideLayoutPath(slide: PptxSlide | undefined): string | undefined {
	const path = slide?.layoutPath;
	return typeof path === 'string' && path !== '' ? path : undefined;
}

/** The style change Home > Shape Fill commits for a picked swatch. */
export function shapeFillChange(hex: string): Partial<ShapeStyle> {
	return { fillColor: hex, fillMode: 'solid' };
}

/** The style change Home > Shape Outline commits for a picked swatch. */
export function shapeOutlineChange(hex: string): Partial<ShapeStyle> {
	return { strokeColor: hex };
}

/**
 * The swatch grid both pickers show: PowerPoint's Standard Colors row plus
 * black/white, which is what the vanilla binding already offered and what the
 * other four each re-listed differently.
 */
export const RIBBON_SHAPE_SWATCHES: readonly string[] = [
	'#ffffff',
	'#000000',
	'#c00000',
	'#ff0000',
	'#ffc000',
	'#ffff00',
	'#92d050',
	'#00b050',
	'#00b0f0',
	'#0070c0',
	'#002060',
	'#7030a0',
];
