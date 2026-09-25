/**
 * The text a presentation node shows, as paragraphs the text measurement
 * understands (`text-measure.ts`'s {@link NodeText}). Shared by the output
 * stage's font fit (`engine-fonts.ts`) and the layout's text-driven sizing
 * (`text-grow.ts`), so both measure exactly the same paragraphs.
 */

import type { PptxSmartArtNode } from '../../types';
import type { EngineNode } from './engine-node';
import { sizingVariable } from './layout-font';
import type { NodeText } from './text-measure';

/**
 * `secFontSz` as a multiple of the node's sizing size: 1 when the node is
 * sized by `secFontSz` itself, the `fact` of its own `<dgm:constr
 * type="secFontSz" refType="primFontSz"/>` ("Vertical Box List"'s
 * `childText` draws its bullets at the full 30pt), else the 0.78 default.
 */
function secondaryScaleOf(node: EngineNode): number | undefined {
	if (sizingVariable(node) === 'secFontSz') {
		return 1;
	}
	const own = node.deferred.find(
		(d) => d.type === 'secFontSz' && d.refType === 'primFontSz' && d.ref === node,
	);
	return own && own.op !== 'lte' && own.op !== 'gte' ? own.fact : undefined;
}

/**
 * A node whose own context point is among the points it presents shows that
 * point's text as its top-level paragraph and every other presented point as
 * a folded descendant; a node presenting only other points (a
 * descendant-only "child text" box) shows them all as equal-level bullet
 * paragraphs. `literal` is a transition point's label, used when no content
 * point is presented; `fitNode` is the node whose `tx` parameters and
 * sizing variable apply (a folded `moveWith` carrier, else `node`).
 */
export function nodeTextFor(
	node: EngineNode,
	ids: readonly string[],
	literal: string | undefined,
	nodeById: Map<string, PptxSmartArtNode>,
	fitNode: EngineNode = node,
): NodeText | undefined {
	const textOf = (id: string): string => nodeById.get(id)?.text ?? '';
	if (ids.length === 0) {
		return literal && literal.trim().length > 0 ? { own: literal, descendants: [] } : undefined;
	}
	const params = node.alg.params;
	const numberParam = (name: string): number | undefined => {
		const value = Number(params[name]);
		return params[name] !== undefined && Number.isFinite(value) ? value : undefined;
	};
	const layout = {
		bulletLevel: numberParam('stBulletLvl'),
		spaceAfterParent: numberParam('lnSpAfParP'),
		spaceAfterChild: numberParam('lnSpAfChP'),
		secondaryScale: secondaryScaleOf(fitNode),
	};
	if (node.presOfAnchored) {
		return { own: textOf(ids[0]), descendants: ids.slice(1).map(textOf), ...layout };
	}
	return { descendants: ids.map(textOf), ...layout };
}
