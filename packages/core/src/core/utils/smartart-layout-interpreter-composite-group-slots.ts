/**
 * SmartArt DiagramML interpreter - choose-aware candidate grouping + slot
 * resolution.
 *
 * Split out of `smartart-layout-interpreter-composite-choose.ts` (the
 * repo's per-file line budget): {@link resolveGroupedSlots} groups the raw
 * candidates `collectRawCandidates` collects there by their resolved
 * content (several layoutNodes can anchor to the EXACT same point set - see
 * this module's own doc comment on the decorative/text pairing), then
 * resolves ONE rect per group.
 *
 * Pure geometry; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveIterationRect } from './smartart-layout-interpreter-composite-iteration';
import { readSlots } from './smartart-layout-interpreter-composite-slots';
import type { Slot } from './smartart-layout-interpreter-composite-slots';
import type { BoundingBox } from './smartart-layout-types';

/** One resolved choose-aware slot: its final rect, the node(s) it renders
 * (the first is primary, the rest fold in as extra paragraphs), the
 * WINNING candidate's own layoutNode (round 28: for `findCompositeItemShape`
 * to resolve the slot's real declared preset from, instead of the caller's
 * own hardcoded family default - `arrangeByChooseAwareSlots` never had
 * access to this before, so every slot silently fell through to the same
 * generic `roundRect`/`rect` fallback regardless of what the layout actually
 * declared), and the candidate's own `declaringRole` (round 29: the NAME of
 * the nearest enclosing bare-wrapper `layoutNode` this slot was discovered
 * under - `child1group` vs `circle` in `cycle-matrix`, or a single shared
 * count-branch wrapper for `upward-arrow`'s `textBoxN`/`arrowDiagramN` -
 * for per-group font-fit, see `arrangeByChooseAwareSlots`'s own doc
 * comment). */
export interface ChooseAwareSlot {
	rect: Slot;
	content: PptxSmartArtNode[];
	node: PptxSmartArtLayoutNode;
	declaringRole: string;
}

/** A choose-live, `presOf`-bearing candidate found by `collectRawCandidates` (`smartart-layout-interpreter-composite-choose.ts`), not yet resolved to a rect. */
export interface RawSlotCandidate {
	node: PptxSmartArtLayoutNode;
	declaringRole: string;
	/**
	 * Round 32: every ancestor role (nearest first, `declaringRole` itself
	 * included) between `node` and the composite root, for a `node` reached
	 * through a bare pass-through wrapper that has no `constrLst` of its own
	 * (`linV` inside `linH` - see `smartart-layout-interpreter-composite-
	 * slots.ts`'s `dimDeclaredBy`). `undefined` for every pre-existing
	 * candidate path (unaffected) - `readSlots` falls back to `declaringRole`
	 * alone in that case.
	 */
	declaringRoleChain?: readonly string[];
	content: PptxSmartArtNode[];
	/** This candidate's 0-based position among every candidate `resolveAnchoredContentPerAnchor` produced for the SAME `node` (0/1 for a single-anchor or root-relative slot, unchanged from before per-iteration splitting existed). */
	iteration: number;
	/** How many total candidates `resolveAnchoredContentPerAnchor` produced for the SAME `node` - see {@link resolveIterationRect}. */
	iterationCount: number;
}

/** Every content node id in `content`, sorted so two candidates that resolve to the SAME points (any order) collapse to the same group key. */
function contentSignature(content: PptxSmartArtNode[]): string {
	return content
		.map((n) => n.id)
		.sort()
		.join(' ');
}

/**
 * Group `candidates` by their resolved content (several layoutNodes can
 * anchor to the EXACT same point set - `Basic Venn`'s `circ1` (`dgm:alg
 * type="sp"`, the real, PAINTED ellipse) and `circ1Tx` (`alg="tx"`, `dgm:shape
 * type="rect" hideGeom="1"`, a text-only sizing box) share the exact SAME
 * `forEachOrigin` anchor, so both resolve to the SAME content - without
 * merging, that content would be folded in TWICE), then resolve ONE rect per
 * group: try each member's OWN `readSlots` in turn, preferring a VISIBLE
 * (non-`hideGeom`) shape first - PowerPoint's own cached drawing renders the
 * data point's text INSIDE the painted shape's own box (`dsp:sp`'s `a:xfrm`),
 * using a `hideGeom` sibling's box only to size/wrap the TEXT internally
 * (`dsp:txXfrm`, a separate field this interpreter does not model), never as
 * a second shape - `Basic Venn`'s cached `circ1` ellipse carries "Alpha"
 * directly; there is no separate `circ1Tx` shape in the cache at all. Both
 * `circ1` and `circ1Tx` resolve a REAL slot here (the arranger's own
 * `dgm:choose` declares `for="ch" forName="circ1"` AND `forName="circ1Tx"`
 * geometry), so ordering purely by algorithm type (the pre-existing rule)
 * picked the `hideGeom` text box's small inset rect instead of the visible
 * shape's own box - wrong preset (`rect` instead of `ellipse`) and wrong
 * geometry. Falls back to a `hideGeom` member's slot when no visible member
 * has one - `Staggered Process`'s `ThreeNodes_3_text` (`hideGeom`) has no
 * `readSlots`-resolvable constraint of its own at all; only its visible `sp`
 * sibling `ThreeNodes_3` does, so visibility ordering reaches the same
 * member this rule already preferred. Among members that tie on visibility,
 * keep the pre-existing non-`sp`-first tiebreak. Merging also RECOVERS
 * geometry a text-only member lacks - dropping `sp` candidates outright (an
 * earlier, simpler version of this fix) lost that geometry along with the
 * duplicate, silently dropping the whole slot instead of just de-duplicating
 * it. A group with NO positioned member anywhere is dropped (matches the
 * pre-existing "no slot resolves -> no content" behaviour). A group born
 * from a multi-anchor forEach split (see `collectRawCandidates`) is sliced
 * within its shared container via {@link resolveIterationRect} instead of
 * resolved at the container's own full size.
 */
export function resolveGroupedSlots(
	candidates: RawSlotCandidate[],
	box: BoundingBox,
	index: ConstraintIndex,
): ChooseAwareSlot[] {
	const groups = new Map<string, RawSlotCandidate[]>();
	for (const candidate of candidates) {
		const key = contentSignature(candidate.content);
		const group = groups.get(key);
		if (group) {
			group.push(candidate);
		} else {
			groups.set(key, [candidate]);
		}
	}
	const out: ChooseAwareSlot[] = [];
	for (const group of groups.values()) {
		const ordered = [...group].sort((a, b) => {
			const aHidden = a.node.shape?.hideGeometry ? 1 : 0;
			const bHidden = b.node.shape?.hideGeometry ? 1 : 0;
			if (aHidden !== bHidden) {
				return aHidden - bHidden;
			}
			const aIsSp = a.node.algorithm?.type === 'sp' ? 1 : 0;
			const bIsSp = b.node.algorithm?.type === 'sp' ? 1 : 0;
			return aIsSp - bIsSp;
		});
		for (const candidate of ordered) {
			const [slotted] = readSlots(
				[candidate.node],
				box,
				index,
				candidate.declaringRoleChain ?? candidate.declaringRole,
			);
			if (slotted) {
				const rect = resolveIterationRect(
					slotted.dims,
					box,
					candidate.iteration,
					candidate.iterationCount,
				);
				out.push({
					rect,
					content: candidate.content,
					node: candidate.node,
					declaringRole: candidate.declaringRole,
				});
				break;
			}
		}
	}
	return out;
}
