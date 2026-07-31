/**
 * slide-transition-label-keys.ts: i18n keys for every `PptxTransitionType`.
 *
 * WHY separate from `SLIDE_TRANSITION_OPTIONS`: that catalogue lists the 24
 * transitions React's Type select offers. Vue's transition panel offers 44 and
 * printed all of them as raw tokens (`wheelReverse`, `flythrough`,
 * `honeycomb`), and core parses 61. A lookup covering the whole union lets a
 * panel spell whatever it already offers without any binding gaining or losing
 * an entry from its select, which is what an option-list change would do.
 *
 * Wording follows PowerPoint's own Transitions gallery.
 *
 * @module render/slide-transition-label-keys
 */
import type { PptxTransitionType } from 'pptx-viewer-core';

/** Wire token -> i18n key for every transition type core can parse. */
export const SLIDE_TRANSITION_LABEL_KEYS: Readonly<Record<PptxTransitionType, string>> = {
	none: 'pptx.transition.none',
	cut: 'pptx.ribbon.transition.cut',
	fade: 'pptx.ribbon.transition.fade',
	push: 'pptx.ribbon.transition.push',
	wipe: 'pptx.ribbon.transition.wipe',
	split: 'pptx.ribbon.transition.split',
	randomBar: 'pptx.transitionPresets.randomBars',
	blinds: 'pptx.transitionPresets.blinds',
	checker: 'pptx.transitionPresets.checker',
	circle: 'pptx.transitionPresets.circle',
	comb: 'pptx.transitionPresets.comb',
	cover: 'pptx.ribbon.transition.cover',
	diamond: 'pptx.transitionPresets.diamond',
	dissolve: 'pptx.transitionPresets.dissolve',
	plus: 'pptx.transitionPresets.plus',
	pull: 'pptx.transitionPresets.pull',
	random: 'pptx.transitionPresets.random',
	strips: 'pptx.transitionPresets.strips',
	uncover: 'pptx.ribbon.transition.uncover',
	wedge: 'pptx.transitionPresets.wedge',
	wheel: 'pptx.transitionPresets.wheel',
	zoom: 'pptx.transitionPresets.zoom',
	newsflash: 'pptx.transitionPresets.newsflash',
	morph: 'pptx.transitionPresets.morph',
	conveyor: 'pptx.transitionPresets.conveyor',
	doors: 'pptx.transitionPresets.doors',
	ferris: 'pptx.transitionPresets.ferris',
	flash: 'pptx.transitionPresets.flash',
	flythrough: 'pptx.transitionPresets.flythrough',
	gallery: 'pptx.transitionPresets.gallery',
	glitter: 'pptx.transitionPresets.glitter',
	honeycomb: 'pptx.transitionPresets.honeycomb',
	pan: 'pptx.transitionPresets.pan',
	prism: 'pptx.transitionPresets.prism',
	reveal: 'pptx.transitionPresets.reveal',
	ripple: 'pptx.transitionPresets.ripple',
	shred: 'pptx.transitionPresets.shred',
	switch: 'pptx.transitionPresets.switch',
	vortex: 'pptx.transitionPresets.vortex',
	warp: 'pptx.transitionPresets.warp',
	wheelReverse: 'pptx.transitionPresets.wheelReverse',
	window: 'pptx.transitionPresets.window',
	cube: 'pptx.transitionPresets.cube',
	flip: 'pptx.transitionPresets.flip',
	rotate: 'pptx.transitionPresets.rotate',
	orbit: 'pptx.transitionPresets.orbit',
	fallOver: 'pptx.transitionPresets.fallOver',
	drape: 'pptx.transitionPresets.drape',
	curtains: 'pptx.transitionPresets.curtains',
	wind: 'pptx.transitionPresets.wind',
	prestige: 'pptx.transitionPresets.prestige',
	fracture: 'pptx.transitionPresets.fracture',
	crush: 'pptx.transitionPresets.crush',
	peelOff: 'pptx.transitionPresets.peelOff',
	pageCurlDouble: 'pptx.transitionPresets.pageCurlDouble',
	pageCurlSingle: 'pptx.transitionPresets.pageCurlSingle',
	airplane: 'pptx.transitionPresets.airplane',
	origami: 'pptx.transitionPresets.origami',
};
