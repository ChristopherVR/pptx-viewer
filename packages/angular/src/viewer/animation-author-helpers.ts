/**
 * animation-author-helpers.ts — Angular shim over the shared element-animation
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
	animationFor,
	applyAnimationPreset,
	DIRECTIONAL_PRESETS,
	hasAnimation,
	removeAnimation,
	removeElementAnimation,
	reorderAnimationDown,
	reorderAnimationUp,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
	setDelay,
	setDirection,
	setDuration,
	setRepeatCount,
	setRepeatMode,
	setSequence,
	setTimingCurve,
	setTrigger,
	setTriggerShapeId,
	showDirectionPicker,
} from '../internal/shared';
export type { AnimationGroup } from '../internal/shared';

// ==========================================================================
// Option catalogs (Angular display labels — view metadata, not shared)
// ==========================================================================

/** Subset of entrance presets surfaced in the authoring UI. */
export const ENTRANCE_PRESETS: ReadonlyArray<{ value: PptxAnimationPreset; label: string }> = [
	{ value: 'appear', label: 'Appear' },
	{ value: 'fadeIn', label: 'Fade In' },
	{ value: 'flyIn', label: 'Fly In' },
	{ value: 'zoomIn', label: 'Zoom In' },
	{ value: 'bounceIn', label: 'Bounce In' },
	{ value: 'wipeIn', label: 'Wipe In' },
	{ value: 'splitIn', label: 'Split In' },
	{ value: 'dissolveIn', label: 'Dissolve In' },
	{ value: 'floatIn', label: 'Float In' },
	{ value: 'growTurnIn', label: 'Grow & Turn' },
];

/** Subset of exit presets surfaced in the authoring UI. */
export const EXIT_PRESETS: ReadonlyArray<{ value: PptxAnimationPreset; label: string }> = [
	{ value: 'fadeOut', label: 'Fade Out' },
	{ value: 'flyOut', label: 'Fly Out' },
	{ value: 'zoomOut', label: 'Zoom Out' },
	{ value: 'bounceOut', label: 'Bounce Out' },
	{ value: 'wipeOut', label: 'Wipe Out' },
	{ value: 'shrinkOut', label: 'Shrink Out' },
	{ value: 'dissolveOut', label: 'Dissolve Out' },
	{ value: 'disappear', label: 'Disappear' },
];

/** Subset of emphasis presets surfaced in the authoring UI. */
export const EMPHASIS_PRESETS: ReadonlyArray<{ value: PptxAnimationPreset; label: string }> = [
	{ value: 'spin', label: 'Spin' },
	{ value: 'pulse', label: 'Pulse' },
	{ value: 'colorWave', label: 'Color Wave' },
	{ value: 'bounce', label: 'Bounce' },
	{ value: 'flash', label: 'Flash' },
	{ value: 'growShrink', label: 'Grow / Shrink' },
	{ value: 'teeter', label: 'Teeter' },
	{ value: 'wave', label: 'Wave' },
	{ value: 'boldFlash', label: 'Bold Flash' },
];

/** Trigger options for the trigger selector. */
export const TRIGGER_OPTIONS: ReadonlyArray<{ value: PptxAnimationTrigger; label: string }> = [
	{ value: 'onClick', label: 'On Click' },
	{ value: 'onShapeClick', label: 'On Shape Click' },
	{ value: 'onHover', label: 'On Hover' },
	{ value: 'afterPrevious', label: 'After Previous' },
	{ value: 'withPrevious', label: 'With Previous' },
];

/** Timing curve options. */
export const TIMING_CURVE_OPTIONS: ReadonlyArray<{
	value: PptxAnimationTimingCurve;
	label: string;
}> = [
	{ value: 'ease', label: 'Ease' },
	{ value: 'ease-in', label: 'Ease In' },
	{ value: 'ease-out', label: 'Ease Out' },
	{ value: 'linear', label: 'Linear' },
];

/** Repeat-mode options (`'none'` means clear the field). */
export const REPEAT_MODE_OPTIONS: ReadonlyArray<{
	value: 'none' | PptxAnimationRepeatMode;
	label: string;
}> = [
	{ value: 'none', label: 'Do not repeat' },
	{ value: 'untilNextClick', label: 'Until Next Click' },
	{ value: 'untilEndOfSlide', label: 'Until End of Slide' },
];

/** Direction options for directional presets (fly in/out, wipe). */
export const DIRECTION_OPTIONS: ReadonlyArray<{
	value: PptxAnimationDirection;
	label: string;
	/** Unicode arrow glyph used as an icon substitute in the Angular template. */
	arrow: string;
}> = [
	{ value: 'fromTop', label: 'From Top', arrow: '↓' },
	{ value: 'fromBottom', label: 'From Bottom', arrow: '↑' },
	{ value: 'fromLeft', label: 'From Left', arrow: '→' },
	{ value: 'fromRight', label: 'From Right', arrow: '←' },
	{ value: 'fromTopLeft', label: 'From Top Left', arrow: '↘' },
	{ value: 'fromTopRight', label: 'From Top Right', arrow: '↙' },
	{ value: 'fromBottomLeft', label: 'From Bottom Left', arrow: '↗' },
	{ value: 'fromBottomRight', label: 'From Bottom Right', arrow: '↖' },
];

/** Sequence options for paragraph/word/letter builds. */
export const SEQUENCE_OPTIONS: ReadonlyArray<{ value: PptxAnimationSequence; label: string }> = [
	{ value: 'asOne', label: 'As One Object' },
	{ value: 'byParagraph', label: 'By Paragraph' },
	{ value: 'byWord', label: 'By Word' },
	{ value: 'byLetter', label: 'By Letter' },
];
