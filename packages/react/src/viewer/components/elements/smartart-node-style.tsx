import type { PptxSmartArtNode } from 'pptx-viewer-core';

import { colour } from '../../utils/smartart-helpers';

/**
 * Per-node visual properties resolved for SVG rendering.
 *
 * A node's {@link PptxSmartArtNode.style} override (set via the inspector and
 * round-tripped through core) wins over the cycled palette colour and the
 * default white text, so an explicit per-node colour shows up on canvas.
 */
export interface ResolvedNodeStyle {
	/** Fill colour for the node shape. */
	fill: string;
	/** Text colour for the node label. */
	fontColor: string;
	/** SVG `font-weight` (700 when bold, else undefined). */
	fontWeight?: number;
	/** SVG `font-style` (`italic` when italic, else undefined). */
	fontStyle?: 'italic';
	/** Optional stroke colour override (line colour). */
	strokeColor?: string;
}

/**
 * Resolve the fill / font colour / emphasis for a single SmartArt node, layering
 * its optional per-node {@link PptxSmartArtNode.style} over the palette default.
 *
 * @param node    - The node being rendered.
 * @param index   - Its position in the rendered list (palette cycling index).
 * @param palette - Resolved colour palette.
 * @returns The resolved fill, font colour, weight, style, and stroke override.
 */
export function resolveNodeStyle(
	node: PptxSmartArtNode,
	index: number,
	palette: string[],
): ResolvedNodeStyle {
	const style = node.style;
	return {
		fill: style?.fillColor ?? colour(index, palette),
		fontColor: style?.fontColor ?? 'white',
		fontWeight: style?.bold ? 700 : undefined,
		fontStyle: style?.italic ? 'italic' : undefined,
		strokeColor: style?.lineColor,
	};
}
