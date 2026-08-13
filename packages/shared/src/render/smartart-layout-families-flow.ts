/**
 * SmartArt layout engine - flow-shaped family computers (gear, timeline,
 * bending/snake).
 *
 * These three arrangements were previously React-only (bespoke JSX in
 * `packages/react/.../smartart-renderer-*`), so the four bindings that call
 * `computeSmartArtLayout` silently degraded `interlockingGears` to a radial
 * burst and `basicTimeline` / `bendingProcess` to a chevron row. Ported here as
 * pure geometry so all five draw the same diagram.
 *
 * Everything uses the existing `RenderedNode` kinds (a gear is a polygon: its
 * teeth are straight segments) and emits exactly one rendered node per source
 * node, the contract `reflowToDrawingShapes` and every binding's node-id
 * alignment rely on.
 */

import type { PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';

import {
	fitFontSize,
	gearPoints,
	nodeFill,
	nodeOpacity,
	nodeStroke,
	nodeTextStyle,
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
	RenderedRectNode,
	SmartArtLayoutResult,
} from './smartart-layout-types';

/** Teeth per cog, and how many nodes become cogs before the rest are a legend. */
const GEAR_TEETH = 8;
const MAX_GEARS = 3;

/**
 * Interlocking cogs for the first three nodes, with any further nodes listed
 * as a colour-keyed legend down the right-hand side.
 */
export function computeGearLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const gearNodes = nodes.slice(0, MAX_GEARS);
	const extraNodes = nodes.slice(MAX_GEARS);
	const gearCount = gearNodes.length;
	const gearAreaW = extraNodes.length > 0 ? w * 0.7 : w;
	const spacing = gearAreaW / (gearCount + 1);
	const gearR = Math.min(spacing * 0.4, h * 0.35);
	const innerR = gearR * 0.7;
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	const renderedNodes: RenderedNode[] = gearNodes.map((node, i) => {
		const gx = spacing * (i + 1);
		// Alternate cogs sit slightly lower so the teeth read as meshed.
		const gy = h / 2 + (i % 2 === 0 ? 0 : gearR * 0.35);
		const result: RenderedPolygonNode = {
			kind: 'polygon',
			key: `${elementId}-gear-${node.id}-${i}`,
			points: gearPoints(gx, gy, gearR, innerR, GEAR_TEETH),
			fill: nodeFill(node, i, palette),
			stroke: nodeStroke(node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 20),
			fontSize: fitFontSize(node.text, innerR * 1.2, innerR * 2, 11),
			textX: gx,
			textY: gy,
			fontWeight: 700,
			...nodeTextStyle(node),
		};
		return result;
	});

	for (const [ei, node] of extraNodes.entries()) {
		const i = gearCount + ei;
		const lx = gearAreaW + 10;
		const ly = 14 + ei * 18;
		const fill = nodeFill(node, i, palette);
		const legend: RenderedCircleNode = {
			kind: 'circle',
			key: `${elementId}-gear-extra-${node.id}-${i}`,
			cx: lx,
			cy: ly,
			r: 3,
			fill,
			stroke: 'none',
			strokeWidth: 0,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 30),
			fontSize: 10,
			textX: lx + 8,
			textY: ly,
			textAnchor: 'start',
			fontColor: fill,
			...nodeTextStyle(node),
		};
		renderedNodes.push(legend);
	}

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'gear',
	};
}

/**
 * A horizontal axis with a dot per node, captions alternating above and below
 * and joined to their dot by a stem in the node's own colour.
 */
export function computeTimelineLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const padX = 24;
	const lineY = h / 2;
	const lineStartX = padX;
	const lineEndX = w - padX;
	const lineLen = lineEndX - lineStartX;
	const count = Math.max(1, nodes.length);
	const dotR = Math.max(4, Math.min(8, lineLen / (count * 4)));
	const labelOffset = Math.min(h * 0.28, 40);

	const connectors: RenderedConnector[] = [
		{
			key: `${elementId}-timeline-axis`,
			// Axis plus an open arrowhead at the right end.
			d: `M${lineStartX},${lineY} L${lineEndX},${lineY} M${lineEndX - 6},${lineY - 4} L${lineEndX},${lineY} L${lineEndX - 6},${lineY + 4}`,
			stroke: '#94a3b8',
			strokeWidth: 2,
			opacity: 1,
		},
	];

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const x =
			nodes.length === 1
				? (lineStartX + lineEndX) / 2
				: lineStartX + (i / (nodes.length - 1)) * lineLen;
		const above = i % 2 === 0;
		const textY = above ? lineY - labelOffset : lineY + labelOffset;
		const stemEndY = above ? lineY - dotR - 2 : lineY + dotR + 2;
		const fontSize = fitFontSize(node.text, (lineLen / count) * 0.9, labelOffset, 10);
		const fill = nodeFill(node, i, palette);

		connectors.push({
			key: `${elementId}-timeline-stem-${i}`,
			d: `M${x},${stemEndY} L${x},${textY + (above ? fontSize : -fontSize)}`,
			stroke: fill,
			strokeWidth: 1,
			opacity: 0.5,
		});

		const result: RenderedCircleNode = {
			kind: 'circle',
			key: `${elementId}-timeline-${node.id}-${i}`,
			cx: x,
			cy: lineY,
			r: dotR,
			fill,
			stroke: 'none',
			strokeWidth: 0,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 20),
			fontSize,
			textX: x,
			textY,
			textAnchor: 'middle',
			textBaseline: above ? 'bottom' : 'top',
			fontColor: fill,
			...nodeTextStyle(node),
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'timeline',
	};
}

/** Columns per snake row, and the size of its connector arrowheads. */
const SNAKE_COLS = 4;
const SNAKE_ARROW = 6;

/**
 * A multi-row grid where even rows flow left-to-right and odd rows flow
 * right-to-left, with an arrow between consecutive nodes.
 */
export function computeBendingLayout(
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const rowsCount = Math.ceil(nodes.length / SNAKE_COLS);
	const padX = 8;
	const padY = 8;
	const cellW = (w - padX * 2) / SNAKE_COLS;
	const cellH = (h - padY * 2) / Math.max(rowsCount, 1);
	const boxW = cellW * 0.8;
	const boxH = Math.min(cellH * 0.6, 32);
	const rx = Math.min(5, boxH * 0.15);
	const sw = styleStroke(style);
	const stroke = strokeFor(sw);

	/** Centre of the cell holding the node at flat index `i`. */
	const centreOf = (i: number): { cx: number; cy: number; row: number } => {
		const row = Math.floor(i / SNAKE_COLS);
		const colInRow = i % SNAKE_COLS;
		const col = row % 2 === 0 ? colInRow : SNAKE_COLS - 1 - colInRow;
		return { cx: padX + col * cellW + cellW / 2, cy: padY + row * cellH + cellH / 2, row };
	};

	const connectors: RenderedConnector[] = [];
	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const { cx: nodeCx, cy: nodeCy, row } = centreOf(i);

		if (i < nodes.length - 1) {
			const next = centreOf(i + 1);
			if (next.row === row) {
				const dir = next.cx > nodeCx ? 1 : -1;
				const startX = nodeCx + dir * (boxW / 2 + 2);
				const endX = next.cx - dir * (boxW / 2 + 2);
				connectors.push({
					key: `${elementId}-snake-arrow-${i}`,
					d: `M${startX},${nodeCy} L${endX + dir * SNAKE_ARROW},${nodeCy} M${endX},${nodeCy - SNAKE_ARROW / 2} L${endX + dir * SNAKE_ARROW},${nodeCy} L${endX},${nodeCy + SNAKE_ARROW / 2}`,
					stroke: '#94a3b8',
					strokeWidth: 1.5,
					opacity: 1,
				});
			} else {
				const startY = nodeCy + boxH / 2 + 2;
				const endY = next.cy - boxH / 2 - 2;
				connectors.push({
					key: `${elementId}-snake-arrow-${i}`,
					d: `M${nodeCx},${startY} L${next.cx},${endY + SNAKE_ARROW} M${next.cx - SNAKE_ARROW / 2},${endY} L${next.cx},${endY + SNAKE_ARROW} L${next.cx + SNAKE_ARROW / 2},${endY}`,
					stroke: '#94a3b8',
					strokeWidth: 1.5,
					opacity: 1,
				});
			}
		}

		const result: RenderedRectNode = {
			kind: 'rect',
			key: `${elementId}-snake-${node.id}-${i}`,
			x: nodeCx - boxW / 2,
			y: nodeCy - boxH / 2,
			width: boxW,
			height: boxH,
			rx,
			fill: nodeFill(node, i, palette),
			stroke: nodeStroke(node, stroke),
			strokeWidth: sw,
			opacity: nodeOpacity(i, nodes.length, style),
			text: truncate(node.text, 20),
			fontSize: fitFontSize(node.text, boxW * 0.85, boxH, 10),
			textX: nodeCx,
			textY: nodeCy,
			...nodeTextStyle(node),
		};
		return result;
	});

	return {
		nodes: renderedNodes,
		connectors,
		shadowFilter: styleShadow(style),
		viewBox: `0 0 ${w} ${h}`,
		family: 'bending',
	};
}
