/**
 * The two halves of an in-place cross-dissolve, paired so a binding can
 * composite them the way PowerPoint composites them: ADDITIVELY.
 *
 * ## Why stacking two fades is not a cross-dissolve
 *
 * A morph dissolves a pair by painting the outgoing half at `1 - t` over the
 * incoming half at `t`. With ordinary (source-over) blending that is not the
 * blend PowerPoint performs. Where BOTH halves paint ink on the same pixel the
 * result is
 *
 * ```
 * bg + (1 - t)(A - bg) + t(A' - bg - (1 - t)(A - bg))  =>  1 - t + t^2
 * ```
 *
 * of the way to full strength instead of all the way: 0.75 at the midpoint. The
 * ink dips toward the backdrop exactly where the two halves agree, so glyphs
 * that cross each other during a text dissolve are painted with dark bites
 * taken out of them, and the wording looks like it is deforming.
 *
 * Measured against PowerPoint 16's own render of the wheel deck's slide 7 -> 8
 * (`CreateVideo`, fitted per frame to `c0 * A + c1 * B` over the centre panel):
 * PowerPoint holds `c0 + c1` at 1.000-1.003 for every frame of the transition,
 * while ours summed to 0.963, and pixels where both slides paint a glyph were
 * 34.6/255 too dark on average (worst 54.9). Issue #161.
 *
 * ## The fix
 *
 * Put both halves in one isolated group and blend them with `plus-lighter`,
 * which sums their PREMULTIPLIED contributions: `(1 - t) A + t B`, a true
 * cross-dissolve. The group is what makes it correct - `plus-lighter` against
 * the backdrop at large would also sum the disc, artwork or slide background
 * underneath and paint the non-overlapping half too BRIGHT by `alpha * backdrop`.
 * Isolating the pair keeps the sum to the two halves and then composites that
 * result over the backdrop normally. It is the same construction CSS view
 * transitions use for their default cross-fade.
 *
 * Only a pair whose halves are BOTH painted in the overlay can be grouped: the
 * incoming half of most pairs animates on the live stage, in a different DOM
 * tree, and moving every one of them into the overlay would change the whole
 * transition's z-order (the failure mode issues #144 / #146 came from). The
 * pairs that qualify are the ones the overlay already lifted, which is the case
 * this was reported for - wording dissolving inside an unchanged opaque shape.
 *
 * @module render/morph-crossfade-group
 */
import type { PptxElement } from 'pptx-viewer-core';

import type { MorphPair } from './morph-types';

/** A matched pair whose two halves are both painted by the overlay. */
export interface MorphCrossfadeGroup {
	/** The outgoing (ghost) half, rendered in the OUTGOING slide's context. */
	outgoing: PptxElement;
	/** The incoming half, rendered in the INCOMING slide's context. */
	incoming: PptxElement;
}

/**
 * The container both halves go in.
 *
 * `isolation: isolate` is the load-bearing part: it confines
 * {@link MORPH_CROSSFADE_HALF_BLEND_MODE} to the pair. The box spans the slide
 * because each half is positioned within the slide's own coordinate space.
 */
export const MORPH_CROSSFADE_GROUP_STYLE = {
	position: 'absolute',
	inset: '0',
	isolation: 'isolate',
} as const;

/** {@link MORPH_CROSSFADE_GROUP_STYLE} as a `style` attribute value. */
export const MORPH_CROSSFADE_GROUP_CSS_TEXT = 'position: absolute; inset: 0; isolation: isolate;';

/** The blend each half of a grouped pair is painted with. */
export const MORPH_CROSSFADE_HALF_BLEND_MODE = 'plus-lighter' as const;

/** A half's own box: it fills the group, and blends with the other half only. */
export const MORPH_CROSSFADE_HALF_STYLE = {
	position: 'absolute',
	inset: '0',
	mixBlendMode: MORPH_CROSSFADE_HALF_BLEND_MODE,
} as const;

/** {@link MORPH_CROSSFADE_HALF_STYLE} as a `style` attribute value. */
export const MORPH_CROSSFADE_HALF_CSS_TEXT = `position: absolute; inset: 0; mix-blend-mode: ${MORPH_CROSSFADE_HALF_BLEND_MODE};`;

/**
 * Pair up the crossfades the overlay paints both halves of.
 *
 * @param pairs - The matched pairs.
 * @param ghostIds - Outgoing ids the overlay paints (see `resolveMorphGhostIds`).
 * @param liftedIds - Incoming ids the overlay paints above those ghosts (see
 *   `resolveMorphOverlayArrivals`). Only a LIFTED half is in the same tree as
 *   its ghost, so only these can be grouped.
 * @param incomingOrder - The incoming slide's elements, flattened, in document
 *   order; the groups come back in that order so the overlay paints them in the
 *   order the slide stacks them.
 * @returns One group per qualifying pair; empty when none qualify.
 */
export function resolveMorphCrossfadeGroups(
	pairs: readonly MorphPair[],
	ghostIds: ReadonlySet<string>,
	liftedIds: ReadonlySet<string>,
	incomingOrder: readonly PptxElement[],
): MorphCrossfadeGroup[] {
	const byIncomingId = new Map<string, MorphPair>();
	for (const pair of pairs) {
		if (ghostIds.has(pair.fromElement.id) && liftedIds.has(pair.toElement.id)) {
			byIncomingId.set(pair.toElement.id, pair);
		}
	}
	const groups: MorphCrossfadeGroup[] = [];
	for (const element of incomingOrder) {
		const pair = byIncomingId.get(element.id);
		if (pair) {
			groups.push({ outgoing: pair.fromElement, incoming: pair.toElement });
		}
	}
	return groups;
}
