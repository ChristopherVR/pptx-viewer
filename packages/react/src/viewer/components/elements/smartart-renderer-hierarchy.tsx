/**
 * Hierarchy SmartArt layout renderer.
 *
 * Renders SmartArt nodes as a tree / org-chart hierarchy with L-shaped
 * connector lines between parent and child nodes.
 *
 * @module smartart-renderer-hierarchy
 */

import React from 'react';

import {
	colour,
	nodeOpacity,
	styleShadow,
	styleStroke,
	truncate,
	buildTree,
	treeWidth,
	treeDepth,
} from '../../utils/smartart-helpers';
import type { TreeNode } from '../../utils/smartart-helpers';
import { ListRenderer } from './smartart-layout-renderers';
import type { LayoutRendererProps } from './smartart-renderer-types';
import { fitFontSize, smartArtNodeGroupProps, SmartArtNodeText } from './smartart-renderer-utils';

/**
 * Renders SmartArt nodes as a tree / org-chart hierarchy with L-shaped
 * connector lines between parent and child nodes.
 *
 * Falls back to {@link ListRenderer} if the tree cannot be built (e.g. all
 * nodes are roots with no parent-child relationships).
 */
export function HierarchyRenderer({
	element,
	nodes,
	palette,
	style,
}: LayoutRendererProps): React.ReactElement {
	const roots = buildTree(nodes);
	if (roots.length === 0) {
		// Fall back to flat list if tree parsing fails
		return <ListRenderer element={element} nodes={nodes} palette={palette} style={style} />;
	}

	const totalLeaves = roots.reduce((s, r) => s + treeWidth(r), 0);
	const depth = Math.max(...roots.map(treeDepth));
	const svgW = element.width;
	const svgH = element.height;
	const cellW = svgW / totalLeaves;
	const cellH = svgH / Math.max(depth, 1);
	const boxW = Math.min(cellW * 0.8, 140);
	const boxH = Math.min(cellH * 0.4, 36);
	const rx = Math.min(6, boxH * 0.15);
	const shadow = styleShadow(style);
	const sw = styleStroke(style);

	const elements: React.ReactNode[] = [];
	let colourIdx = 0;

	function renderTreeNode(t: TreeNode, xOffset: number, level: number): number {
		const w = treeWidth(t);
		const nodeCx = (xOffset + w / 2) * cellW;
		const nodeCy = level * cellH + cellH / 2;
		const ci = colourIdx++;
		const fontSize = fitFontSize(t.node.text, boxW * 0.9, boxH, 11);

		// Draw connector lines to children first (so they appear behind boxes)
		for (const child of t.children) {
			const childW = treeWidth(child);
			let childOffset = xOffset;
			// Compute child's actual offset
			for (const c of t.children) {
				if (c === child) {
					break;
				}
				childOffset += treeWidth(c);
			}
			const childCx = (childOffset + childW / 2) * cellW;
			const childCy = (level + 1) * cellH + cellH / 2;

			// Draw an L-shaped connector: vertical down from parent, horizontal to child, vertical down to child
			const midY = nodeCy + boxH / 2 + (childCy - boxH / 2 - (nodeCy + boxH / 2)) / 2;
			elements.push(
				<path
					key={`${element.id}-hier-conn-${t.node.id}-${child.node.id}`}
					d={`M${nodeCx},${nodeCy + boxH / 2} L${nodeCx},${midY} L${childCx},${midY} L${childCx},${childCy - boxH / 2}`}
					fill='none'
					stroke='#94a3b8'
					strokeWidth={1.5}
					opacity={0.5}
				/>,
			);
		}

		// Draw the box with rounded corners and shadow
		elements.push(
			<g
				key={`${element.id}-hier-group-${t.node.id}`}
				{...smartArtNodeGroupProps(t.node.id, shadow)}
			>
				<rect
					x={nodeCx - boxW / 2}
					y={nodeCy - boxH / 2}
					width={boxW}
					height={boxH}
					rx={rx}
					fill={colour(ci, palette)}
					opacity={nodeOpacity(ci, nodes.length, style)}
					stroke={sw > 0 ? 'rgba(255,255,255,0.3)' : 'none'}
					strokeWidth={sw}
				/>
				<SmartArtNodeText
					x={nodeCx}
					y={nodeCy}
					text={truncate(t.node.text, 40)}
					fill='white'
					fontSize={fontSize}
					className='pointer-events-none'
				/>
			</g>,
		);

		let childOffset = xOffset;
		for (const child of t.children) {
			renderTreeNode(child, childOffset, level + 1);
			childOffset += treeWidth(child);
		}
		return w;
	}

	let offset = 0;
	for (const root of roots) {
		offset += renderTreeNode(root, offset, 0);
	}

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${svgW} ${svgH}`}
			preserveAspectRatio='xMidYMid meet'
			data-testid='smartart-hierarchy'
		>
			{elements}
		</svg>
	);
}
