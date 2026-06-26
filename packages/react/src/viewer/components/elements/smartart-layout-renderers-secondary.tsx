/**
 * SmartArt layout renderers: Pyramid, Venn, Funnel, and Target.
 *
 * Each renderer is a React component that accepts {@link LayoutRendererProps}
 * and returns an SVG visualisation of the SmartArt nodes in that layout style.
 */

import React from 'react';

import {
	colour,
	nodeOpacity,
	styleShadow,
	styleStroke,
	truncate,
} from '../../utils/smartart-helpers';
import type { LayoutRendererProps } from './smartart-renderer-types';
import { fitFontSize, smartArtNodeGroupProps, SmartArtNodeText } from './smartart-renderer-utils';

// ── Pyramid Renderer ────────────────────────────────────────────────────────

/**
 * Renders SmartArt nodes as stacked trapezoids forming a pyramid shape.
 *
 * The top band is narrowest and the bottom band is widest, giving the
 * classic pyramid appearance. Each band contains centred text.
 */
export function PyramidRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const pad = 8;
	const gap = 3;
	const usableH = h - pad * 2;
	const bandH = (usableH - gap * (nodes.length - 1)) / nodes.length;
	const maxW = w - pad * 2;
	const shadow = styleShadow(style);
	const sw = styleStroke(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-pyramid'
		>
			{nodes.map((node, i) => {
				// Top band is narrowest, bottom is widest (pyramid shape)
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

				return (
					<g
						key={`${element.id}-pyramid-${node.id}-${i}`}
						{...smartArtNodeGroupProps(node.id, shadow)}
					>
						<polygon
							points={points}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
							stroke={sw > 0 ? 'rgba(255,255,255,0.3)' : 'none'}
							strokeWidth={sw}
						/>
						<SmartArtNodeText
							x={w / 2}
							y={y + bandH / 2}
							text={truncate(node.text, 30)}
							fill='white'
							fontSize={fontSize}
							className='pointer-events-none'
						/>
					</g>
				);
			})}
		</svg>
	);
}

// ── Venn Renderer ───────────────────────────────────────────────────────────

/**
 * Renders SmartArt nodes as overlapping circles (Venn diagram).
 *
 * For 1-4 nodes the circles are arranged radially around a centre point.
 * For 5+ nodes the circles are placed in a horizontal row with overlap.
 */
export function VennRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const shadow = styleShadow(style);

	if (nodes.length <= 4) {
		const cx = w / 2;
		const cy = h / 2;
		const r = Math.min(w, h) * 0.28;
		const spread = r * 0.55;

		return (
			<svg
				className='w-full h-full pointer-events-none'
				viewBox={`0 0 ${w} ${h}`}
				preserveAspectRatio='xMidYMid meet'
				data-testid='smartart-venn'
			>
				{nodes.map((node, i) => {
					const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
					const nx = cx + spread * Math.cos(angle);
					const ny = cy + spread * Math.sin(angle);
					const fontSize = fitFontSize(node.text, r * 1.2, r * 2, 11);

					return (
						<g
							key={`${element.id}-venn-${node.id}-${i}`}
							{...smartArtNodeGroupProps(node.id, shadow)}
						>
							<circle cx={nx} cy={ny} r={r} fill={colour(i, palette)} opacity={0.35} />
							<SmartArtNodeText
								x={nx}
								y={ny}
								text={truncate(node.text, 20)}
								fill='white'
								fontSize={fontSize}
								fontWeight='bold'
								className='pointer-events-none'
							/>
						</g>
					);
				})}
			</svg>
		);
	}

	// 5+ nodes: horizontal row of overlapping circles
	const r = Math.min(h * 0.38, w / (nodes.length * 0.9));
	const overlap = r * 0.5;
	const totalW = nodes.length * (r * 2 - overlap) + overlap;
	const offsetX = (w - totalW) / 2 + r;
	const cy = h / 2;

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-venn'
		>
			{nodes.map((node, i) => {
				const nx = offsetX + i * (r * 2 - overlap);
				const fontSize = fitFontSize(node.text, r * 1.2, r * 2, 10);

				return (
					<g
						key={`${element.id}-venn-${node.id}-${i}`}
						{...smartArtNodeGroupProps(node.id, shadow)}
					>
						<circle cx={nx} cy={cy} r={r} fill={colour(i, palette)} opacity={0.35} />
						<SmartArtNodeText
							x={nx}
							y={cy}
							text={truncate(node.text, 20)}
							fill='white'
							fontSize={fontSize}
							fontWeight='bold'
							className='pointer-events-none'
						/>
					</g>
				);
			})}
		</svg>
	);
}

// ── Funnel Renderer ─────────────────────────────────────────────────────────

/**
 * Renders SmartArt nodes as a funnel: a series of trapezoids that narrow
 * progressively from top to bottom.
 */
export function FunnelRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const pad = 8;
	const usableW = w - pad * 2;
	const stageH = (h - pad * 2) / nodes.length;
	const shadow = styleShadow(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-funnel'
		>
			{nodes.map((node, i) => {
				const topWidth = usableW * (1 - i / nodes.length);
				const bottomWidth = usableW * (1 - (i + 1) / nodes.length);
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

				return (
					<g
						key={`${element.id}-funnel-${node.id}-${i}`}
						{...smartArtNodeGroupProps(node.id, shadow)}
					>
						<polygon
							points={points}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
						/>
						<SmartArtNodeText
							x={w / 2}
							y={y + stageH / 2}
							text={truncate(node.text, 30)}
							fill='white'
							fontSize={fontSize}
							className='pointer-events-none'
						/>
					</g>
				);
			})}
		</svg>
	);
}

// ── Target Renderer ─────────────────────────────────────────────────────────

/**
 * Renders SmartArt nodes as concentric circles (bullseye/target) with labels
 * connected by leader lines to the right of the target.
 */
export function TargetRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const cx = w * 0.4;
	const cy = h / 2;
	const maxR = Math.min(cx - 8, cy - 8);
	const fontSize = Math.max(7, Math.min(10, maxR / (nodes.length + 1)));
	const labelX = cx + maxR + 8;
	const shadow = styleShadow(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-target'
		>
			{nodes.map((node, i) => {
				const r = maxR * ((nodes.length - i) / nodes.length);
				return (
					<g
						key={`${element.id}-target-${node.id}-${i}`}
						{...smartArtNodeGroupProps(node.id, shadow)}
					>
						<circle
							cx={cx}
							cy={cy}
							r={Math.max(r, 4)}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
						/>
						<line
							x1={cx + Math.max(r, 4)}
							y1={cy}
							x2={labelX - 2}
							y2={8 + i * (fontSize + 6)}
							stroke={colour(i, palette)}
							strokeWidth={1}
							opacity={0.6}
						/>
						<text
							x={labelX}
							y={8 + i * (fontSize + 6) + fontSize / 2}
							textAnchor='start'
							dominantBaseline='central'
							fill={colour(i, palette)}
							fontSize={fontSize}
							className='pointer-events-none'
						>
							{truncate(node.text, 30)}
						</text>
					</g>
				);
			})}
		</svg>
	);
}
