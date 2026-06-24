/**
 * SmartArt layout engine — core family computers (list, process, cycle,
 * hierarchy, matrix). Each produces fully-styled `RenderedNode` /
 * `RenderedConnector` view-models from a node array + bounding box.
 *
 * Pure geometry; no framework code. Consolidated from the Vue engine
 * (`packages/vue/src/viewer/composables/smartart-layout.ts`).
 */

import type { PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';

import {
	buildTree,
	fitFontSize,
	nodeFill,
	nodeOpacity,
	nodeStroke,
	strokeFor,
	styleShadow,
	styleStroke,
	treeDepth,
	treeWidth,
	truncate,
} from './smartart-layout-helpers';
import type {
	BoundingBox,
	RenderedConnector,
	RenderedNode,
	RenderedPolygonNode,
	RenderedRectNode,
	SmartArtLayoutResult,
	TreeNode,
} from './smartart-layout-types';

/** Vertical stacked rounded-rectangles list. */
export function computeListLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const pad = 8;
	const gap = 4;
	const usableH = h - pad * 2;
	const itemH = nodes.length > 0 ? (usableH - gap * (nodes.length - 1)) / nodes.length : usableH;
	const itemW = w - pad * 2;
	const rx = Math.min(6, itemH * 0.15);
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const y = pad + i * (itemH + gap);
		const fontSize = fitFontSize(node.text, itemW * 0.9, itemH, 12);
		const result: RenderedRectNode = {
			kind: 'rect',
			key: `${elementId}-list-${node.id}-${i}`,
			x: pad,
			y,
			width: itemW,
			height: itemH,
			rx,
			fill: nodeFill(node, i, palette),
			stroke: nodeStroke(node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 40),
			fontSize,
			textX: pad + itemW / 2,
			textY: y + itemH / 2,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'list',
	};
}

/** Horizontal chevron/arrow process layout. */
export function computeProcessLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const pad = 8;
	const gap = 4;
	const chevronDepth = Math.min(16, w * 0.04);
	const usableW = w - pad * 2;
	const itemW = nodes.length > 0 ? (usableW - gap * (nodes.length - 1)) / nodes.length : usableW;
	const itemH = Math.min(h - pad * 2, h * 0.6);
	const yMid = h / 2;
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const x = pad + i * (itemW + gap);
		const halfH = itemH / 2;
		const isFirst = i === 0;
		const isLast = i === nodes.length - 1;

		let points: string;
		if (isFirst) {
			points = [
				`${x},${yMid - halfH}`,
				`${x + itemW - chevronDepth},${yMid - halfH}`,
				`${x + itemW},${yMid}`,
				`${x + itemW - chevronDepth},${yMid + halfH}`,
				`${x},${yMid + halfH}`,
			].join(' ');
		} else if (isLast) {
			points = [
				`${x},${yMid - halfH}`,
				`${x + itemW},${yMid - halfH}`,
				`${x + itemW},${yMid + halfH}`,
				`${x},${yMid + halfH}`,
				`${x + chevronDepth},${yMid}`,
			].join(' ');
		} else {
			points = [
				`${x},${yMid - halfH}`,
				`${x + itemW - chevronDepth},${yMid - halfH}`,
				`${x + itemW},${yMid}`,
				`${x + itemW - chevronDepth},${yMid + halfH}`,
				`${x},${yMid + halfH}`,
				`${x + chevronDepth},${yMid}`,
			].join(' ');
		}

		const fontSize = fitFontSize(node.text, itemW * 0.7, itemH, 12);
		const result: RenderedPolygonNode = {
			kind: 'polygon',
			key: `${elementId}-process-${node.id}-${i}`,
			points,
			fill: nodeFill(node, i, palette),
			stroke: nodeStroke(node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 25),
			fontSize,
			textX: x + itemW / 2,
			textY: yMid,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'process',
	};
}

/** Circular arrangement of nodes with arc connectors. */
export function computeCycleLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const size = Math.min(w, h);
	const cx = w / 2;
	const cy = h / 2;
	const radius = size * 0.35;
	const nodeR = Math.max(size * 0.06, Math.min(size * 0.12, 200 / Math.max(1, nodes.length)));
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const connectors: RenderedConnector[] = nodes.map((_node, i) => {
		const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
		const nx = cx + radius * Math.cos(angle);
		const ny = cy + radius * Math.sin(angle);
		const nextI = (i + 1) % nodes.length;
		const nextAngle = (nextI / nodes.length) * Math.PI * 2 - Math.PI / 2;
		const nextX = cx + radius * Math.cos(nextAngle);
		const nextY = cy + radius * Math.sin(nextAngle);
		const midAngle = (angle + nextAngle) / 2;
		const adjustedMidAngle =
			i === nodes.length - 1 ? (angle + nextAngle + Math.PI * 2) / 2 : midAngle;
		const arcBulge = radius * 0.15;
		const controlX = cx + (radius + arcBulge) * Math.cos(adjustedMidAngle);
		const controlY = cy + (radius + arcBulge) * Math.sin(adjustedMidAngle);
		return {
			key: `${elementId}-cycle-conn-${i}`,
			d: `M${nx},${ny} Q${controlX},${controlY} ${nextX},${nextY}`,
		};
	});

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
		const nx = cx + radius * Math.cos(angle);
		const ny = cy + radius * Math.sin(angle);
		const fontSize = fitFontSize(node.text, nodeR * 1.4, nodeR * 2, 11);
		return {
			kind: 'circle',
			key: `${elementId}-cycle-${node.id}-${i}`,
			cx: nx,
			cy: ny,
			r: nodeR,
			fill: nodeFill(node, i, palette),
			stroke: nodeStroke(node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 20),
			fontSize,
		};
	});

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'cycle',
	};
}

/**
 * Tree / org-chart hierarchy with L-shaped connector lines.
 * Falls back to list layout if the tree cannot be built.
 */
export function computeHierarchyLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const roots = buildTree(nodes);
	if (roots.length === 0) {
		return computeListLayout(nodes, box, palette, style, elementId);
	}

	const { width: svgW, height: svgH } = box;
	const totalLeaves = roots.reduce((s, r) => s + treeWidth(r), 0);
	const depth = Math.max(...roots.map(treeDepth));
	const cellW = svgW / Math.max(1, totalLeaves);
	const cellH = svgH / Math.max(1, depth);
	const boxW = Math.min(cellW * 0.8, 140);
	const boxH = Math.min(cellH * 0.4, 36);
	const rx = Math.min(6, boxH * 0.15);
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = [];
	const connectors: RenderedConnector[] = [];
	let colourIdx = 0;

	function renderTreeNode(t: TreeNode, xOffset: number, level: number): void {
		const w = treeWidth(t);
		const nodeCx = (xOffset + w / 2) * cellW;
		const nodeCy = level * cellH + cellH / 2;
		const ci = colourIdx++;
		const fontSize = fitFontSize(t.node.text, boxW * 0.9, boxH, 11);

		let childOffset = xOffset;
		for (const child of t.children) {
			const childW = treeWidth(child);
			const childCx = (childOffset + childW / 2) * cellW;
			const childCy = (level + 1) * cellH + cellH / 2;
			const midY = nodeCy + boxH / 2 + (childCy - boxH / 2 - (nodeCy + boxH / 2)) / 2;
			connectors.push({
				key: `${elementId}-hier-conn-${t.node.id}-${child.node.id}`,
				d: `M${nodeCx},${nodeCy + boxH / 2} L${nodeCx},${midY} L${childCx},${midY} L${childCx},${childCy - boxH / 2}`,
			});
			childOffset += childW;
		}

		const nodeEntry: RenderedRectNode = {
			kind: 'rect',
			key: `${elementId}-hier-${t.node.id}-${ci}`,
			x: nodeCx - boxW / 2,
			y: nodeCy - boxH / 2,
			width: boxW,
			height: boxH,
			rx,
			fill: nodeFill(t.node, ci, palette),
			stroke: nodeStroke(t.node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(ci, nodes.length, style),
			text: truncate(t.node.text, 40),
			fontSize,
			textX: nodeCx,
			textY: nodeCy,
		};
		renderedNodes.push(nodeEntry);

		let co = xOffset;
		for (const child of t.children) {
			renderTreeNode(child, co, level + 1);
			co += treeWidth(child);
		}
	}

	let offset = 0;
	for (const root of roots) {
		renderTreeNode(root, offset, 0);
		offset += treeWidth(root);
	}

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${svgW} ${svgH}`,
		family: 'hierarchy',
	};
}

/** Grid (ceil(sqrt(n)) × rows) layout. */
export function computeMatrixLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
	const rows = Math.max(1, Math.ceil(nodes.length / cols));
	const pad = 8;
	const gap = 6;
	const usableW = w - pad * 2;
	const usableH = h - pad * 2;
	const cellW = (usableW - gap * (cols - 1)) / cols;
	const cellH = (usableH - gap * (rows - 1)) / rows;
	const rx = Math.min(6, Math.min(cellW, cellH) * 0.1);
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const x = pad + col * (cellW + gap);
		const y = pad + row * (cellH + gap);
		const fontSize = fitFontSize(node.text, cellW * 0.85, cellH, 12);
		const result: RenderedRectNode = {
			kind: 'rect',
			key: `${elementId}-matrix-${node.id}-${i}`,
			x,
			y,
			width: cellW,
			height: cellH,
			rx,
			fill: nodeFill(node, i, palette),
			stroke: nodeStroke(node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 30),
			fontSize,
			textX: x + cellW / 2,
			textY: y + cellH / 2,
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'matrix',
	};
}
