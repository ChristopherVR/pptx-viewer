/**
 * SmartArt DiagramML interpreter - hierarchy fan/generation axis pitch.
 *
 * Split out of `smartart-layout-interpreter-hierarchy.ts` (the file-size
 * budget): the `cellW`/`cellH` derivation itself (`compositeFanPitch`/
 * `computeAxisPitch` wiring), alongside the doc comments explaining WHY the
 * two axes use genuinely different models. `cellW`/`cellH` as a naive
 * `dimension/count` split distributes leftover space EQUALLY on both ends
 * ("space-around"); real PowerPoint treats the two axes DIFFERENTLY instead:
 * generation axis - fixed leading margin (top), trailing edge flush against
 * the far box edge; fan axis - CENTRED (no margin, a fixed `sibSp` gap,
 * slack split evenly). `pitch` plugs in as `cellW`/`cellH`; `shift` corrects
 * the position afterwards via `translateResult`.
 *
 * Pure geometry; no framework code, no DOM.
 */

import type { HierarchyHangShape } from './smartart-hierarchy-hang-depth';
import type { HierarchyOrientation } from './smartart-hierarchy-orientation';
import type { AxisPitch } from './smartart-hierarchy-pitch';
import {
	compositeFanPitch,
	computeAxisPitch,
	GENERATION_MARGIN_RATIO,
} from './smartart-hierarchy-pitch';
import { HANG_HEIGHT_RATIO, HIER_TAIL_OFFSET_RATIO } from './smartart-hierarchy-shared';
import type { BoundingBox } from './smartart-layout-types';

export interface HierarchyAxisPitches {
	xPitch: AxisPitch;
	yPitch: AxisPitch;
}

/**
 * Resolve the fan-axis (`x`) and generation-axis (`y`) pitch/shift together.
 *
 * A TRANSPOSED hierarchy needs no GENERATION-axis leading margin (its item
 * size already fills the box edge-to-edge, so a nonzero margin double-counts
 * space that was never there - measured regression:
 * `horizontal-hierarchy--flat3.pptx`'s root rendered 61px off the box's left
 * edge instead of flush). `tailed` mode: a pitch fill against the WHOLE
 * `effectiveBox` assumes `totalLeaves`/`depth` items genuinely span it -
 * true for `std` (every generation fans), false here (only
 * `fannedGenerations` rows fan; the REST is reserved for the hanging tail
 * via its own separate `vGap`/indent mechanism, already sized via
 * `fitItemBox`'s own `maxHangDepth` term). Filling the WHOLE box using only
 * the fanned count double-reserves that space as one giant inter-row gap
 * (COM-verified regression: `organization-chart--hier5.pptx`'s own
 * generation-1 row rendered ~200px too far down) - scoped to just the
 * FAN-share instead. `fanHeight` reserves `maxHangRows` rows (the tallest
 * hanging branch's own ROW count, not `maxHangDepth`'s hop count - see
 * `HierarchyHangShape.maxHangRows`'s doc comment in `smartart-hierarchy-
 * hang-depth.ts`), matching `fitItemBox`'s own height-axis term.
 *
 * The FAN axis is CENTRED (`compositeFanPitch`), not a leading-margin/
 * trailing-flush pack (`compositeWidthFactor` is `undefined` for
 * `tailedPitch` mode: org-chart's own `rootText1` is never shrunk relative
 * to its own composite wrapper - see `smartart-hierarchy-composite-
 * child.ts`). Used UNCONDITIONALLY for `tailedPitch` too: empirically
 * byte-identical to the OLD `computeAxisPitch(fanWidth, 0, boxW,
 * totalLeaves)` fill-exactly formula across all 7 org-chart-family fixtures
 * - a real equivalence, not a guess; the remaining org-chart residual is
 * therefore NOT a fan-axis bug, see `smartart-track-r-successor.md`'s own
 * SESSION 9.
 *
 * `orientation.generationGapRatio` (COM-verified fixed ratio - see
 * `smartart-hierarchy-generation-gap.ts`) replaces the OLD "solve to fill
 * the box" GENERATION-axis gap ONLY for plain, non-transposed, non-tailed
 * "Hierarchy": `transposed`/`tailed` are unchanged, not yet re-measured
 * against this same fixed-vs-solved distinction (see `smartart-track-r-
 * successor.md`'s SESSION 10).
 */
export function computeHierarchyAxisPitches(
	effectiveBox: BoundingBox,
	orientation: HierarchyOrientation,
	boxW: number,
	boxH: number,
	totalLeaves: number,
	depth: number,
	hangShape: HierarchyHangShape,
	tailedPitch: boolean,
): HierarchyAxisPitches {
	const generationMargin = orientation.transposed ? 0 : boxH * GENERATION_MARGIN_RATIO;
	const fanWidth = tailedPitch
		? effectiveBox.width - hangShape.maxHangDepth * HIER_TAIL_OFFSET_RATIO * boxW
		: effectiveBox.width;
	const fanHeight = tailedPitch
		? effectiveBox.height - hangShape.maxHangRows * (1 + HANG_HEIGHT_RATIO) * boxH
		: effectiveBox.height;
	const xPitch = compositeFanPitch(
		fanWidth,
		boxW,
		orientation.compositeWidthFactor,
		orientation.cardOffsetXRatio,
		orientation.sibSpRatio,
		totalLeaves,
	);
	const fixedGenerationGapRatio = orientation.transposed
		? undefined
		: tailedPitch
			? orientation.generationGapRatio
			: orientation.compositeGenerationGapRatio;
	const yPitch = computeAxisPitch(
		fanHeight,
		generationMargin,
		boxH,
		depth,
		fixedGenerationGapRatio,
	);
	return { xPitch, yPitch };
}
