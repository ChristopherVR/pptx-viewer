import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import {
	getComputedEffectStyle,
	getDuotoneSvgFilter,
	getSoftEdgeSvgFilter,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';

/**
 * Hidden SVG definitions referenced by shape-level effect filters: the DAG
 * duotone recolour (`filter: url(#dag-duotone-<id>)`) and the soft-edge feather
 * (`filter: url(#soft-edge-<id>)`, emitted by shared `getEffectFilterCss`). Both
 * `filter` CSS references already ride on the shape `<div>`; this injects the
 * matching `<filter>` markup so those references resolve.
 */
export function renderShapeFilterDefs(doc: Document, element: PptxElement): SVGSVGElement | null {
	if (!hasShapeProperties(element)) {
		return null;
	}
	const markups: string[] = [];
	const duotone = getDuotoneSvgFilter(element.shapeStyle, element.id);
	if (duotone) {
		markups.push(duotone.filterMarkup);
	}
	const softEdge = getSoftEdgeSvgFilter(element.shapeStyle, element.id);
	if (softEdge) {
		markups.push(softEdge.filterMarkup);
	}
	if (markups.length === 0) {
		return null;
	}
	const svg = createSvgEl(doc, 'svg', { width: 0, height: 0, 'aria-hidden': 'true' });
	svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
	const defs = createSvgEl(doc, 'defs');
	defs.innerHTML = markups.join('');
	svg.appendChild(defs);
	return svg;
}

/**
 * DAG fill-overlay tint layer: an absolutely-positioned, blended `<div>` painted
 * over the element (rather than blending the whole element, which would also
 * tint text/children). Returns `null` when no overlay colour was parsed. Mirrors
 * Vue's `ShapeEffectOverlay` fill-overlay layer.
 */
export function renderShapeFillOverlay(doc: Document, element: PptxElement): HTMLElement | null {
	if (!hasShapeProperties(element)) {
		return null;
	}
	const overlay = getComputedEffectStyle(element).fillOverlay;
	if (!overlay) {
		return null;
	}
	const layer = createEl(doc, 'div', 'pptxv-fill-overlay', {
		position: 'absolute',
		inset: 0,
		background: overlay.color,
		mixBlendMode: overlay.blendMode,
		pointerEvents: 'none',
	});
	layer.setAttribute('aria-hidden', 'true');
	return layer;
}
