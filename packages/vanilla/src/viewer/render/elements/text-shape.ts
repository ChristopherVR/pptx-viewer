import { buildParagraphs, getContainerStyle, getOverflowSegments } from 'pptx-viewer-shared';

import { composeTransforms, createEl } from '../dom';
import { getShapeFillStrokeStyle, getTextBlockStyle } from '../element-styles';
import type { ElementRenderer } from '../types';
import { renderEquations } from './equation';
import { renderExtrusionOverlay } from './extrusion-overlay';
import {
	renderStrokeOutline,
	renderShapeFillOverlay,
	renderShapeFilterDefs,
} from './shape-filter-defs';
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
	// During a `p:animClr` colour animation the shape relinquishes its static
	// fill / stroke so the wrapper-level colour keyframes surface (presentation).
	const animState = context.presentationStates?.get(element.id);
	const shape = getShapeFillStrokeStyle(
		element,
		animState?.animatesFill,
		animState?.animatesStroke,
	);
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
	// DAG fill-overlay tint: a blended layer over the fill but beneath the text,
	// so the tint applies to the fill without washing out the text/children.
	const fillOverlay = renderShapeFillOverlay(context.document, element);
	if (fillOverlay) {
		el.appendChild(fillOverlay);
	}
	// Gradient / pattern outline: a CSS border takes one flat colour only.
	const gradientOutline = renderStrokeOutline(context.document, element);
	if (gradientOutline) {
		el.appendChild(gradientOutline);
	}

	const equation = renderEquations(element, context);
	const warped = equation ? null : renderWarpedText(element, context);
	if (equation) {
		el.appendChild(equation);
	} else if (warped) {
		el.appendChild(warped);
	} else {
		// `a:linkedTxbx`: a box in a linked chain paints only the slice of the
		// chain's text the preceding boxes could not hold, resolved against its
		// siblings on the slide being rendered. Returns undefined (and costs one
		// field check) for the overwhelmingly common non-chain element.
		const linkedSegments = getOverflowSegments(element, context.slide?.elements);
		const paragraphs = buildParagraphs(element, context.fieldContext, linkedSegments);
		const hasText = paragraphs.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined);
		if (hasText) {
			el.appendChild(
				renderTextBlock(context.document, paragraphs, getTextBlockStyle(element), {
					elementId: element.id,
					states: context.presentationStates,
				}),
			);
		}
	}

	return el;
};
