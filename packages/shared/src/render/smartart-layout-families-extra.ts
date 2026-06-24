/**
 * SmartArt layout engine — extended family computers (radial, pyramid, venn,
 * funnel, target). Each produces fully-styled `RenderedNode` /
 * `RenderedConnector` view-models from a node array + bounding box.
 *
 * Pure geometry; no framework code. Consolidated from the Vue engine
 * (`packages/vue/src/viewer/composables/smartart-layout.ts`).
 */

import type { PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';

import {
	fitFontSize,
	nodeFill,
	nodeOpacity,
	nodeStroke,
	strokeFor,
	styleShadow,
	styleStroke,
	truncate,
} from './smartart-layout-helpers';
import type {
	BoundingBox,
	RenderedCircleNode,
	RenderedConnector,
	RenderedNode,
	RenderedPolygonNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

/** Centre node + satellite nodes arranged radially. */
export function computeRadialLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const cx = w / 2;
	const cy = h / 2;
	const size = Math.min(w, h);
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	if (nodes.length === 0) {
		return {
			nodes: [],
			connectors: [],
			shadowFilter: undefined,
			viewBox: `0 0 ${w} ${h}`,
			family: 'radial',
		};
	}

	const [centre, ...satellites] = nodes;
	const centreR = size * 0.14;
	const orbitR = size * 0.35;
	const satR = Math.max(size * 0.06, Math.min(size * 0.1, 180 / Math.max(1, satellites.length)));

	const renderedNodes: RenderedNode[] = [];
	const connectors: RenderedConnector[] = [];

	const centreFontSize = fitFontSize(centre.text, centreR * 1.6, centreR * 2, 12);
	renderedNodes.push({
		kind: 'circle',
		key: `${elementId}-radial-centre-0`,
		cx,
		cy,
		r: centreR,
		fill: nodeFill(centre, 0, palette),
		stroke: nodeStroke(centre, stroke),
		strokeWidth: sw,
		opacity: nodeOpacity(0, nodes.length, style),
		text: truncate(centre.text, 20),
		fontSize: centreFontSize,
	});

	satellites.forEach((node, si) => {
		const i = si + 1;
		const angle = (si / Math.max(1, satellites.length)) * Math.PI * 2 - Math.PI / 2;
		const nx = cx + orbitR * Math.cos(angle);
		const ny = cy + orbitR * Math.sin(angle);
		const fontSize = fitFontSize(node.text, satR * 1.4, satR * 2, 10);

		const edgeAngleX = cx + centreR * Math.cos(angle);
		const edgeAngleY = cy + centreR * Math.sin(angle);
		connectors.push({
			key: `${elementId}-radial-conn-${i}`,
			d: `M${edgeAngleX},${edgeAngleY} L${nx},${ny}`,
		});

		renderedNodes.push({
			kind: 'circle',
			key: `${elementId}-radial-${node.id}-${i}`,
			cx: nx,
			cy: ny,
			r: satR,
			fill: nodeFill(node, i, palette),
			stroke: nodeStroke(node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 20),
			fontSize,
		});
	});

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'radial',
	};
}

/** Stacked trapezoids forming a pyramid shape (widest at bottom). */
export function computePyramidLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const pad = 8;
	const gap = 3;
	const usableH = h - pad * 2;
	const bandH = nodes.length > 0 ? (usableH - gap * (nodes.length - 1)) / nodes.length : usableH;
	const maxW = w - pad * 2;
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const topWidthFrac = 0.3 + (i / Math.max(nodes.length - 1, 1)) * 0.7;
		const bottomWidthFrac =
			i < nodes.length - 1 ? 0.3 + ((i + 1) / Math.max(nodes.length - 1, 1)) * 0.7 : 1.0;
		const topW = maxW * topWidthFrac;
		const bottomW = maxW * bottomWidthFrac;
		const y = pad + i * (bandH + gap);

		const topLeft = (w - topW) / 2;
		const topRight = topLeft + topW;
		const bottomLeft = (w - bottomW) / 2;
		const bottomRight = bottomLeft + bottomW;

		const points = [
			`${topLeft},${y}`,
			`${topRight},${y}`,
			`${bottomRight},${y + bandH}`,
			`${bottomLeft},${y + bandH}`,
		].join(' ');

		const fontSize = fitFontSize(node.text, topW * 0.85, bandH, 12);
		const result: RenderedPolygonNode = {
			kind: 'polygon',
			key: `${elementId}-pyramid-${node.id}-${i}`,
			points,
			fill: nodeFill(node, i, palette),
			stroke: nodeStroke(node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 30),
			fontSize,
			textX: w / 2,
			textY: y + bandH / 2,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'pyramid',
	};
}

/** Overlapping circles arranged radially (≤4 nodes) or horizontally (5+). */
export function computeVennLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const shadow = styleShadow(style);

	if (nodes.length <= 4) {
		const cx = w / 2;
		const cy = h / 2;
		const r = Math.min(w, h) * 0.28;
		const spread = r * 0.55;

		const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
			const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
			const nx = cx + spread * Math.cos(angle);
			const ny = cy + spread * Math.sin(angle);
			const fontSize = fitFontSize(node.text, r * 1.2, r * 2, 11);
			const result: RenderedCircleNode = {
				kind: 'circle',
				key: `${elementId}-venn-${node.id}-${i}`,
				cx: nx,
				cy: ny,
				r,
				fill: nodeFill(node, i, palette),
				stroke: 'none',
				strokeWidth: 0,
				opacity: 0.35,
				text: truncate(node.text, 20),
				fontSize,
			};
			return result;
		});

		return {
			nodes: renderedNodes,
			connectors: [],
			shadowFilter: shadow,
			viewBox: `0 0 ${w} ${h}`,
			family: 'venn',
		};
	}

	const r = Math.min(h * 0.38, w / (nodes.length * 0.9));
	const overlap = r * 0.5;
	const totalW = nodes.length * (r * 2 - overlap) + overlap;
	const offsetX = (w - totalW) / 2 + r;
	const cy = h / 2;

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const nx = offsetX + i * (r * 2 - overlap);
		const fontSize = fitFontSize(node.text, r * 1.2, r * 2, 10);
		const result: RenderedCircleNode = {
			kind: 'circle',
			key: `${elementId}-venn-${node.id}-${i}`,
			cx: nx,
			cy,
			r,
			fill: nodeFill(node, i, palette),
			stroke: 'none',
			strokeWidth: 0,
			opacity: 0.35,
			text: truncate(node.text, 20),
			fontSize,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'venn',
	};
}

/** Narrowing trapezoid stages forming a funnel. */
export function computeFunnelLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const pad = 8;
	const usableW = w - pad * 2;
	const stageH = nodes.length > 0 ? (h - pad * 2) / nodes.length : h - pad * 2;
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const topWidth = usableW * (1 - i / Math.max(1, nodes.length));
		const bottomWidth = usableW * (1 - (i + 1) / Math.max(1, nodes.length));
		const y = pad + i * stageH;

		const topLeft = (w - topWidth) / 2;
		const topRight = topLeft + topWidth;
		const bottomLeft = (w - bottomWidth) / 2;
		const bottomRight = bottomLeft + bottomWidth;

		const points = [
			`${topLeft},${y}`,
			`${topRight},${y}`,
			`${bottomRight},${y + stageH}`,
			`${bottomLeft},${y + stageH}`,
		].join(' ');

		const fontSize = fitFontSize(node.text, topWidth * 0.85, stageH, 11);
		const result: RenderedPolygonNode = {
			kind: 'polygon',
			key: `${elementId}-funnel-${node.id}-${i}`,
			points,
			fill: nodeFill(node, i, palette),
			stroke: nodeStroke(node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 30),
			fontSize,
			textX: w / 2,
			textY: y + stageH / 2,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'funnel',
	};
}

/** Concentric circles (bullseye) with leader lines to the right. */
export function computeTargetLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const cx = w * 0.4;
	const cy = h / 2;
	const maxR = Math.min(cx - 8, cy - 8);
	const shadow = styleShadow(style);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const r = maxR * ((nodes.length - i) / Math.max(1, nodes.length));
		const result: RenderedCircleNode = {
			kind: 'circle',
			key: `${elementId}-target-${node.id}-${i}`,
			cx,
			cy,
			r: Math.max(r, 4),
			fill: nodeFill(node, i, palette),
			stroke: 'none',
			strokeWidth: 0,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 30),
			fontSize: Math.max(7, Math.min(10, maxR / Math.max(1, nodes.length + 1))),
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'target',
	};
}
