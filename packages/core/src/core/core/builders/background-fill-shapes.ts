/**
 * `background-fill-shapes`: resolve `<p:sp useBgFill="1">` against the slide's
 * own background.
 *
 * A shape carrying the attribute paints with the SLIDE BACKGROUND's fill, not
 * its own and not its theme style's. PowerPoint's designer emits full-bleed
 * panels this way and gives them an `a:fillRef` pointing at `accent1` anyway, so
 * a renderer that honours only the style reference paints the panel in the
 * accent colour: a black-and-white title slide comes out black-and-blue.
 *
 * The shape parser cannot resolve it on its own (the slide's background is
 * assembled later, and may be inherited from the layout or master), so the load
 * pipeline calls {@link applyBackgroundFillToShapes} once both are known.
 *
 * @module background-fill-shapes
 */

import type { PptxElement, PptxSlideBackgroundPattern, ShapeStyle } from '../../types';
import { hasShapeProperties } from '../../types';

/** The resolved background of the slide these shapes belong to. */
export interface ResolvedSlideBackground {
	backgroundColor?: string;
	backgroundGradient?: string;
	backgroundImage?: string;
	backgroundPattern?: PptxSlideBackgroundPattern;
}

/**
 * Copy `background` onto every element whose style asked for the slide's
 * background fill, recursing into groups. Mutates in place and is a no-op for
 * decks with no such shape (the overwhelmingly common case).
 */
export function applyBackgroundFillToShapes(
	elements: PptxElement[],
	background: ResolvedSlideBackground,
): void {
	for (const element of elements) {
		if (element.type === 'group' && Array.isArray(element.children)) {
			applyBackgroundFillToShapes(element.children, background);
		}
		if (!hasShapeProperties(element) || !element.shapeStyle?.useBackgroundFill) {
			continue;
		}
		applyBackground(element.shapeStyle, background);
	}
}

/**
 * Replace a style's fill with the slide background's. The image / gradient /
 * pattern cases mirror the precedence a slide's own background rendering uses:
 * an image wins over a gradient, which wins over a flat colour.
 */
function applyBackground(style: ShapeStyle, background: ResolvedSlideBackground): void {
	if (background.backgroundImage) {
		style.fillMode = 'image';
		style.fillImageUrl = background.backgroundImage;
		style.fillColor = 'transparent';
		style.fillOpacity = 1;
		return;
	}
	if (background.backgroundGradient) {
		style.fillMode = 'gradient';
		style.fillGradient = background.backgroundGradient;
		style.fillOpacity = 1;
		return;
	}
	if (background.backgroundPattern) {
		style.fillMode = 'pattern';
		style.fillPatternPreset = background.backgroundPattern.preset;
		style.fillColor = background.backgroundPattern.fgColor;
		style.fillPatternBackgroundColor = background.backgroundPattern.bgColor;
		style.fillOpacity = 1;
		return;
	}
	if (background.backgroundColor) {
		style.fillMode = 'solid';
		style.fillColor = background.backgroundColor;
		style.fillOpacity = 1;
		return;
	}
	// No resolvable background: paint nothing rather than fall back to the theme
	// accent the `a:fillRef` would otherwise supply.
	style.fillMode = 'none';
	style.fillColor = 'transparent';
	style.fillOpacity = 0;
}
