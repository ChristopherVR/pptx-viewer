import type { PptxTransitionType } from 'pptx-viewer-core';

/** Transition presets surfaced in the gallery (matches the `pptx.ribbon.transition.*` i18n keys). */
export interface TransitionPreset {
	type: PptxTransitionType;
	labelKey: string;
}

export const TRANSITION_PRESETS: readonly TransitionPreset[] = [
	{ type: 'none', labelKey: 'pptx.ribbon.transition.none' },
	{ type: 'fade', labelKey: 'pptx.ribbon.transition.fade' },
	{ type: 'push', labelKey: 'pptx.ribbon.transition.push' },
	{ type: 'wipe', labelKey: 'pptx.ribbon.transition.wipe' },
	{ type: 'split', labelKey: 'pptx.ribbon.transition.split' },
	{ type: 'reveal', labelKey: 'pptx.ribbon.transition.reveal' },
	{ type: 'cut', labelKey: 'pptx.ribbon.transition.cut' },
	{ type: 'cover', labelKey: 'pptx.ribbon.transition.cover' },
	{ type: 'uncover', labelKey: 'pptx.ribbon.transition.uncover' },
];

/** Default duration (seconds) seeded into the Transitions tab's duration field. */
export const DEFAULT_TRANSITION_DURATION_SEC = 0.7;
