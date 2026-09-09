/**
 * SmartArt DiagramML interpreter - pyramid (`pyra`) arranger.
 *
 * Stacks the data-model points as horizontal trapezoid bands forming a
 * triangle. Honours the `sibSp` gap constraint between bands.
 *
 * Also honours `dgm:param[@type=pyraLvlNode]` (COM-verified against real
 * PowerPoint's "Basic Pyramid": `ppt/diagrams/layout1.xml`'s root `dgm:alg
 * type="pyra"` carries `dgm:param type="pyraLvlNode" val="level"`, naming the
 * nested `dgm:layoutNode name="level"` that represents each band's own
 * shape). When that named node's own `dgm:constrLst` declares a `w`/`h`
 * ratio smaller than the full slot (a `fact`, or a sub-1 literal `val`, the
 * same convention every other ratio constraint in this interpreter uses),
 * the rendered band shrinks to that fraction of its slot, centred, leaving a
 * visible gap, so a hand-authored layout that narrows the level node's own
 * box actually narrows the band instead of always filling its slot. Real
 * "Basic Pyramid" declares `w val="1"` / `h val="500"` on `level`, neither of
 * which qualifies as a ratio (`500` is not less than `1`), so this is a
 * no-op there, verified byte-identical against the shipped layout via a COM
 * probe.
 *
 * ## `pyraAcctPos` (`dgm:param[@type=pyraAcctPos]`, `bef`/`aft`): NOT a
 * separate accent-box column
 *
 * A previous round of this interpreter modelled `pyraAcctPos` as "move this
 * band's text into a dedicated rect callout beside the band" (a
 * `bandX`/`acctX` two-column split), reasoning by analogy with the gallery's
 * "Pyramid List" variant. That model is WRONG, discovered by COM-verified
 * regression: of the 227-fixture gallery corpus, only `basic-pyramid` and
 * `inverted-pyramid` ever declare `pyraAcctPos` at all (grepped every
 * fixture's `layout1.xml`), and "Pyramid List" (`pyramid-list--*.pptx`)
 * does NOT use `dgm:alg type="pyra"` for its accent at all - it is a
 * `composite` of a single decorative `triangle` (`alg="sp"`, one static
 * shape, not per-item bands) beside a `lin`-arranged list of `roundRect`
 * items, structurally unrelated to this module. `basic-pyramid`/
 * `inverted-pyramid`'s cached ground truth for an accented row (a data
 * point with a child) is TWO TRAPEZOID shapes sharing one band's slot
 * (`trapezoid` for the point's own text, `nonIsoscelesTrapezoid` for the
 * child's), not a rect sidebar - a fundamentally different shape family from
 * the old column model, which produced a `rect` accent box that never
 * matched any real fixture's preset OR geometry.
 *
 * The real, per-item, child-driven accent split (populated only when a data
 * point HAS a child - `levelTx`/`acctTx`-named roles, `axis="self"`/`"des"`
 * respectively) is handled upstream by the item-roles module
 * (`smartart-layout-interpreter-item-role-stack.ts`'s `stackRoleContent`),
 * which resolves per-point role content against the real tree and produces,
 * per accented row, TWO polygon entries sharing the ORIGINAL (unsplit) band's
 * `points` - one tagged `itemRoleName` for the point's own text ("levelTx"),
 * one for the child's ("acctTx"). This arranger emits ONE plain trapezoid
 * band per top-level point (matching `basic-pyramid--flat3.pptx`'s all-leaf
 * dataset exactly, 0.12% residual) and takes no `pyraAcctPos` branch at all.
 *
 * ## `pyraAcctRatio` band-splitting geometry (COM-verified,
 *    `repositionPyramidBands`)
 *
 * `basic-pyramid`/`inverted-pyramid` also declare `pyraAcctRatio` (gated on
 * `func="maxDepth" op="gte" val="2"` - true whenever ANY point in the WHOLE
 * diagram has a child): once active, EVERY row's own "level" (self-role) band
 * shrinks uniformly to `(1 - pyraAcctRatio)` of its natural width - COM-
 * verified across all 3 rows of `basic-pyramid--hier5.pptx` (accented AND the
 * one unaccented row alike): each row's natural top/bottom x-coordinates,
 * scaled by this SAME factor anchored at the diagram box's own LEFT edge
 * (`scaledX = (1 - pyraAcctRatio) * naturalX`, in box-LOCAL coordinates where
 * the left edge is `x=0`), reproduce the cached "level" band's bounding box
 * to within rounding for every row (`Node One`/`Three`/`Four`, `pyraAcctRatio
 * =0.32`). The accent (`acctTx`, only present on a row with a child) then
 * fills the REMAINDER of that row's natural slot: its own top-left/bottom-
 * left corners are the level band's own (scaled) top-right/bottom-right
 * corners - the two bands share a slanted boundary - and its top-right/
 * bottom-right corners are both the diagram box's own right edge (flush,
 * vertical), matching the cached `nonIsoscelesTrapezoid` preset's own
 * asymmetric shape (one slanted side, one vertical). Both derivations
 * verified independently for all 3 rows of `basic-pyramid--hier5.pptx`
 * (COM-verified bounding-box match to within 1px on every one).
 *
 * `stackRoleContent` has no generic way to split a polygon's own `points`
 * (unlike a rect, which splits by height) - see `RenderedNodeIdentity.
 * itemRoleName`'s own doc comment - so `repositionPyramidBands` is the
 * arranger-specific geometry pass that module's doc comment calls for,
 * applied as a POST-PASS after `expandResultItemRoles` (keyed by
 * `itemRoleName` and `nodeId`, not by re-deriving anything `stackRoleContent`
 * itself decided) rather than folded into `arrangePyramid` itself, so it
 * never double-splits a row `stackRoleContent` already left alone (a row
 * with no child keeps its single, unsplit entry - `itemRoleName` stays
 * `undefined` - but STILL needs the same `pyraAcctRatio` width shrink, since
 * the ratio is diagram-wide, not per-row).
 *
 * Pure geometry; no framework code.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode, SmartArtStyle } from '../types';
import { resolveRatioConstraint } from './smartart-constraint-ratio-fallback';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX, roleOf } from './smartart-constraint-solver';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { algorithmParam } from './smartart-layout-interpreter-model';
import { polygonNode, styleContext } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

// COM-verified against "Basic Pyramid" (`basic-pyramid--flat3.pptx`, no
// `sibSp` declared on the `pyra` layout node): the stack of bands fills the
// FULL diagram box edge-to-edge, zero outer margin and zero inter-band gap
// (cached `dsp:sp` bands are `h = box.height / n` stacked with no space
// between them, and the widest band's `w` equals the box width exactly). Both
// are ratio constraints (`sibSp`/`sp`, and a margin-shaped constraint if one
// existed) that `resolveRatioConstraint` picks up when a real layout declares
// them; the literal here is only the "declares nothing" fallback.
export const DEFAULT_GAP_RATIO = 0;
export const DEFAULT_INSET = 0;

/** Depth-first search of an arranger's item-template subtree for a `dgm:layoutNode` by name. */
function findNamedNode(
	node: PptxSmartArtLayoutNode,
	name: string,
): PptxSmartArtLayoutNode | undefined {
	if (node.name === name) {
		return node;
	}
	for (const child of node.children ?? []) {
		const found = findNamedNode(child, name);
		if (found) {
			return found;
		}
	}
	return undefined;
}

/** Execute the `pyra` algorithm: stacked trapezoid bands (apex at top). */
export function arrangePyramid(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	const n = nodes.length;
	const bandW = w - DEFAULT_INSET * 2;
	const bandCx = DEFAULT_INSET + bandW / 2;
	const gapRatio = resolveRatioConstraint(
		plan.node.constraints,
		index,
		roleOf(plan.node),
		['sibSp', 'sp'],
		DEFAULT_GAP_RATIO,
	);
	const usableH = h - DEFAULT_INSET * 2;
	const bandH = n > 0 ? usableH / (n + Math.max(0, n - 1) * gapRatio) : usableH;
	const gap = gapRatio * bandH;

	// `pyraLvlNode` names the item-template's own band shape; when it declares a
	// sub-1 w/h ratio for itself, the band should honour that instead of always
	// filling its slot (see module doc comment). `1` (full slot) when absent or
	// when the named node's own constraint isn't a ratio, so real "Basic
	// Pyramid" (w=1, h=500) renders exactly as before.
	const lvlNodeName = algorithmParam(plan.node, 'pyraLvlNode');
	const lvlNode = lvlNodeName ? findNamedNode(plan.node, lvlNodeName) : undefined;
	const lvlWidthRatio = lvlNode
		? resolveRatioConstraint(lvlNode.constraints, index, roleOf(lvlNode), ['w'], 1)
		: 1;
	const lvlHeightRatio = lvlNode
		? resolveRatioConstraint(lvlNode.constraints, index, roleOf(lvlNode), ['h'], 1)
		: 1;
	// `linDir="fromT"` ("inverted-pyramid": the apex points DOWN, widest band on
	// TOP) vs the common `"fromB"` (apex UP, widest band on the bottom, "Basic
	// Pyramid" itself) - COM-verified against `inverted-pyramid--hier5.pptx`:
	// its own topmost row (`i=0`) is the WIDEST cached band, the exact mirror
	// of `basic-pyramid`'s own `i=0` (narrowest, the apex). Reusing `linDir`
	// (the same param name `lin`/`snake` already read for flow direction) is
	// the genuine ECMA declarative signal, not a per-fixture-name guess.
	const inverted = algorithmParam(plan.node, 'linDir') === 'fromT';

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const slotTop = DEFAULT_INSET + i * (bandH + gap);
		const slotBot = slotTop + bandH;
		const slotMidY = (slotTop + slotBot) / 2;
		const halfBandH = ((slotBot - slotTop) * lvlHeightRatio) / 2;
		const yTop = slotMidY - halfBandH;
		const yBot = slotMidY + halfBandH;
		const effectiveI = inverted ? n - 1 - i : i;
		const fTop = effectiveI / n;
		const fBot = (effectiveI + 1) / n;
		const halfTop = ((bandW * fTop) / 2) * lvlWidthRatio;
		const halfBot = ((bandW * fBot) / 2) * lvlWidthRatio;
		const points = [
			`${bandCx - halfTop},${yTop}`,
			`${bandCx + halfTop},${yTop}`,
			`${bandCx + halfBot},${yBot}`,
			`${bandCx - halfBot},${yBot}`,
		].join(' ');
		return polygonNode({
			key: `${elementId}-pyra-${node.id}-${i}`,
			points,
			textX: bandCx,
			textY: (yTop + yBot) / 2,
			fontWidth: Math.max(20, halfBot * 1.4),
			fontHeight: bandH,
			node,
			index: i,
			total: n,
			palette,
			style,
			ctx,
		});
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'pyramid',
	};
}
