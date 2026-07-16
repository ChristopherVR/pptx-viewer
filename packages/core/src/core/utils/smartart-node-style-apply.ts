/**
 * Apply per-node visual overrides onto decomposed SmartArt shape elements.
 *
 * The algorithmic SmartArt layouts (`smartart-layouts*`) emit one `shape`
 * element per content node, in content-node order. When a node carries a
 * {@link PptxSmartArtNodeStyle} override, this post-pass rewrites the
 * corresponding shape's fill / stroke / font colour and bold / italic so the
 * explicit per-node colour wins over the cycled palette colour.
 *
 * Pure and immutable: returns a new element array (only overridden shapes are
 * cloned). The drawing-shapes and constraint-engine paths do not preserve a
 * 1:1 content-node ordering, so callers only apply this to the family/named/
 * heuristic algorithmic output.
 *
 * @module smartart-node-style-apply
 */

import type { PptxElement, PptxSmartArtNode } from '../types';
import { getContentNodes } from './smartart-helpers';
import { projectSmartArtNodeText } from './smartart-node-text-projection';

/** Content nodes that actually carry a per-node style override, in order. */
function styledContentNodes(nodes: PptxSmartArtNode[]): PptxSmartArtNode[] {
	return getContentNodes(nodes);
}

/**
 * Overlay per-node style overrides onto the shape elements produced by an
 * algorithmic SmartArt layout. `elements` and `nodes` are matched by order:
 * the Nth `shape` element corresponds to the Nth content node.
 */
export function applyNodeStylesToElements(
	elements: PptxElement[],
	nodes: PptxSmartArtNode[],
): PptxElement[] {
	const contentNodes = styledContentNodes(nodes);
	if (contentNodes.length === 0) {
		return elements;
	}
	let shapeIndex = 0;
	return elements.map((element): PptxElement => {
		if (element.type !== 'shape') {
			return element;
		}
		const node = contentNodes[shapeIndex++];
		const style = node?.style ?? {};
		if (!node) {
			return element;
		}

		const shapeStyle = { ...element.shapeStyle };
		if (style.fillColor !== undefined) {
			shapeStyle.fillColor = style.fillColor;
			shapeStyle.fillMode = 'solid';
		}
		if (style.lineColor !== undefined) {
			shapeStyle.strokeColor = style.lineColor;
		}

		const baseTextStyle = element.textStyle ?? {};
		const textStyle = { ...baseTextStyle };
		if (style.fontColor !== undefined) {
			textStyle.color = style.fontColor;
		}
		if (style.bold !== undefined) {
			textStyle.bold = style.bold;
		}
		if (style.italic !== undefined) {
			textStyle.italic = style.italic;
		}

		const projectedSegments = projectSmartArtNodeText(node, textStyle);
		const segments = projectedSegments.map((seg) => ({
			...seg,
			style: {
				...seg.style,
				...(style.fontColor !== undefined ? { color: style.fontColor } : {}),
				...(style.bold !== undefined ? { bold: style.bold } : {}),
				...(style.italic !== undefined ? { italic: style.italic } : {}),
			},
		}));

		return {
			...element,
			text: node.text,
			shapeStyle,
			textStyle,
			...(segments ? { textSegments: segments } : {}),
		};
	});
}
