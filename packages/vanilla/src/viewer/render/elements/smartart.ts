import type { PptxSmartArtData, SmartArtStyle } from 'pptx-viewer-core';
import {
	buildChromeStyle,
	buildSmartArtA11y,
	computeDrawingViewBox,
	computeSmartArtLayout,
	getContainerStyle,
	projectDrawingShapes,
	resolveDrawingShapeNodeId,
	resolvePalette,
	revealedSmartArtNodeCount,
	styleShadowFilter,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import type { ElementRenderer } from '../types';
import { renderSmartArt3DElement } from './smartart-3d';
import { enableSmartArtEditing } from './smartart-editable';
import { buildSmartArtFallbackSvg } from './smartart-fallback';
import { appendSvgTextLines, SMARTART_SVG_STYLE } from './smartart-svg';

/**
 * Renderer for `smartArt` elements. Dispatches to the opt-in Three.js
 * renderer (`smartart-3d.ts`) when `context.smartArt3D` is set (see
 * `PptxViewerOptions.smartArt3D`), otherwise renders the flat SVG below.
 */
export const renderSmartArtElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'smartArt') {
		return null;
	}
	if (context.smartArt3D) {
		return renderSmartArt3DElement(element, zIndex, context);
	}
	return renderSmartArtSvg(element, zIndex, context);
};

/**
 * The flat SVG renderer, viewer-only vanilla port of Vue's
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
 * Inline node text editing and the hover fill swatch bar are enabled when the
 * interactive editor callbacks are present. Also used as fallback content for
 * the opt-in 3D renderer in `smartart-3d.ts`.
 */
export const renderSmartArtSvg: ElementRenderer = (element, zIndex, context) => {
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
	wrapper.dataset.testid = `smartart-${data?.layout ?? 'diagram'}`;

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

	// Native staged diagram build (`p:bldDgm`): during a running presentation the
	// controller surfaces a `build` descriptor whose `progress` (0..1) reveals the
	// leading nodes / drawing shapes. The view box is still computed from the FULL
	// shape set so the diagram does not rescale as it builds (mirrors Vue).
	const build = context.presentationStates?.get(element.id)?.build;
	const diagramBuild = build?.kind === 'diagram' ? build : undefined;
	const shownNodeCount = diagramBuild
		? revealedSmartArtNodeCount(nodes, diagramBuild)
		: nodes.length;
	const isPartialBuild = diagramBuild !== undefined && shownNodeCount < nodes.length;

	if (data && drawingShapes.length > 0) {
		const revealedShapeCount = isPartialBuild
			? Math.ceil((shownNodeCount / Math.max(nodes.length, 1)) * drawingShapes.length)
			: drawingShapes.length;
		chrome.appendChild(
			buildDrawingShapesSvg(
				doc,
				element.id,
				data,
				buildSmartArtA11y(data).nodes,
				revealedShapeCount,
			),
		);
		enableSmartArtEditing(chrome, element, context);
		return wrapper;
	}

	if (data && nodes.length > 0) {
		const revealedNodes = isPartialBuild ? nodes.slice(0, shownNodeCount) : nodes;
		const layout = computeSmartArtLayout(
			revealedNodes,
			{ width: element.width, height: element.height },
			resolvePalette(data),
			data.style ?? 'flat',
			element.id,
			data.resolvedLayoutType,
			data.layout,
			undefined,
			data.layoutDefinition,
			data.presLayoutVars,
		);
		chrome.appendChild(
			buildSmartArtFallbackSvg(
				doc,
				layout,
				buildSmartArtA11y(data).nodes,
				nodes.map((node) => node.id),
			),
		);
		enableSmartArtEditing(chrome, element, context);
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
	a11yNodes: ReturnType<typeof buildSmartArtA11y>['nodes'],
	revealedShapeCount: number,
): SVGSVGElement {
	const shapes = data.drawingShapes ?? [];
	const style: SmartArtStyle = data.style ?? 'flat';
	// View box from the FULL shape set so a partial build does not rescale.
	const viewBox = computeDrawingViewBox(shapes);
	const projected = projectDrawingShapes(elementId, shapes, viewBox, resolvePalette(data), style);
	const rendered = projected.slice(0, Math.max(0, revealedShapeCount));
	const shadow = styleShadowFilter(style);

	const svg = createSvgEl(doc, 'svg', {
		viewBox: `0 0 ${viewBox.width} ${viewBox.height}`,
		preserveAspectRatio: 'xMidYMid meet',
	});
	svg.setAttribute('class', 'pptxv-smartart-svg');
	svg.setAttribute('style', SMARTART_SVG_STYLE);

	for (const [index, shape] of rendered.entries()) {
		const g = createSvgEl(doc, 'g');
		const nodeId = resolveDrawingShapeNodeId(shapes[index]!, index, shapes, data.nodes);
		if (nodeId) {
			g.dataset.smartartNodeId = nodeId;
			g.style.pointerEvents = 'auto';
			g.style.cursor = 'text';
		}
		const nodeA11y = a11yNodes[index];
		if (nodeA11y) {
			g.setAttribute('role', 'img');
			g.setAttribute('aria-label', nodeA11y.label);
			const title = createSvgEl(doc, 'title');
			title.textContent = nodeA11y.label;
			g.appendChild(title);
		}
		if (shadow) {
			g.style.filter = shadow;
		}
		if (shape.imageUrl) {
			const image = createSvgEl(doc, 'image', {
				x: shape.x,
				y: shape.y,
				width: shape.width,
				height: shape.height,
				preserveAspectRatio: 'xMidYMid meet',
				transform: shape.transform,
			});
			image.setAttribute('href', shape.imageUrl);
			g.appendChild(image);
		} else if (shape.isEllipse) {
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
		if (shape.textLines.length > 0) {
			appendSvgTextLines(doc, g, {
				lines: shape.textLines,
				x: shape.textX,
				fill: shape.fontColor,
				fontSize: shape.fontSize,
			});
		}
		svg.appendChild(g);
	}
	return svg;
}
