import { buildParagraphs, getContainerStyle } from 'pptx-viewer-shared';

import { composeTransforms, createEl } from '../dom';
import { getShapeFillStrokeStyle, getTextBlockStyle } from '../element-styles';
import type { ElementRenderer } from '../types';
import { renderEquations } from './equation';
import { renderExtrusionOverlay } from './extrusion-overlay';
import { renderShapeFilterDefs } from './shape-filter-defs';
import { renderTextBlock } from './text-block';
import { renderWarpedText } from './text-warp';

/**
 * Renderer for `text` and `shape` elements: an absolutely positioned box with
 * the shared fill/stroke/effects/geometry style, containing the element's
 * rich text (when any) built by the shared `buildParagraphs`.
 *
 * Specialised DOM helpers provide WordArt text warp, OMML equations, shape
 * duotone SVG filter definitions, and CSS 3D extrusion side panels.
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

	const extrusion = renderExtrusionOverlay(context.document, element);
	if (extrusion) {
		el.appendChild(extrusion);
	}
	const filterDefs = renderShapeFilterDefs(context.document, element);
	if (filterDefs) {
		el.appendChild(filterDefs);
	}

	const equation = renderEquations(element, context);
	const warped = equation ? null : renderWarpedText(element, context);
	if (equation) {
		el.appendChild(equation);
	} else if (warped) {
		el.appendChild(warped);
	} else {
		const paragraphs = buildParagraphs(element);
		const hasText = paragraphs.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined);
		if (hasText) {
			el.appendChild(renderTextBlock(context.document, paragraphs, getTextBlockStyle(element)));
		}
	}

	return el;
};
