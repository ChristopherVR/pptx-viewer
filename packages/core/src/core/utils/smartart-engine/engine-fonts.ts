/**
 * Output-stage font sizing for the per-point engine: gathers the text every
 * rendered node shows (its own paragraph when it presents its own data
 * point, plus folded descendant paragraphs), resolves all sizes jointly
 * (`font-groups.ts`), and writes them onto the rendered nodes in pixels.
 */

import type { PptxSmartArtNode } from '../../types';
import { resolveFontTable } from '../smartart-layout-item-font-size';
import type { RenderedRectNode } from '../smartart-layout-types';
import type { EngineNode } from './engine-node';
import type { FontFitEntry } from './font-groups';
import { resolveEngineFonts } from './font-groups';
import { sourceIdsOf } from './move-with-merge';
import { nodeTextFor } from './node-text';
import type { NodeText } from './text-fit';
import { DESCENDANT_FONT_SCALE, paragraphSizesPt, textMetricsFor } from './text-measure';

/** A rendered node paired with the engine node that produced it. */
export interface RenderedEngineNode {
	node: EngineNode;
	rendered: RenderedRectNode;
	mergedIds?: string[];
	/** A folded `moveWith` carrier whose box and constraints size the text (else `node`). */
	textNode?: EngineNode;
}

const PX_PER_PT = 96 / 72;

/**
 * The paragraphs `entry` renders (see {@link nodeTextFor}), including any
 * point a `moveWith` carrier folded into it.
 */
export function nodeTextOf(
	entry: RenderedEngineNode,
	nodeById: Map<string, PptxSmartArtNode>,
): NodeText | undefined {
	const ids = sourceIdsOf(entry.node);
	for (const id of entry.mergedIds ?? []) {
		if (!ids.includes(id)) {
			ids.push(id);
		}
	}
	return nodeTextFor(
		entry.node,
		ids,
		entry.rendered.literalText ?? entry.rendered.text,
		nodeById,
		entry.textNode ?? entry.node,
	);
}

/** Resolve and assign every collected node's font size (pixels). */
export function applyEngineFonts(
	collected: readonly RenderedEngineNode[],
	nodeById: Map<string, PptxSmartArtNode>,
	fontName: string | undefined,
): void {
	const texts = new Map<EngineNode, NodeText>();
	const txBySource = new Map<string, EngineNode>();
	for (const entry of collected) {
		const text = nodeTextOf(entry, nodeById);
		if (!text) {
			continue;
		}
		const fitNode = entry.textNode ?? entry.node;
		texts.set(fitNode, text);
		const first = sourceIdsOf(fitNode)[0];
		if (first && fitNode.alg.type === 'tx' && !txBySource.has(first)) {
			txBySource.set(first, fitNode);
		}
	}
	// A shape-only (`sp`) node presenting the same point as a `tx` node shows
	// that text at the `tx` node's size: "Vertical Action List"'s `bgOutline`
	// carries its item text at `parentText`'s 28pt, in `parentText`'s own
	// text box (the cached `dsp:txXfrm`), rather than fitting it afresh.
	const twinOf = new Map<EngineNode, EngineNode>();
	const entries: FontFitEntry[] = [];
	for (const [node, text] of texts) {
		const first = sourceIdsOf(node)[0];
		const twin = first && node.alg.type !== 'tx' ? txBySource.get(first) : undefined;
		if (twin && texts.has(twin)) {
			twinOf.set(node, twin);
		} else {
			entries.push({ node, text });
		}
	}
	const sizes = resolveEngineFonts(entries, textMetricsFor(resolveFontTable(fontName)));
	for (const [node, twin] of twinOf) {
		const size = sizes.get(twin);
		if (size !== undefined) {
			sizes.set(node, size);
		}
	}
	const hasDescendants = (node: EngineNode): boolean => {
		const text = texts.get(node);
		return text !== undefined && text.own !== undefined && text.descendants.length > 0;
	};
	for (const { node: renderedNode, rendered, textNode } of collected) {
		const node = textNode ?? renderedNode;
		const pt = sizes.get(node) ?? 18;
		const text = texts.get(node);
		const { first, secondary } = text
			? paragraphSizesPt(text, pt)
			: { first: pt, secondary: Math.round(pt * DESCENDANT_FONT_SCALE) };
		rendered.fontSize = first * PX_PER_PT;
		rendered.descendantFontSize = hasDescendants(node) ? secondary * PX_PER_PT : undefined;
	}
}
