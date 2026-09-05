/**
 * `animation-presets-exit` - OOXML exit presetId -> effect-name table. Split
 * out of `animation-presets.ts` to keep that module under the repo's
 * file-size guideline; see `animation-presets.ts` for the composed
 * `PRESET_ID_TO_EFFECT.exit` this feeds.
 *
 * @module render/animation-presets-exit
 */

import { EXTENDED_EXIT_PRESETS } from './animation-presets-extended';
import type { EffectName } from './animation-timeline-types';

/** OOXML exit `p:cTn/@presetId` -> playback effect name. */
export const EXIT_PRESETS: Record<number, EffectName> = {
	// exit.11 (Flash Once) and exit.12 are the only two of the 68 exit IDs
	// deliberately left unmapped after this pass; see the module doc on
	// `animation-presets-extended.ts` for why (exit.12 has no authoring
	// identity at all today and would collide with exit.16's Peek Out).
	1: 'disappear',
	2: 'flyOutBottom',
	// exit.6 = Circle, confirmed via COM (`msoAnimEffectCircle` with
	// `Effect.Exit = True` serializes as presetID 6, filter="circle(in)"),
	// matching the catalog label and `circleOut` in the authoring reverse
	// lookup. There is no dedicated exit iris/circle-mask keyframe yet, so
	// `shrinkOut` remains as a documented visual APPROXIMATION (both read
	// as "collapse to nothing"); see the APPROXIMATION_ALLOWLIST entry in
	// `animation-preset-tables-consistency.test.ts`.
	6: 'shrinkOut',
	9: 'dissolveOut',
	10: 'fadeOut',
	22: 'wipeOut',
	23: 'zoomOut',
	// exit.26/37 verified via a fresh COM pass (AddEffect + `Effect.Exit =
	// True` + raw OOXML inspection): `msoAnimEffectBounce` with
	// `Effect.Exit = True` re-emits presetID 26 (the SAME id as its
	// entrance form, filter="wipe(down)" on both), and
	// `msoAnimEffectRiseUp` with `Effect.Exit = True` re-emits presetID 37
	// (again the same id as its entrance form, filter="fade" on both).
	// This table previously had `bounceOut` on 37 and no entry for 26,
	// i.e. exactly the same "Bounce"/"Rise Up" mix-up already fixed on the
	// entrance side (entr.26/37) but never propagated to exit. Bounce's
	// exit form reuses the existing `bounceOut` keyframe; Rise Up's exit
	// form ("Sink Down" in the gallery) gets its own `sinkDown` keyframe.
	26: 'bounceOut',
	37: 'sinkDown',
	// exit.3/4/5/8/13/14/20/21 (Blinds/Box/Checkerboard/Diamond/Plus/Random
	// Bars/Wedge/Wheel) confirmed via a fresh COM pass (AddEffect +
	// `Effect.Exit = True` + raw OOXML inspection): each reuses the SAME
	// numeric presetID as its entrance form, mirroring the
	// already-documented Bounce/Rise Up/Circle pattern above. Each gets a
	// dedicated exit keyframe in `animation-keyframes-exit-shapes.ts` that
	// reuses its entrance counterpart's mask/transform technique played in
	// reverse (shown -> hidden), rather than falling back to the generic
	// fade.
	3: 'blindsOut',
	4: 'boxOut',
	5: 'checkerboardOut',
	8: 'diamondOut',
	13: 'plusOut',
	14: 'randomBarsOut',
	20: 'wedgeOut',
	21: 'wheelOut',
	// exit.18 (Strips) confirmed via the same COM pass: presetID 18 (the
	// SAME id as its entrance form, entr.18). This CONTRADICTS
	// `animation-write-mappings.ts`'s existing (unverified) `collapseOut`
	// entry at exit.18; that entry is almost certainly a pre-existing
	// guess that was never COM-checked, and correcting it is a separate,
	// larger fix out of this pass's scope (see the APPROXIMATION_ALLOWLIST
	// entry in `animation-preset-tables-consistency.test.ts`). No
	// dedicated diagonal-strip exit keyframe exists, so this reuses
	// `wipeOut`, matching the approximation `animation-filter-effects.ts`
	// already uses for the Strips filter family's exit form.
	18: 'wipeOut',
	// exit.7/15/16/17/19/24/25/27-68 (minus the ids already covered above):
	// the exit-side half of the same gap-closing pass, split into
	// `animation-presets-extended.ts`; see that module's doc for the
	// per-id rationale (exit.16/17, Peek Out/Split, had no dedicated exit
	// keyframe at all before this pass).
	...EXTENDED_EXIT_PRESETS,
};
