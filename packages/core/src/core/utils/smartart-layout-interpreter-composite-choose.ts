/**
 * SmartArt DiagramML interpreter - `dgm:choose`-guarded composite slot
 * resolution.
 *
 * A composite whose own `.children` include NO `self`-axis slot at all
 * (`cycle-matrix`/`balance`'s shape: the WHOLE composite tree has no single
 * bound "current point", so every content-bearing slot's `dgm:presOf`
 * resolves relative to the DIAGRAM ROOT, exactly like a diagram-level
 * `dgm:choose` condition) needs a DIFFERENT slot-collection strategy than
 * `arrangeByPresentationOf`'s self/des ordinal matching (`smartart-layout-
 * interpreter-composite.ts`).
 *
 * `cycle-matrix--fallback-n2.pptx`'s real shape: `children` (a bare wrapper,
 * no presOf) flattens FOUR named groups (`child1group`..`child4group`), each
 * gated by its OWN `dgm:if` (`axis="ch ch" ptType="node node" st="N 1"
 * cnt="1 0" func="cnt" op="gte" val="1"` - "does top-level point N exist AND
 * have >= 1 child of its own"), unconditionally flattened onto `.children`
 * by `smartart-layout-definition.ts`'s `nestedLayoutNodes` (which does not
 * evaluate `dgm:choose` conditions) but tagged with the guarding `dgm:if`'s
 * condition as `chooseGuard`. A LIVE group's own children (`child1`/
 * `child1Text`, compound `presOf axis="ch des" st="1 1" cnt="1 0"`) resolve
 * relative to the SAME diagram root, not to any per-group anchor - "take
 * top-level point 1, then ITS descendants". A SIBLING top-level bare wrapper
 * (`circle`, guarded the SAME way as `children`) can ALSO be live at once -
 * its own children (`quadrant1..4`) carry a plain single-token `presOf
 * axis="ch"`, each independently positioned into the diagram's own top-level
 * point list by its own `st`/`cnt` (`quadrant1`: position 1 = the diagram's
 * first top-level point itself).
 *
 * A DIFFERENT shape needs the OPPOSITE resolution: `Phased Process`'s
 * `middleComposite`/`leftComposite` (bare wrappers, each scoped to one
 * specific phase) nest a per-position `dgm:forEach axis="ch ch" st="N M"
 * cnt="1 1"` around each of THEIR OWN content children (`circ1Tx`, `presOf
 * axis="desOrSelf"` - a single-token axis that only makes sense relative to
 * an anchor, never the whole diagram). `resolveAnchoredContent`
 * (`smartart-layout-interpreter-composite-anchor.ts`) is what tells the two
 * shapes apart: it resolves a node's `presOf` relative to its OWN
 * `forEachOrigin` (the enclosing forEach's own resolved point) when one is
 * present, and relative to the diagram root otherwise - see its own doc
 * comment for the full derivation.
 *
 * Pure geometry; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { roleOf } from './smartart-constraint-solver';
import type { SlotStyleContext } from './smartart-layout-interpreter-composite';
import { resolveAnchoredContentPerAnchor } from './smartart-layout-interpreter-composite-anchor';
import { selectFirstMatchChildren } from './smartart-layout-interpreter-composite-choose-groups';
import type {
	ChooseAwareSlot,
	RawSlotCandidate,
} from './smartart-layout-interpreter-composite-group-slots';
import { resolveGroupedSlots } from './smartart-layout-interpreter-composite-group-slots';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { evaluateWhen } from './smartart-layout-interpreter-when';
import { findCompositeItemShape } from './smartart-layout-shape-preset';
import type { BoundingBox, RenderedNode, RenderedRectNode } from './smartart-layout-types';

/** 1-based position + sibling count for a `func="pos"`/`"revPos"`/`"posEven"`/`"posOdd"` condition in a `chooseGuard` chain, when the CANDIDATE being tested is one iteration of a multi-anchor `forEachOrigin` split (see {@link collectRawCandidates}) - `undefined` for a bare wrapper or a single-anchor node, where no per-iteration position exists. */
interface IterationPosition {
	position: number;
	total: number;
}

/**
 * `true` when EVERY condition in `node`'s own `chooseGuard` CHAIN (if any -
 * `sub-step-process--hier5.pptx`'s `chLin1..7`, each nested inside BOTH an
 * outer `pos`-discriminating `dgm:if` and an inner, nearly-vacuous one, need
 * BOTH to hold) allows it to render, evaluated against the diagram's full
 * flat node list, with `iterationPosition` (when supplied) letting a
 * `func="pos"`-family condition decide against WHICH forEach iteration this
 * specific candidate is - `discoverArrangement`'s own tree-location `pos`
 * (the layoutNode's static position in the layoutDef) is a DIFFERENT
 * concept, never applicable here (this module never receives it). An
 * UNDECIDABLE condition anywhere in the chain defaults that ONE condition
 * to "allow" (not the whole chain) - dropping content this cannot
 * confidently evaluate would be a NEW regression, whereas over-including at
 * worst matches the pre-existing "flatten every branch" behaviour; a chain
 * where every OTHER condition is still decidable and false still correctly
 * excludes the branch.
 */
function guardAllows(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
	iterationPosition: IterationPosition | undefined,
): boolean {
	if (!node.chooseGuard) {
		return true;
	}
	return node.chooseGuard.every(
		(guard) =>
			evaluateWhen(guard, flat.length, {
				nodes: flat,
				position: iterationPosition?.position,
				total: iterationPosition?.total,
			}) !== false,
	);
}

/**
 * Recursively walk `node`'s subtree collecting every choose-live,
 * `presOf`-bearing, POSITIONED descendant as RAW candidates (content
 * resolved, geometry not yet attempted) - see {@link collectChooseAwareSlots}
 * for why this is a separate pass. A branch whose OWN `chooseGuard`
 * evaluates false is dropped entirely, IT AND EVERYTHING NESTED INSIDE IT
 * (`child2group`..`child4group` here, `fallback-n2` has only 1 top-level
 * point). A bare wrapper (no `presOf` of its own - `children`, `child1group`,
 * `circle`) is never itself a candidate; its children are resolved using ITS
 * OWN role as the next `declaringRole`, since a nested composite re-scopes
 * `for="ch" forName="X"` positioning to its own children (`child1group`'s
 * own constrLst positions `child1`/`child1Text`, not `children`'s).
 *
 * A `presOf`-bearing node reached through a MULTI-anchor `forEachOrigin`
 * (`nested-target--hier5.pptx`'s `oChild`: a genuine `dgm:forEach axis="ch
 * ch" st="1 1" cnt="1 0"`, an UNBOUNDED second hop - "every child of point
 * 1", not a fixed position) produces ONE candidate PER anchor
 * (`resolveAnchoredContentPerAnchor`), not one candidate with every anchor's
 * content folded together - the genuine "one item template, N forEach
 * iterations" ECMA-376 21.4.2.13 describes, the same mechanism
 * `sub-step-process--hier5.pptx`'s hand-duplicated `chLin1..7` templates
 * need. Each anchor's OWN `guardAllows` check is deferred until its content
 * is resolved (rather than checked once, up front, the way a bare wrapper's
 * is) specifically so a `func="pos"`-family condition in `node`'s own
 * `chooseGuard` chain can decide against THAT SPECIFIC iteration's own
 * 1-based position - `sub-step-process`'s own `chLinN` templates each carry
 * a `pos==N` guard this way (though `chLinN` itself is a STRUCTURAL
 * arranger, not a presOf-bearing content leaf, so this mechanism alone does
 * not yet reach it - see this module's own doc comment on remaining gaps).
 * A single-anchor forEach (or none at all) still produces exactly ONE
 * candidate, `iteration=0, iterationCount=1`, with `iterationPosition`
 * `undefined` (no per-iteration position exists) - behaviour-identical to
 * before this split existed.
 */
function collectRawCandidates(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
	declaringRole: string,
	out: RawSlotCandidate[] = [],
): RawSlotCandidate[] {
	// A node with `presentationOfCandidates` may resolve to a real axis
	// choose-aware even when its STATIC `presentationOf` guess (`choosePresentationOf`'s
	// single, parse-time pick) happens to be bare - see `resolvePresentationOf`
	// (`smartart-layout-interpreter-when.ts`), which `resolveAnchoredContentPerAnchor`
	// itself now consults; this gate only decides whether it is worth calling.
	const hasPresOf =
		(node.presentationOf?.axis?.length ?? 0) > 0 ||
		(node.presentationOfCandidates?.length ?? 0) > 0;
	if (hasPresOf) {
		const groups = resolveAnchoredContentPerAnchor(node, flat);
		const iterationPosition = (iteration: number): IterationPosition | undefined =>
			groups.length > 1 ? { position: iteration + 1, total: groups.length } : undefined;
		groups.forEach((content, iteration) => {
			if (!guardAllows(node, flat, iterationPosition(iteration))) {
				return;
			}
			out.push({ node, declaringRole, content, iteration, iterationCount: groups.length });
		});
		return out;
	}
	if (!guardAllows(node, flat, undefined)) {
		return out;
	}
	const nextRole = roleOf(node);
	// First-match-wins among `node`'s own children before recursing into any
	// of them, recovering real `dgm:choose` semantics from `chooseGroups` -
	// see `smartart-layout-interpreter-composite-choose-groups.ts`'s own doc
	// comment (`balance--hier5.pptx`'s 127-member mutually-exclusive family,
	// the one shape this changes; every other fixture's `children` carries no
	// `chooseGroups` at all, so this is a no-op elsewhere).
	for (const child of selectFirstMatchChildren(node.children ?? [], flat)) {
		collectRawCandidates(child, flat, nextRole, out);
	}
	return out;
}

/**
 * Collect every choose-live content slot in `node`'s subtree (see
 * {@link collectRawCandidates} for the recursive walk this wraps), merging
 * candidates that resolve to the SAME point set into ONE slot rather than
 * one per layoutNode.
 *
 * `Basic Venn`'s `circ1` (`dgm:alg type="sp"`, decorative) and `circ1Tx`
 * (`alg="tx"`, the real text) share the exact SAME `forEachOrigin` anchor,
 * so both resolve to the SAME content - without merging, that content would
 * be folded in TWICE (`PRIMARY_ALG` maps `sp` to `'spacer'` elsewhere in
 * this interpreter for the same reason: it is never a text family on its
 * own). Merging also RECOVERS geometry a text-only member lacks: `Staggered
 * Process`'s `ThreeNodes_3_text` (`hideGeom`) has no `readSlots`-resolvable
 * constraint of its own at all; only its decorative `ThreeNodes_3` sibling
 * does, and dropping `sp` candidates outright (an earlier, simpler version
 * of this fix) lost that geometry along with the duplicate, silently
 * dropping the whole slot instead of just de-duplicating it.
 */
export function collectChooseAwareSlots(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
	box: BoundingBox,
	index: ConstraintIndex,
	declaringRole: string,
): ChooseAwareSlot[] {
	const candidates = collectRawCandidates(node, flat, declaringRole);
	return resolveGroupedSlots(candidates, box, index);
}

/**
 * `dgm:choose`-guarded root-relative slot collection, for a composite with NO
 * `self`-axis slot anywhere (`cycle-matrix`/`balance`'s shape - see this
 * module's own doc comment). Returns `undefined` when nothing resolves, so
 * the caller (`smartart-layout-interpreter-composite.ts`) falls back to the
 * blind order-based mapping.
 */
export function arrangeByChooseAwareSlots(
	root: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
	box: BoundingBox,
	index: ConstraintIndex,
	ctx: SlotStyleContext,
): RenderedNode[] | undefined {
	const slots = collectChooseAwareSlots(root, flat, box, index, roleOf(root));
	if (slots.length === 0) {
		return undefined;
	}
	return slots.map(({ rect, content, node: layoutNode }, i) => {
		const first = content[0];
		const rendered: RenderedRectNode = {
			...(presetBoxNode({
				key: `${ctx.elementId}-comp-choose-${first.id}-${i}`,
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
				node: first,
				index: i,
				total: slots.length,
				palette: ctx.palette,
				style: ctx.style,
				ctx: ctx.ctx,
				shape: findCompositeItemShape(layoutNode),
				fallbackKind: 'rect',
			}) as RenderedRectNode),
			foldedNodeIds: content.slice(1).map((entry) => entry.id),
		};
		return rendered;
	});
}
