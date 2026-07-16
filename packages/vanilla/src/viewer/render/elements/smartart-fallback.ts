import type { RenderedNode, SmartArtLayoutResult, SmartArtNodeA11y } from 'pptx-viewer-shared';

import { createSvgEl } from '../dom';
import { appendCenteredSvgText, SMARTART_SVG_STYLE } from './smartart-svg';

/**
 * SVG assembly for the SmartArt fallback path (no pre-computed drawing
 * shapes): renders the geometry produced by the shared layout engine
 * (`computeSmartArtLayout`), mirroring the fallback `<svg>` branch of Vue's
 * `SmartArtRenderer.vue` (connectors behind nodes, rect / circle / polygon
 * nodes with centred white multi-line labels).
 */

const CONNECTOR_STROKE = '#94a3b8';

/** Build the fallback layout `<svg>` for a computed SmartArt layout. */
export function buildSmartArtFallbackSvg(
	doc: Document,
	layout: SmartArtLayoutResult,
	a11yNodes: readonly SmartArtNodeA11y[] = [],
	nodeIds: readonly string[] = [],
): SVGSVGElement {
	const svg = createSvgEl(doc, 'svg', {
		viewBox: layout.viewBox,
		preserveAspectRatio: 'xMidYMid meet',
		'data-layout-family': layout.family,
	});
	svg.setAttribute('class', 'pptxv-smartart-svg');
	svg.setAttribute('style', SMARTART_SVG_STYLE);

	// Connectors render first so they appear behind nodes.
	for (const conn of layout.connectors) {
		svg.appendChild(
			createSvgEl(doc, 'path', {
				d: conn.d,
				fill: 'none',
				stroke: CONNECTOR_STROKE,
				'stroke-width': 1.5,
				opacity: 0.5,
			}),
		);
	}
	for (const [index, node] of layout.nodes.entries()) {
		svg.appendChild(
			buildFallbackNode(doc, node, layout.shadowFilter, a11yNodes[index]?.label, nodeIds[index]),
		);
	}
	return svg;
}

function buildFallbackNode(
	doc: Document,
	node: RenderedNode,
	shadowFilter: string | undefined,
	a11yLabel: string | undefined,
	nodeId: string | undefined,
): SVGGElement {
	const g = createSvgEl(doc, 'g');
	if (nodeId) {
		g.dataset.smartartNodeId = nodeId;
		g.style.pointerEvents = 'auto';
		g.style.cursor = 'text';
	}
	if (a11yLabel) {
		g.setAttribute('role', 'img');
		g.setAttribute('aria-label', a11yLabel);
		const title = createSvgEl(doc, 'title');
		title.textContent = a11yLabel;
		g.appendChild(title);
	}
	if (shadowFilter) {
		g.style.filter = shadowFilter;
	}
	const paint = {
		fill: node.fill,
		stroke: node.stroke,
		'stroke-width': node.strokeWidth,
		opacity: node.opacity,
	};
	if (node.kind === 'circle') {
		g.appendChild(createSvgEl(doc, 'circle', { cx: node.cx, cy: node.cy, r: node.r, ...paint }));
		appendCenteredSvgText(doc, g, {
			text: node.text,
			x: node.cx,
			y: node.cy,
			fill: 'white',
			fontSize: node.fontSize,
		});
	} else if (node.kind === 'polygon') {
		g.appendChild(createSvgEl(doc, 'polygon', { points: node.points, ...paint }));
		appendCenteredSvgText(doc, g, {
			text: node.text,
			x: node.textX,
			y: node.textY,
			fill: 'white',
			fontSize: node.fontSize,
		});
	} else {
		g.appendChild(
			createSvgEl(doc, 'rect', {
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height,
				rx: node.rx,
				...paint,
			}),
		);
		appendCenteredSvgText(doc, g, {
			text: node.text,
			x: node.textX,
			y: node.textY,
			fill: 'white',
			fontSize: node.fontSize,
		});
	}
	return g;
}
