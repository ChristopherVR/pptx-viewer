/**
 * SmartArt DiagramML interpreter - the declared "cascade" hierarchy shape
 * (SESSION 28).
 *
 * Split out of `smartart-layout-interpreter-hierarchy.ts` (the file-size
 * budget): `half-circle-organization-chart`/`name-and-title-organization-
 * chart` declare a `composite` wrapper whose own height genuinely differs
 * from the rendered item's (`orientation.compositeHeightFactor`, `smartart-
 * hierarchy-orientation.ts`) AND a `sp` (generation gap) relative to that
 * SAME composite width - together, the layout's own declared constraints
 * describe an EVEN, box-filling cascade across every generation (root,
 * fanned children, and the row past that), not a fanned-row-plus-
 * independent-hanging-tail shape: local-coordinate analysis of `half-circle-
 * organization-chart--hier5.pptx`'s own cached `dsp:sp` geometry (867x533
 * box, `Node One`/`Two`+`Three`/`Four`+`Five`) shows THREE rows an equal
 * ~197px pitch apart, spanning almost the full box height with zero
 * leading/trailing margin - not the smaller, independently-sized
 * `HANG_HEIGHT_RATIO` gap `placeAt`'s `hangingPlacer` branch applies to
 * every other `tailed` layout, and a FIXED `alignOff`-driven rightward
 * nudge (`dgm:constr type="alignOff" val="0.65"`, declared identically on
 * every `hierRoot` branch past the root itself) for the row past the fan,
 * not the mirrored per-branch-direction indent `HIER_TAIL_OFFSET_RATIO`
 * models for every other `tailed` layout.
 *
 * Detected structurally (`compositeHeightFactor` only exists for this
 * declared shape, corpus-checked to be unique to these two fixtures), not by
 * layout name: reusing the SAME `cellH` pitch for the row past the fan
 * (instead of routing it through `hangingPlacer`), plus the fixed rightward
 * nudge, reproduces `half-circle-organization-chart--hier5.pptx`'s own
 * geometry to within measurement rounding (full corpus regen:
 * `maxDeltaFraction` 0.0844 -> 0.0646, zero regressions elsewhere -
 * `name-and-title-organization-chart--hier5.pptx` itself never actually
 * engages `heightFactor`/this plan, see `smartart-hierarchy-composite-
 * child.ts`'s own `hasCompoundTextRole` guard).
 *
 * Pure geometry/decision logic; no framework code, no DOM.
 */

import type { HierarchyHangShape } from './smartart-hierarchy-hang-depth';
import type { HierarchyOrientation } from './smartart-hierarchy-orientation';

/** `dgm:constr type="alignOff" val="0.65"` - see the module doc comment. */
const CASCADE_ALIGN_OFF_RATIO = 0.65;

export interface CascadePlan {
	/** True only for the declared cascade shape - every other layout is unaffected. */
	active: boolean;
	/** `depth` for `computeHierarchyAxisPitches`: the row past the fan counts as its own generation when `active`. */
	pitchDepth: number;
	/** `hangShape` for `computeHierarchyAxisPitches`: no separate hang-row reservation when `active` (the row past the fan is a NORMAL pitch row). */
	pitchHangShape: HierarchyHangShape;
	/** `StandardOptions.cascadeOffsetX` - `undefined` when not `active`. */
	cascadeOffsetX?: { fromLevel: number; offsetPx: number };
}

/**
 * Resolve whether the declared cascade shape applies, and every value its
 * two call sites (`computeHierarchyAxisPitches`, `StandardOptions`) need.
 */
export function resolveCascadePlan(
	mode: 'std' | 'tailed' | 'hanging',
	orientation: HierarchyOrientation,
	depth: number,
	hangShape: HierarchyHangShape,
	boxW: number,
): CascadePlan {
	const active = mode === 'tailed' && orientation.compositeHeightFactor !== undefined;
	if (!active) {
		return { active, pitchDepth: depth, pitchHangShape: hangShape };
	}
	return {
		active,
		pitchDepth: depth + hangShape.maxHangRows,
		pitchHangShape: { ...hangShape, maxHangRows: 0 },
		cascadeOffsetX: {
			fromLevel: depth,
			offsetPx: (boxW / (orientation.compositeWidthFactor ?? 1)) * CASCADE_ALIGN_OFF_RATIO,
		},
	};
}
