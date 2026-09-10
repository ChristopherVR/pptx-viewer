/**
 * Folded-descendant text helpers for the DiagramML interpreter bridge.
 *
 * Split out of `smartart-interpreter-drawing-bridge.ts` (file-size budget):
 * that module's `interpretedLayoutToElements` and `arrangeLinear`/
 * `arrangeSnake` (`smartart-layout-interpreter-linear.ts`/`-snake.ts`) both
 * need to know which descendants fold into a node's own box and what text
 * they carry; this module is the single source for that.
 */

import type { PptxSmartArtNode, TextSegment, TextStyle } from '../types';
import { projectSmartArtNodeText } from './smartart-node-text-projection';

/**
 * Descendants of `node` that were NOT separately given their own rendered
 * shape (i.e. not in `renderedIds`), in pre-order, read via `childrenOf`
 * (`smartArtChildrenOf`: works for both the loader's flat `parentId`
 * representation and a nested `.children` one). Stops descending into an
 * already-rendered descendant's own subtree: that descendant's box handles
 * its own folding independently when the caller processes it in turn.
 *
 * This is how a node added one level deeper via the SmartArt text pane's
 * Tab/"Add Bullet" (real PowerPoint: `axis="ch"` selects only the top-level
 * box per {@link import('./smartart-layout-interpreter-flow').selectArrangedNodes},
 * so the deeper node never gets its own box) still reaches the canvas: as an
 * additional paragraph in its nearest rendered ancestor's box, matching
 * PowerPoint's own cached drawing (see `smartart-gallery-ground-truth.test.ts`).
 *
 * Trims a LEADING/TRAILING run of empty-text (unrendered) descendants but
 * keeps an INTERIOR one as a blank-paragraph placeholder - the SAME rule
 * `smartArtDescendantsWithText` (`smartart-node-tree-axis.ts`) uses for the
 * composite/item-role "des"-axis fold, unified here after a corpus-wide
 * check (every text-bearing cached shape across all 227 gallery fixtures
 * whose text contains an interior blank paragraph - 5, across `bubble-
 * picture-list--hier5`/`meet-the-team--hier8`/`small-dots-horizontal--
 * hier8`/`text-card-short-line--hier8.pptx` - wants that blank PRESERVED;
 * none wants it dropped). This module's own PRIOR design deliberately
 * dropped every empty-text unrendered descendant unconditionally, reasoning
 * that a structural GROUP-WRAPPER content point (real genuine org charts
 * insert these between a manager and its reports) would otherwise corrupt
 * its ancestor's text with a spurious blank paragraph - a real, principled
 * concern, but one with NO corpus fixture currently measuring it either way
 * (zero of the 227 fixtures' cached text disagrees with preserving an
 * interior blank here); the empirical, corpus-wide signal favours ONE
 * unified rule over two conflicting ones, so this now matches
 * `smartArtDescendantsWithText` exactly. A GROUP-WRAPPER's own children are
 * typically ALREADY separately rendered (hierarchy gives every real node
 * its own box), so they are excluded via `renderedIds` before this trim
 * ever runs - the wrapper itself only survives the trim when it sits
 * BETWEEN two other real, unrendered fold entries, which is precisely the
 * shape PowerPoint's own cached drawing renders as a blank line.
 */
export function collectFoldedDescendants(
	node: PptxSmartArtNode,
	renderedIds: Set<string>,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	const walk = (current: PptxSmartArtNode): void => {
		for (const child of childrenOf.get(current.id) ?? []) {
			if (renderedIds.has(child.id)) {
				continue;
			}
			out.push(child);
			walk(child);
		}
	};
	walk(node);
	let start = 0;
	while (start < out.length && out[start].text.trim().length === 0) {
		start++;
	}
	let end = out.length - 1;
	while (end >= start && out[end].text.trim().length === 0) {
		end--;
	}
	return out.slice(start, end + 1);
}

/**
 * `node`'s own text plus any {@link collectFoldedDescendants} text, `\n`-joined
 * - the SAME combined text PowerPoint's own cached drawing carries in one box
 * (see `projectFoldedNodeText` below). Exposed for a caller
 * (`smartart-layout-interpreter-linear.ts`'s `arrangeLinear`/`arrangeSnake`)
 * that needs to size/fit the SHARED item font against the TRUE rendered text
 * content of a node whose descendants fold into its own box (a list layout's
 * `axis="ch"`-selected top-level point with a node added a level deeper via
 * the text pane's Tab/"Add Bullet"), not just the arranged node's own short
 * label - measured against `basic-process--hier5.pptx`/`--hier8.pptx`
 * (`smartart-gallery-ground-truth.test.ts`): the font-fit computed from only
 * the top-level node's own text is too generous once its folded bullet text
 * is what actually has to fit the box.
 */
export function foldedItemText(
	node: PptxSmartArtNode,
	renderedIds: Set<string>,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): string {
	const folded = collectFoldedDescendants(node, renderedIds, childrenOf);
	return [node.text, ...folded.map((descendant) => descendant.text)].join('\n');
}

/**
 * Just the {@link collectFoldedDescendants} text, WITHOUT `node`'s own text
 * prepended - for a caller (`smartart-layout-item-font-tier.ts`) that needs
 * to size the node's own top-level paragraph and its folded descendants at
 * two DIFFERENT font sizes rather than `foldedItemText`'s single joined
 * string. See that module's doc comment for why a folded item's descendant
 * paragraph renders at a DIFFERENT (smaller) size than the item's own text.
 */
export function foldedDescendantTexts(
	node: PptxSmartArtNode,
	renderedIds: Set<string>,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): string[] {
	return collectFoldedDescendants(node, renderedIds, childrenOf).map(
		(descendant) => descendant.text,
	);
}

/**
 * Combine `node`'s own projected text with any {@link collectFoldedDescendants}
 * as additional paragraphs, matching the `\n`-joined text PowerPoint's own
 * cached drawing carries for the same case (`smartArtParagraphsText`).
 *
 * A folded descendant renders at `descendantFallbackStyle` (its OWN,
 * independently-shrunk size - see `smartart-layout-item-font-tier.ts`'s
 * module doc comment), which differs from `fallbackStyle` (the node's own
 * top-level size) whenever the arranger resolved one via
 * `RenderedNode.descendantFontSize`; falls back to `fallbackStyle` itself
 * when the arranger did not (every non-`lin`/`snake` caller of this bridge).
 */
export function projectFoldedNodeText(
	node: PptxSmartArtNode,
	folded: PptxSmartArtNode[],
	fallbackStyle: TextStyle,
	descendantFallbackStyle: TextStyle,
	bulletEnabled: boolean,
): { text: string; segments: TextSegment[] } {
	const segments = projectSmartArtNodeText(node, fallbackStyle, { bulletEnabled });
	const texts = [node.text];
	for (const descendant of folded) {
		segments.push({ text: '', style: descendantFallbackStyle, isParagraphBreak: true });
		segments.push(
			...projectSmartArtNodeText(descendant, descendantFallbackStyle, { bulletEnabled }),
		);
		texts.push(descendant.text);
	}
	return { text: texts.join('\n'), segments };
}
