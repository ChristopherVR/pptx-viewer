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
import { collectRawCandidates } from './smartart-layout-interpreter-composite-candidates';
import type { FontFitContext } from './smartart-layout-interpreter-composite-fontfit';
import { resolveFitByDeclaringRole } from './smartart-layout-interpreter-composite-fontfit';
import type { ChooseAwareSlot } from './smartart-layout-interpreter-composite-group-slots';
import { resolveGroupedSlots } from './smartart-layout-interpreter-composite-group-slots';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { findCompositeItemShape } from './smartart-layout-shape-preset';
import type { BoundingBox, RenderedNode, RenderedRectNode } from './smartart-layout-types';

/**
 * Collect every choose-live content slot in `node`'s subtree (see
 * {@link collectRawCandidates}, `smartart-layout-interpreter-composite-
 * candidates.ts`, for the recursive walk this wraps), merging
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
 *
 * Round 28 measured a shared-font-fit wiring attempt (`resolveSharedFontFit`
 * across EVERY slot at once, matching the OTHER two composite paths) against
 * the full 227-fixture corpus and REVERTED it: it genuinely helped several
 * fixtures close to the cached size (`balance--hier5.pptx` 12->34.7pt
 * against a 37.3pt target, `counterbalance-arrows--fallback-n2.pptx`
 * 12->34.7pt against 36.0pt), but OVERSHOT others badly
 * (`cycle-matrix--fallback-n2.pptx` 12->80.0pt against a 21.3pt target,
 * `grid-matrix--fallback-n1.pptx` 12->110.7pt against 61.3pt,
 * `segmented-pyramid--hier5.pptx` 12->86.7pt against 25.3pt), because
 * `slots[0]?.node`'s own declared `primFontSz` ceiling was reused as ONE
 * SHARED ceiling for every slot in the whole composite - but this family's
 * slots do NOT always share one uniform item template the way
 * `upward-arrow`'s own `arrowDiagramN`/`textBoxN` count-branches do (all
 * discovered under the SAME live count-branch wrapper): a
 * `cycle-matrix`/`basic-matrix`/`segmented-pyramid`-style choose-aware
 * composite's slots come from DIFFERENT named wrapper groups
 * (`child1group` vs `circle`, etc.), each with its own genuinely different
 * declared ceiling.
 *
 * Round 29: fit is now computed PER GROUP instead of once globally, keyed by
 * `ChooseAwareSlot.declaringRole` (the name of the nearest enclosing
 * bare-wrapper `layoutNode` each slot was discovered under, already threaded
 * through by `resolveGroupedSlots`). `upward-arrow`'s slots all share ONE
 * declaringRole (their live count-branch wrapper), so grouping degenerates
 * to the SAME single shared fit round 28 already measured as correct for it;
 * `cycle-matrix`/`grid-matrix`/`segmented-pyramid`'s slots split across
 * their own distinct wrapper names, so each group gets its own ceiling
 * instead of inheriting an unrelated group's. Measured monotonic (no
 * fixture's `maxGeomDelta` worse) across the full corpus before landing -
 * see the round 29 update in the successor doc for the exact sweep.
 */
export function arrangeByChooseAwareSlots(
	root: PptxSmartArtLayoutNode,
	flat: PptxSmartArtNode[],
	box: BoundingBox,
	index: ConstraintIndex,
	ctx: SlotStyleContext,
	fontCtx?: FontFitContext,
): RenderedNode[] | undefined {
	const slots = collectChooseAwareSlots(root, flat, box, index, roleOf(root));
	if (slots.length === 0) {
		return undefined;
	}
	const fitByRole = fontCtx ? resolveFitByDeclaringRole(fontCtx, slots) : new Map();
	return slots.map(({ rect, content, node: layoutNode, declaringRole }, i) => {
		const first = content[0];
		const fit = fitByRole.get(declaringRole);
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
				fontSizeOverride: fit?.rootSizePx,
				descendantFontSize: fit?.descendantSizePx,
				ctx: ctx.ctx,
				shape: findCompositeItemShape(layoutNode),
				fallbackKind: 'rect',
			}) as RenderedRectNode),
			foldedNodeIds: content.slice(1).map((entry) => entry.id),
		};
		return rendered;
	});
}
