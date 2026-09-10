/**
 * SmartArt DiagramML interpreter - cycle ring per-axis slack placement.
 *
 * Split out of `smartart-layout-interpreter-cycle-ring.ts` (the repo's
 * per-file line budget) - this is the single `resolveRingAxisOffset` helper,
 * kept in its own file with its own doc comment.
 *
 * Pure geometry; no framework code.
 */

/** Fraction of the axis's own natural span used as the "same extreme" tolerance when counting how many ring points reach an edge - see `resolveRingAxisOffset`'s own doc comment. */
const TIE_EPSILON_FRACTION = 1e-3;

/**
 * SESSION 16: a ring's slack on ONE axis is not always centred - live-COM
 * measurement (`radial-cycle--hier5.pptx`, a hub+3-satellite ring: 1
 * satellite alone at the top, 2 tied at the bottom) found the box's near
 * edge sitting FLUSH (measured top margin 0.17pt of a 400pt box) against
 * whichever side has the LONE satellite, with ALL the slack pushed to the
 * opposite (tied-satellite) side (measured bottom margin 52.68pt) - not
 * split evenly the way `ringLayoutForGapFactor`'s own centred formula
 * (unchanged before this session) assumed.
 *
 * The general rule this generalises to, verified against every existing
 * passing fixture before landing (see the call site's own comment): for a
 * `stAng`-rotated regular n-gon, whichever extreme (min or max) on an axis
 * is reached by FEWER satellites is the "lone" side and sits flush (zero
 * margin); the extreme reached by MORE satellites keeps the leftover slack.
 * When BOTH extremes are reached by the same count (`basic-cycle--
 * flat3.pptx`'s own hub-less n=3 ring on its OWN binding axis - content
 * fills 99.98% of the box height already, so there is no real slack either
 * way to distinguish the two models; `basic-radial--hier5.pptx`'s n=4 ring,
 * where a point sits at BOTH poles for an even n, genuinely IS 1-vs-1 on
 * both axes) this reduces to the ORIGINAL centred formula exactly - a
 * strict generalisation, not a special case.
 *
 * `values` are the RAW natural-space satellite centre coordinates on this
 * axis (not yet offset by the item's own half-extent). The caller's own
 * `centers` mapping is `(naturalCoord - low) * scale + offset` (already
 * `low`-relative before this function ever runs), so at the LOW extreme
 * (`naturalCoord===low`) the mapped position is simply `offset` - flush
 * there means `offset=0`, not a `low`-dependent term. `boundSize` is the
 * axis's own already-half-extent-adjusted span (`maxX-minX`/`maxY-minY`,
 * floored at `1e-6`).
 */
export function resolveRingAxisOffset(
	dimension: number,
	boundSize: number,
	scale: number,
	values: number[],
): number {
	const span = Math.max(1e-9, Math.max(...values) - Math.min(...values));
	const epsilon = span * TIE_EPSILON_FRACTION;
	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);
	const lowCount = values.filter((v) => v - minValue <= epsilon).length;
	const highCount = values.filter((v) => maxValue - v <= epsilon).length;
	if (lowCount < highCount) {
		// The lone satellite sits at the LOW extreme - flush it to the box's
		// own near edge (zero leading margin), all slack trailing.
		return 0;
	}
	if (highCount < lowCount) {
		// The lone satellite sits at the HIGH extreme - flush it to the box's
		// own far edge (zero trailing margin), all slack leading.
		return dimension - boundSize * scale;
	}
	// Tied (or a degenerate single-point ring): centre, matching the
	// pre-SESSION-16 formula exactly.
	return (dimension - boundSize * scale) / 2;
}
