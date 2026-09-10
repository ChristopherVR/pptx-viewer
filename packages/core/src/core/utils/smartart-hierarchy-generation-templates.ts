/**
 * SmartArt DiagramML interpreter - per-GENERATION hierarchy item TEMPLATE
 * resolution (a distinctly-sized root vs every deeper generation).
 *
 * `resolveHierarchyItemNode` (`smartart-hierarchy-item-template.ts`, SESSION
 * 29) already picks ONE template - the "majority" one every generation but a
 * one-off root uses - for `fitItemBox`'s single uniform box. Two corpus
 * fixtures declare a genuinely DIFFERENT box size for the root itself
 * (`hierarchy-list--hier5.pptx`'s `rootText`/`rootComposite` vs `childText`;
 * `horizontal-multi-level-hierarchy--hier5.pptx`'s `LevelOneTextNode` vs
 * `LevelTwoTextNode`, the SAME pair `resolveHierarchyItemNode` already
 * distinguishes as "first-found" vs "majority"). This module extends that
 * single pick into a small root/descendant TABLE, with the root's own real
 * size as a multiple of the descendant's, so a caller that CAN afford a
 * differently-sized root box (`smartart-hierarchy-hanging-box.ts`) has the
 * real declared numbers instead of forcing every row to the same size.
 *
 * ## Choose-wrapped `tx` candidates
 *
 * A candidate's own `dgm:alg type="tx"` is sometimes declared entirely
 * inside a `dgm:choose` (mirroring `dir="norm"/"rev"` text alignment, e.g.
 * `square-accent-list`'s own `Parent`/`Child` nodes) rather than as a direct
 * child - `node.algorithm` stays `undefined` for those, so a plain
 * `node.algorithm?.type === 'tx'` read (as `collectTxShapeNodes` in
 * `smartart-hierarchy-item-template.ts` still does) silently finds ZERO
 * candidates for them, and this module's own root/descendant split never
 * fires. `collectScoped` resolves a choose-wrapped candidate's type via
 * `chooseAlgorithmOfType` (a `tx`-only search, deliberately separate from
 * `chooseAlgType`/`chooseAlgorithm`'s own structural whitelist - see that
 * function's own doc comment for why arrangement DISPATCH must not be
 * widened the same way) before falling back to `undefined`.
 *
 * ## Structural signal
 *
 * A candidate template is "root scope" when it is reached from
 * `algorithmNode` WITHOUT crossing a NESTED `hierChild`-typed layoutNode
 * (the recursive "every deeper generation" construct); "descendant scope"
 * once such a boundary is crossed. `algorithmNode` itself (typically also
 * `hierChild`-typed - the arranger's own top-level algorithm) does not count
 * as a crossing; only a `hierChild` found STRICTLY BELOW it does -
 * `horizontal-multi-level-hierarchy--hier5.pptx`'s own `level2hierChild`
 * node is exactly this boundary; `hierarchy-list--hier5.pptx`'s own
 * `childShape` node is the same shape (a DIRECT, non-`dgm:choose`-wrapped
 * `dgm:alg type="hierChild"`, so `.algorithm.type` is readable without
 * choose resolution).
 *
 * A genuine root/descendant split needs EXACTLY one candidate in each scope.
 * `name-and-title-organization-chart--hier5.pptx`'s own second candidate
 * (`titleText1`, a title role sharing `rootText1`'s OWN composite, cross-
 * referencing it only via `primFontSz` - see `resolveHierarchyItemNode`'s
 * own doc comment) sits in the SAME root scope as `rootText1` (neither
 * candidate ever crosses a nested `hierChild`), so this module correctly
 * finds no descendant-scope candidate there and returns no `root` entry -
 * unlike a plain "first vs not-first" heuristic, which would misclassify
 * `titleText1` as a distinct root template.
 *
 * ## Sizing
 *
 * `root.widthFactor`/`heightFactor`: the root candidate's own resolved
 * `w`/`h`, as a multiple of the descendant candidate's, both resolved via
 * `ConstraintIndex.resolveConstraint` (the SAME reference-chain walk every
 * other declared-ratio read in this arranger uses) in the layout's own
 * diagram-relative unit space - COM-verified against `hierarchy-list--
 * hier5.pptx`'s own cached drawing: `rootText`/`rootComposite` resolve to
 * `w=1, h=0.5` and `childText` to `w=0.8, h=0.5` in that unit space (the
 * `diagram` node's own `w`/`h` default to `1`, the implicit whole-diagram
 * unit - see `smartart-constraint-solver.ts`'s own module doc comment), so
 * `widthFactor = 1/0.8 = 1.25`, `heightFactor = 0.5/0.5 = 1`. Multiplying a
 * separately-fit descendant pixel size (`childText` cached `179x112`) by
 * those factors gives `223.75x112` against the cached root box `224x112` -
 * within a pixel of rounding, from nothing but the layout's own declared
 * constraints.
 *
 * `undefined` (no `root` entry) whenever either resolved size is missing,
 * non-positive, or the two are within 1% of each other on both axes (not a
 * genuine size distinction - keeps callers on the existing single-box path
 * for every ordinary layout unchanged).
 *
 * Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtPresLayoutVars } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveConstraint } from './smartart-constraint-solver';
import { resolveHierarchyItemNode } from './smartart-hierarchy-item-template';
import { chooseAlgorithmOfType } from './smartart-layout-interpreter-choose-algorithm';

/** Types `collectScoped` treats as a `tx`+shape item candidate - see the module doc comment's "choose-wrapped tx" note. */
const TX_ALG_TYPES = new Set(['tx']);

export interface HierarchyGenerationTemplate {
	node: PptxSmartArtLayoutNode;
	name: string;
}

export interface HierarchyRootTemplate extends HierarchyGenerationTemplate {
	/** Root's own `w`/`h`, each as a multiple of `descendant`'s (same unit space). */
	widthFactor: number;
	heightFactor: number;
}

export interface HierarchyGenerationTemplates {
	/** The template every generation but a distinctly-sized root uses (SESSION 29's existing majority pick, or the sole candidate). */
	descendant: HierarchyGenerationTemplate;
	/** The root's own distinct template, only when genuinely different-sized - see the module doc comment. */
	root?: HierarchyRootTemplate;
}

/**
 * Depth-first collection of every `tx`-alg descendant with its own
 * `dgm:shape`, tagged with whether it was reached by crossing a nested
 * `hierChild`-typed layoutNode - see the module doc comment. Mirrors
 * `collectTxShapeNodes` in `smartart-hierarchy-item-template.ts`, plus the
 * scope tag that module has no reason to track.
 */
function collectScoped(
	node: PptxSmartArtLayoutNode | undefined,
	crossedHierChild: boolean,
	out: { node: PptxSmartArtLayoutNode; descendantScope: boolean }[],
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): void {
	if (!node) {
		return;
	}
	// `node.algorithm` stays `undefined` for a `tx` alg declared entirely
	// inside a `dgm:choose` (mirroring `dir="norm"/"rev"` text alignment, e.g.
	// `square-accent-list`'s own `Parent`/`Child` nodes) - see the module doc
	// comment's "choose-wrapped tx" note. `chooseAlgorithmOfType` resolves it
	// without touching `chooseAlgType`/`chooseAlgorithm`'s own structural
	// whitelist (that one gates arrangement DISPATCH elsewhere, unrelated to
	// this item-template scan).
	const effectiveType =
		node.algorithm?.type ??
		(node.choose
			? chooseAlgorithmOfType(node, nodeCount, TX_ALG_TYPES, { presLayoutVars })?.type
			: undefined);
	if (effectiveType === 'tx' && node.shape) {
		out.push({ node, descendantScope: crossedHierChild });
	}
	const nextCrossed = crossedHierChild || node.algorithm?.type === 'hierChild';
	for (const child of node.children ?? []) {
		collectScoped(child, nextCrossed, out, nodeCount, presLayoutVars);
	}
}

function resolvedSize(index: ConstraintIndex, name: string): { w: number; h: number } | undefined {
	const w = resolveConstraint(index, name, 'w');
	const h = resolveConstraint(index, name, 'h');
	if (w === undefined || h === undefined || !(w > 0) || !(h > 0)) {
		return undefined;
	}
	return { w, h };
}

/**
 * Resolve the root-vs-descendant item template table for `algorithmNode` -
 * see the module doc comment for the structural signal and sizing model.
 * `undefined` only when `algorithmNode` declares no `tx`+shape descendant at
 * all (mirrors `resolveHierarchyItemNode`'s own `undefined` contract).
 */
export function resolveHierarchyGenerationTemplates(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): HierarchyGenerationTemplates | undefined {
	if (!algorithmNode) {
		return undefined;
	}
	const fallbackNode = resolveHierarchyItemNode(algorithmNode);
	const scoped: { node: PptxSmartArtLayoutNode; descendantScope: boolean }[] = [];
	for (const child of algorithmNode.children ?? []) {
		collectScoped(child, false, scoped, nodeCount, presLayoutVars);
	}
	const rootScoped = scoped.filter((c) => !c.descendantScope);
	const descendantScoped = scoped.filter((c) => c.descendantScope);
	// A genuine root/descendant split needs EXACTLY one candidate reachable
	// without crossing a nested `hierChild` and exactly one reachable only by
	// crossing one - see the module doc comment for why this structural test,
	// not SESSION 29's cross-reference heuristic, decides the split: a
	// layoutDef whose descendant template's own size is declared entirely via
	// references to the ROOT template's name (`hierarchy-list--hier5.pptx`'s
	// `childText` -> `rootComposite`, never another `tx`-candidate's name)
	// never trips `resolveHierarchyItemNode`'s own cross-reference gate, so
	// its "majority" pick would otherwise stay the one-off root (`rootText`),
	// wrongly assigning the SAME box to every generation.
	const rootMatch = rootScoped.length === 1 ? rootScoped[0] : undefined;
	const descendantMatch = descendantScoped.length === 1 ? descendantScoped[0] : undefined;
	if (!rootMatch?.node.name || !descendantMatch?.node.name) {
		return fallbackNode?.name
			? { descendant: { node: fallbackNode, name: fallbackNode.name } }
			: undefined;
	}
	const descendant: HierarchyGenerationTemplate = {
		node: descendantMatch.node,
		name: descendantMatch.node.name,
	};
	const rootSize = resolvedSize(index, rootMatch.node.name);
	const descSize = resolvedSize(index, descendant.name);
	if (!rootSize || !descSize) {
		return { descendant };
	}
	const widthFactor = rootSize.w / descSize.w;
	const heightFactor = rootSize.h / descSize.h;
	if (Math.abs(widthFactor - 1) < 0.01 && Math.abs(heightFactor - 1) < 0.01) {
		return { descendant };
	}
	return {
		descendant,
		root: { node: rootMatch.node, name: rootMatch.node.name, widthFactor, heightFactor },
	};
}
