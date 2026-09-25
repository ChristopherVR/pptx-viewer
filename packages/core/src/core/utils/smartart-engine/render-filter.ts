/**
 * Which engine nodes become drawn shapes, and the literal text a transition
 * point carries. Split out of `engine-to-result.ts` for the file-size
 * budget.
 */

import type { PptxSmartArtNode } from '../../types';
import type { EngineNode } from './engine-node';

/**
 * A presented `parTrans`/`sibTrans` transition point's own connector text
 * (`DataPoint.label`, e.g. a numbered-list badge's ordinal "1"/"2"/"3", or an
 * org-chart relationship line's label) - there is no `PptxSmartArtNode` to
 * read `.text` from for a transition point (`point.source` is only ever set
 * for a `node`/`asst` content point), so this is the transition-point
 * equivalent `sourceIdsOf`'s content-point lookup can't cover. Only consulted
 * when `sourceIdsOf` found nothing, matching the drawing bridge's own
 * `literalText ?? projection?.text` precedence
 * (`smartart-interpreter-drawing-bridge.ts`).
 */
export function transitionLabelOf(node: EngineNode): string | undefined {
	for (const point of node.presOf) {
		if (!point.source && point.label) {
			return point.label;
		}
	}
	return undefined;
}

/**
 * `hideGeom` (ECMA-376 Part 1, 21.4.7.16 `ST_OnOffStyleType`) means the node
 * draws NO visible border/fill, not that it is not a node: PowerPoint still
 * places its own text-bearing shape there (invisible outline, real text),
 * commonly a "descendant" role box folded under a sibling's card (see
 * `Vertical Action List`/`Descending Block List`/`Numbered Title List`: an
 * item's own child node text renders as a second, borderless line inside the
 * same visual card). Dropping every `hideGeom` node outright previously lost
 * those boxes entirely (2-3 of 5-6 text-bearing shapes per fixture) even
 * though the engine placed correct geometry for them; a `hideGeom` node with
 * NO presented text (a genuinely decorative/structural placeholder, e.g. a
 * sibling row with no descendant) is still skipped, since it carries nothing
 * to compare or display.
 *
 * A ZERO-AREA node is also skipped regardless of `hideGeom`/text: a
 * `hierChild` continuation for a childless leaf (the layout driver gives an
 * unplaced child a `{w:0, h:0}` box) presents no text either way, so it was never
 * going to draw anything visible - but it still reached `isFiniteGeometry`
 * below as a "real" shape with degenerate geometry, declining the WHOLE
 * diagram over a box nothing would have shown (the same failure mode
 * `collectRenderedNodes`'s own `conn`-alg skip fixes for connectors).
 */
export function isRenderable(
	node: EngineNode,
	presented: readonly (PptxSmartArtNode | undefined)[],
	literalText: string | undefined,
): boolean {
	// A `dgm:shape` with no `type` draws no geometry (ECMA-376 21.4.3.8's
	// default `none`): "Organization Chart"'s `rootComposite`/`hierRoot`
	// carriers declare one only to host `presOf`, and drawing them added a
	// phantom rounded rectangle over every node.
	if (!node.shape?.type || node.shape.type === 'none' || !node.box) {
		return false;
	}
	if (node.box.w <= 0 || node.box.h <= 0) {
		return false;
	}
	if (!node.shape.hideGeom) {
		return true;
	}
	if (literalText && literalText.trim().length > 0) {
		return true;
	}
	return presented.some((n) => (n?.text ?? '').trim().length > 0);
}
