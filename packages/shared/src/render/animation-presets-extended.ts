/**
 * `animation-presets-extended` - the "extended" entrance/exit OOXML preset
 * ids that `animation-presets.ts`'s `PRESET_ID_TO_EFFECT` spreads in, split
 * out to keep that file under the repo's file-size guideline.
 *
 * GROUND TRUTH: the ids are COM-derived. Every `MsoAnimEffect` value was
 * added through `MainSequence.AddEffect` (entrance, then `Effect.Exit =
 * True`) and the saved `presetID` read back; a reverse pass (a deck with
 * `presetID="k"` on slide `k`, reopened and read through `Effect.EffectType`)
 * agrees. The real entrance/exit ids above 26 are 27-31, 34, 35, 37-43, 45,
 * 47-56 and 58; 32, 33, 36, 44, 46, 57 and 59-68 are not presets and are
 * deliberately absent. The previous table keyed ids 27+ by the object-model
 * enum order, which drifts from the OOXML id from 32 up.
 *
 * WHAT PLAYS: a PowerPoint-authored deck carries the preset's real behaviour
 * tree (`p:anim` / `p:animScale` / `p:animEffect` ...), and those nodes drive
 * playback directly. The names below are the static fallback for an
 * effect whose tree carries no usable behaviour, reusing the closest keyframe
 * family. Each choice with no textual overlap to the real name is listed in
 * `animation-preset-tables-consistency.test.ts`'s APPROXIMATION_ALLOWLIST.
 *
 * @module render/animation-presets-extended
 */

import type { EffectName } from './animation-timeline-types';

/** entr.7/15/17/24/25 plus every real entrance id from 27 up. */
export const EXTENDED_ENTR_PRESETS: Partial<Record<number, EffectName>> = {
	7: 'flyInBottom', // Crawl In
	15: 'spiralIn', // Spiral In
	24: 'fadeIn', // Random Effects
	25: 'boomerangIn', // Boomerang
	27: 'appear', // Color Typewriter
	28: 'creditsIn', // Credits
	29: 'fadeIn', // Ease In
	30: 'floatIn', // Float
	31: 'growTurnIn', // Grow & Turn
	34: 'lightSpeedIn', // Light Speed
	35: 'pinwheelIn', // Pinwheel
	37: 'riseUp', // Rise Up
	38: 'curveUpIn', // Swish
	39: 'expandIn', // Thin Line
	40: 'unfoldIn', // Unfold
	41: 'whipIn', // Whip
	42: 'floatUpIn', // Ascend
	43: 'centerRevolveIn', // Center Revolve
	45: 'swivel', // Faded Swivel
	47: 'flyInTop', // Descend
	48: 'dropIn', // Sling
	49: 'spinnerIn', // Spinner
	50: 'compressIn', // Compress
	51: 'flyInRight', // Zip
	52: 'curveUpIn', // Arc Up
	53: 'zoomIn', // Faded Zoom
	54: 'glideIn', // Glide
	55: 'expandIn', // Expand
	56: 'flipIn', // Flip
	58: 'foldIn', // Fold
};

/**
 * exit.7/15/16/17/19/24/25 plus every real exit id from 27 up (exit.26/37
 * and the 1-23 band live in `animation-presets-exit.ts`).
 */
export const EXTENDED_EXIT_PRESETS: Partial<Record<number, EffectName>> = {
	7: 'flyOutBottom', // Crawl Out
	15: 'spiralOut', // Spiral Out
	16: 'splitOut', // Split
	17: 'shrinkOut', // Collapse
	19: 'fadeOut', // Swivel
	24: 'fadeOut', // Random Effects
	25: 'boomerangOut', // Boomerang
	27: 'disappear', // Color Typewriter
	28: 'creditsOut', // Credits
	29: 'fadeOut', // Ease Out
	30: 'fadeOut', // Float
	31: 'shrinkOut', // Shrink & Turn
	34: 'lightSpeedOut', // Light Speed
	35: 'pinwheelOut', // Pinwheel
	38: 'curveDownOut', // Swish
	39: 'shrinkOut', // Thin Line
	40: 'unfoldOut', // Unfold
	41: 'whipOut', // Whip
	42: 'flyOutTop', // Ascend
	43: 'centerRevolveOut', // Center Revolve
	45: 'fadeOut', // Faded Swivel
	47: 'floatDownOut', // Descend
	48: 'dropOut', // Sling
	49: 'spinnerOut', // Spinner
	50: 'stretchOutBottom', // Stretchy
	51: 'flyOutRight', // Zip
	52: 'curveDownOut', // Arc Up
	53: 'zoomOut', // Faded Zoom
	54: 'glideOut', // Glide
	55: 'shrinkOut', // Contract
	56: 'flipOut', // Flip
	58: 'foldOut', // Fold
};
