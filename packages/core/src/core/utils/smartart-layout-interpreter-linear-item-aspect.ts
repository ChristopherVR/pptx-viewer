/**
 * SmartArt DiagramML interpreter - `lin` arranger item aspect resolution.
 *
 * Split out of `smartart-layout-interpreter-linear.ts` (the repo's per-file
 * line budget): `itemAspect`, the item's own height/width ratio as declared
 * by the OUTER arranger (as opposed to the item's own self-scoped `h`/`w`,
 * a separate fallback `arrangeLinear` applies itself).
 */

import type { PptxSmartArtNode, PptxSmartArtPresLayoutVars } from '../types';
import { resolveConstraintDeclaredBy } from './smartart-constraint-declared-by';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { roleOf } from './smartart-constraint-solver';
import { isColumnWrapper } from './smartart-layout-interpreter-item-role-orientation';
import type { ArrangementPlan, FlowDirection } from './smartart-layout-interpreter-model';
import { itemNode } from './smartart-layout-interpreter-model';

/**
 * Item aspect (height / width), resolved ONLY from the ARRANGER's own
 * `constrLst` (`for="ch" forName="<item role>"` / `ptType="<item ptType>"`),
 * via {@link resolveConstraintDeclaredBy} - the item's OWN self-scoped
 * `h`/`w` is a SEPARATE fallback the caller applies itself (`naturalAspect`
 * in `arrangeLinear`), not considered here.
 *
 * Round 25: a same-axis "inherit the arranger's own dimension" declaration
 * (`<dgm:constr type="h" for="ch" forName="linNode" refType="h"/>`, no
 * cross-axis reference or literal factor of its own - "Vertical Bracket
 * List"'s `linNode`) resolves to a spurious 1:1 "aspect" via this same
 * code path (both axes bottom out at the root's own implicit `w=h=1`) and
 * squashes a genuinely WIDE item template into a narrow square. A dedicated
 * fix EXCLUDING that pattern (unconditionally, for EVERY item) was
 * implemented, measured against the full 227-fixture corpus, and found to
 * REGRESS WIDELY (dozens of OTHER fixtures' FONT/GEOM values moved
 * measurably further from cached - e.g. `alternating-flow--hier5.pptx`
 * 44.0px->74.7px against a 37.3px cached target, `bullet-timeline--
 * hier5.pptx`'s `maxGeomDelta` 34%->88% - the SAME degenerate 1:1
 * resolution this fix targeted is, empirically, load-bearing for many
 * OTHER fixtures' correct box shape, not merely "coincidentally correct"
 * for them). REVERTED - see the round-25 successor doc's own section for
 * the measured regression numbers and the `smartart-layout-interpreter-
 * linear-item-aspect.ts` file that attempt added (deleted along with the
 * revert - this file is a DIFFERENT, round-27 extraction, not a resurrection
 * of that one). Round 25's own doc comment asked for a NARROWER trigger,
 * "possibly conditioned on the item template's own nested arranger being a
 * DIFFERENT-orientation `lin`" - round 27 built exactly that signal for the
 * SIBLING column-role-split mechanism (`smartart-layout-interpreter-item-
 * role-orientation.ts`'s `isColumnWrapper`: an EXPLICIT `linDir="fromL"|
 * "fromR"` wrapper, 2+ text roles, every one a genuinely plain rect - see
 * that function's own doc comment for why the plain-rect guard is load-
 * bearing here too, not just for the role-split geometry: "Vertical Block
 * List" shares "Vertical Bracket List"'s exact wrapper shape but its
 * descendant role is a rotated decorative connector, not a real column, and
 * WOULD have wrongly widened this item's own box under a check that only
 * looked at `linDir`) and reuses it here: the exemption now applies ONLY
 * when `item` itself is a genuine column wrapper (measured corpus-wide:
 * `vertical-bracket-list` is the ONLY fixture in the gallery whose item
 * template is BOTH a same-axis-inherit candidate AND a genuine column
 * wrapper - the intersection that regressed 25 fixtures under round 25's
 * unconditional exclusion is empty here).
 */
export function itemAspect(
	plan: ArrangementPlan,
	index: ConstraintIndex,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): number | undefined {
	const item = itemNode(plan.node);
	if (!item) {
		return undefined;
	}
	if (isColumnWrapper(item, nodeCount, presLayoutVars)) {
		return undefined;
	}
	const role = roleOf(item);
	const arrangerRole = roleOf(plan.node);
	const height = resolveConstraintDeclaredBy(index, role, 'h', arrangerRole);
	const width = resolveConstraintDeclaredBy(index, role, 'w', arrangerRole);
	if (typeof height === 'number' && typeof width === 'number' && height > 0 && width > 0) {
		return height / width;
	}
	return undefined;
}

/** Order the data nodes for the resolved flow direction. */
export function ordered(nodes: PptxSmartArtNode[], flow: FlowDirection): PptxSmartArtNode[] {
	return flow.reverse ? [...nodes].reverse() : nodes;
}
