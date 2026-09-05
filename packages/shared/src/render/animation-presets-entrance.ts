/**
 * `animation-presets-entrance` - OOXML entrance presetId -> effect-name table.
 * Split out of `animation-presets.ts` to keep that module under the repo's
 * file-size guideline; see `animation-presets.ts` for the composed
 * `PRESET_ID_TO_EFFECT.entr` this feeds.
 *
 * @module render/animation-presets-entrance
 */

import { EXTENDED_ENTR_PRESETS } from './animation-presets-extended';
import type { EffectName } from './animation-timeline-types';

/** OOXML entrance `p:cTn/@presetId` -> playback effect name. */
export const ENTR_PRESETS: Record<number, EffectName> = {
	1: 'appear',
	2: 'flyInBottom',
	3: 'blindsIn',
	4: 'boxIn',
	5: 'checkerboardIn',
	// entr.6 = Circle: a genuine iris-style mask reveal, not a plain scale.
	// It used to duplicate entr.31 (Expand)'s `expandIn`, so a Circle
	// entrance was visually indistinguishable from Expand.
	6: 'circleIn',
	9: 'dissolveIn',
	10: 'fadeIn',
	// entr.11 = Flash Once, entr.12 = Peek In, entr.16 = Split per the
	// MS-OI29500 entrance catalog. (12 was mislabelled Flash Once and 16
	// Peek In, so a Peek In entrance BLINKED and a Split entrance peeked.)
	// Ground truth from a real PowerPoint deck (issue #132): preset 12
	// carries `p:animEffect filter="wipe(...)"` (a peek reveal) and preset
	// 16 carries `filter="barn(...)"` (the split barn-door reveal).
	// Re-verified directly against retail PowerPoint via COM automation
	// (AddEffect + raw OOXML inspection): entr.11 emits no filter (a plain
	// visibility flash, matching `flashIn`'s blink keyframe), entr.12
	// carries `filter="wipe(up)"`, and entr.16 carries
	// `filter="barn(inVertical)"`. This block is intentionally UNCHANGED
	// from the #132 fix; `animation-write-mappings.ts` and
	// `animation-preset-catalog.ts` were the ones still mislabelled (their
	// entr.11/12/16/17 labels were shifted one preset too high) and have
	// been corrected to match this table instead.
	11: 'flashIn',
	12: 'peekIn',
	14: 'randomBarsIn',
	16: 'splitIn',
	// entr.17 = Stretch (confirmed via COM: a plain `ppt_w`/`ppt_h` grow
	// from 0 to full size, no filter); an expand-from-nothing scale is the
	// closest existing match.
	17: 'expandIn',
	22: 'wipeIn',
	23: 'zoomIn',
	// entr.26/37 verified via COM (AddEffect + raw OOXML inspection):
	// `msoAnimEffectBounce` serializes as presetID 26 and
	// `msoAnimEffectRiseUp` serializes as presetID 37. These were
	// previously swapped in this table (26 played 'riseUp', 37 played
	// 'bounceIn'); PowerPoint's own internal MsoAnimEffect id and the
	// OOXML presetID are different numbering spaces that only coincide
	// for some effects.
	26: 'bounceIn',
	21: 'wheelIn',
	31: 'expandIn',
	37: 'riseUp',
	42: 'floatIn',
	// entr.19 = Swivel, confirmed via COM (`msoAnimEffectSwivel` serializes
	// as presetID 19, presetClass="entr", no filter); already COM-verified
	// in `animation-write-mappings.ts`'s `ENTR_CANONICAL` and in the UI
	// catalog, but never wired up here even though the `swivel` keyframe
	// (rotateY entrance) already existed and was already used for its
	// initial-style resolution in `animation-effects.ts`.
	19: 'swivel',
	49: 'spinnerIn',
	53: 'growTurnIn',
	// entr.8/13/20 (Diamond/Plus/Wedge) confirmed via a fresh COM pass
	// (AddEffect + raw OOXML inspection): each serializes as
	// presetClass="entr" with exactly the presetID this table already
	// assumed in `animation-write-mappings.ts`'s `diamondIn`/`plusIn`/
	// `wedgeIn` entries. Their dedicated mask-reveal keyframes already
	// existed (used by the `p:animEffect/@filter` fallback path in
	// `animation-filter-effects.ts`) but were never wired up here, so a
	// deck whose `p:cTn` carries the presetId without an accompanying
	// filter attribute fell through to the generic fade safety net.
	8: 'diamondIn',
	13: 'plusIn',
	20: 'wedgeIn',
	// entr.18 (Strips) confirmed via the same COM pass: presetID 18,
	// matching the already-COM-verified catalog label ("Strips"). There is
	// no dedicated diagonal-strip keyframe, so this reuses the `wipeIn`
	// mask (the same approximation already used by the Strips filter
	// family in `animation-filter-effects.ts`); see the
	// APPROXIMATION_ALLOWLIST entry in
	// `animation-preset-tables-consistency.test.ts`.
	18: 'wipeIn',
	// entr.47 (Descend) confirmed via the same COM pass: presetID 47,
	// matching the already-COM-verified catalog label ("Descend"; see
	// `animation-preset-catalog.ts`). No dedicated "falls from above"
	// keyframe exists, so this reuses `flyInTop` (falls from the top edge
	// into place), the closest existing motion; see the
	// APPROXIMATION_ALLOWLIST entry in
	// `animation-preset-tables-consistency.test.ts`.
	47: 'flyInTop',
	// entr.7/15/24/25/27-68 (minus the ids already covered above): closes
	// the "68 entrance IDs, 54/200 non-path IDs covered" gap. Split into
	// `animation-presets-extended.ts` to keep this file under the repo's
	// file-size guideline; see that module's doc for the per-id rationale
	// and confidence level (entr.15 is COM-confirmed, the rest are matched
	// by NAME against the authoring reverse lookup).
	...EXTENDED_ENTR_PRESETS,
};
