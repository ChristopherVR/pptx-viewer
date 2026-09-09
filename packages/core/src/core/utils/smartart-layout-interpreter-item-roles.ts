/**
 * SmartArt DiagramML interpreter - per-item text-role expansion.
 *
 * A `forEach axis="ch" ptType="node"`-driven arranger (linear/snake/cycle/
 * pyramid) gives every top-level data point ONE box via its arranger's
 * primary item template. Many real built-in layouts declare a SECOND (or
 * more) per-item text role alongside that primary one, in one of three
 * shapes:
 *
 *  - flat siblings directly under the forEach - e.g. Vertical Bullet List's
 *    `parentText` (self) plus a `dgm:choose`-guarded `childText` (`des`,
 *    when the point has children) or `spacer` (no text). Both choose
 *    branches are already flattened onto `.children` by
 *    `smartart-layout-definition.ts`'s `nestedLayoutNodes`.
 *  - a composite item WRAPPER - e.g. Meet the Team's `compNode`: the item
 *    itself paints no text, and its OWN children (`nameText`/`roleText`,
 *    ...) are the real per-item roles.
 *  - TWO (or more) PARALLEL composite wrappers, each its own top-level
 *    child of the arranger, each driven by its OWN separate `dgm:forEach
 *    axis="ch"` over the SAME point set - e.g. `CircleAccentTimeline`'s
 *    `parComposite` (self text) and `desComposite` (the point's own CHILD
 *    text), two independent forEach blocks flattened onto `.children` as
 *    siblings. {@link resolveItemTextRoles} drills into EVERY non-text
 *    wrapper at the arranger's own level, not only the first, or the second
 *    wrapper's roles are invisible.
 *
 * A FOURTH shape - a nested `layoutNode` with its OWN `dgm:forEach
 * axis="ch"`, repeating a whole sub-template once per child of the point
 * being rendered (Lined List's `vert1`/`vert2`/`vert3`) - is handled by
 * `smartart-layout-interpreter-item-roles-recursive.ts` instead: see that
 * module's doc comment for why it is a separate walker rather than a case
 * here. {@link expandResultItemRoles} dispatches to whichever applies.
 *
 * Before this module, the interpreter rendered ONLY the primary item's own
 * text and folded every other descendant into that SAME box as extra
 * paragraphs (`collectFoldedDescendants` in
 * `smartart-interpreter-drawing-bridge.ts`) - correct for a node added a
 * level deeper via the text pane's Tab/"Add Bullet", but wrong whenever the
 * layoutDef declares a REAL second box for that descendant text (the
 * majority case for list/card layouts).
 *
 * This is a partial, general fix: it uses `dgm:presOf`'s `axis` (`self`/
 * `ch`/`des`/`desOrSelf`) to decide which data lands in which role box, and
 * does NOT evaluate the guarding `dgm:choose`/`dgm:if` condition - see
 * {@link resolveItemRoleContent}'s doc comment for how mutually exclusive
 * alternatives are told apart without it. Geometry is a starting
 * approximation (roles stacked vertically, weighted by an
 * arranger-declared `h` constraint when one resolves): a composite-wrapped
 * item's TRUE per-role layout (can be side-by-side) is left to the
 * arranger-specific geometry work this module does not attempt.
 *
 * Also exports {@link expandResultItemRoles}, the one caller
 * (`smartart-layout-interpreter.ts`) needs to apply role-splitting across a
 * whole arrangement result. See `smartart-layout-interpreter-hub.ts` for the
 * related but distinct "hub + satellites" detection.
 */

import type { PptxSmartArtConnection, PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { roleOf } from './smartart-constraint-solver';
import {
	hasAmbiguousTopLevelRoles,
	isTextRole,
} from './smartart-layout-interpreter-item-role-shared';
import { stackRoleContent } from './smartart-layout-interpreter-item-role-stack';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';
import {
	pushRoleContent,
	resolveRoleContent,
} from './smartart-layout-interpreter-item-role-transition';
import {
	expandRecursiveItemRoles,
	hasRecursiveItemTemplate,
} from './smartart-layout-interpreter-item-roles-recursive';
import {
	isPartialForEachOrigin,
	resolvePartialForEachRoles,
	unwrapTextRoles,
} from './smartart-layout-interpreter-item-roles-unwrap';
import type { RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

export {
	contentIds,
	isTextRole,
	rolePreset,
	TRANSITION_ROLE_NAMES,
} from './smartart-layout-interpreter-item-role-shared';
export type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';

/**
 * The per-item text-role templates for one arranged point, beyond the
 * single box the caller's existing arranger already produces. Returns
 * `undefined` when the item is (or reduces to) a single plain text box -
 * the common case, where the caller keeps its pre-existing behaviour.
 */
export function resolveItemTextRoles(
	arranger: PptxSmartArtLayoutNode,
): PptxSmartArtLayoutNode[] | undefined {
	const flatChildren = arranger.children ?? [];
	// `Alternating Flow`'s `process` arranger flattens TWO parity-alternating
	// composite templates (`composite1`, ODD points via `step="2"`;
	// `composite2`, EVEN points via a `followSib`-reached iterator) onto the
	// SAME `.children` - see `resolvePartialForEachRoles`'s doc comment
	// (`smartart-layout-interpreter-item-roles-unwrap.ts`) for the full
	// reasoning: content-compatible alternates use one wrapper's roles for
	// every point, genuinely different ones decline.
	const contributingWrappers = flatChildren.filter(
		(child) => !isTextRole(child) && unwrapTextRoles(child).length > 0,
	);
	if (contributingWrappers.length >= 2 && contributingWrappers.some(isPartialForEachOrigin)) {
		return resolvePartialForEachRoles(contributingWrappers);
	}
	// `cycle3` "Continuous Cycle"'s `Name0` unions its 2-point branch's
	// `node1`/`node2` (both DIRECT top-level `axis="ch desOrSelf"` roles) with
	// its general-N branch's `cycle` sub-arranger (a nested composite wrapper
	// whose OWN descendants, once unwrapped, are ALSO valid text roles) - two
	// mutually exclusive `dgm:choose` branches flattened onto the same
	// `.children`. Unwrapping `cycle` there would conflate its roles with
	// `node1`/`node2`'s, so this declines entirely rather than guess which
	// branch is real - see `hasAmbiguousTopLevelRoles`'s doc comment.
	if (hasAmbiguousTopLevelRoles(flatChildren)) {
		return undefined;
	}
	// A composite/wrapper child (Meet the Team's `compNode`) paints no text of
	// its own: its OWN descendants are additional candidates, drilled from
	// EVERY non-text wrapper at this level (not just the first,
	// `itemNode`'s `arranger.children[0]`) and at any depth beneath it -
	// `CircleAccentTimeline`/`VerticalAccentList` drive `parTx` (self) and
	// `desTx` (`des`, the point's own CHILD text) from TWO SEPARATE composite
	// templates (`parComposite`/`desComposite`) under TWO SEPARATE top-level
	// `dgm:forEach`s over the same point set, both flattened onto
	// `arranger.children` as siblings, so unwrapping only the first
	// (`parComposite`) left `desComposite`'s roles invisible and the caller's
	// own descendant-folding inference merged the child's text into the
	// parent's box instead of giving it its own (measured:
	// `circle-accent-timeline--hier5.pptx`'s cached drawing keeps "Node One"
	// and its child "Node Two..." as two SEPARATE boxes, not one folded box).
	// List1's `parentLin` is the OTHER wrapper shape: a nested `lin`
	// sub-arranger (LTR/RTL alignment) around JUST the primary's own text box,
	// whose TRUE secondary role (`childText`) is still a FLAT SIBLING of the
	// wrapper at the arranger's own level, not nested inside it - so both
	// sources are combined rather than choosing one.
	const unwrapped = flatChildren.flatMap((child) => unwrapTextRoles(child));
	const roles = [...flatChildren, ...unwrapped].filter(isTextRole);
	return roles.length > 1 ? roles : undefined;
}

/**
 * Resolve each of `roles`' actual content for `node`, in template order.
 * Two roles can target the SAME axis as mutually exclusive `dgm:choose`
 * alternatives both surviving flattening (Step Down Process's LAST-point
 * `FinalChildText` vs every other point's `ChildText`, both `des`, chosen by
 * a `followSib` count this module does not evaluate) - a role whose
 * resolved ids are already fully claimed by an earlier role is dropped
 * rather than rendering the same descendant text twice. `connections`
 * (optional) resolves a role bound to a TRANSITION point instead of a data
 * node (see `resolveRoleContent`'s doc comment) - a numbered-badge layout's
 * ordinal text, read from the item's own `parOf` edge's `sibTrans`/`parTrans`
 * point.
 */
export function resolveItemRoleContent(
	roles: PptxSmartArtLayoutNode[],
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	connections?: PptxSmartArtConnection[],
): ItemRoleContent[] {
	const used = new Set<string>();
	const out: ItemRoleContent[] = [];
	for (const role of roles) {
		pushRoleContent(resolveRoleContent(role, node, childrenOf, connections), used, out);
	}
	return out;
}

/**
 * Expand ONE arranger-computed box for a single arranged point into its
 * per-item text roles (`roles`, from {@link resolveItemTextRoles}), stacking
 * them within the SAME box vertically in template order. Returns
 * `undefined` when this particular point has no secondary role content (no
 * qualifying descendants), so the caller keeps its original single box.
 */
export function expandItemRoles(
	roles: PptxSmartArtLayoutNode[],
	arrangerRole: string,
	original: RenderedNode,
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	index: ConstraintIndex,
	connections?: PptxSmartArtConnection[],
): RenderedNode[] | undefined {
	const content = resolveItemRoleContent(roles, node, childrenOf, connections);
	return stackRoleContent(content, arrangerRole, original, index);
}

/** Expand every rendered point using `split`, keeping the original box when it declines. */
function expandEveryPoint(
	result: SmartArtLayoutResult,
	nodes: PptxSmartArtNode[],
	split: (rendered: RenderedNode, node: PptxSmartArtNode) => RenderedNode[] | undefined,
): SmartArtLayoutResult {
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const expanded: RenderedNode[] = [];
	for (const rendered of result.nodes) {
		const node = rendered.nodeId ? nodeById.get(rendered.nodeId) : undefined;
		const rows = node ? split(rendered, node) : undefined;
		expanded.push(...(rows ?? [rendered]));
	}
	return { ...result, nodes: expanded };
}

/**
 * Expand every arranged point's box in `result` into its per-item text
 * roles, when `arranger`'s item template declares more than one (see
 * {@link resolveItemTextRoles}), or is a genuinely RECURSIVE item template
 * (a nested `layoutNode` with its own `dgm:forEach axis="ch"`, repeating a
 * whole sub-template once per child of the point being rendered - Lined
 * List's `vert1`/`vert2`/`vert3`; see `smartart-layout-interpreter-item-
 * roles-recursive.ts`'s module doc comment for why that is a dedicated
 * walker rather than a case here). A no-op (returns `result` unchanged) for
 * the common single-text-box item template. The one entry point
 * `smartart-layout-interpreter.ts` needs. `connections`, when supplied, lets
 * a transition-bound role (a numbered-badge's ordinal text) resolve too.
 */
export function expandResultItemRoles(
	arranger: PptxSmartArtLayoutNode,
	result: SmartArtLayoutResult,
	nodes: PptxSmartArtNode[],
	childrenOf: Map<string, PptxSmartArtNode[]>,
	index: ConstraintIndex,
	connections?: PptxSmartArtConnection[],
): SmartArtLayoutResult {
	const arrangerRole = roleOf(arranger);
	if (hasRecursiveItemTemplate(arranger)) {
		return expandEveryPoint(result, nodes, (rendered, node) =>
			expandRecursiveItemRoles(
				arranger,
				arrangerRole,
				rendered,
				node,
				childrenOf,
				index,
				connections,
			),
		);
	}
	const roles = resolveItemTextRoles(arranger);
	if (!roles) {
		return result;
	}
	return expandEveryPoint(result, nodes, (rendered, node) =>
		expandItemRoles(roles, arrangerRole, rendered, node, childrenOf, index, connections),
	);
}
