import { buildParagraphs, getContainerStyle } from 'pptx-viewer-shared';

import { composeTransforms, createEl } from '../dom';
import { getShapeFillStrokeStyle, getTextBlockStyle } from '../element-styles';
import type { ElementRenderer } from '../types';
import { renderTextBlock } from './text-block';

/**
 * Renderer for `text` and `shape` elements: an absolutely positioned box with
 * the shared fill/stroke/effects/geometry style, containing the element's
 * rich text (when any) built by the shared `buildParagraphs`.
 *
 * Known simplifications vs. the Vue/React bindings (candidates for follow-up
 * renderers): WordArt text warp, OMML equations, duotone SVG filter defs, and
 * 3D extrusion side panels are not rendered (the base 3D transform and the
 * box-shadow extrusion approximation from the shared style builders are).
 */
export const renderTextShapeElement: ElementRenderer = (element, zIndex, context) => {
	const container = getContainerStyle(element, zIndex);
	const shape = getShapeFillStrokeStyle(element);
	// The shape style may carry a 3D transform; compose it with the container's
	// rotation/flip transform instead of letting the merge clobber it.
	const merged = { ...container, ...shape };
	const transform = composeTransforms(container['transform'], shape['transform']);
	if (transform !== undefined) {
		merged['transform'] = transform;
	}

	const el = createEl(context.document, 'div', 'pptxv-element pptxv-shape', merged);
	el.dataset.elementId = element.id;

	const paragraphs = buildParagraphs(element);
	const hasText = paragraphs.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined);
	if (hasText) {
		el.appendChild(renderTextBlock(context.document, paragraphs, getTextBlockStyle(element)));
	}

	return el;
};
