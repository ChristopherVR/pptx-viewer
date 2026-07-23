/**
 * SmartArt DiagramML interpreter - styled node builders.
 *
 * Small factory helpers shared by every arranger (linear / cycle / hierarchy /
 * pyramid / snake) so each arranger file stays focused on geometry rather than
 * on repeating the fill / stroke / opacity / font wiring. Pure geometry; no
 * framework code.
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
	RenderedCircleNode,
	RenderedPolygonNode,
	RenderedRectNode,
} from './smartart-layout-types';

/** Resolved stroke width / colour / shadow for a SmartArt style. */
export interface StyleContext {
	strokeWidth: number;
	stroke: string;
	shadow: string | undefined;
}

/** Derive the reusable stroke/shadow context for a style once per layout. */
export function styleContext(style: SmartArtStyle): StyleContext {
	const strokeWidth = styleStroke(style);
	return { strokeWidth, stroke: strokeFor(strokeWidth), shadow: styleShadow(style) };
}

interface RectParams {
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
	node: PptxSmartArtNode;
	index: number;
	total: number;
	palette: string[];
	style: SmartArtStyle;
	ctx: StyleContext;
}

/** Build a styled rounded-rect node covering `[x,y,width,height]`. */
export function rectNode(params: RectParams): RenderedRectNode {
	const { x, y, width, height, node, index, total, palette, style, ctx } = params;
	return {
		kind: 'rect',
		key: params.key,
		x,
		y,
		width,
		height,
		rx: Math.min(6, height * 0.15),
		fill: nodeFill(node, index, palette),
		stroke: nodeStroke(node, ctx.stroke),
		strokeWidth: ctx.strokeWidth,
		opacity: nodeOpacity(index, total, style),
		text: truncate(node.text, 40),
		fontSize: fitFontSize(node.text, width * 0.9, height, 12),
		textX: x + width / 2,
		textY: y + height / 2,
	};
}

interface CircleParams {
	key: string;
	cx: number;
	cy: number;
	r: number;
	node: PptxSmartArtNode;
	index: number;
	total: number;
	palette: string[];
	style: SmartArtStyle;
	ctx: StyleContext;
}

/** Build a styled circle node centred at `[cx,cy]`. */
export function circleNode(params: CircleParams): RenderedCircleNode {
	const { cx, cy, r, node, index, total, palette, style, ctx } = params;
	return {
		kind: 'circle',
		key: params.key,
		cx,
		cy,
		r,
		fill: nodeFill(node, index, palette),
		stroke: nodeStroke(node, ctx.stroke),
		strokeWidth: ctx.strokeWidth,
		opacity: nodeOpacity(index, total, style),
		text: truncate(node.text, 20),
		fontSize: fitFontSize(node.text, r * 1.4, r * 2, 11),
	};
}

interface PolygonParams {
	key: string;
	points: string;
	textX: number;
	textY: number;
	fontWidth: number;
	fontHeight: number;
	node: PptxSmartArtNode;
	index: number;
	total: number;
	palette: string[];
	style: SmartArtStyle;
	ctx: StyleContext;
}

/** Build a styled polygon node from an SVG points string. */
export function polygonNode(params: PolygonParams): RenderedPolygonNode {
	const { points, textX, textY, node, index, total, palette, style, ctx } = params;
	return {
		kind: 'polygon',
		key: params.key,
		points,
		fill: nodeFill(node, index, palette),
		stroke: nodeStroke(node, ctx.stroke),
		strokeWidth: ctx.strokeWidth,
		opacity: nodeOpacity(index, total, style),
		text: truncate(node.text, 25),
		fontSize: fitFontSize(node.text, params.fontWidth, params.fontHeight, 12),
		textX,
		textY,
	};
}
