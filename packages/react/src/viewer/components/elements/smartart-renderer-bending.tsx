/**
 * Bending Process (Snake) SmartArt layout renderer.
 *
 * Renders SmartArt nodes in a snake / bending-process layout where
 * nodes are arranged in a multi-row grid. Even rows flow left-to-right
 * and odd rows flow right-to-left, with arrow connectors between
 * adjacent nodes.
 *
 * @module smartart-renderer-bending
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

/**
 * Renders SmartArt nodes in a snake / bending-process layout.
 *
 * Nodes are arranged in a multi-row grid where even rows flow left-to-right
 * and odd rows flow right-to-left, with arrow connectors between adjacent
 * nodes.
 */
export function BendingProcessRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const COLS = 4;
	const w = element.width;
	const h = element.height;
	const rowsCount = Math.ceil(nodes.length / COLS);
	const padX = 8;
	const padY = 8;
	const cellW = (w - padX * 2) / COLS;
	const cellH = (h - padY * 2) / Math.max(rowsCount, 1);
	const boxW = cellW * 0.8;
	const boxH = Math.min(cellH * 0.6, 32);
	const rx = Math.min(5, boxH * 0.15);
	const arrowSize = 6;
	const shadow = styleShadow(style);
	const sw = styleStroke(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-bending'
		>
			{nodes.map((node, i) => {
				const row = Math.floor(i / COLS);
				const colInRow = i % COLS;
				const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;

				const nodeCx = padX + col * cellW + cellW / 2;
				const nodeCy = padY + row * cellH + cellH / 2;
				const fontSize = fitFontSize(node.text, boxW * 0.85, boxH, 10);

				let arrow: React.ReactNode = null;
				if (i < nodes.length - 1) {
					const nextRow = Math.floor((i + 1) / COLS);
					const nextColInRow = (i + 1) % COLS;
					const nextCol = nextRow % 2 === 0 ? nextColInRow : COLS - 1 - nextColInRow;
					const nextCx = padX + nextCol * cellW + cellW / 2;
					const nextCy = padY + nextRow * cellH + cellH / 2;

					if (nextRow === row) {
						const dir = nextCx > nodeCx ? 1 : -1;
						const startX = nodeCx + dir * (boxW / 2 + 2);
						const endX = nextCx - dir * (boxW / 2 + 2);
						arrow = (
							<g key={`${element.id}-snake-arrow-${i}`}>
								<line
									x1={startX}
									y1={nodeCy}
									x2={endX}
									y2={nodeCy}
									stroke='#94a3b8'
									strokeWidth={1.5}
								/>
								<polygon
									points={`${endX},${nodeCy - arrowSize / 2} ${endX + dir * arrowSize},${nodeCy} ${endX},${nodeCy + arrowSize / 2}`}
									fill='#94a3b8'
								/>
							</g>
						);
					} else {
						const startY = nodeCy + boxH / 2 + 2;
						const endY = nextCy - boxH / 2 - 2;
						arrow = (
							<g key={`${element.id}-snake-arrow-${i}`}>
								<line
									x1={nodeCx}
									y1={startY}
									x2={nextCx}
									y2={endY}
									stroke='#94a3b8'
									strokeWidth={1.5}
								/>
								<polygon
									points={`${nextCx - arrowSize / 2},${endY} ${nextCx},${endY + arrowSize} ${nextCx + arrowSize / 2},${endY}`}
									fill='#94a3b8'
								/>
							</g>
						);
					}
				}

				return (
					<g
						key={`${element.id}-snake-${node.id}-${i}`}
						{...smartArtNodeGroupProps(node.id, shadow)}
					>
						{arrow}
						<rect
							x={nodeCx - boxW / 2}
							y={nodeCy - boxH / 2}
							width={boxW}
							height={boxH}
							rx={rx}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
							stroke={sw > 0 ? 'rgba(255,255,255,0.3)' : 'none'}
							strokeWidth={sw}
						/>
						<SmartArtNodeText
							x={nodeCx}
							y={nodeCy}
							text={truncate(node.text, 20)}
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
