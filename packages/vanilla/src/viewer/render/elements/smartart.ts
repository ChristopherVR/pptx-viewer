import type { PptxSmartArtData, SmartArtStyle } from 'pptx-viewer-core';
import {
	buildChromeStyle,
	buildSmartArtA11y,
	computeDrawingViewBox,
	computeSmartArtLayout,
	getContainerStyle,
	projectDrawingShapes,
	resolvePalette,
	styleShadowFilter,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import type { ElementRenderer } from '../types';
import { buildSmartArtFallbackSvg } from './smartart-fallback';
import { appendCenteredSvgText, SMARTART_SVG_STYLE } from './smartart-svg';

/**
 * Renderer for `smartArt` elements, viewer-only vanilla port of Vue's
 * `SmartArtRenderer.vue`:
 *
 * - **Drawing-shapes path (preferred)**: renders the pre-computed
 *   `smartArtData.drawingShapes` extracted by core from
 *   `ppt/diagrams/drawing*.xml`, via the shared `projectDrawingShapes`
 *   view-model (palette / stroke / shadow resolution included).
 * - **Fallback layout path**: when no drawing shapes exist, runs the shared
 *   layout engine (`computeSmartArtLayout`) over the node tree and renders the
 *   resulting rect / circle / polygon geometry with connectors.
 * - **Empty placeholder**: no data or zero nodes renders a small labelled box.
 *
 * The graphic is wrapped in chrome (background / outline via shared
 * `buildChromeStyle`) and described to assistive tech through the shared
 * `buildSmartArtA11y` diagram label (`role="img"` + `aria-label`).
 *
 * Not ported (editor-only in Vue): inline node text editing, the hover fill
 * swatch bar, and per-node `data-node-id` editing hooks. The opt-in 3D
 * renderer (`pptx-viewer-shared/smartart-3d`) is a separate follow-up.
 */
export const renderSmartArtElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'smartArt') {
		return null;
	}
	const doc = context.document;
	const data = element.smartArtData;

	const wrapper = createEl(
		doc,
		'div',
		'pptxv-element pptxv-smartart',
		getContainerStyle(element, zIndex),
	);
	wrapper.dataset.elementId = element.id;

	const chrome = createEl(doc, 'div', 'pptxv-smartart-chrome', buildChromeStyle(data?.chrome));
	chrome.style.position = 'relative';
	wrapper.appendChild(chrome);

	if (data) {
		const a11y = buildSmartArtA11y(data);
		chrome.setAttribute('role', 'img');
		chrome.setAttribute('aria-label', a11y.label);
	}

	const nodes = data?.nodes ?? [];
	const drawingShapes = data?.drawingShapes ?? [];

	if (data && drawingShapes.length > 0) {
		chrome.appendChild(buildDrawingShapesSvg(doc, element.id, data));
		return wrapper;
	}

	if (data && nodes.length > 0) {
		const layout = computeSmartArtLayout(
			nodes,
			{ width: element.width, height: element.height },
			resolvePalette(data),
			data.style ?? 'flat',
			element.id,
			data.resolvedLayoutType,
			data.layout,
		);
		chrome.appendChild(buildSmartArtFallbackSvg(doc, layout));
		return wrapper;
	}

	const placeholder = createEl(doc, 'div', 'pptxv-smartart-placeholder', {
		width: '100%',
		height: '100%',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: '11px',
		color: 'rgba(255,255,255,0.8)',
		pointerEvents: 'none',
	});
	placeholder.textContent = context.t('pptx.smartArt.placeholder');
	chrome.appendChild(placeholder);
	return wrapper;
};

/** Build the `<svg>` for the pre-computed drawing-shapes path. */
function buildDrawingShapesSvg(
	doc: Document,
	elementId: string,
	data: PptxSmartArtData,
): SVGSVGElement {
	const shapes = data.drawingShapes ?? [];
	const style: SmartArtStyle = data.style ?? 'flat';
	const viewBox = computeDrawingViewBox(shapes);
	const rendered = projectDrawingShapes(elementId, shapes, viewBox, resolvePalette(data), style);
	const shadow = styleShadowFilter(style);

	const svg = createSvgEl(doc, 'svg', {
		viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
		preserveAspectRatio: 'xMidYMid meet',
	});
	svg.setAttribute('class', 'pptxv-smartart-svg');
	svg.setAttribute('style', SMARTART_SVG_STYLE);

	for (const shape of rendered) {
		const g = createSvgEl(doc, 'g');
		if (shadow) {
			g.style.filter = shadow;
		}
		if (shape.isEllipse) {
			g.appendChild(
				createSvgEl(doc, 'ellipse', {
					cx: shape.cx,
					cy: shape.cy,
					rx: shape.width / 2,
					ry: shape.height / 2,
					fill: shape.fill,
					stroke: shape.stroke,
					'stroke-width': shape.strokeWidth,
					transform: shape.transform,
				}),
			);
		} else {
			g.appendChild(
				createSvgEl(doc, 'rect', {
					x: shape.x,
					y: shape.y,
					width: shape.width,
					height: shape.height,
					rx: shape.rx,
					fill: shape.fill,
					stroke: shape.stroke,
					'stroke-width': shape.strokeWidth,
					transform: shape.transform,
				}),
			);
		}
		if (shape.text) {
			appendCenteredSvgText(doc, g, {
				text: shape.text,
				x: shape.textX,
				y: shape.textY,
				fill: shape.fontColor,
				fontSize: shape.fontSize,
			});
		}
		svg.appendChild(g);
	}
	return svg;
}
