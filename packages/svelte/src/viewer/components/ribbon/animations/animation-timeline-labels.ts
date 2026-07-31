/**
 * animation-timeline-labels.ts: wire token -> i18n key tables for the five
 * schema selects in {@link AnimationTimeline}.
 *
 * WHY these exist: the timeline row drives its selects straight off the shared
 * `*_VALUES` vocabularies, which are OOXML-flavoured camelCase (`onShapeClick`,
 * `fromBottomRight`, `untilEndOfSlide`). Rendering them verbatim showed the
 * user the wire value and made the row untranslatable, even though every one of
 * these tokens has had a dictionary entry all along. Vanilla's
 * `animation-panel.ts` already resolves the same keys, so mapping them here
 * puts the two bindings on identical wording.
 *
 * These are LOOKUPS, not option lists: the timeline keeps offering exactly the
 * values the shared vocabularies carry (all eight directions, not the four the
 * docked panel's picker shows), so labelling them cannot change the control.
 *
 * @module animation-timeline-labels
 */

/** `PptxAnimationTrigger` -> dictionary key. */
export const TRIGGER_LABEL_KEYS: Readonly<Record<string, string>> = {
	onClick: 'pptx.animation.trigger.onClick',
	onShapeClick: 'pptx.animation.trigger.onShapeClick',
	onHover: 'pptx.animation.trigger.onHover',
	afterPrevious: 'pptx.animation.trigger.afterPrevious',
	withPrevious: 'pptx.animation.trigger.withPrevious',
};

/** `PptxAnimationDirection` -> dictionary key (all eight compass values). */
export const DIRECTION_LABEL_KEYS: Readonly<Record<string, string>> = {
	fromTop: 'pptx.animation.direction.fromTop',
	fromBottom: 'pptx.animation.direction.fromBottom',
	fromLeft: 'pptx.animation.direction.fromLeft',
	fromRight: 'pptx.animation.direction.fromRight',
	fromTopLeft: 'pptx.animation.direction.fromTopLeft',
	fromTopRight: 'pptx.animation.direction.fromTopRight',
	fromBottomLeft: 'pptx.animation.direction.fromBottomLeft',
	fromBottomRight: 'pptx.animation.direction.fromBottomRight',
};

/** `PptxAnimationSequence` -> dictionary key. */
export const SEQUENCE_LABEL_KEYS: Readonly<Record<string, string>> = {
	asOne: 'pptx.animation.sequence.asOne',
	byParagraph: 'pptx.animation.sequence.byParagraph',
	byWord: 'pptx.animation.sequence.byWord',
	byLetter: 'pptx.animation.sequence.byLetter',
};

/**
 * `PptxAnimationTimingCurve` -> dictionary key. The values are the CSS spelling
 * (`ease-in`) while the keys are camelCase (`easeIn`), so this one cannot be
 * built by string interpolation the way the other four could.
 */
export const TIMING_CURVE_LABEL_KEYS: Readonly<Record<string, string>> = {
	ease: 'pptx.animation.timingCurve.ease',
	'ease-in': 'pptx.animation.timingCurve.easeIn',
	'ease-out': 'pptx.animation.timingCurve.easeOut',
	linear: 'pptx.animation.timingCurve.linear',
};

/** `PptxAnimationRepeatMode` (plus the `'none'` clear sentinel) -> key. */
export const REPEAT_MODE_LABEL_KEYS: Readonly<Record<string, string>> = {
	none: 'pptx.animation.repeatUntil.none',
	untilNextClick: 'pptx.animation.repeatUntil.untilNextClick',
	untilEndOfSlide: 'pptx.animation.repeatUntil.untilEndOfSlide',
};
