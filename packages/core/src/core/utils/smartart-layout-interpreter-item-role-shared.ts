/**
 * SmartArt DiagramML interpreter - shared per-item-role primitives.
 *
 * Split out of `smartart-layout-interpreter-item-roles.ts` (the file-size
 * budget) once `smartart-layout-interpreter-item-roles-recursive.ts` needed
 * the SAME `dgm:presOf` axis resolution: both a flat (single-level) item
 * template and a genuinely recursive one (a nested `layoutNode` with its own
 * `dgm:forEach axis="ch"`) resolve a role to a set of data-node ids the same
 * way. See both callers' module doc comments for the flat/recursive split
 * itself; this module only holds the primitives neither wants to duplicate.
 * A role bound to a TRANSITION point (a numbered-badge's ordinal text)
 * resolves differently - see
 * `smartart-layout-interpreter-item-role-transition.ts`. Turning resolved
 * content into geometry is `smartart-layout-interpreter-item-role-stack.ts`
 * - both split out separately for the same file-size reason.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { resolveConstraintDeclaredBy } from './smartart-constraint-declared-by';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { roleOf } from './smartart-constraint-solver';
import { compoundChildIds } from './smartart-layout-interpreter-item-role-compound';
import { smartArtDescendantsWithText } from './smartart-node-tree-axis';

/** Algorithm types that are NEVER text, whatever `presOf` they happen to carry
 * (a decorative connector-anchor marker can still carry `presOf axis="self"`
 * for style/colour purposes - `gear`'s `gear1srcNode`). */
const DECORATIVE_ALGORITHM_TYPES = new Set(['sp', 'composite', 'conn']);

/**
 * DiagramML's own reserved role names for a TRANSITION point between two
 * siblings/parent-child (ECMA-376's `dgm:pt/@type="sibTrans"`/`"parTrans"`
 * enum, not an author-chosen name - `smartart-layout-interpreter-flow.ts`'s
 * `NODE_POINT_TYPES` excludes the same two for the same reason). Such a
 * layoutNode can still carry `presOf axis="self"` (Multidirectional Cycle's
 * `sibTrans` wraps a `connectorText` label), but "self" there means the
 * TRANSITION point's own text, a different data point the axis model below
 * (scoped to the CURRENT arranged node) cannot resolve - so it must never be
 * treated as one of the arranged node's own per-item roles.
 */
export const TRANSITION_ROLE_NAMES = new Set(['sibTrans', 'parTrans']);

/**
 * True when `node` genuinely projects data-point text: a non-empty
 * `dgm:presOf/@axis`, and an algorithm that is not DEFINITIVELY decorative.
 * `dgm:alg type="tx"` is the norm, but `parseSmartArtLayoutAlgorithm` only
 * reads a DIRECT `<dgm:alg>` child, so a real text role whose alg is itself
 * `dgm:choose`-wrapped (List1's `parentText`, alternating LTR/RTL params)
 * parses with `algorithm` undefined - treated permissively here (`undefined`
 * passes) rather than excluded, since only a KNOWN decorative type
 * (`sp`/`composite`/`conn`) can be excluded with confidence. False for a
 * positioning/decoration wrapper with no `presOf` at all, or a bare
 * `<dgm:presOf/>` with no `axis`.
 */
export function isTextRole(node: PptxSmartArtLayoutNode): boolean {
	if ((node.presentationOf?.axis?.length ?? 0) === 0) {
		return false;
	}
	if (node.name !== undefined && TRANSITION_ROLE_NAMES.has(node.name)) {
		return false;
	}
	const alg = node.algorithm?.type;
	return alg === undefined || !DECORATIVE_ALGORITHM_TYPES.has(alg);
}

/**
 * True when `topLevelChildren` (an arranger's OWN `.children`, never a
 * deeper level) has TWO OR MORE direct text roles that each target a
 * descendant/children axis (`ch`/`des`/`desOrSelf` - as opposed to `self`,
 * which always targets the SAME single point regardless of which role reads
 * it). A genuine single coherent item template declares at most ONE such
 * role (list/card layouts pair exactly one `self` role with at most one
 * `ch`/`des` one); two or more is the signature of a `dgm:choose` whose
 * MUTUALLY EXCLUSIVE branches were both flattened onto `.children` (`cycle3`
 * "Continuous Cycle"'s `Name0` unions its 2-point branch's `node1`/`node2`
 * -both `axis="ch desOrSelf"`- with its general-N branch's `cycle` sub-
 * arranger, because `cycle`'s OWN algorithm is itself choose-wrapped so
 * `discoverArrangement` falls back to `Name0` instead of unwrapping to
 * `cycle`). Both the flat scan (`resolveItemTextRoles`) and the recursive
 * walker (`hasRecursiveItemTemplate`) decline unwrapping/recursing past such
 * an arranger rather than guess which branch is real, conflating the two
 * branches' item counts - `dgm:choose` branch evaluation for children
 * flattening (not just algorithm-type selection) is a bigger gap this narrow
 * guard does not attempt to close.
 */
export function hasAmbiguousTopLevelRoles(topLevelChildren: PptxSmartArtLayoutNode[]): boolean {
	const textRoles = topLevelChildren.filter(isTextRole);
	const descendantAxisRoles = textRoles.filter((child) => {
		const axis = child.presentationOf?.axis?.[0];
		return axis === 'ch' || axis === 'des' || axis === 'desOrSelf';
	});
	if (descendantAxisRoles.length >= 2) {
		return true;
	}
	// A `desOrSelf` role is already INCLUSIVE (self AND descendants folded
	// into ONE box, see `contentIds`) - it never legitimately shares the
	// template with a SECOND role. `Converging Radial`'s hub+satellite
	// `cycle` family unions the hub-only `centerShape` (`self`) with the
	// satellite-only `node` role (`desOrSelf`) as flattened siblings, the
	// SAME choose-branch-flattening shape the descendant-axis check above
	// guards, just with one branch's role being `self` instead of `ch`/`des`.
	// A satellite that itself has a child (`converging-radial--hier5.pptx`'s
	// "Node Four", whose own child "Node Five" is folded into the SAME box in
	// the cached drawing) would otherwise get `centerShape` claiming its self
	// text and the now-descendant-only remainder of `node` split into a
	// SECOND, wrong box (measured: shape count went from 4 to 5).
	//
	// EXCLUDES a `desOrSelf` role reached through a GENUINE recursive
	// `dgm:forEach axis="ch"`/`"des"` (its `forEachOrigin`, `smartart-layout-
	// definition.ts`) - that shape is a true per-CHILD repeat (`Vertical
	// Circle List`'s `txLvl3`, one row per indent level, reached through
	// `Name21`'s `axis="ch"` forEach with NO count limit), not a flattened
	// choose alternative to the sibling `self` role (`Name13`'s `txLvl2`):
	// declining here regressed its shape count from 5 to 3 (both rows folded
	// back into one). `Converging Radial`'s `node` role, by contrast, is
	// reached through `axis="self"` (trivially "the current point", not a
	// real iteration) - only THAT shape is the ambiguous one.
	const isFlatDesOrSelf = (role: PptxSmartArtLayoutNode): boolean => {
		if (role.presentationOf?.axis?.[0] !== 'desOrSelf') {
			return false;
		}
		const originAxis = role.forEachOrigin?.axis;
		return !originAxis || !(originAxis.includes('ch') || originAxis.includes('des'));
	};
	return textRoles.length >= 2 && descendantAxisRoles.some(isFlatDesOrSelf);
}

/** All of `node`'s descendants (any depth) with non-empty text, document order. */
function descendantIds(
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): string[] {
	return smartArtDescendantsWithText(node, childrenOf).map((descendant) => descendant.id);
}

/**
 * `id -> text` for every one of `node`'s descendants (any depth) - the SAME
 * set {@link contentIds}'s `ch`/`des`/`desOrSelf` branches resolve ids from.
 *
 * Round 20: a `ch`/`des`-axis role (`childText` in "Vertical Bullet List":
 * `presOf axis="des"`, the point's own CHILD's text, folded into a
 * companion box beside the point's own `parentText`) resolved the right
 * `nodeIds` all along, but `smartart-layout-interpreter-item-role-stack-
 * fields.ts`'s `splitEntryFields` had no way to turn an id back into text -
 * its `text: entry.literalText ?? original.text` fallback silently
 * DUPLICATED the point's OWN text into the child's box instead (COM-
 * verified against `vertical-bullet-list--hier8.pptx`: "Branch A Root"
 * rendered under BOTH `parentText` AND `childText`, the second one wrong -
 * the real child, "Branch A Child", never appeared at all). This map lets
 * the stack/fields modules resolve the REAL text for any `nodeIds` a role
 * carries, not just the transition-role `literalText` case.
 */
export function descendantTextById(
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): Map<string, string> {
	const map = new Map<string, string>();
	for (const descendant of smartArtDescendantsWithText(node, childrenOf)) {
		map.set(descendant.id, descendant.text);
	}
	return map;
}

/** The data-node id(s) a role's `presOf` axis resolves to for one point. */
export function contentIds(
	role: PptxSmartArtLayoutNode,
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
): string[] {
	const fullAxis = role.presentationOf?.axis;
	if (fullAxis && fullAxis.length > 1) {
		// A genuine COMPOUND axis (`Tab List`'s `FirstChild`/`Child`, `axis="ch
		// desOrSelf"`) needs position-range resolution over the point's own
		// children, not a plain single-token match - see
		// `smartart-layout-interpreter-item-role-compound.ts`. Any OTHER
		// compound shape this corpus does not use is left unresolved (its
		// content stays folded into the primary box, the pre-existing
		// behaviour), rather than guessing.
		return fullAxis[0] === 'ch' ? compoundChildIds(role, node, childrenOf) : [];
	}
	const axis = fullAxis?.[0];
	if (axis === 'self') {
		return [node.id];
	}
	if (axis === 'ch') {
		return (childrenOf.get(node.id) ?? [])
			.filter((child) => child.text.trim().length > 0)
			.map((child) => child.id);
	}
	if (axis === 'des') {
		return descendantIds(node, childrenOf);
	}
	if (axis === 'desOrSelf') {
		// ECMA-376's "desOrSelf" is INCLUSIVE (self AND its descendants, folded
		// into ONE box as successive paragraphs), not "descendants, falling
		// back to self only when there are none" - measured against
		// `numbered-card-list--hier5.pptx`'s cached drawing, whose `nodeRect`
		// role (`presOf axis="desOrSelf"`) shows "Node One\nNode Two has a
		// longer label" as ONE box (self's own text first, then the child's),
		// and `bending-picture-caption--hier5.pptx`'s `Parent` role the same
		// way. Self always comes first, matching that document order. Safe
		// even for a role that is NOT the sole one for a point (e.g.
		// `lProcess1`'s "header" self role beside "child" `desOrSelf`):
		// `resolveItemRoleContent`/`pushRoleContent`'s dedup drops an id
		// already claimed by an earlier role, so a self id claimed elsewhere
		// simply falls out of THIS role's ids instead of duplicating it.
		const ids = descendantIds(node, childrenOf);
		return node.text.trim().length > 0 ? [node.id, ...ids] : ids;
	}
	// Any other single-token axis this corpus does not use is left unresolved:
	// the caller drops this role and its content stays folded into the
	// primary box, the pre-existing behaviour.
	return [];
}

/** A role's own declared preset (`dgm:shape/@type`), or plain `rect` when absent. */
export function rolePreset(role: PptxSmartArtLayoutNode): string {
	return role.shape?.presetGeometry ?? 'rect';
}

/**
 * Cross-axis weight for splitting the item cell across roles: the role's
 * OWN arranger-declared `h` constraint when it resolves to a positive
 * number (see `resolveConstraintDeclaredBy`), else an equal share.
 */
export function heightWeight(
	index: ConstraintIndex,
	arrangerRole: string,
	role: PptxSmartArtLayoutNode,
): number {
	const resolved = resolveConstraintDeclaredBy(index, roleOf(role), 'h', arrangerRole);
	return typeof resolved === 'number' && Number.isFinite(resolved) && resolved > 0 ? resolved : 1;
}

/**
 * Main-axis weight for splitting the item cell across roles SIDE BY SIDE
 * (round 27's column role split, `smartart-layout-interpreter-item-role-
 * stack-columns.ts`): the role's OWN declared `w` constraint, mirroring
 * {@link heightWeight} exactly but for the cross axis a horizontally-nested
 * item template ("Vertical Bracket List"'s `linNode`, `linDir="fromL"`)
 * actually stacks its roles along.
 */
export function widthWeight(
	index: ConstraintIndex,
	declaringRole: string,
	role: PptxSmartArtLayoutNode,
): number {
	const resolved = resolveConstraintDeclaredBy(index, roleOf(role), 'w', declaringRole);
	return typeof resolved === 'number' && Number.isFinite(resolved) && resolved > 0 ? resolved : 1;
}
