import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import {
	buildStrokeOutline,
	getComputedEffectStyle,
	getDuotoneSvgFilter,
	getSoftEdgeSvgFilter,
	svgGradientFillRef,
	isPatternPaint,
	svgGradientMarkup,
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

/**
 * Gradient / pattern OUTLINE (`a:ln/a:gradFill`, `a:ln/a:pattFill`) painted as a
 * stroked SVG path over the element, following the shape's own geometry.
 *
 * A CSS `border` takes a single flat colour, so a gradient outline was drawn
 * with the parser's averaged `strokeColor` and a patterned one lost its hatching
 * entirely. `element-styles.ts` drops the CSS border for these shapes so the
 * flat colour does not show underneath this overlay.
 */
export function renderStrokeOutline(doc: Document, element: PptxElement): SVGSVGElement | null {
	const outline = buildStrokeOutline(element);
	if (!outline) {
		return null;
	}
	const svg = createSvgEl(doc, 'svg', {
		class: 'pptx-vanilla-gradient-outline',
		'aria-hidden': 'true',
		viewBox: `0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`,
		preserveAspectRatio: 'none',
	});
	svg.setAttribute(
		'style',
		'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none',
	);
	const defs = createSvgEl(doc, 'defs');
	if (isPatternPaint(outline.paint)) {
		// The tile rides in as a data-URI <image> so the same descriptor renders
		// from plain attributes in every binding.
		const pattern = createSvgEl(doc, 'pattern', {
			id: outline.paint.id,
			width: outline.paint.width,
			height: outline.paint.height,
			patternUnits: 'userSpaceOnUse',
		});
		const image = createSvgEl(doc, 'image', {
			href: outline.paint.href,
			width: outline.paint.width,
			height: outline.paint.height,
		});
		pattern.appendChild(image);
		defs.appendChild(pattern);
	} else {
		defs.innerHTML = svgGradientMarkup(outline.paint);
	}
	svg.appendChild(defs);
	const path = createSvgEl(doc, 'path', {
		d: outline.d,
		fill: 'none',
		stroke: svgGradientFillRef(outline.paint),
		'stroke-width': outline.strokeWidth,
		'stroke-linecap': outline.lineCap,
		'stroke-linejoin': outline.lineJoin,
	});
	if (outline.dashArray) {
		path.setAttribute('stroke-dasharray', outline.dashArray);
	}
	svg.appendChild(path);
	return svg;
}
