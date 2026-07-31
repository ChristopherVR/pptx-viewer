/**
 * animation-editor-label-keys.ts: wire-token -> i18n key maps for the animation
 * editor's direction / sequence / timing-curve selects.
 *
 * WHY this exists: `AnimationEditorControls.vue` printed the raw
 * `PptxAnimationDirection` / `PptxAnimationSequence` / `PptxAnimationTimingCurve`
 * values (`fromBottomLeft`, `byParagraph`, `ease-in`) straight into its
 * `<option>`s, which are schema values rather than English and can never be
 * translated. The keys below are exactly the ones React's
 * `animation-panel-constants.ts` uses, so both bindings spell the same value the
 * same way.
 *
 * WHY a map rather than `t('pptx.animation.timingCurve.' + value)`: the curve
 * values are kebab-case (`ease-in`) while the dictionary keys are camelCase
 * (`easeIn`), so a naive concatenation misses. A map also keeps the value list
 * itself untouched: these tables only affect spelling, never which options the
 * select offers.
 *
 * @module animation-editor-label-keys
 */
import type {
	PptxAnimationDirection,
	PptxAnimationSequence,
	PptxAnimationTimingCurve,
} from 'pptx-viewer-core';

/** All eight `PptxAnimationDirection` values the editor offers. */
export const ANIMATION_DIRECTION_LABEL_KEYS: Readonly<Record<PptxAnimationDirection, string>> = {
	fromLeft: 'pptx.animation.direction.fromLeft',
	fromRight: 'pptx.animation.direction.fromRight',
	fromTop: 'pptx.animation.direction.fromTop',
	fromBottom: 'pptx.animation.direction.fromBottom',
	fromTopLeft: 'pptx.animation.direction.fromTopLeft',
	fromTopRight: 'pptx.animation.direction.fromTopRight',
	fromBottomLeft: 'pptx.animation.direction.fromBottomLeft',
	fromBottomRight: 'pptx.animation.direction.fromBottomRight',
};

/** Text-build granularity (`byParagraph` / `byWord` / `byLetter`). */
export const ANIMATION_SEQUENCE_LABEL_KEYS: Readonly<Record<PptxAnimationSequence, string>> = {
	asOne: 'pptx.animation.sequence.asOne',
	byParagraph: 'pptx.animation.sequence.byParagraph',
	byWord: 'pptx.animation.sequence.byWord',
	byLetter: 'pptx.animation.sequence.byLetter',
};

/** Easing curves. Note the kebab-case value / camelCase key mismatch. */
export const ANIMATION_TIMING_CURVE_LABEL_KEYS: Readonly<Record<PptxAnimationTimingCurve, string>> =
	{
		ease: 'pptx.animation.timingCurve.ease',
		'ease-in': 'pptx.animation.timingCurve.easeIn',
		'ease-out': 'pptx.animation.timingCurve.easeOut',
		linear: 'pptx.animation.timingCurve.linear',
	};
