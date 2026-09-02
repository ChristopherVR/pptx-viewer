import type { ConnectorArrowType } from 'pptx-viewer-core';
import { getConnectorPathGeometry, hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import {
	buildDashArray,
	buildParagraphs,
	connectorHitStrokeWidth,
	connectorNeedsPath,
	DEFAULT_STROKE_COLOR,
	getCompoundLineOffsets,
	getCompoundLineWidths,
	getLineGlowFilterCss,
	getLineShadowParams,
	markerPath,
	normalizeArrow,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import { getTextBlockStyle } from '../element-styles';
import type { ElementRenderContext, ElementRenderer } from '../types';
import { renderTextBlock } from './text-block';

/**
 * Renderer for `connector` elements: straight, bent, and curved connectors as
 * an inline SVG spanning the element's bounding box, with stroke
 * colour/width/dash, start/end arrowheads, and compound (double/triple) line
 * support, text labels, and line-level shadow/glow effects. Vanilla port of
 * Vue's `ConnectorRenderer.vue` and React's connector effects path.
 *
 * Flip is baked into the geometry (not a CSS transform) so arrowheads point
 * the right way; only rotation goes on the wrapper transform.
 */
export const renderConnectorElement: ElementRenderer = (element, zIndex, context) => {
	const doc = context.document;
	const ss = hasShapeProperties(element) ? element.shapeStyle : undefined;

	const strokeWidth = Math.max(0, ss?.strokeWidth ?? 2);
	const strokeColor = ss?.strokeColor ?? DEFAULT_STROKE_COLOR;
	const strokeOpacity = ss?.strokeOpacity ?? 1;
	// Shared dash builder: honours every `prstDash` preset (dash/lgDash/dashDot/
	// sysDashDotDot, etc.) plus a `custDash` segment list, instead of the old
	// local `3w/w` approximation that collapsed every non-dot preset to one shape.
	const dashArray = buildDashArray(ss?.strokeDash, strokeWidth, ss?.customDashSegments);

	const w = Math.max(element.width, 1);
	const h = Math.max(element.height, 1);

	const wrapper = createEl(doc, 'div', 'pptxv-element pptxv-connector', {
		position: 'absolute',
		left: `${element.x}px`,
		top: `${element.y}px`,
		width: `${element.width}px`,
		height: `${element.height}px`,
		zIndex,
		pointerEvents: 'none',
		overflow: 'visible',
		// Base stroke colour lives on the wrapper (an inherited SVG property) so a
		// `p:animClr` `stroke.color` keyframe applied to this `[data-element-id]`
		// wrapper cascades down to the painted `stroke: inherit` strands below.
		stroke: strokeColor,
	});
	wrapper.dataset.elementId = element.id;
	if (element.rotation) {
		wrapper.style.transform = `rotate(${element.rotation}deg)`;
	}
	if (typeof element.opacity === 'number') {
		wrapper.style.opacity = String(element.opacity);
	}
	if (element.hidden) {
		wrapper.style.display = 'none';
	}
	const lineGlow = getLineGlowFilterCss(ss);
	if (lineGlow) {
		wrapper.style.filter = lineGlow;
	}

	const svg = createSvgEl(doc, 'svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` });
	svg.setAttribute('style', 'overflow:visible;display:block');

	// Arrow markers (distinct, DOM-id-safe ids per element + side).
	const seed = element.id.replace(/[^a-zA-Z0-9_-]/gu, '_');
	const defs = createSvgEl(doc, 'defs');
	const lineShadow = getLineShadowParams(ss);
	const shadowId = lineShadow ? `${seed}-line-shadow` : undefined;
	if (lineShadow && shadowId) {
		const filter = createSvgEl(doc, 'filter', {
			id: shadowId,
			x: '-50%',
			y: '-50%',
			width: '200%',
			height: '200%',
		});
		filter.appendChild(
			createSvgEl(doc, 'feDropShadow', {
				dx: lineShadow.offsetX,
				dy: lineShadow.offsetY,
				stdDeviation: lineShadow.blur / 2,
				'flood-color': lineShadow.color,
				'flood-opacity': lineShadow.opacity,
			}),
		);
		defs.appendChild(filter);
	}
	const startArrow = normalizeArrow(ss?.connectorStartArrow);
	const endArrow = normalizeArrow(ss?.connectorEndArrow);
	const startMarkerId = startArrow ? `${seed}-start` : undefined;
	const endMarkerId = endArrow ? `${seed}-end` : undefined;
	if (startArrow && startMarkerId) {
		defs.appendChild(
			buildMarker(context, startMarkerId, startArrow, strokeColor, {
				width: ss?.connectorStartArrowWidth,
				length: ss?.connectorStartArrowLength,
			}),
		);
	}
	if (endArrow && endMarkerId) {
		defs.appendChild(
			buildMarker(context, endMarkerId, endArrow, strokeColor, {
				width: ss?.connectorEndArrowWidth,
				length: ss?.connectorEndArrowLength,
			}),
		);
	}
	if (defs.childNodes.length > 0) {
		svg.appendChild(defs);
	}

	// Compound (double/triple) line support: parallel offset strokes.
	const compound = ss?.compoundLine;
	const offsets = getCompoundLineOffsets(compound, strokeWidth);
	const widths = getCompoundLineWidths(compound, strokeWidth);

	const shapeType = hasShapeProperties(element) ? element.shapeType : undefined;
	const usePath = connectorNeedsPath(shapeType) && hasShapeProperties(element);
	const pathData = usePath ? getConnectorPathGeometry(element).pathData : undefined;

	// Straight-connector endpoints, mirrored by flips; reused by the hit target
	// below and by the painted `<line>` strands.
	const x1 = element.flipHorizontal ? w : 0;
	const y1 = element.flipVertical ? h : 0;
	const x2 = element.flipHorizontal ? 0 : w;
	const y2 = element.flipVertical ? 0 : h;

	// The only pointer-reachable part of a connector: a transparent stroke along
	// the line that opts back into hit testing. The wrapper is
	// `pointer-events: none` so a connector's mostly-empty bounding box never
	// swallows clicks meant for the shapes it spans, which left the line itself
	// unclickable until this path existed.
	const hit = createSvgEl(doc, 'path', {
		class: 'pptxv-connector-hit',
		d: pathData ?? `M${x1},${y1} L${x2},${y2}`,
		fill: 'none',
		stroke: 'transparent',
		'stroke-width': connectorHitStrokeWidth(strokeWidth),
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
	});
	hit.style.pointerEvents = 'stroke';
	svg.appendChild(hit);

	offsets.forEach((offset, idx) => {
		const stroke: Record<string, string | number | undefined> = {
			// Inherit the wrapper's base stroke so a colour animation cascades.
			stroke: 'inherit',
			'stroke-width': Math.max(widths[idx] ?? strokeWidth, 1),
			'stroke-opacity': strokeOpacity,
			'stroke-dasharray': dashArray,
			'stroke-linecap': 'round',
			'marker-start': idx === 0 && startMarkerId ? `url(#${startMarkerId})` : undefined,
			'marker-end': idx === offsets.length - 1 && endMarkerId ? `url(#${endMarkerId})` : undefined,
			filter: shadowId ? `url(#${shadowId})` : undefined,
		};
		let node: SVGElement;
		if (pathData !== undefined) {
			node = createSvgEl(doc, 'path', {
				d: pathData,
				fill: 'none',
				'stroke-linejoin': 'round',
				...stroke,
			});
			if (offset !== 0) {
				node.style.transform = `translate(0, ${offset}px)`;
			}
		} else {
			node = createSvgEl(doc, 'line', {
				x1,
				y1: y1 + offset,
				x2,
				y2: y2 + offset,
				...stroke,
			});
		}
		svg.appendChild(node);
	});

	wrapper.appendChild(svg);
	appendConnectorLabel(wrapper, element, context);
	return wrapper;
};

function appendConnectorLabel(
	wrapper: HTMLElement,
	element: Parameters<ElementRenderer>[0],
	context: ElementRenderContext,
): void {
	if (!hasTextProperties(element)) {
		return;
	}
	const paragraphs = buildParagraphs(element, context.fieldContext);
	if (!paragraphs.some((paragraph) => paragraph.runs.length > 0)) {
		return;
	}
	const label = renderTextBlock(context.document, paragraphs, {
		...getTextBlockStyle(element),
		position: 'absolute',
		left: '10%',
		top: '50%',
		width: '80%',
		height: 'auto',
		transform: 'translateY(-50%)',
		textAlign: element.textStyle?.align ?? 'center',
		pointerEvents: 'none',
	});
	label.classList.add('pptxv-connector-label');
	wrapper.appendChild(label);
}

function buildMarker(
	context: ElementRenderContext,
	id: string,
	arrow: ConnectorArrowType,
	strokeColor: string,
	size: { width?: 'sm' | 'med' | 'lg'; length?: 'sm' | 'med' | 'lg' },
): SVGMarkerElement {
	const doc = context.document;
	// Size the marker box from the shared `markerPath` (`@w`/`@len` size tokens)
	// so `sm`/`lg` arrowheads scale, instead of the old hard-coded 4x4 box.
	const shape = markerPath(arrow, size.width, size.length);
	const marker = createSvgEl(doc, 'marker', {
		id,
		viewBox: '0 0 10 10',
		refX: 5,
		refY: 5,
		markerWidth: shape.markerWidth,
		markerHeight: shape.markerHeight,
		orient: 'auto-start-reverse',
		markerUnits: 'strokeWidth',
	});
	if (shape.shape === 'circle') {
		marker.appendChild(createSvgEl(doc, 'circle', { cx: 5, cy: 5, r: 4, fill: strokeColor }));
	} else if (shape.strokeOnly) {
		// The open chevron ('arrow'): stroked, not filled, or it draws as a solid
		// wedge indistinguishable from 'triangle'.
		marker.appendChild(createSvgEl(doc, 'path', { d: shape.d, fill: 'none', stroke: strokeColor }));
	} else {
		marker.appendChild(createSvgEl(doc, 'path', { d: shape.d, fill: strokeColor }));
	}
	return marker;
}
