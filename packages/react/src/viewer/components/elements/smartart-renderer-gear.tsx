/**
 * Gear SmartArt layout renderer.
 *
 * Renders up to 3 SmartArt nodes as interlocking gear shapes, with any
 * remaining nodes shown as a legend list to the right.
 *
 * @module smartart-renderer-gear
 */

import React from 'react';

import { colour, nodeOpacity, styleShadow, truncate } from '../../utils/smartart-helpers';
import type { LayoutRendererProps } from './smartart-renderer-types';
import {
	fitFontSize,
	gearPath,
	smartArtNodeGroupProps,
	SmartArtNodeText,
} from './smartart-renderer-utils';

/**
 * Renders up to 3 SmartArt nodes as interlocking gear shapes, with any
 * remaining nodes shown as a legend list to the right.
 */
export function GearRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const w = element.width;
	const h = element.height;
	const gearNodes = nodes.slice(0, 3);
	const extraNodes = nodes.slice(3);
	const gearCount = gearNodes.length;
	const gearAreaW = extraNodes.length > 0 ? w * 0.7 : w;
	const spacing = gearAreaW / (gearCount + 1);
	const gearR = Math.min(spacing * 0.4, h * 0.35);
	const innerR = gearR * 0.7;
	const teethCount = 8;
	const shadow = styleShadow(style);

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-gear'
		>
			{gearNodes.map((node, i) => {
				const gx = spacing * (i + 1);
				const gy = h / 2 + (i % 2 === 0 ? 0 : gearR * 0.35);
				const fontSize = fitFontSize(node.text, innerR * 1.2, innerR * 2, 11);

				return (
					<g
						key={`${element.id}-gear-${node.id}-${i}`}
						{...smartArtNodeGroupProps(node.id, shadow)}
					>
						<path
							d={gearPath(gx, gy, gearR, innerR, teethCount)}
							fill={colour(i, palette)}
							opacity={nodeOpacity(i, nodes.length, style)}
						/>
						<circle cx={gx} cy={gy} r={innerR * 0.5} fill='white' opacity={0.25} />
						<SmartArtNodeText
							x={gx}
							y={gy}
							text={truncate(node.text, 20)}
							fill='white'
							fontSize={fontSize}
							fontWeight='bold'
							className='pointer-events-none'
						/>
					</g>
				);
			})}
			{extraNodes.map((node, i) => {
				const lx = gearAreaW + 10;
				const ly = 14 + i * 18;
				return (
					<g key={`${element.id}-gear-extra-${node.id}-${i}`}>
						<circle
							cx={lx}
							cy={ly}
							r={3}
							fill={colour(gearCount + i, palette)}
							opacity={nodeOpacity(gearCount + i, nodes.length, style)}
						/>
						<text
							x={lx + 8}
							y={ly}
							textAnchor='start'
							dominantBaseline='central'
							fill={colour(gearCount + i, palette)}
							fontSize={10}
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
