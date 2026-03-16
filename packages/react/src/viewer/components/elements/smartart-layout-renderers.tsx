/**
 * SmartArt layout renderers: List, Process, Cycle, and Matrix.
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
import { fitFontSize } from './smartart-renderer-utils';

// ── List Renderer ───────────────────────────────────────────────────────────

/**
 * Renders SmartArt nodes as a vertical list of rounded rectangles.
 *
 * Each node occupies a horizontal bar spanning the full width, stacked
 * vertically with even spacing.
 */
export function ListRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const pad = 8;
	const gap = 4;
	const usableH = h - pad * 2;
	const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;
	const itemW = w - pad * 2;
	const rx = Math.min(6, itemH * 0.15);
	const shadow = styleShadow(style);
	const sw = styleStroke(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-list'
		>
			{nodes.map((node, i) => {
				const y = pad + i * (itemH + gap);
				const fontSize = fitFontSize(node.text, itemW * 0.9, itemH, 12);
				return (
					<g key={`${element.id}-list-${node.id}-${i}`} style={{ filter: shadow }}>
						<rect
							x={pad}
							y={y}
							width={itemW}
							height={itemH}
							rx={rx}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
							stroke={sw > 0 ? 'rgba(255,255,255,0.3)' : 'none'}
							strokeWidth={sw}
						/>
						<text
							x={pad + itemW / 2}
							y={y + itemH / 2}
							textAnchor='middle'
							dominantBaseline='central'
							fill='white'
							fontSize={fontSize}
							className='pointer-events-none'
						>
							{truncate(node.text, 40)}
						</text>
					</g>
				);
			})}
		</svg>
	);
}

// ── Process Renderer (Chevron) ──────────────────────────────────────────────

/**
 * Renders SmartArt nodes as a horizontal row of chevron / arrow shapes.
 *
 * The first node has a flat left edge, the last has a flat right edge, and
 * middle nodes have the full chevron notch on both sides.
 */
export function ProcessRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const pad = 8;
	const gap = 4;
	const chevronDepth = Math.min(16, w * 0.04);
	const usableW = w - pad * 2;
	const itemW = (usableW - gap * (nodes.length - 1)) / nodes.length;
	const itemH = Math.min(h - pad * 2, h * 0.6);
	const yMid = h / 2;
	const shadow = styleShadow(style);
	const sw = styleStroke(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-process'
		>
			{nodes.map((node, i) => {
				const x = pad + i * (itemW + gap);
				const halfH = itemH / 2;
				const isFirst = i === 0;
				const isLast = i === nodes.length - 1;

				// Build chevron shape points
				const points = isFirst
					? `${x},${yMid - halfH} ${x + itemW - chevronDepth},${yMid - halfH} ${x + itemW},${yMid} ${x + itemW - chevronDepth},${yMid + halfH} ${x},${yMid + halfH}`
					: isLast
						? `${x},${yMid - halfH} ${x + itemW},${yMid - halfH} ${x + itemW},${yMid + halfH} ${x},${yMid + halfH} ${x + chevronDepth},${yMid}`
						: `${x},${yMid - halfH} ${x + itemW - chevronDepth},${yMid - halfH} ${x + itemW},${yMid} ${x + itemW - chevronDepth},${yMid + halfH} ${x},${yMid + halfH} ${x + chevronDepth},${yMid}`;

				const fontSize = fitFontSize(node.text, itemW * 0.7, itemH, 12);

				return (
					<g key={`${element.id}-process-${node.id}-${i}`} style={{ filter: shadow }}>
						<polygon
							points={points}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
							stroke={sw > 0 ? 'rgba(255,255,255,0.3)' : 'none'}
							strokeWidth={sw}
						/>
						<text
							x={x + itemW / 2}
							y={yMid}
							textAnchor='middle'
							dominantBaseline='central'
							fill='white'
							fontSize={fontSize}
							className='pointer-events-none'
						>
							{truncate(node.text, 25)}
						</text>
					</g>
				);
			})}
		</svg>
	);
}

// ── Cycle Renderer ──────────────────────────────────────────────────────────

/**
 * Renders SmartArt nodes in a circular (radial) arrangement with curved
 * connector arcs between consecutive nodes.
 */
export function CycleRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const size = Math.min(w, h);
	const cx = w / 2;
	const cy = h / 2;
	const radius = size * 0.35;
	const nodeR = Math.max(size * 0.06, Math.min(size * 0.12, 200 / nodes.length));
	const shadow = styleShadow(style);
	const sw = styleStroke(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-cycle'
		>
			{/* Connector arc lines between consecutive nodes */}
			{nodes.map((_node, i) => {
				const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
				const nx = cx + radius * Math.cos(angle);
				const ny = cy + radius * Math.sin(angle);
				const nextI = (i + 1) % nodes.length;
				const nextAngle = (nextI / nodes.length) * Math.PI * 2 - Math.PI / 2;
				const nextX = cx + radius * Math.cos(nextAngle);
				const nextY = cy + radius * Math.sin(nextAngle);

				// Draw curved connector arc
				const midAngle = (angle + nextAngle) / 2;
				// Handle wrap-around for last->first connector
				const adjustedMidAngle =
					i === nodes.length - 1 ? (angle + nextAngle + Math.PI * 2) / 2 : midAngle;
				const arcBulge = radius * 0.15;
				const controlX = cx + (radius + arcBulge) * Math.cos(adjustedMidAngle);
				const controlY = cy + (radius + arcBulge) * Math.sin(adjustedMidAngle);

				return (
					<path
						key={`${element.id}-cycle-conn-${i}`}
						d={`M${nx},${ny} Q${controlX},${controlY} ${nextX},${nextY}`}
						fill='none'
						stroke='#94a3b8'
						strokeWidth={1.5}
						opacity={0.5}
						markerEnd={undefined}
					/>
				);
			})}
			{/* Node circles */}
			{nodes.map((node, i) => {
				const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
				const nx = cx + radius * Math.cos(angle);
				const ny = cy + radius * Math.sin(angle);
				const fontSize = fitFontSize(node.text, nodeR * 1.4, nodeR * 2, 11);

				return (
					<g key={`${element.id}-cycle-${node.id}-${i}`} style={{ filter: shadow }}>
						<circle
							cx={nx}
							cy={ny}
							r={nodeR}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
							stroke={sw > 0 ? 'rgba(255,255,255,0.3)' : 'none'}
							strokeWidth={sw}
						/>
						<text
							x={nx}
							y={ny}
							textAnchor='middle'
							dominantBaseline='central'
							fill='white'
							fontSize={fontSize}
							className='pointer-events-none'
						>
							{truncate(node.text, 20)}
						</text>
					</g>
				);
			})}
		</svg>
	);
}

// ── Matrix Renderer ─────────────────────────────────────────────────────────

/**
 * Renders SmartArt nodes in a grid (matrix) layout.
 *
 * Nodes are placed in a grid with `ceil(sqrt(n))` columns, each cell
 * containing a rounded rectangle with centred text.
 */
export function MatrixRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const cols = Math.ceil(Math.sqrt(nodes.length));
	const rows = Math.ceil(nodes.length / cols);
	const pad = 8;
	const gap = 6;
	const usableW = w - pad * 2;
	const usableH = h - pad * 2;
	const cellW = (usableW - gap * (cols - 1)) / cols;
	const cellH = (usableH - gap * (rows - 1)) / rows;
	const rx = Math.min(6, Math.min(cellW, cellH) * 0.1);
	const shadow = styleShadow(style);
	const sw = styleStroke(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-matrix'
		>
			{nodes.map((node, i) => {
				const col = i % cols;
				const row = Math.floor(i / cols);
				const x = pad + col * (cellW + gap);
				const y = pad + row * (cellH + gap);
				const fontSize = fitFontSize(node.text, cellW * 0.85, cellH, 12);

				return (
					<g key={`${element.id}-matrix-${node.id}-${i}`} style={{ filter: shadow }}>
						<rect
							x={x}
							y={y}
							width={cellW}
							height={cellH}
							rx={rx}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
							stroke={sw > 0 ? 'rgba(255,255,255,0.3)' : 'none'}
							strokeWidth={sw}
						/>
						<text
							x={x + cellW / 2}
							y={y + cellH / 2}
							textAnchor='middle'
							dominantBaseline='central'
							fill='white'
							fontSize={fontSize}
							fontWeight={500}
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
