/**
 * SmartArt DiagramML interpreter - raw choose-aware candidate collection.
 *
 * Split out of `smartart-layout-interpreter-composite-choose.ts` (the repo's
 * per-file line budget): {@link collectRawCandidates} is the recursive walk
 * that module's `collectChooseAwareSlots` wraps. Pure geometry; no framework
 * code.
 */

import type {
	PptxSmartArtIteratorAttributes,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import { roleOf } from './smartart-constraint-solver';
import { resolveAxisNodes } from './smartart-layout-interpreter-axis-count';
import {
	resolveAnchoredContentPerAnchor,
	resolveAnchoredContentPerAnchorFrom,
} from './smartart-layout-interpreter-composite-anchor';
import { selectFirstMatchChildren } from './smartart-layout-interpreter-composite-choose-groups';
import { STRUCTURAL_ALG_TYPES } from './smartart-layout-interpreter-composite-detect';
import type { RawSlotCandidate } from './smartart-layout-interpreter-composite-group-slots';
import { evaluateWhen } from './smartart-layout-interpreter-when';

/**
 * `node`'s own `forEachOrigin`, resolved root-relatively - the forEach-bound
 * point set a `func="maxDepth"`/`"cnt"`-family `dgm:if` in `node`'s own
 * `chooseGuard` can navigate `@axis` from (`radial-cluster--hier5.pptx`'s
 * `singleCycle`/`textCenter` choose, both anchored to `Name38`'s `axis="ch"
 * cnt="1"` binding to the diagram's first top-level point) - see
 * `evaluateWhen`'s `maxDepth` case (`smartart-layout-interpreter-when.ts`).
 * `undefined` when `node` has no `forEachOrigin`, or it resolves to nothing.
 */
function resolveOwnAnchor(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
): PptxSmartArtNode[] | undefined {
	const origin = node.forEachOrigin;
	if (!origin?.axis || origin.axis.length === 0) {
		return undefined;
	}
	return resolveAxisNodes(flat, origin.axis, origin.pointTypes, origin.start, origin.count);
}

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
	const anchor = resolveOwnAnchor(node, flat);
	return node.chooseGuard.every(
		(guard) =>
			evaluateWhen(guard, flat.length, {
				nodes: flat,
				anchor,
				position: iterationPosition?.position,
				total: iterationPosition?.total,
			}) !== false,
	);
}

/**
 * Recursively walk `node`'s subtree collecting every choose-live,
 * `presOf`-bearing, POSITIONED descendant as RAW candidates (content
 * resolved, geometry not yet attempted) - see `collectChooseAwareSlots`
 * (`smartart-layout-interpreter-composite-choose.ts`) for why this is a
 * separate pass. A branch whose OWN `chooseGuard` evaluates false is dropped
 * entirely, IT AND EVERYTHING NESTED INSIDE IT (`child2group`..`child4group`
 * here, `fallback-n2` has only 1 top-level point). A bare wrapper (no
 * `presOf` of its own - `children`, `child1group`, `circle`) is never itself
 * a candidate; its children are resolved using ITS OWN role as the next
 * `declaringRole`, since a nested composite re-scopes `for="ch"
 * forName="X"` positioning to its own children (`child1group`'s own
 * constrLst positions `child1`/`child1Text`, not `children`'s).
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
 * not yet reach it). A single-anchor forEach (or none at all) still produces
 * exactly ONE candidate, `iteration=0, iterationCount=1`, with
 * `iterationPosition` `undefined` (no per-iteration position exists).
 *
 * `inheritedOrigin` (round 32): the nearest ENCLOSING repeated-item-template
 * node's own `forEachOrigin`, threaded down for a `presOf`-bearing
 * descendant that has NO `forEachOrigin` of its own -
 * `continuous-arrow-process--hier5.pptx`'s `parTx`/`desTx` sit two
 * `dgm:layoutNode` levels inside `linV` (the actual `alg="lin"` item
 * template, reached via `axis="ch" ptType="node"`), so neither carries a
 * `forEachOrigin` itself; without this, both resolved root-relatively (one
 * arbitrary point instead of one per top-level point), collapsing the whole
 * slot to a single shape. Established ONLY when a bare node's OWN algorithm
 * is a genuine structural type ({@link STRUCTURAL_ALG_TYPES}) reached
 * through an `axis="ch" ptType="node"` origin - the narrow "this bare node
 * IS a repeated per-point item template" signal, not "any bare node with
 * any forEachOrigin" - so a plain content leaf reached the same way
 * (unaffected before this round) keeps resolving exactly as before.
 */
export function collectRawCandidates(
	node: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
	declaringRole: string,
	out: RawSlotCandidate[] = [],
	inheritedOrigin?: PptxSmartArtIteratorAttributes,
	// Round 32: every ancestor role STRICTLY ABOVE `declaringRole` (nearest
	// first) - see `RawSlotCandidate.declaringRoleChain`'s own doc comment
	// (`smartart-layout-interpreter-composite-group-slots.ts`) for why a bare
	// pass-through wrapper needs this. Internal recursion state; every
	// pre-existing external call site omits it (defaults to `[]`, unaffected).
	ancestorChain: readonly string[] = [],
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
		const ownOrigin = (node.forEachOrigin?.axis?.length ?? 0) > 0 ? node.forEachOrigin : undefined;
		if (!ownOrigin && inheritedOrigin) {
			const declaringRoleChain =
				ancestorChain.length > 0 ? [declaringRole, ...ancestorChain] : undefined;
			for (const { content, anchorIndex, anchorCount } of resolveAnchoredContentPerAnchorFrom(
				node,
				flat,
				inheritedOrigin,
			)) {
				const iterationPosition: IterationPosition | undefined =
					anchorCount > 1 ? { position: anchorIndex + 1, total: anchorCount } : undefined;
				if (!guardAllows(node, flat, iterationPosition)) {
					continue;
				}
				out.push({
					node,
					declaringRole,
					declaringRoleChain,
					content,
					iteration: anchorIndex,
					iterationCount: anchorCount,
				});
			}
			return out;
		}
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
	const nextAncestorChain =
		nextRole === declaringRole ? ancestorChain : [declaringRole, ...ancestorChain];
	const ownTemplateOrigin =
		node.algorithm?.type &&
		STRUCTURAL_ALG_TYPES.has(node.algorithm.type) &&
		node.forEachOrigin?.axis?.includes('ch') &&
		node.forEachOrigin?.pointTypes?.includes('node')
			? node.forEachOrigin
			: undefined;
	const effectiveOrigin = ownTemplateOrigin ?? inheritedOrigin;
	// First-match-wins among `node`'s own children before recursing into any
	// of them, recovering real `dgm:choose` semantics from `chooseGroups` -
	// see `smartart-layout-interpreter-composite-choose-groups.ts`'s own doc
	// comment (`balance--hier5.pptx`'s 127-member mutually-exclusive family,
	// the one shape this changes; every other fixture's `children` carries no
	// `chooseGroups` at all, so this is a no-op elsewhere).
	for (const child of selectFirstMatchChildren(node.children ?? [], flat)) {
		collectRawCandidates(child, flat, nextRole, out, effectiveOrigin, nextAncestorChain);
	}
	return out;
}
