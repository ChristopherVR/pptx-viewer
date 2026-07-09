/**
 * Slide transition and element animation preset options.
 *
 * NOTE: `label` keeps the English fallback text (existing consumers outside
 * this sweep still render `option.label` directly). Each option also carries
 * an `i18nKey` pointing at the shared i18n dictionary, matching the
 * `{ value, i18nKey }` convention already used elsewhere in this codebase, so
 * a render site can switch to `t(option.i18nKey)` without a data-shape change.
 */

import type { AnimationPresetOption, SlideTransitionOption } from '../types';

export const SLIDE_TRANSITION_OPTIONS: (SlideTransitionOption & { i18nKey: string })[] = [
	{ value: 'none', label: 'None', i18nKey: 'pptx.transition.none' },
	{ value: 'cut', label: 'Cut', i18nKey: 'pptx.ribbon.transition.cut' },
	{ value: 'fade', label: 'Fade', i18nKey: 'pptx.ribbon.transition.fade' },
	{ value: 'push', label: 'Push', i18nKey: 'pptx.ribbon.transition.push' },
	{ value: 'wipe', label: 'Wipe', i18nKey: 'pptx.ribbon.transition.wipe' },
	{ value: 'split', label: 'Split', i18nKey: 'pptx.ribbon.transition.split' },
	{ value: 'randomBar', label: 'Random Bars', i18nKey: 'pptx.transitionPresets.randomBars' },
	{ value: 'blinds', label: 'Blinds', i18nKey: 'pptx.transitionPresets.blinds' },
	{ value: 'checker', label: 'Checker', i18nKey: 'pptx.transitionPresets.checker' },
	{ value: 'circle', label: 'Circle', i18nKey: 'pptx.transitionPresets.circle' },
	{ value: 'comb', label: 'Comb', i18nKey: 'pptx.transitionPresets.comb' },
	{ value: 'cover', label: 'Cover', i18nKey: 'pptx.ribbon.transition.cover' },
	{ value: 'diamond', label: 'Diamond', i18nKey: 'pptx.transitionPresets.diamond' },
	{ value: 'dissolve', label: 'Dissolve', i18nKey: 'pptx.transitionPresets.dissolve' },
	{ value: 'plus', label: 'Plus', i18nKey: 'pptx.transitionPresets.plus' },
	{ value: 'pull', label: 'Pull', i18nKey: 'pptx.transitionPresets.pull' },
	{ value: 'random', label: 'Random', i18nKey: 'pptx.transitionPresets.random' },
	{ value: 'strips', label: 'Strips', i18nKey: 'pptx.transitionPresets.strips' },
	{ value: 'uncover', label: 'Uncover', i18nKey: 'pptx.ribbon.transition.uncover' },
	{ value: 'wedge', label: 'Wedge', i18nKey: 'pptx.transitionPresets.wedge' },
	{ value: 'wheel', label: 'Wheel', i18nKey: 'pptx.transitionPresets.wheel' },
	{ value: 'zoom', label: 'Zoom', i18nKey: 'pptx.transitionPresets.zoom' },
	{ value: 'newsflash', label: 'Newsflash', i18nKey: 'pptx.transitionPresets.newsflash' },
	{ value: 'morph', label: 'Morph', i18nKey: 'pptx.transitionPresets.morph' },
];

export const ANIMATION_PRESET_OPTIONS: (AnimationPresetOption & { i18nKey: string })[] = [
	{ value: 'fadeIn', label: 'Fade In', i18nKey: 'pptx.animation.preset.fadeIn' },
	{ value: 'flyIn', label: 'Fly In', i18nKey: 'pptx.animation.preset.flyIn' },
	{ value: 'zoomIn', label: 'Zoom In', i18nKey: 'pptx.animation.preset.zoomIn' },
	{ value: 'fadeOut', label: 'Fade Out', i18nKey: 'pptx.animation.preset.fadeOut' },
	{ value: 'flyOut', label: 'Fly Out', i18nKey: 'pptx.animation.preset.flyOut' },
	{ value: 'zoomOut', label: 'Zoom Out', i18nKey: 'pptx.animation.preset.zoomOut' },
	{ value: 'spin', label: 'Spin', i18nKey: 'pptx.animation.preset.spin' },
	{ value: 'pulse', label: 'Pulse', i18nKey: 'pptx.animation.preset.pulse' },
	{ value: 'colorWave', label: 'Color Wave', i18nKey: 'pptx.animation.preset.colorWave' },
	{ value: 'bounce', label: 'Bounce', i18nKey: 'pptx.animation.preset.bounce' },
	{ value: 'flash', label: 'Flash', i18nKey: 'pptx.animation.preset.flash' },
	{ value: 'growShrink', label: 'Grow/Shrink', i18nKey: 'pptx.animation.preset.growShrink' },
	{ value: 'teeter', label: 'Teeter', i18nKey: 'pptx.animation.preset.teeter' },
];
