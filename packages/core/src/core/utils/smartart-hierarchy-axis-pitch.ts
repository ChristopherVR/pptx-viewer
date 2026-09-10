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
	cascadeReserveOffsetPx?: number,
): HierarchyAxisPitches {
	// SESSION 28: the generation-axis mirror of `compositeFanPitch`'s own
	// `compositeW` substitution - when the layout's own "parent-relative"
	// composite shape means the WRAPPING cell's own height genuinely differs
	// from the rendered item's height (`compositeHeightFactor` defined, e.g.
	// `half-circle-organization-chart`), the `tailed`-mode row-to-row PITCH
	// must use the composite cell's own (larger) height, not the smaller
	// rendered item's - `undefined`/non-`tailed` leaves this identical to
	// `boxH` (byte-for-byte unchanged): `std` mode already has its OWN,
	// different composite correction for this same distinction
	// (`resolveGenerationGapRatio`'s own `compositeChild`-aware branch) -
	// applying BOTH double-corrects (measured regression:
	// `circle-picture-hierarchy--hier5.pptx`, `std` mode, `heightFactor`
	// defined via the SAME "parent-relative" shape, 3.38% -> 18.57%). See
	// `smartart-hierarchy-composite-child.ts`'s own `heightFactor` doc comment.
	const generationItemSize =
		tailedPitch && orientation.compositeHeightFactor
			? boxH / orientation.compositeHeightFactor
			: boxH;
	// SESSION 30: `GENERATION_MARGIN_RATIO` is a fixed leading-margin BIAS
	// compensating for the "Hierarchy"-family `composite` wrapper's own
	// decorative "3D card" shell (see this module's own doc comment) - it is
	// COM-verified correct whenever that shell exists (`hierarchy--
	// {flat3,hier5,hier8}.pptx`, `compositeWidthFactor` defined) AND for
	// `tailedPitch` (org-chart family, no such shell but a different,
	// independently-verified shape - see `smartart-hierarchy-axis-pitch.test.ts`'s
	// own non-transposed-tailed case). It does NOT generalise to a `std`-mode
	// layout with NO declared `composite` wrapper at all
	// (`compositeWidthFactor===undefined`, "level1Shape direct" - SESSION 21's
	// own naming): `labeled-hierarchy--hier5.pptx`'s own cached root sits
	// FLUSH against the generation axis's leading edge (local `y=0`), not
	// biased down by this margin - applying it anyway put the root ~29px
	// (5.44% of the 533-tall diagram) below where PowerPoint renders it.
	// Solving the SAME centred-pitch equation backward from the fixture's own
	// cached row centres (COM-verified: local `y=0/197/393`, i.e. flush) shows
	// `margin=0` is the exact value that reproduces a flush root, not a
	// smaller nonzero bias - not just "closer to zero". Scoped narrowly (only
	// `!tailedPitch && compositeWidthFactor===undefined`): `circle-picture-
	// hierarchy--hier5.pptx` (the OTHER "std", no-outer-margin-style fixture
	// with a small residual) still declares its OWN `composite` wrapper
	// (`compositeWidthFactor=0.6`), so this condition leaves it untouched -
	// confirmed via a full corpus regen, not just this fixture's own number.
	//
	// SESSION 31: the `tailedPitch` half of that same margin ALSO does not
	// generalise to a tailed (org-chart-family) tree with NO hanging tail at
	// all (`hangShape.maxHangDepth===0`, a purely-fanned tree that never
	// escapes the fan into `placeHangingForest`'s own separate mechanism -
	// see `smartart-hierarchy-hang-depth.ts`'s `computeHangShape`):
	// `organization-chart--flat3.pptx` (1 root + 2 fanned children, no
	// deeper generation) is the ONLY built-in-gallery fixture with this exact
	// shape (`mode==='tailed' && maxHangDepth===0` - every other org-chart-
	// family fixture checked has a real hang, `maxHangDepth>=1`, and keeps
	// the existing nonzero margin unaffected). Per-shape diagnostic showed
	// BOTH rows (root AND the fanned children) shifted uniformly `+16px`
	// (3.0% of the 533-tall diagram) too far down, with `w`/`h` already
	// exact - the signature of a pure `yPitch.shift` error, not a pitch or
	// size bug. Solving `computeAxisPitch`'s own centred-shift equation
	// backward from the fixture's cached local row centres (`128`/`406`,
	// `pitch=278.5` matching this fixture's OWN un-margined pitch almost
	// exactly) gives `margin=~1.5` (effectively `0`, not the ~33px
	// `boxH*GENERATION_MARGIN_RATIO` the un-scoped condition was applying) -
	// COM-verified via the fixture's own cached geometry, not guessed.
	const noHangTailed = tailedPitch && hangShape.maxHangDepth === 0;
	const generationMargin =
		orientation.transposed ||
		(!tailedPitch && orientation.compositeWidthFactor === undefined) ||
		noHangTailed
			? 0
			: boxH * GENERATION_MARGIN_RATIO;
	// SESSION 30: when the declared cascade shape is active
	// (`cascadeReserveOffsetPx` defined - see `smartart-hierarchy-cascade.ts`),
	// the row past the fan no longer sits in an INDENTED hanging column at
	// all - `placeAt` routes it through the SAME fanned-row placer as every
	// other generation, nudged right by `cascadeOffsetX`'s own fixed
	// `alignOff`-derived pixel amount instead. The fan axis must reserve room
	// for THAT nudge, not the (now-unused for this shape) `HIER_TAIL_OFFSET_
	// RATIO` indent reservation the plain hanging-tail model needs - reusing
	// the indent term here left the fan row centred ~56px (6.5% of the
	// diagram width) too far right on `half-circle-organization-chart--
	// hier5.pptx`, uniformly across every generation (root included, since
	// this feeds `xPitch.shift`, applied to the WHOLE result via
	// `translateResult`) - COM-verified fix, not a per-layout special case:
	// `cascadeReserveOffsetPx` is `undefined` for every fixture that doesn't
	// declare this construct, leaving `fanWidth` byte-identical to before.
	const fanWidth = tailedPitch
		? effectiveBox.width -
			(cascadeReserveOffsetPx ?? hangShape.maxHangDepth * HIER_TAIL_OFFSET_RATIO * boxW)
		: effectiveBox.width;
	// See `HierarchyOrientation.hangHeightRatio`'s own doc comment (SESSION
	// 25/32): the SAME per-hang-row height reservation this pitch makes must
	// use the SAME ratio that sized `boxH` (`fitItemBox`) and positioned the
	// hang transition (`smartart-hierarchy-standard.ts`) in the first place -
	// all three consume `orientation.hangHeightRatio` (falling back to the
	// fixed `HANG_HEIGHT_RATIO` only for the rare compound-text-role shape
	// that field itself is `undefined` for), or the reservation this function
	// makes disagrees with the size/position `fitItemBox`/`placeAt` actually
	// used (measured regression when left on the OLD, always-fixed
	// `HANG_HEIGHT_RATIO`: `organization-chart--hier5.pptx`/
	// `picture-organization-chart--hier5.pptx` 1.27% -> 3.38%, worse, not
	// better; and, pre-SESSION-32, a transposed tailed hang (e.g. "Horizontal
	// Organization Chart") over-reserved room using the fixed ratio against a
	// `boxH` that was itself already grown by `generationGapRatio` instead -
	// measured regression, root's own fanned children row landing 89px/10.3%
	// short of cached).
	const hangHeightRatio = orientation.hangHeightRatio ?? HANG_HEIGHT_RATIO;
	const fanHeight = tailedPitch
		? effectiveBox.height - hangShape.maxHangRows * (1 + hangHeightRatio) * boxH
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
		generationItemSize,
		depth,
		fixedGenerationGapRatio,
	);
	return { xPitch, yPitch };
}
