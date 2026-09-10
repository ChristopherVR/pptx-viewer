/**
 * SmartArt DiagramML interpreter - per-item text-anchor resolution
 * (`dgm:alg type="tx"`'s `txAnchorVert`/`txAnchorVertCh` parameters).
 *
 * **Round 18: NOT currently wired to anything** (`arrangeLinear`/
 * `arrangeSnake` reverted their round-17 use of this module) - see
 * `smartart-layout-item-font-tier.ts`'s module doc comment: the
 * font-size fit problem this was built to solve turned out to have a
 * different cause (a wrong `lineHeightRatio`, not a per-anchor line-height
 * difference - direct COM proof: `VerticalAnchor` does not change
 * `BoundHeight/Lines/fontSize` at all). The resolver itself is unaffected
 * by that finding and remains correct/tested - kept as validated,
 * corpus-verified infrastructure for a genuine `dgm:alg type="tx"` need
 * (e.g. actually positioning text vertically within a shape to match
 * PowerPoint's real anchor, a real, separate, NOT-yet-addressed gap this
 * track has not investigated) rather than deleted.
 *
 * Round 17: `smartart-gallery-ground-truth.test.ts`'s cached `drawing1.xml`
 * shows a folded item's overall `a:bodyPr/@anchor` is NOT a fixed constant
 * (round 15/16 assumed folded=top, non-folded=center) - a full corpus scan
 * (`FOLDED` items get `ctr` 50x/`t` 124x/`b` 20x; `SINGLE` items get `ctr`
 * 550x/`t` 126x/`b` 69x, pooled across the whole gallery) disproves that.
 * ECMA-376 21.4.7.11 names the real mechanism: the `tx` algorithm's
 * `txAnchorVert` parameter governs a node's OWN paragraph anchor (default
 * `mid`), while `txAnchorVertCh` governs the anchor used when a folded
 * CHILD paragraph is pulled into the same box (default `t`) - so a folded
 * item's overall anchor is `txAnchorVertCh`, a non-folded item's is
 * `txAnchorVert`, and BOTH commonly go undeclared (falling to their
 * different defaults), which is exactly what produces `basic-process--
 * hier5.pptx`'s mixed `t` (folded)/`ctr` (non-folded) split on ONE preset
 * family, and `vertical-process--hier5.pptx`'s explicit
 * `<dgm:param type="txAnchorVertCh" val="mid"/>` override producing a
 * uniform `ctr` for both.
 *
 * `dgm:alg type="tx"` is very often wrapped in a `dgm:choose` (the SAME
 * idiom the arrangement algorithms use - `smartart-layout-interpreter-
 * choose-algorithm.ts`), so a real resolution needs the same
 * `activeBranch`/`nestedChooseBranch` machinery THAT module already uses
 * for `lin`/`cycle`/`pyra`/`snake`/`hierChild`/`hierRoot` - but `tx` is
 * deliberately NOT added to that module's own `CHOOSE_ALG_TYPES` (used for
 * ARRANGER discovery, a different, blind recursive search that must not
 * accidentally match an unrelated per-item `tx` alg nested somewhere inside
 * the tree it walks). This module is a separate, narrowly-scoped resolver:
 * given the item template layoutNode directly (`itemNode(plan.node)`,
 * already resolved by the caller), find ITS OWN `tx` alg - direct child or
 * inside ITS OWN `choose` - never searching past it into unrelated nodes.
 *
 * `vertical-process--hier5.pptx`'s override condition
 * (`func="maxDepth" axis="root des" ptType="all node" op="gt" val="1"`)
 * queries the DATA model's own tree depth, not the layout definition's -
 * unrelated to `smartart-layout-interpreter-model.ts`'s `treeMaxDepth`
 * (which walks the LAYOUT node tree for arranger `choose` resolution, a
 * different tree entirely). `evaluateWhen`'s `maxDepth` case does not
 * itself inspect `axis`/`ptType` (see its own doc comment), so supplying
 * `diagramHasFold ? 2 : 1` as `WhenContext.maxDepth` is sufficient: a
 * user-authored deck's DATA tree only ever gets deeper than 1 through the
 * text pane's Tab/"Add Bullet" (the SAME folding `collectFoldedDescendants`
 * already detects), so "does maxDepth exceed 1" and "does ANY item fold a
 * descendant anywhere in the diagram" are the same question for this
 * corpus - verified directly (`scan-txanchor.ts`, not merely assumed).
 *
 * Corpus coverage (round 17, `scan-txanchor.ts` against all 134 `lin`/
 * `snake` fixtures): resolves for the common single-role `lin`/`snake`
 * families (`basic-process`, `vertical-process`, `basic-block-list`, and
 * others sharing that shape) with ZERO mismatches against the cached
 * anchor. Returns `undefined` (the caller then falls back to the existing,
 * unconditional line-spacing behaviour) for the ~107/134 fixtures whose
 * item template is a COMPOSITE (an image+caption composite, or a
 * multi-role list layout with a separate `parentText`/`childText`
 * sub-role) - `itemNode()` returns the composite/role wrapper, not the
 * sub-node that actually carries the `tx` alg, a materially different,
 * NOT-yet-solved problem (see the round 17 successor doc section).
 */

import type { PptxSmartArtChoose, PptxSmartArtLayoutNode, XmlObject } from '../types';
import {
	activeBranch,
	localName,
	nestedChooseBranch,
} from './smartart-layout-interpreter-choose-branch';
import type { WhenContext } from './smartart-layout-interpreter-when';

/** ECMA-376 `ST_VerticalAlignment`. */
export type TxAnchorVert = 't' | 'mid' | 'b';

/** `txAnchorVert`'s spec default: a node's own paragraph is vertically centered when undeclared. */
const DEFAULT_ANCHOR_VERT: TxAnchorVert = 'mid';
/** `txAnchorVertCh`'s spec default: a folded child paragraph anchors to the top of the shared box when undeclared. */
const DEFAULT_ANCHOR_VERT_CH: TxAnchorVert = 't';

/** The two `tx`-alg parameters this module resolves. */
export interface ItemTxAnchor {
	/** This item's OWN paragraph anchor, when it does NOT fold a descendant. */
	anchorVert: TxAnchorVert;
	/** This item's overall anchor when it DOES fold a descendant paragraph into the same box. */
	anchorVertCh: TxAnchorVert;
}

function isVert(value: string | undefined): value is TxAnchorVert {
	return value === 't' || value === 'mid' || value === 'b';
}

/** First `dgm:alg type="tx"` found in `raw`, WITHOUT descending into a nested `dgm:choose` (that is handled separately by the caller). */
function directTxAlg(raw: XmlObject | undefined): XmlObject | undefined {
	if (!raw) {
		return undefined;
	}
	for (const [key, entry] of Object.entries(raw)) {
		if (key.startsWith('@_') || localName(key) !== 'alg') {
			continue;
		}
		for (const candidate of Array.isArray(entry) ? entry : [entry]) {
			if (
				candidate &&
				typeof candidate === 'object' &&
				(candidate as XmlObject)['@_type'] === 'tx'
			) {
				return candidate as XmlObject;
			}
		}
	}
	return undefined;
}

/** `dgm:param` children of a `dgm:alg` element, keyed by `@type`. */
function txParams(algXml: XmlObject): Map<string, string> {
	const map = new Map<string, string>();
	const paramKey = Object.keys(algXml).find((key) => localName(key) === 'param');
	const raw = paramKey ? algXml[paramKey] : undefined;
	const list: unknown[] = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : [];
	for (const entry of list) {
		if (!entry || typeof entry !== 'object') {
			continue;
		}
		const type = String((entry as XmlObject)['@_type'] ?? '');
		const value = (entry as XmlObject)['@_val'];
		if (type) {
			map.set(type, String(value ?? ''));
		}
	}
	return map;
}

/** Resolve `item`'s effective `tx`-alg params: its own direct algorithm, or the winning `choose` branch's (one level of nesting). */
function resolveTxParams(
	item: PptxSmartArtLayoutNode,
	nodeCount: number,
	context: WhenContext,
): Map<string, string> | undefined {
	if (item.algorithm?.type === 'tx') {
		const map = new Map<string, string>();
		for (const parameter of item.algorithm.parameters ?? []) {
			if (parameter.value !== undefined) {
				map.set(parameter.type, parameter.value);
			}
		}
		return map;
	}
	for (const choose of item.choose ?? []) {
		const branch = activeBranch(choose as PptxSmartArtChoose, nodeCount, context);
		if (!branch) {
			continue;
		}
		const direct = directTxAlg(branch);
		if (direct) {
			return txParams(direct);
		}
		for (const [key, entry] of Object.entries(branch)) {
			if (localName(key) !== 'choose') {
				continue;
			}
			for (const candidate of Array.isArray(entry) ? entry : [entry]) {
				const nested = nestedChooseBranch(candidate as XmlObject, nodeCount, context);
				const nestedAlg = nested ? directTxAlg(nested) : undefined;
				if (nestedAlg) {
					return txParams(nestedAlg);
				}
			}
		}
	}
	return undefined;
}

/**
 * Resolve `itemTemplate`'s effective `txAnchorVert`/`txAnchorVertCh`, or
 * `undefined` when its `tx` algorithm cannot be found at all (a composite
 * or multi-role item template - see the module doc comment) or its
 * `choose` is not decidable with the given `context`.
 *
 * @param diagramHasFold - Whether ANY item in the whole diagram folds a
 *   descendant paragraph into its own box (the DATA tree's own maxDepth
 *   exceeding 1 - see the module doc comment for why this is the correct
 *   value to feed `WhenContext.maxDepth` for a `tx` alg's `choose`).
 */
export function resolveItemTxAnchor(
	itemTemplate: PptxSmartArtLayoutNode | undefined,
	nodeCount: number,
	diagramHasFold: boolean,
): ItemTxAnchor | undefined {
	if (!itemTemplate) {
		return undefined;
	}
	const context: WhenContext = { maxDepth: diagramHasFold ? 2 : 1 };
	const params = resolveTxParams(itemTemplate, nodeCount, context);
	if (!params) {
		return undefined;
	}
	const vert = params.get('txAnchorVert');
	const vertCh = params.get('txAnchorVertCh');
	return {
		anchorVert: isVert(vert) ? vert : DEFAULT_ANCHOR_VERT,
		anchorVertCh: isVert(vertCh) ? vertCh : DEFAULT_ANCHOR_VERT_CH,
	};
}

/**
 * Whether ONE item is top-anchored, given the diagram's resolved
 * {@link ItemTxAnchor} (`undefined` when unresolved - the common case for
 * composite/multi-role item templates) and whether THIS item folds a
 * descendant paragraph into its own box (selects `anchorVertCh` over
 * `anchorVert` - see the module doc comment).
 */
export function isItemTopAnchored(
	anchor: ItemTxAnchor | undefined,
	hasDescendants: boolean,
): boolean {
	if (!anchor) {
		return false;
	}
	return (hasDescendants ? anchor.anchorVertCh : anchor.anchorVert) === 't';
}
