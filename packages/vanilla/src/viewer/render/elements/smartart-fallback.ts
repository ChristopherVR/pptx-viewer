import { smartArtConnectorPaint, smartArtNodeLabel } from 'pptx-viewer-shared';
import type { RenderedNode, SmartArtLayoutResult, SmartArtNodeA11y } from 'pptx-viewer-shared';

import { createSvgEl } from '../dom';
import { appendSvgTextLines, SMARTART_SVG_STYLE } from './smartart-svg';

/**
 * SVG assembly for the SmartArt fallback path (no pre-computed drawing
 * shapes): renders the geometry produced by the shared layout engine
 * (`computeSmartArtLayout`), mirroring the fallback `<svg>` branch of every
 * other binding (connectors behind nodes, rect / circle / polygon nodes with
 * multi-line labels).
 *
 * Label placement / colour and connector paint are decided by the shared
 * `smartArtNodeLabel` / `smartArtConnectorPaint`, so the optional descriptor
 * fields (target leader captions, gear legend rows, timeline captions above and
 * below the axis, per-node font colour / weight / style, coloured stems) are
 * honoured here exactly as they are in React.
 */

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
		const paint = smartArtConnectorPaint(conn);
		svg.appendChild(
			createSvgEl(doc, 'path', {
				d: paint.d,
				fill: 'none',
				stroke: paint.stroke,
				'stroke-width': paint.strokeWidth,
				opacity: paint.opacity,
				'stroke-dasharray': paint.dash,
			}),
		);
	}
	// `nodeIds` is index-aligned with `layout.nodes` (the revealed subset during a
	// staged `p:bldDgm` build), while `a11yNodes` always covers the FULL diagram;
	// so the label has to be looked up by node id, never by render position.
	const labelsById = new Map(a11yNodes.map((node) => [node.id, node.label]));
	for (const [index, node] of layout.nodes.entries()) {
		const nodeId = nodeIds[index];
		const label = nodeId ? labelsById.get(nodeId) : a11yNodes[index]?.label;
		svg.appendChild(buildFallbackNode(doc, node, layout.shadowFilter, label, nodeId));
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
	} else if (node.kind === 'polygon') {
		g.appendChild(createSvgEl(doc, 'polygon', { points: node.points, ...paint }));
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
	}

	// Label placement / colour is decided by shared, including the optional
	// off-centre anchors circle nodes use for target and timeline captions.
	const label = smartArtNodeLabel(node);
	if (label.visible) {
		appendSvgTextLines(doc, g, {
			lines: label.lines,
			x: label.x,
			fill: label.fill,
			fontSize: label.fontSize,
			textAnchor: label.textAnchor,
			dominantBaseline: label.dominantBaseline,
			fontWeight: label.fontWeight,
			fontStyle: label.fontStyle,
		});
	}
	return g;
}
