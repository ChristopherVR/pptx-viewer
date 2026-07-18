import type {
	PptxAnimationDirection,
	PptxAnimationPreset,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
} from 'pptx-viewer-core';

/**
 * Option catalogs for the docked inspector AnimationPanel, mirroring React's
 * `animation-panel-constants.ts` exactly: the same preset subsets (the docked
 * panel intentionally offers fewer presets than the ribbon galleries), the
 * same trigger / timing-curve / repeat / direction / sequence options, and
 * the same `pptx.animation.*` label keys. Values come from the shared
 * catalogs' vocabulary; labels resolve through the shared dictionary.
 */

/** Entrance presets offered by the docked panel (React parity subset). */
export const PANEL_ENTRANCE_PRESETS: readonly PptxAnimationPreset[] = ['fadeIn', 'flyIn', 'zoomIn'];

/** Exit presets offered by the docked panel (React parity subset). */
export const PANEL_EXIT_PRESETS: readonly PptxAnimationPreset[] = ['fadeOut', 'flyOut', 'zoomOut'];

/** Emphasis presets offered by the docked panel (React parity subset). */
export const PANEL_EMPHASIS_PRESETS: readonly PptxAnimationPreset[] = [
	'spin',
	'pulse',
	'colorWave',
	'bounce',
	'flash',
	'growShrink',
	'teeter',
];

export const PANEL_TRIGGER_OPTIONS: ReadonlyArray<{
	value: PptxAnimationTrigger;
	labelKey: string;
}> = [
	{ value: 'onClick', labelKey: 'pptx.animation.trigger.onClick' },
	{ value: 'onShapeClick', labelKey: 'pptx.animation.trigger.onShapeClick' },
	{ value: 'onHover', labelKey: 'pptx.animation.trigger.onHover' },
	{ value: 'afterPrevious', labelKey: 'pptx.animation.trigger.afterPrevious' },
	{ value: 'withPrevious', labelKey: 'pptx.animation.trigger.withPrevious' },
];

export const PANEL_TIMING_CURVE_OPTIONS: ReadonlyArray<{
	value: PptxAnimationTimingCurve;
	labelKey: string;
}> = [
	{ value: 'ease', labelKey: 'pptx.animation.timingCurve.ease' },
	{ value: 'ease-in', labelKey: 'pptx.animation.timingCurve.easeIn' },
	{ value: 'ease-out', labelKey: 'pptx.animation.timingCurve.easeOut' },
	{ value: 'linear', labelKey: 'pptx.animation.timingCurve.linear' },
];

export const PANEL_REPEAT_MODE_OPTIONS: ReadonlyArray<{
	value: 'none' | PptxAnimationRepeatMode;
	labelKey: string;
}> = [
	{ value: 'none', labelKey: 'pptx.animation.repeatUntil.none' },
	{ value: 'untilNextClick', labelKey: 'pptx.animation.repeatUntil.untilNextClick' },
	{ value: 'untilEndOfSlide', labelKey: 'pptx.animation.repeatUntil.untilEndOfSlide' },
];

/**
 * Direction picker options. Like React's icon choice (fromTop renders a
 * down-pointing arrow: the motion direction), each glyph points where the
 * element travels, not where it comes from.
 */
export const PANEL_DIRECTION_OPTIONS: ReadonlyArray<{
	value: PptxAnimationDirection;
	labelKey: string;
	glyph: string;
}> = [
	{ value: 'fromTop', labelKey: 'pptx.animation.direction.fromTop', glyph: '↓' },
	{ value: 'fromBottom', labelKey: 'pptx.animation.direction.fromBottom', glyph: '↑' },
	{ value: 'fromLeft', labelKey: 'pptx.animation.direction.fromLeft', glyph: '→' },
	{ value: 'fromRight', labelKey: 'pptx.animation.direction.fromRight', glyph: '←' },
];

export const PANEL_SEQUENCE_OPTIONS: ReadonlyArray<{
	value: PptxAnimationSequence;
	labelKey: string;
}> = [
	{ value: 'asOne', labelKey: 'pptx.animation.sequence.asOne' },
	{ value: 'byParagraph', labelKey: 'pptx.animation.sequence.byParagraph' },
	{ value: 'byWord', labelKey: 'pptx.animation.sequence.byWord' },
	{ value: 'byLetter', labelKey: 'pptx.animation.sequence.byLetter' },
];
