import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import {
	buildHollowHitOutline,
	buildStrokeOutline,
	buildSubpathFillOverlay,
	getComputedEffectStyle,
	getDuotoneSvgFilter,
	getSoftEdgeSvgFilter,
	isPatternPaint,
	strokeOutlineViewBox,
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
 * Stroked SVG OUTLINE painted over the element, following the shape's own
 * geometry, for the two cases a CSS `border` cannot paint:
 *
 *  - a gradient / pattern line (`a:ln/a:gradFill`, `a:ln/a:pattFill`): a border
 *    takes a single flat colour, so a gradient outline was drawn with the
 *    parser's averaged `strokeColor` and a patterned one lost its hatching;
 *  - a stroke-only ("open") preset (`line`, `arc`, the connector family): it has
 *    no region to fill and no box to outline, so a border drew a RECTANGLE.
 *
 * `element-styles.ts` drops the CSS border for these shapes so neither the flat
 * colour nor the box shows underneath this overlay.
 */
/**
 * Transparent outline hit band for an unfilled, textless shape. Its container is
 * `pointer-events: none` so clicks fall through to whatever it is drawn over;
 * this opts the OUTLINE back in (same trick as the connector hit target).
 */
export function renderHollowHitOutline(doc: Document, element: PptxElement): SVGSVGElement | null {
	const hit = buildHollowHitOutline(element);
	if (!hit) {
		return null;
	}
	const svg = createSvgEl(doc, 'svg', {
		'aria-hidden': 'true',
		viewBox: strokeOutlineViewBox(element),
		preserveAspectRatio: 'none',
	});
	svg.setAttribute(
		'style',
		'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none',
	);
	const path = createSvgEl(doc, 'path', {
		d: hit.d,
		fill: 'none',
		stroke: 'transparent',
		'stroke-width': hit.strokeWidth,
	});
	path.setAttribute('style', 'pointer-events:stroke');
	svg.appendChild(path);
	return svg;
}

/**
 * Per-sub-path FILL overlay, for a multi-sub-path preset (`smileyFace`'s open
 * eyes, `actionButtonBlank`'s darkened bevel well) or custom geometry whose
 * sub-paths carry their own `@fill` mode, which cannot share one CSS
 * `background-color`. `element-styles.ts` drops the container fill for these
 * (via shared `suppressesCssFill`) so this layered SVG paints it instead, each
 * sub-path with its own resolved fill. Returns `null` for the ordinary case
 * (a single merged fill is correct).
 */
export function renderShapeSubpathFillOverlay(
	doc: Document,
	element: PptxElement,
): SVGSVGElement | null {
	const overlay = buildSubpathFillOverlay(element);
	if (!overlay) {
		return null;
	}
	const svg = createSvgEl(doc, 'svg', {
		class: 'pptx-vanilla-subpath-fill',
		'aria-hidden': 'true',
		viewBox: `0 0 ${overlay.viewBoxWidth} ${overlay.viewBoxHeight}`,
		preserveAspectRatio: 'none',
	});
	svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%');
	for (const paint of overlay.paints) {
		const path = createSvgEl(doc, 'path', { d: paint.d, fill: paint.fill, stroke: 'none' });
		svg.appendChild(path);
	}
	return svg;
}

export function renderStrokeOutline(doc: Document, element: PptxElement): SVGSVGElement | null {
	const outline = buildStrokeOutline(element);
	if (!outline) {
		return null;
	}
	const svg = createSvgEl(doc, 'svg', {
		class: 'pptx-vanilla-gradient-outline',
		'aria-hidden': 'true',
		viewBox: strokeOutlineViewBox(element),
		preserveAspectRatio: 'none',
	});
	svg.setAttribute(
		'style',
		'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none',
	);
	// A flat-coloured outline (an open preset) needs no paint server at all.
	if (outline.paint) {
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
	}
	for (const strand of outline.strands) {
		const path = createSvgEl(doc, 'path', {
			d: outline.d,
			fill: 'none',
			stroke: outline.stroke,
			'stroke-width': strand.strokeWidth,
			'stroke-linecap': outline.lineCap,
			'stroke-linejoin': outline.lineJoin,
		});
		if (outline.dashArray) {
			path.setAttribute('stroke-dasharray', outline.dashArray);
		}
		if (strand.offset !== 0) {
			path.setAttribute('style', `transform:translate(0, ${strand.offset}px)`);
		}
		svg.appendChild(path);
	}
	return svg;
}
