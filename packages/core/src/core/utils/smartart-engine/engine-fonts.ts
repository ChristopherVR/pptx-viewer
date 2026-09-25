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
import type { NodeText } from './text-fit';
import { sizingVariable } from './text-fit';
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
 * The paragraphs `entry` renders. A node whose own context point is among
 * the points it presents shows that point's text as its top-level paragraph
 * and every other presented point as a folded descendant; a node presenting
 * only other points (a descendant-only "child text" box) shows them all as
 * equal-level bullet paragraphs.
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
	const textOf = (id: string): string => nodeById.get(id)?.text ?? '';
	if (ids.length === 0) {
		const literal = entry.rendered.literalText ?? entry.rendered.text;
		return literal && literal.trim().length > 0 ? { own: literal, descendants: [] } : undefined;
	}
	const params = entry.node.alg.params;
	const numberParam = (name: string): number | undefined => {
		const value = Number(params[name]);
		return params[name] !== undefined && Number.isFinite(value) ? value : undefined;
	};
	const fitNode = entry.textNode ?? entry.node;
	const layout = {
		bulletLevel: numberParam('stBulletLvl'),
		spaceAfterParent: numberParam('lnSpAfParP'),
		spaceAfterChild: numberParam('lnSpAfChP'),
		secondaryScale: sizingVariable(fitNode) === 'secFontSz' ? 1 : undefined,
	};
	if (entry.node.presOfAnchored) {
		return { own: textOf(ids[0]), descendants: ids.slice(1).map(textOf), ...layout };
	}
	return { descendants: ids.map(textOf), ...layout };
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
