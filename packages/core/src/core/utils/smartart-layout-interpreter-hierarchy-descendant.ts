/**
 * SmartArt DiagramML interpreter - hierarchy-descendant precedence guard for
 * `discoverArrangement` (`smartart-layout-interpreter-model.ts`, Track S's
 * own file - this is a Track R cross-track addition, disclosed in the
 * SESSION 24 report, since it is squarely about `hierChild`/`hierRoot`
 * precedence).
 *
 * SESSION 24 finding (`horizontal-labeled-hierarchy--hier5.pptx`, the
 * "hierarchy5" layoutDef - and structurally the SAME shape as `labeled-
 * hierarchy--hier5.pptx`'s own "hierarchy6", which dispatches correctly):
 * `mainComposite` wraps TWO SIBLING flows, `hierFlow` (`dgm:alg type="lin"`,
 * itself CHOOSE-WRAPPED - picking whether a leading `firstBuf` spacer is
 * included) and `bgShapesFlow` (the background-band flow). `hierFlow`'s own
 * choose CORRECTLY resolves to `lin` (this is not a mis-tunnelled match -
 * `hierFlow` genuinely IS a `lin`-type layoutNode) - but `hierFlow` is only
 * a THIN packing wrapper around its own child `hierChild1`, the REAL
 * arrangement algorithm for the whole diagram. `discoverArrangement`'s walk
 * visits `hierFlow` BEFORE `hierChild1` (a shallower ancestor, visited
 * first in the pre-order walk) and sets `chosen = {kind:'linear',
 * node:hierFlow}` immediately - which, via the `!hierarchy && !chosen` top
 * guard, PERMANENTLY BLOCKS `hierChild1`'s own (later, but genuinely
 * decidable) choose resolution from ever running, even though `hierarchy`
 * carries the HIGHEST final precedence when it IS found.
 *
 * This is a DIFFERENT root cause from `nested-target`'s own (a `.choose`
 * search tunnelling INTO the wrong content) - `tunnelsPastOwnCompositeSlot`
 * does not fire here at all (`hierFlow.algorithm?.type` is `undefined` at
 * the point that check runs, not `'composite'`, so `looksLikeOwnComposite`
 * is false). It is also a NARROWER condition than either of Track S's own
 * two prior (reverted, 16-fixture-regressing) attempts at a related
 * precedence fix: those gated the CHOOSE-BRANCH ITSELF broadly (skip a
 * `.choose` for any node that also independently looks like a composite, or
 * is a descendant of one) - this instead gates ONLY the `chosen` STRUCTURAL
 * assignment, and ONLY when the candidate's own subtree contains a REAL
 * `hierChild`/`hierRoot` construct (a condition true for exactly this
 * "sibling flows, one hiding a hierarchy tree" shape, not for the ordinary
 * timeline/picture-list/radial fixtures the 16-fixture regression list
 * named) - see `smartart-track-r-successor.md` SESSION 24 for the full
 * corpus classification this was measured against before landing.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { chooseAlgType } from './smartart-layout-interpreter-flow';
import type { WhenContext } from './smartart-layout-interpreter-when';

const HIERARCHY_ALG_TYPES = new Set(['hierRoot', 'hierChild']);

/**
 * True when `node` has a DESCENDANT whose own algorithm resolves to
 * `hierChild`/`hierRoot` - checked BOTH directly (`child.algorithm?.type`,
 * a bare non-choose-wrapped `dgm:alg`) AND via `chooseAlgType` (a
 * choose-wrapped one, e.g. `hierChild1`'s own `linDir` `fromL`/`fromR`
 * direction pick - the exact shape a genuine org-chart-family `hierChild`
 * always takes, per `smartart-layout-interpreter-choose-algorithm.ts`'s own
 * `CHOOSE_ALG_TYPES` inclusion of these two types). Unlike `hasStructural
 * Descendant` (`smartart-layout-interpreter-composite-detect.ts`), which
 * deliberately only checks DIRECT algorithms, this one MUST also resolve
 * choose-wrapped ones - a `hierChild`/`hierRoot` algorithm is choose-wrapped
 * in every genuine fixture measured so far (the `linDir`/`hierBranch`
 * direction pick is universal), so a direct-only check would never fire for
 * the exact construct this guard exists to protect.
 */
export function hasHierarchyDescendant(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	context: WhenContext,
): boolean {
	return (node.children ?? []).some((child) => {
		const type = child.algorithm?.type ?? chooseAlgType(child, nodeCount, context);
		if (type && HIERARCHY_ALG_TYPES.has(type)) {
			return true;
		}
		return hasHierarchyDescendant(child, nodeCount, context);
	});
}
