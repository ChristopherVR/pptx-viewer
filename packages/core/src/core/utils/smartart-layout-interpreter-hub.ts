/**
 * SmartArt DiagramML interpreter - "hub + satellites" arranger substitution.
 *
 * A radial/composite layout (`radial-cycle`, `basic-radial`, `balance`,
 * `vertical-circle-list`) whose driving `dgm:forEach` selects a SINGLE point
 * (`cnt="1"`, or simply having one root) is not arranging that one point as
 * its only content - the point is a HUB, and a NESTED `dgm:forEach
 * axis="ch"` inside the SAME driving iterator's raw body actually arranges
 * the hub's OWN children (`nestedLayoutNodes` in `smartart-layout-
 * definition.ts` flattens that nested forEach's item templates onto the
 * SAME `.children` array as the hub's own template - it does not model
 * iteration-scope boundaries - so a raw-XML check is the only way to tell
 * "these siblings are additional roles of the SAME point"
 * (`smartart-layout-interpreter-item-roles.ts`'s `resolveItemTextRoles`)
 * apart from "these REPEAT once per the point's own child" (this module)).
 * Split out of `smartart-layout-interpreter.ts` to keep that file under the
 * repo's per-file line budget.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode, SmartArtStyle } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { foldedDescendantTexts } from './smartart-interpreter-drawing-bridge';
import {
	computeCycleRingLayout,
	resolveCycleRingParams,
} from './smartart-layout-interpreter-cycle';
import { arrangerRepeatsChildTemplate } from './smartart-layout-interpreter-hub-detect';
import { itemNode, numericParam } from './smartart-layout-interpreter-model';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';
import { roundRectCornerInsetPx } from './smartart-layout-shape-preset';
import type { BoundingBox, RenderedNode } from './smartart-layout-types';

/** The hub point plus the satellites its nested `axis="ch"` forEach actually arranges. */
export interface HubExpansion {
	hubNode: PptxSmartArtNode;
	satellites: PptxSmartArtNode[];
}

/**
 * Detect the hub pattern for this arranger's already-selected `arranged`
 * list: exactly one point was selected, its OWN driving forEach repeats a
 * child template, and it genuinely has children to repeat that template
 * over. Returns `undefined` (keep `arranged` as-is) otherwise - the common
 * case, and the safe degradation when a diagram matches the `cnt="1"`/single
 * -root shape without ALSO nesting a child-repeating forEach (an ordinary
 * one-point diagram).
 */
export function detectHubExpansion(
	arranger: PptxSmartArtLayoutNode,
	arranged: PptxSmartArtNode[],
	childrenOf: Map<string, PptxSmartArtNode[]>,
): HubExpansion | undefined {
	if (arranged.length !== 1 || !arrangerRepeatsChildTemplate(arranger)) {
		return undefined;
	}
	const hubNode = arranged[0];
	const satellites = childrenOf.get(hubNode.id) ?? [];
	return satellites.length > 0 ? { hubNode, satellites } : undefined;
}

/**
 * Build the hub's own box. When `arranger` is a `cycle` algorithm (every
 * genuine gallery hub layout - `radial-cycle`, `basic-radial`,
 * `diverging-radial`, `converging-radial`, `radial-venn` - the hub is the
 * `ctrShpMap="fNode"` node of a `cycle` alg), this reuses
 * `smartart-layout-interpreter-cycle.ts`'s own ring-fitting geometry
 * (`computeCycleRingLayout`) with `satelliteCount` ring nodes for the ring's
 * own centre/scale, then sizes the hub from `resolveCycleRingParams`'s
 * `hubRatio` (`node.w = fact * centerShape.w`, DECLARED directly in the
 * composite's own `constrLst` - see that function's doc comment) when
 * present: the hub's natural (pre-scale) width is `1 / fact` in the SAME
 * unit space the ring item's own natural width (fixed at 1) already uses,
 * so its SCALED half-extents are `(1/fact)/2 * scaleX` /
 * `(1/fact)/2 * scaleY`, reusing the ring's own already-solved
 * `scaleX (= ring.nodeWidth)` / `scaleY (= ring.nodeHeight /
 * heightOverWidth)` - no separate geometric guess needed. Falls back to the
 * ring's own "largest ellipse that clears every ring node" computation
 * (`hubHalfWidth`/`hubHalfHeight`) when no such declared ratio is found, and
 * to the previous coarse `0.3x`-of-the-smaller-box-dimension placeholder for
 * every other hub-bearing algorithm (`balance`, `vertical-circle-list`),
 * which this module does not have per-family geometry for.
 */
export function buildHubRenderedNode(
	arranger: PptxSmartArtLayoutNode,
	hubNode: PptxSmartArtNode,
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	satelliteCount = 0,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
	childrenOf?: Map<string, PptxSmartArtNode[]>,
	fontName?: string,
): RenderedNode {
	const item = itemNode(arranger);
	if (arranger.algorithm?.type === 'cycle' && satelliteCount > 0) {
		const startDeg = numericParam(arranger, 'stAng', 0);
		const spanDeg = numericParam(arranger, 'spanAng', 360);
		// A hub-bearing ring never ALSO nests a hub of its own, so `ctrShpMap`
		// never applies recursively here - `satelliteCount` is already the
		// ring's own node count.
		const {
			minGapRatio,
			heightOverWidth,
			absoluteGapPx,
			hubRatio,
			hubGapRatio,
			sibTransBulgeRatio,
		} = resolveCycleRingParams(arranger, index, satelliteCount);
		// Same `hubGeometry` `r0` correction `arrangeCycle` applies to the
		// satellites themselves (see `computeCycleRingLayout`'s own doc
		// comment) - without it here too, the hub's own centre/scale would be
		// solved from the OLD, too-small chord-only `r0`, landing it at a
		// different point than where the satellites (solved with the
		// corrected `r0`) actually ring around.
		const hubGeometry =
			hubRatio && hubGapRatio !== undefined
				? { factor: hubRatio.factor, gapRatio: hubGapRatio }
				: undefined;
		const ring = computeCycleRingLayout(
			satelliteCount,
			startDeg,
			spanDeg,
			minGapRatio,
			heightOverWidth,
			box,
			absoluteGapPx,
			hubGeometry,
			undefined,
			sibTransBulgeRatio,
		);
		let width = Math.max(1, ring.hubHalfWidth * 2);
		let height = Math.max(1, ring.hubHalfHeight * 2);
		if (hubRatio) {
			const scaleX = ring.nodeWidth;
			const scaleY = heightOverWidth > 0 ? ring.nodeHeight / heightOverWidth : ring.nodeHeight;
			const naturalHubDiam = 1 / hubRatio.factor;
			width = Math.max(1, naturalHubDiam * scaleX);
			height = Math.max(1, naturalHubDiam * scaleY);
		}
		// Round 36: this branch used to hand no `fontSizeOverride` to
		// `presetBoxNode` at all, so every hub fell through that helper's own
		// crude, un-derived per-box heuristic (capped ~12px) regardless of the
		// diagram's real declared `primFontSz` - the SAME gap `smartart-layout-
		// interpreter-cycle-fontfit.ts`'s module doc comment describes round 18
		// closing for the RING items, just never wired for the hub (which is
		// built HERE, via `detectHubExpansion`, before `arrangeCycle` ever sees a
		// hub-stripped node list - `arrangeCycle`'s own `buildCycleHubBox` hub-
		// font branch is unreachable for every genuine gallery hub fixture). A
		// corpus-wide scan of every hub-bearing cycle fixture's cached drawing
		// (`l36-hub-font-scan.ts`, scratchpad) shows the hub's real font size is
		// ALWAYS fit to ITS OWN (usually much bigger) box, independently of the
		// ring items' shared size - fits the SAME shared tiered fitter
		// `arrangeCycle`'s ring items already use, against the hub's own box only.
		const cornerInsetPx = roundRectCornerInsetPx(item?.shape, width, height);
		const descendantTexts = childrenOf
			? foldedDescendantTexts(hubNode, new Set([hubNode.id]), childrenOf)
			: [];
		const { rootSizePx, descendantSizePx } = resolveTieredItemFontSize(
			{ kind: 'cycle', node: arranger },
			index,
			[{ rootText: hubNode.text, descendantTexts, width, height }],
			fontName,
			undefined,
			cornerInsetPx,
		);
		return presetBoxNode({
			key: `${elementId}-hub-${hubNode.id}`,
			x: ring.hubCenter.x - width / 2,
			y: ring.hubCenter.y - height / 2,
			width,
			height,
			node: hubNode,
			index: 0,
			total: 1,
			palette,
			style,
			ctx: styleContext(style),
			shape: item?.shape,
			fallbackKind: 'circle',
			preserveEllipseAspect: true,
			fontSizeOverride: rootSizePx,
			descendantFontSize: descendantSizePx,
		});
	}
	// Coarse, centred placeholder for a non-`cycle` hub-bearing algorithm
	// (`balance`, `vertical-circle-list`): sized as a fraction of the whole
	// diagram box, using the arranger's own item template's `dgm:shape`
	// override (`centerShape`'s `ellipse`, ...) when present.
	const size = Math.min(box.width, box.height) * 0.3;
	return presetBoxNode({
		key: `${elementId}-hub-${hubNode.id}`,
		x: (box.width - size) / 2,
		y: (box.height - size) / 2,
		width: size,
		height: size,
		node: hubNode,
		index: 0,
		total: 1,
		palette,
		style,
		ctx: styleContext(style),
		shape: item?.shape,
		fallbackKind: 'circle',
	});
}
