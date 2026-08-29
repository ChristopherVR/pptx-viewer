/**
 * Snapshot the static shape colours that a relative `p:animClr/p:by/p:hsl`
 * keyframe uses after the binding relinquishes its ordinary fill / stroke.
 * Kept framework-neutral so all five renderers feed the same CSS variables.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

import { ANIMATION_COLOR_BASE_PROPERTIES } from './animation-color';
import type { CssStyleMap } from './element-style-transform';
import { getComputedFillStyle } from './fill-style';
import { getComputedStrokeStyle } from './stroke-style';

export interface AnimationColorBaseStyleOptions {
	animatesFill?: boolean;
	animatesStroke?: boolean;
	parentGroupFill?: ShapeStyle;
}

/**
 * Build CSS custom properties only while a paint animation is active, keeping
 * ordinary rendering and existing style snapshots unchanged.
 */
export function getAnimationColorBaseStyle(
	element: PptxElement,
	options: AnimationColorBaseStyleOptions = {},
): CssStyleMap {
	if (!hasShapeProperties(element) || (!options.animatesFill && !options.animatesStroke)) {
		return {};
	}

	const style: CssStyleMap = {};
	if (options.animatesFill) {
		const fill = getComputedFillStyle(element, options.parentGroupFill);
		style[ANIMATION_COLOR_BASE_PROPERTIES.fill] =
			fill?.backgroundColor ?? element.shapeStyle?.fillColor ?? 'currentColor';
	}
	if (options.animatesStroke) {
		const stroke = getComputedStrokeStyle(element);
		style[ANIMATION_COLOR_BASE_PROPERTIES.stroke] =
			stroke.borderColor ?? element.shapeStyle?.strokeColor ?? 'currentColor';
	}
	style[ANIMATION_COLOR_BASE_PROPERTIES.color] =
		(hasTextProperties(element) ? element.textStyle?.color : undefined) ?? 'currentColor';
	return style;
}
