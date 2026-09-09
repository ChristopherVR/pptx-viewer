/**
 * SmartArt DiagramML interpreter - RECURSIVE per-item template expansion.
 *
 * ECMA-376 21.4's `dgm:forEach` is not limited to the single top-level
 * iteration an arranger (`lin`/`snake`/`cycle`/`pyra`) already performs over
 * its own point list (handled by the arranger algorithms themselves, and by
 * the single-level role splitting in `smartart-layout-interpreter-item-
 * roles.ts`): a `layoutNode` INSIDE an item template can carry its OWN
 * `dgm:forEach axis="ch"`, meaning "repeat everything nested under me once
 * per CHILD of the point currently being rendered" - a genuinely recursive
 * per-item template. `LinedList` is the canonical case: each top-level
 * item's box (`horz1`/`tx1`) nests a `vert1` sub-arranger whose `dgm:forEach
 * axis="ch"` repeats `horz2`/`tx2` once per child of THAT item, and `vert2`
 * nests exactly the same pattern one level deeper again (`horz3`/`tx3`,
 * `horz4`/`tx4`), so an item with a grandchild gets three text-bearing
 * boxes, one with no children gets one.
 *
 * `smartart-layout-definition.ts` already preserves what this needs: a
 * layoutNode reached by walking through a `dgm:forEach` wrapper carries that
 * forEach's iterator attributes on its OWN `.forEachOrigin` (`undefined` for
 * a direct child, or one reached only through a `dgm:choose` - a condition,
 * not an iteration). A layoutNode can have MULTIPLE forEach children with
 * different axes (`lProcess1`'s `vertFlow` has a `ptType="parTrans" cnt="1"`
 * one for its connector AND a SEPARATE `axis="ch"` one for its repeated
 * `child` item), so this must be checked PER CHILD via `.forEachOrigin`, not
 * by asking the PARENT "do you have `.forEach` entries wrapping ANY axis" -
 * an earlier version of this module did the latter and treated `vertFlow`
 * itself as the recursion boundary (because ONE of its forEach children
 * happened to be `axis="ch"`), which silently swallowed `lProcess1`'s
 * `header` role - the regression this comment now guards against. A
 * layoutNode whose OWN `.forEachOrigin` is `axis="ch"` (with no `ptType` or
 * an explicit `"node"`) is the recursion boundary this module walks;
 * everything else (`followSib`, a `ptType="parTrans"`/`"sibTrans"`
 * transition, a direct child) is left as a static, once-only template, its
 * pre-existing treatment.
 *
 * Deliberately separate from `smartart-layout-interpreter-item-roles.ts`'s
 * flat role splitting (a single level, template-only, data-free scan)
 * rather than folded into it: the flat scan's role ORDER (a wrapper's own
 * children appended AFTER its flat siblings - see that module's List1 doc
 * comment) is deliberately tuned to real fixtures with no `axis="ch"`
 * forEach anywhere in the item template, and changing that walk to a
 * natural document-order recursive descent would silently reorder those
 * layouts' stacked roles. This module only activates when
 * {@link hasRecursiveItemTemplate} finds the genuinely new construct, so
 * neither path can regress the other's fixtures.
 */

import type { PptxSmartArtConnection, PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import {
	hasAmbiguousTopLevelRoles,
	isTextRole,
	TRANSITION_ROLE_NAMES,
} from './smartart-layout-interpreter-item-role-shared';
import { stackRoleContent } from './smartart-layout-interpreter-item-role-stack';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';
import {
	pushRoleContent,
	resolveRoleContent,
} from './smartart-layout-interpreter-item-role-transition';
import type { RenderedNode } from './smartart-layout-types';

/**
 * True when `node` was itself produced by an ENCLOSING `dgm:forEach` that
 * repeats it once per CHILD of the point being rendered (`axis="ch"`,
 * `ptType` absent or `"node"` - transitions (`sibTrans`/`parTrans`) and a
 * `followSib`/count-limited forEach are never the recursion target).
 */
function isChAxisOrigin(node: PptxSmartArtLayoutNode): boolean {
	const origin = node.forEachOrigin;
	return (
		(origin?.axis?.includes('ch') ?? false) &&
		(!origin?.pointTypes || origin.pointTypes.includes('node'))
	);
}

/**
 * True when ANY node BELOW `arranger`'s own item-template level (i.e. not
 * `arranger.children` themselves, but something reachable from one of
 * them) was produced by a `ch`-axis `dgm:forEach` - the marker this whole
 * module exists to walk. `arranger.children` are deliberately excluded at
 * this top level: they were already produced by the OUTER forEach the
 * ARRANGER itself consumes (one item template per already-rendered point),
 * which is typically the very same `axis="ch" ptType="node"` shape a nested
 * recursion boundary uses, so checking `arranger.children`'s OWN
 * `.forEachOrigin` here would treat EVERY multi-node item template as
 * "recursive". Cheap existence scan, no data involved.
 */
export function hasRecursiveItemTemplate(arranger: PptxSmartArtLayoutNode): boolean {
	if (hasAmbiguousTopLevelRoles(arranger.children ?? [])) {
		return false;
	}
	const hasChAxisBelow = (node: PptxSmartArtLayoutNode): boolean =>
		(node.children ?? []).some((child) => isChAxisOrigin(child) || hasChAxisBelow(child));
	return (arranger.children ?? []).some(hasChAxisBelow);
}

/**
 * Visit ONE template node against `contextNode`: a text role resolves its
 * content against the CURRENT context (exactly like the flat scan's
 * `resolveItemRoleContent`); anything else is transparent - its children are
 * walked with the SAME context (each individually re-checked for its OWN
 * `ch`-axis origin by {@link collectRecursive}), exactly as if this node
 * were not there. A reserved transition role (`sibTrans`/`parTrans`) is
 * skipped entirely, content included, mirroring the flat scan's exclusion.
 */
function visitOne(
	node: PptxSmartArtLayoutNode,
	contextNode: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	connections: PptxSmartArtConnection[] | undefined,
	used: Set<string>,
	out: ItemRoleContent[],
): void {
	if (node.name !== undefined && TRANSITION_ROLE_NAMES.has(node.name)) {
		return;
	}
	if (isTextRole(node)) {
		pushRoleContent(resolveRoleContent(node, contextNode, childrenOf, connections), used, out);
		return;
	}
	if (node.children && node.children.length > 0) {
		collectRecursive(node.children, contextNode, childrenOf, connections, used, out);
	}
}

/**
 * Walk `templateNodes` against `contextNode`, PER NODE deciding whether it
 * is a `ch`-axis recursion boundary (`.forEachOrigin`, see this module's doc
 * comment for why that must be checked per-node rather than on the parent):
 * if so, {@link visitOne} runs once per child of `contextNode`, with that
 * child as the new context; otherwise it runs once with the SAME context.
 * `used` is threaded through the whole walk (not just one level) so a
 * mutually-exclusive `dgm:choose` alternative at any depth still can't
 * double-claim a data node's text; safe globally because data-node ids are
 * unique across the whole tree.
 */
function collectRecursive(
	templateNodes: PptxSmartArtLayoutNode[],
	contextNode: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	connections: PptxSmartArtConnection[] | undefined,
	used: Set<string>,
	out: ItemRoleContent[],
): void {
	for (const templateNode of templateNodes) {
		if (isChAxisOrigin(templateNode)) {
			for (const child of childrenOf.get(contextNode.id) ?? []) {
				visitOne(templateNode, child, childrenOf, connections, used, out);
			}
		} else {
			visitOne(templateNode, contextNode, childrenOf, connections, used, out);
		}
	}
}

/**
 * Resolve `arranger`'s (possibly recursive) item template against `node`,
 * the specific point being rendered - the recursive counterpart of the flat
 * scan's `resolveItemTextRoles` + `resolveItemRoleContent` combined, since a
 * recursive template's roles are inseparable from the data node each one
 * resolves against (a `ch`-axis forEach's descendants belong to a DIFFERENT
 * context node than its own siblings). `arranger.children` are visited with
 * `node` itself as context, ignoring their OWN `.forEachOrigin` (see
 * {@link hasRecursiveItemTemplate}'s doc comment): the arranger's OUTER
 * forEach already produced one item template per rendered point, so this is
 * that SAME point, not a fresh iteration.
 */
export function resolveRecursiveItemRoleContent(
	arranger: PptxSmartArtLayoutNode,
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	connections?: PptxSmartArtConnection[],
): ItemRoleContent[] {
	const out: ItemRoleContent[] = [];
	const used = new Set<string>();
	for (const child of arranger.children ?? []) {
		visitOne(child, node, childrenOf, connections, used, out);
	}
	return out;
}

/**
 * Expand ONE arranger-computed box for a single arranged point into its
 * recursive per-item text roles, stacking them within the SAME box
 * vertically in template order (see `stackRoleContent`). Returns
 * `undefined` when this point resolves to at most one role (no qualifying
 * children at any depth), so the caller keeps its original single box.
 */
export function expandRecursiveItemRoles(
	arranger: PptxSmartArtLayoutNode,
	arrangerRole: string,
	original: RenderedNode,
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	index: ConstraintIndex,
	connections?: PptxSmartArtConnection[],
): RenderedNode[] | undefined {
	const content = resolveRecursiveItemRoleContent(arranger, node, childrenOf, connections);
	return stackRoleContent(content, arrangerRole, original, index);
}
