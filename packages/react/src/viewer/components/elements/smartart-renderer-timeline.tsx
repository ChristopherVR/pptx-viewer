/**
 * Timeline SmartArt layout renderer.
 *
 * Renders SmartArt nodes along a horizontal timeline axis.
 * Nodes alternate between above and below the axis line, connected by
 * vertical stems. An arrowhead appears at the right end of the axis.
 *
 * @module smartart-renderer-timeline
 */

import React from 'react';

import { colour, nodeOpacity, styleShadow, truncate } from '../../utils/smartart-helpers';
import type { LayoutRendererProps } from './smartart-renderer-types';
import { fitFontSize } from './smartart-renderer-utils';

/**
 * Renders SmartArt nodes along a horizontal timeline axis.
 *
 * Nodes alternate between above and below the axis line, connected by
 * vertical stems. An arrowhead appears at the right end of the axis.
 */
export function TimelineRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const padX = 24;
	const lineY = h / 2;
	const lineStartX = padX;
	const lineEndX = w - padX;
	const lineLen = lineEndX - lineStartX;
	const dotR = Math.max(4, Math.min(8, lineLen / (nodes.length * 4)));
	const labelOffset = Math.min(h * 0.28, 40);
	const shadow = styleShadow(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-timeline'
		>
			{/* Main timeline axis */}
			<line x1={lineStartX} y1={lineY} x2={lineEndX} y2={lineY} stroke='#94a3b8' strokeWidth={2} />
			{/* Arrow at end */}
			<polygon
				points={`${lineEndX - 6},${lineY - 4} ${lineEndX},${lineY} ${lineEndX - 6},${lineY + 4}`}
				fill='#94a3b8'
			/>
			{nodes.map((node, i) => {
				const x =
					nodes.length === 1
						? (lineStartX + lineEndX) / 2
						: lineStartX + (i / (nodes.length - 1)) * lineLen;
				const above = i % 2 === 0;
				const textY = above ? lineY - labelOffset : lineY + labelOffset;
				const stemEndY = above ? lineY - dotR - 2 : lineY + dotR + 2;
				const fontSize = fitFontSize(node.text, (lineLen / nodes.length) * 0.9, labelOffset, 10);

				return (
					<g key={`${element.id}-timeline-${node.id}-${i}`} style={{ filter: shadow }}>
						<line
							x1={x}
							y1={stemEndY}
							x2={x}
							y2={textY + (above ? fontSize : -fontSize)}
							stroke={colour(i, palette)}
							strokeWidth={1}
							opacity={0.5}
						/>
						<circle
							cx={x}
							cy={lineY}
							r={dotR}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
						/>
						<text
							x={x}
							y={textY}
							textAnchor='middle'
							dominantBaseline={above ? 'auto' : 'hanging'}
							fill={colour(i, palette)}
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
