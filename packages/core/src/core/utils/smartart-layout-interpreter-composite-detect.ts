/**
 * SmartArt DiagramML interpreter - top-level `composite` arranger detection.
 *
 * Split out of `smartart-layout-interpreter-model.ts` (the repo's per-file
 * line budget) so `discoverArrangement` can tell a genuine top-level
 * `composite` arranger (`gear`, `balance`, `stacked-venn`) apart from a
 * per-item composite item TEMPLATE (Meet the Team's `compNode`) without
 * hijacking the diagram's real structural arranger. Pure TypeScript - no
 * framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode } from '../types';

/** Constraint types that position a composite child into an explicit slot. */
const SLOT_CONSTRAINTS = new Set(['l', 't', 'w', 'h', 'ctrX', 'ctrY']);

/**
 * True when a composite's child `layoutNode`s carry positioning constraints that
 * map data points into fixed slots. Only then does `composite` win; otherwise it
 * is a passive wrapper and the interpreter recurses to the inner arrangement.
 *
 * Checks TWO shapes real built-ins use: a slot positioning ITSELF (its own
 * `constrLst` carries `l`/`t`/`w`/`h`/`ctrX`/`ctrY`), and the far more common
 * one - the composite ARRANGER positioning its slots FOR them, via its own
 * `for="ch" forName="<slot>"` constraint (`gear`, `balance`, `stacked-venn`;
 * see `allConstraints`, which also reaches a slot list nested inside a
 * `dgm:choose`/`dgm:forEach` the composite's positioning is count-branched
 * by - `gear`'s blocker).
 */
/** `dgm:alg` types that are a genuine structural arranger, never a plain content leaf. */
const STRUCTURAL_ALG_TYPES = new Set(['lin', 'cycle', 'pyra', 'snake', 'hierRoot', 'hierChild']);

/**
 * True when `node` was reached through an ENCLOSING `dgm:forEach` that only
 * ever iterates TRANSITION points (`axis="followSib"`, or `ptType`
 * restricted to `sibTrans`/`parTrans`) - a decorative connector/spacer
 * between two arranged points, never the diagram's own repeated content.
 * `hProcess7` ("Detailed Process")'s `vProcSp` reuses the SAME `dgm:alg
 * type="lin"` as the diagram's real per-item arranger, purely to line up its
 * OWN three decorative sub-shapes (`vSp1`/`simulatedConn`/`vSp2`, a simulated
 * connector) - it is a flattened SIBLING of the genuine item template
 * (`compositeNode`) within the arranger's own `.children`, reached via
 * `forEach axis="followSib" ptType="sibTrans"`, so a plain "first child whose
 * algorithm type matches" search picks it BEFORE ever considering the real
 * arranger, hijacking `discoverArrangement`'s choose-decided `linear` plan
 * into laying out three decorative slivers instead of the diagram's actual
 * items (measured: 3 slivers where 3 real item cards were expected). Moved
 * here (from `smartart-layout-interpreter-model.ts`, its only caller) purely
 * for the repo's per-file line budget.
 */
export function isTransitionOnlyChild(node: PptxSmartArtLayoutNode): boolean {
	const origin = node.forEachOrigin;
	if (!origin) {
		return false;
	}
	if (origin.axis?.includes('followSib') || origin.axis?.includes('follow')) {
		return true;
	}
	const pointTypes = origin.pointTypes;
	return (
		(pointTypes?.length ?? 0) > 0 &&
		(pointTypes?.every((type) => type === 'sibTrans' || type === 'parTrans') ?? false)
	);
}

/**
 * True when `node` declares its OWN `dgm:forEach axis="ch" st="N"` with
 * `N > 1` - a CONTINUATION iterator picking up from an EARLIER point already
 * consumed elsewhere in the SAME item template (`Table List`'s `pillars`
 * `st="2"`, skipping the composite's own `roof` slot which separately
 * consumes point 1; `Stacked List`'s `vertFlow` `st="2"`, skipping the
 * `firstComp` slot's own point 1), never the diagram's own top-level
 * "repeat once per point starting from the first" driver. Used by both
 * `discoverArrangement` (`smartart-layout-interpreter-model.ts`, to exclude
 * a continuation arranger from STRUCTURAL candidacy so the walk keeps
 * looking for the real one) and {@link hasStructuralDescendant} below (to
 * exclude it from disqualifying an OUTER composite too - the deferral
 * `hasStructuralDescendant` exists for is correct for a genuine per-item
 * nested arranger like `NumberedDotsVertical`'s `itemsFlow` - `st="1"`/
 * absent - but wrong for a continuation that only ever covers PART of the
 * points).
 *
 * Requires EVERY `forEach` entry to qualify (`.every`, not `.some`) - a node
 * can carry SEVERAL independent `axis="ch"` `forEach` entries at once, one
 * per named alternative slot (`Basic Venn`'s root `compositeShape`: seven
 * single-point entries, `st="1"` through `st="7"`, one per possible circle -
 * see ECMA-376 21.4.4.9, `dgm:forEach` is repeatable). A `.some` match
 * wrongly branded `compositeShape` a "continuation" because SIX of its seven
 * entries start beyond point 1, even though the SEVENTH (`st` absent, i.e.
 * `1`) covers point 1 - `discoverArrangement` then excluded the composite
 * root from choose/structural candidacy entirely, falling through to the
 * last-resort single-leaf `tx` plan (measured: `basic-venn`/`hexagon-
 * cluster`/`theme-picture-accent`/`theme-picture-grid`/`theme-picture-
 * alternating-accent` all landed on `plan.kind: 'text'` this way). A GENUINE
 * continuation (`Table List`'s `pillars`, `Stacked List`'s `vertFlow`)
 * declares exactly ONE such `forEach`, so `.every` agrees with the old
 * `.some` there (a single-element array), and an empty array (no `forEach`
 * at all) is guarded separately so `.every`'s vacuous-true default never
 * fires.
 */
export function isContinuationForEach(node: PptxSmartArtLayoutNode): boolean {
	const forEach = node.forEach ?? [];
	if (forEach.length === 0) {
		return false;
	}
	return forEach.every(
		(each) => each.axis?.length === 1 && each.axis[0] === 'ch' && (each.start?.[0] ?? 1) > 1,
	);
}

/**
 * True when `node` has a DESCENDANT whose OWN `dgm:alg` is a structural type
 * (`lin`/`cycle`/`pyra`/`snake`/`hierRoot`/`hierChild`, checked via a DIRECT,
 * non-choose-wrapped algorithm only - `parseSmartArtLayoutAlgorithm` parses
 * `algorithm` as `undefined` for a choose-wrapped one, so this never fires
 * for that shape, which is fine: a choose-DECIDED composite branch is
 * already handled by `discoverArrangement`'s separate choose-resolution
 * path, an active decision this passive check should not second-guess).
 * Excludes a descendant that is itself only a {@link isContinuationForEach}
 * arranger (see its own doc comment) - such a descendant covers only PART of
 * the points, so it must not disqualify the outer composite from ALSO being
 * considered.
 *
 * A composite whose sole mapped slot IS a nested structural arranger is a
 * passive positioning SHELL, not a genuine top-level composite -
 * `NumberedDotsVertical`'s `root` wraps `itemsFlow`'s own direct `dgm:alg
 * type="lin"` (no `dgm:choose` at all) purely to position it inside a single
 * named slot; `mapsSlots(root)` sees that ONE `for="ch" forName="itemsFlow"`
 * constraint and returns `true`, so without this exclusion
 * `discoverArrangement`'s composite-over-structural priority hijacked the
 * diagram away from its real `linear`/`itemsFlow` arrangement into a
 * degenerate single-slot "composite" (one item, no repetition at all) -
 * measured as a generic grid-fallback shape instead of the real item flow.
 * A GENUINE composite (`gear`, `balance`, `stacked-venn`) maps its slots onto
 * plain content leaves (`tx`/`sp`/`conn`), never onto a nested `lin`/`cycle`/
 * `pyra`/`snake`/hierarchy alg, so this never excludes one of those.
 */
export function hasStructuralDescendant(node: PptxSmartArtLayoutNode): boolean {
	return (node.children ?? []).some(
		(child) =>
			(STRUCTURAL_ALG_TYPES.has(child.algorithm?.type ?? '') && !isContinuationForEach(child)) ||
			hasStructuralDescendant(child),
	);
}

export function mapsSlots(node: PptxSmartArtLayoutNode): boolean {
	const declaredByArranger = (node.allConstraints ?? node.constraints ?? []).some(
		(constraint) => constraint.for === 'ch' && SLOT_CONSTRAINTS.has(constraint.type),
	);
	if (declaredByArranger) {
		return true;
	}
	return (node.children ?? []).some((child) =>
		(child.constraints ?? []).some((constraint) => SLOT_CONSTRAINTS.has(constraint.type)),
	);
}

/**
 * Composite nodes that are the REPEATED item template of an outer
 * `forEach axis="ch" ptType="node"` (Meet the Team's `compNode`, Text Card's
 * `compNode`, Step Down Process's `composite`), as opposed to a genuine
 * top-level composite arranger mapping DISTINCT data points onto named
 * slots (`gear`, `balance`, `stacked-venn`).
 *
 * `mapsSlots` also recognises ARRANGER-declared slot constraints (`for="ch"
 * forName="<slot>"`), which a per-item composite always carries too (its
 * own `photoCircle`/`nameText`/... positioning) - without this exclusion,
 * `discoverArrangement`'s composite-over-structural priority would hijack
 * every per-item-composite layout away from its correctly found `lin`/
 * `snake`/`cycle`/`pyra` structural arranger, SINCE such a composite is
 * always `itemNode(arranger)` (the arranger's own FIRST child) and
 * `smartart-layout-interpreter-item-roles.ts`'s wrapper-drilling already
 * handles it there. A genuine top-level composite is never itself such an
 * item template (nothing repeats it per point), so it is unaffected.
 */
export function itemTemplateNodes(
	node: PptxSmartArtLayoutNode,
	out: Set<PptxSmartArtLayoutNode>,
): void {
	const drivesPoints = node.forEach?.some(
		(each) =>
			each.axis?.length === 1 &&
			each.axis[0] === 'ch' &&
			(!each.pointTypes || each.pointTypes.includes('node')),
	);
	const item = node.children?.[0];
	if (drivesPoints && item) {
		out.add(item);
	}
	for (const child of node.children ?? []) {
		itemTemplateNodes(child, out);
	}
}

/**
 * True when `node` is `ancestor` itself, or somewhere inside its subtree.
 * `discoverArrangement` (`smartart-layout-interpreter-model.ts`) uses this
 * to keep a SIBLING alternative slot (`nested-target--hier5.pptx`'s
 * `middleBox`/`centerBox`, each flattened onto the SAME parent's children
 * the way `outerBox` is, each with its OWN separate, shallow-resolving
 * nested `.choose`) from independently re-asserting a whole-diagram
 * algorithm pick once an ANCESTOR composite has already been found to have
 * ITS OWN choose wrongly tunnelling into one such slot - see
 * `smartart-layout-interpreter-choose-depth.ts`'s own doc comment for the
 * full derivation.
 */
export function isLayoutNodeOrDescendantOf(
	ancestor: PptxSmartArtLayoutNode,
	node: PptxSmartArtLayoutNode,
): boolean {
	if (ancestor === node) {
		return true;
	}
	return (ancestor.children ?? []).some((child) => isLayoutNodeOrDescendantOf(child, node));
}
