/**
 * animation-author-helpers.ts: Angular shim over the shared element-animation
 * authoring model.
 *
 * The pure, immutable `PptxElementAnimation[]` readers + patch builders now live
 * in `pptx-viewer-shared` (`render/animation-authoring`), consolidated with the
 * Vue authoring model. They are re-exported here so the authoring panel / ribbon
 * keep importing the same names.
 *
 * What stays Angular-local: the **labelled** option catalogs the templates bind
 * to (`ENTRANCE_PRESETS` … `DIRECTION_OPTIONS`). Shared exposes only the value
 * lists (`ENTRANCE_PRESET_VALUES` …) because the human label / arrow glyph is a
 * view concern; this module pairs each value with its Angular display label.
 */

import type {
	PptxAnimationDirection,
	PptxAnimationPreset,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
} from 'pptx-viewer-core';

// ── Pure authoring functions (consolidated in shared) ──
export {
	AFTER_ANIMATION_VALUES,
	animationFor,
	applyAnimationPreset,
	DIRECTIONAL_PRESETS,
	getEffectSoundState,
	hasAnimation,
	removeAnimation,
	removeElementAnimation,
	reorderAnimationDown,
	reorderAnimationUp,
	setAfterAnimation,
	setAfterAnimationColor,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
	setDelay,
	setDirection,
	setDuration,
	setEffectSound,
	setRepeatCount,
	setRepeatMode,
	setSequence,
	setTimingCurve,
	setTrigger,
	setTriggerShapeId,
	showDirectionPicker,
} from '../internal/shared';
export type { AnimationGroup, EffectSoundState } from '../internal/shared';

// ==========================================================================
// Option catalogs (Angular display labels: view metadata, not shared)
// ==========================================================================

/** Subset of entrance presets surfaced in the authoring UI. */
export const ENTRANCE_PRESETS: ReadonlyArray<{
	value: PptxAnimationPreset;
	label: string;
	labelKey: string;
}> = [
	{ value: 'appear', label: 'Appear', labelKey: 'pptx.animation.preset.appear' },
	{ value: 'fadeIn', label: 'Fade In', labelKey: 'pptx.animation.preset.fadeIn' },
	{ value: 'flyIn', label: 'Fly In', labelKey: 'pptx.animation.preset.flyIn' },
	{ value: 'zoomIn', label: 'Zoom In', labelKey: 'pptx.animation.preset.zoomIn' },
	{ value: 'bounceIn', label: 'Bounce In', labelKey: 'pptx.animation.preset.bounceIn' },
	{ value: 'wipeIn', label: 'Wipe In', labelKey: 'pptx.animation.preset.wipeIn' },
	{ value: 'splitIn', label: 'Split In', labelKey: 'pptx.animation.preset.splitIn' },
	{ value: 'dissolveIn', label: 'Dissolve In', labelKey: 'pptx.animation.preset.dissolveIn' },
	{ value: 'floatIn', label: 'Float In', labelKey: 'pptx.animation.preset.floatIn' },
	{ value: 'growTurnIn', label: 'Grow & Turn', labelKey: 'pptx.animation.preset.growTurnIn' },
];

/** Subset of exit presets surfaced in the authoring UI. */
export const EXIT_PRESETS: ReadonlyArray<{
	value: PptxAnimationPreset;
	label: string;
	labelKey: string;
}> = [
	{ value: 'fadeOut', label: 'Fade Out', labelKey: 'pptx.animation.preset.fadeOut' },
	{ value: 'flyOut', label: 'Fly Out', labelKey: 'pptx.animation.preset.flyOut' },
	{ value: 'zoomOut', label: 'Zoom Out', labelKey: 'pptx.animation.preset.zoomOut' },
	{ value: 'bounceOut', label: 'Bounce Out', labelKey: 'pptx.animation.preset.bounceOut' },
	{ value: 'wipeOut', label: 'Wipe Out', labelKey: 'pptx.animation.preset.wipeOut' },
	{ value: 'shrinkOut', label: 'Shrink Out', labelKey: 'pptx.animation.preset.shrinkOut' },
	{ value: 'dissolveOut', label: 'Dissolve Out', labelKey: 'pptx.animation.preset.dissolveOut' },
	{ value: 'disappear', label: 'Disappear', labelKey: 'pptx.animation.preset.disappear' },
];

/** Subset of emphasis presets surfaced in the authoring UI. */
export const EMPHASIS_PRESETS: ReadonlyArray<{
	value: PptxAnimationPreset;
	label: string;
	labelKey: string;
}> = [
	{ value: 'spin', label: 'Spin', labelKey: 'pptx.animation.preset.spin' },
	{ value: 'pulse', label: 'Pulse', labelKey: 'pptx.animation.preset.pulse' },
	{ value: 'colorWave', label: 'Color Wave', labelKey: 'pptx.animation.preset.colorWave' },
	{ value: 'bounce', label: 'Bounce', labelKey: 'pptx.animation.preset.bounce' },
	{ value: 'flash', label: 'Flash', labelKey: 'pptx.animation.preset.flash' },
	{ value: 'growShrink', label: 'Grow / Shrink', labelKey: 'pptx.animation.preset.growShrink' },
	{ value: 'teeter', label: 'Teeter', labelKey: 'pptx.animation.preset.teeter' },
	{ value: 'wave', label: 'Wave', labelKey: 'pptx.animation.preset.wave' },
	{ value: 'boldFlash', label: 'Bold Flash', labelKey: 'pptx.animation.preset.boldFlash' },
];

/** Trigger options for the trigger selector. */
export const TRIGGER_OPTIONS: ReadonlyArray<{
	value: PptxAnimationTrigger;
	label: string;
	labelKey: string;
}> = [
	{ value: 'onClick', label: 'On Click', labelKey: 'pptx.animation.trigger.onClick' },
	{
		value: 'onShapeClick',
		label: 'On Shape Click',
		labelKey: 'pptx.animation.trigger.onShapeClick',
	},
	{ value: 'onHover', label: 'On Hover', labelKey: 'pptx.animation.trigger.onHover' },
	{
		value: 'afterPrevious',
		label: 'After Previous',
		labelKey: 'pptx.animation.trigger.afterPrevious',
	},
	{
		value: 'withPrevious',
		label: 'With Previous',
		labelKey: 'pptx.animation.trigger.withPrevious',
	},
];

/** Timing curve options. */
export const TIMING_CURVE_OPTIONS: ReadonlyArray<{
	value: PptxAnimationTimingCurve;
	label: string;
	labelKey: string;
}> = [
	{ value: 'ease', label: 'Ease', labelKey: 'pptx.animation.timingCurve.ease' },
	{ value: 'ease-in', label: 'Ease In', labelKey: 'pptx.animation.timingCurve.easeIn' },
	{ value: 'ease-out', label: 'Ease Out', labelKey: 'pptx.animation.timingCurve.easeOut' },
	{ value: 'linear', label: 'Linear', labelKey: 'pptx.animation.timingCurve.linear' },
];

/** Repeat-mode options (`'none'` means clear the field). */
export const REPEAT_MODE_OPTIONS: ReadonlyArray<{
	value: 'none' | PptxAnimationRepeatMode;
	label: string;
	labelKey: string;
}> = [
	{ value: 'none', label: 'Do not repeat', labelKey: 'pptx.animation.repeatUntil.none' },
	{
		value: 'untilNextClick',
		label: 'Until Next Click',
		labelKey: 'pptx.animation.repeatUntil.untilNextClick',
	},
	{
		value: 'untilEndOfSlide',
		label: 'Until End of Slide',
		labelKey: 'pptx.animation.repeatUntil.untilEndOfSlide',
	},
];

/** Direction options for directional presets (fly in/out, wipe). */
export const DIRECTION_OPTIONS: ReadonlyArray<{
	value: PptxAnimationDirection;
	label: string;
	labelKey: string;
	/** Unicode arrow glyph used as an icon substitute in the Angular template. */
	arrow: string;
}> = [
	{ value: 'fromTop', label: 'From Top', labelKey: 'pptx.animation.direction.fromTop', arrow: '↓' },
	{
		value: 'fromBottom',
		label: 'From Bottom',
		labelKey: 'pptx.animation.direction.fromBottom',
		arrow: '↑',
	},
	{
		value: 'fromLeft',
		label: 'From Left',
		labelKey: 'pptx.animation.direction.fromLeft',
		arrow: '→',
	},
	{
		value: 'fromRight',
		label: 'From Right',
		labelKey: 'pptx.animation.direction.fromRight',
		arrow: '←',
	},
	{
		value: 'fromTopLeft',
		label: 'From Top Left',
		labelKey: 'pptx.animation.direction.fromTopLeft',
		arrow: '↘',
	},
	{
		value: 'fromTopRight',
		label: 'From Top Right',
		labelKey: 'pptx.animation.direction.fromTopRight',
		arrow: '↙',
	},
	{
		value: 'fromBottomLeft',
		label: 'From Bottom Left',
		labelKey: 'pptx.animation.direction.fromBottomLeft',
		arrow: '↗',
	},
	{
		value: 'fromBottomRight',
		label: 'From Bottom Right',
		labelKey: 'pptx.animation.direction.fromBottomRight',
		arrow: '↖',
	},
];

/** Sequence options for paragraph/word/letter builds. */
export const SEQUENCE_OPTIONS: ReadonlyArray<{
	value: PptxAnimationSequence;
	label: string;
	labelKey: string;
}> = [
	{ value: 'asOne', label: 'As One Object', labelKey: 'pptx.animation.sequence.asOne' },
	{ value: 'byParagraph', label: 'By Paragraph', labelKey: 'pptx.animation.sequence.byParagraph' },
	{ value: 'byWord', label: 'By Word', labelKey: 'pptx.animation.sequence.byWord' },
	{ value: 'byLetter', label: 'By Letter', labelKey: 'pptx.animation.sequence.byLetter' },
];
