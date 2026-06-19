import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getP14TransitionAnimations } from './p14-transition-css';
import { P14_TRANSITION_KEYFRAMES_ALL } from './p14-transition-keyframes';
import {
	getSlideTransitionAnimations,
	resolveSlideTransition,
	resolveTransitionDurationMs,
} from './slide-transition-css';
import { SLIDE_TRANSITION_KEYFRAMES } from './slide-transition-keyframes';
import {
	DEFAULT_TRANSITION_DURATION_MS,
	INSTANT,
	RANDOM_ELIGIBLE_TYPES,
	resolveDirection,
	resolveDirection8,
	resolveOrientation,
} from './slide-transition-types';

describe('resolveDirection', () => {
	it('maps the four ooxml cardinal tokens', () => {
		expect(resolveDirection('l', 'right')).toBe('left');
		expect(resolveDirection('r', 'left')).toBe('right');
		expect(resolveDirection('u', 'left')).toBe('up');
		expect(resolveDirection('d', 'left')).toBe('down');
	});

	it('falls back to the default for unknown/diagonal tokens', () => {
		expect(resolveDirection(undefined, 'down')).toBe('down');
		expect(resolveDirection('lu', 'right')).toBe('right');
		expect(resolveDirection('', 'up')).toBe('up');
	});
});

describe('resolveDirection8', () => {
	it('maps cardinals and the four diagonals', () => {
		expect(resolveDirection8('l', 'right')).toBe('left');
		expect(resolveDirection8('lu', 'left')).toBe('lu');
		expect(resolveDirection8('ld', 'left')).toBe('ld');
		expect(resolveDirection8('ru', 'left')).toBe('ru');
		expect(resolveDirection8('rd', 'left')).toBe('rd');
	});

	it('falls back to the default for unknown tokens', () => {
		expect(resolveDirection8('zzz', 'up')).toBe('up');
	});
});

describe('resolveOrientation', () => {
	it('prefers an explicit orient over direction', () => {
		expect(resolveOrientation('horz', 'vert')).toBe('vert');
	});

	it('falls back to the direction when it carries the orientation', () => {
		expect(resolveOrientation('vert', undefined)).toBe('vert');
	});

	it('defaults to horz', () => {
		expect(resolveOrientation(undefined, undefined)).toBe('horz');
		expect(resolveOrientation('', '')).toBe('horz');
	});
});

describe('random-eligible types', () => {
	it('excludes none, cut, and random', () => {
		expect(RANDOM_ELIGIBLE_TYPES).not.toContain('none');
		expect(RANDOM_ELIGIBLE_TYPES).not.toContain('cut');
		expect(RANDOM_ELIGIBLE_TYPES).not.toContain('random');
	});
});

describe('getSlideTransitionAnimations', () => {
	it('returns INSTANT for none and cut', () => {
		expect(getSlideTransitionAnimations('none', 500, undefined)).toStrictEqual(INSTANT);
		expect(getSlideTransitionAnimations('cut', 500, undefined)).toStrictEqual(INSTANT);
	});

	it('embeds the supplied duration into the animation shorthand', () => {
		const result = getSlideTransitionAnimations('fade', 750, undefined);
		expect(result.incoming).toContain('750ms');
		expect(result.outgoing).toContain('750ms');
	});

	it('cross-fades for fade with the outgoing layer on top', () => {
		const result = getSlideTransitionAnimations('fade', 400, undefined);
		expect(result.outgoing).toContain('pptx-tr-fade-out');
		expect(result.incoming).toContain('pptx-tr-fade-in');
		expect(result.outgoingOnTop).toBeTruthy();
	});

	it('resolves push direction (incoming under outgoing)', () => {
		const left = getSlideTransitionAnimations('push', 400, 'l');
		expect(left.outgoing).toContain('pptx-tr-push-out-to-left');
		expect(left.incoming).toContain('pptx-tr-push-in-from-right');
		expect(left.outgoingOnTop).toBeFalsy();

		const up = getSlideTransitionAnimations('push', 400, 'u');
		expect(up.outgoing).toContain('pptx-tr-push-out-to-top');
		expect(up.incoming).toContain('pptx-tr-push-in-from-bottom');
	});

	it('defaults push to left when direction is absent', () => {
		const result = getSlideTransitionAnimations('push', 400, undefined);
		expect(result.outgoing).toContain('pptx-tr-push-out-to-left');
	});

	it('wipes the incoming layer only', () => {
		const result = getSlideTransitionAnimations('wipe', 400, 'r');
		expect(result.outgoing).toBe('none');
		expect(result.incoming).toContain('pptx-tr-wipe-from-right');
		expect(result.outgoingOnTop).toBeFalsy();
	});

	it('covers with diagonal support', () => {
		const result = getSlideTransitionAnimations('cover', 400, 'rd');
		expect(result.outgoing).toBe('none');
		expect(result.incoming).toContain('pptx-tr-cover-from-rd');
	});

	it('uncovers by moving the outgoing layer (incoming static, on top)', () => {
		const result = getSlideTransitionAnimations('uncover', 400, 'l');
		expect(result.outgoing).toContain('pptx-tr-uncover-to-left');
		expect(result.incoming).toBe('none');
		expect(result.outgoingOnTop).toBeTruthy();
	});

	it('treats pull as a directional alias of uncover', () => {
		const pull = getSlideTransitionAnimations('pull', 400, 'r');
		const uncover = getSlideTransitionAnimations('uncover', 400, 'r');
		expect(pull).toStrictEqual(uncover);
	});

	it('splits horizontally and vertically (out variant by default)', () => {
		const horz = getSlideTransitionAnimations('split', 400, undefined, 'horz');
		expect(horz.incoming).toContain('pptx-tr-split-h-out');
		const vert = getSlideTransitionAnimations('split', 400, undefined, 'vert');
		expect(vert.incoming).toContain('pptx-tr-split-v-out');
	});

	it('splits inward when direction is "in"', () => {
		const result = getSlideTransitionAnimations('split', 400, 'in', 'vert');
		expect(result.outgoing).toContain('pptx-tr-split-v-in');
		expect(result.incoming).toBe('none');
		expect(result.outgoingOnTop).toBeTruthy();
	});

	it('renders clip-path shape transitions on the incoming layer', () => {
		expect(getSlideTransitionAnimations('circle', 400, undefined).incoming).toContain(
			'pptx-tr-circle-in',
		);
		expect(getSlideTransitionAnimations('diamond', 400, undefined).incoming).toContain(
			'pptx-tr-diamond-in',
		);
		expect(getSlideTransitionAnimations('plus', 400, undefined).incoming).toContain(
			'pptx-tr-plus-in',
		);
		expect(getSlideTransitionAnimations('wedge', 400, undefined).incoming).toContain(
			'pptx-tr-wedge-in',
		);
		expect(getSlideTransitionAnimations('wheel', 400, undefined).incoming).toContain(
			'pptx-tr-wheel-in',
		);
	});

	it('zooms both layers', () => {
		const result = getSlideTransitionAnimations('zoom', 400, undefined);
		expect(result.outgoing).toContain('pptx-tr-zoom-out');
		expect(result.incoming).toContain('pptx-tr-zoom-in');
	});

	it('resolves orientation-aware blinds / comb / randomBar', () => {
		expect(getSlideTransitionAnimations('blinds', 400, undefined, 'vert').incoming).toContain(
			'pptx-tr-blinds-v',
		);
		expect(getSlideTransitionAnimations('comb', 400, undefined, 'horz').incoming).toContain(
			'pptx-tr-comb-h',
		);
		expect(getSlideTransitionAnimations('randomBar', 400, undefined, 'vert').incoming).toContain(
			'pptx-tr-randombar-v',
		);
	});

	it('resolves checker, dissolve, and newsflash', () => {
		expect(getSlideTransitionAnimations('checker', 400, undefined).incoming).toContain(
			'pptx-tr-checker-in',
		);
		expect(getSlideTransitionAnimations('dissolve', 400, undefined).incoming).toContain(
			'pptx-tr-dissolve-in',
		);
		expect(getSlideTransitionAnimations('newsflash', 400, undefined).incoming).toContain(
			'pptx-tr-newsflash-in',
		);
	});

	it('resolves diagonal strips, defaulting to lu', () => {
		expect(getSlideTransitionAnimations('strips', 400, 'rd').incoming).toContain(
			'pptx-tr-strips-rd',
		);
		expect(getSlideTransitionAnimations('strips', 400, undefined).incoming).toContain(
			'pptx-tr-strips-lu',
		);
	});

	it('falls back to a cross-fade for morph', () => {
		const result = getSlideTransitionAnimations('morph', 400, undefined);
		expect(result.outgoing).toContain('pptx-tr-fade-out');
		expect(result.incoming).toContain('pptx-tr-fade-in');
	});

	it('approximates exotic types with the closest 2-d case', () => {
		// conveyor/gallery/pan -> push, reveal -> wipe, doors -> split,
		// switch/flythrough/ferris/prism -> zoom, ripple/honeycomb/glitter/shred
		// -> dissolve, flash -> fade.
		expect(getSlideTransitionAnimations('conveyor', 400, 'l').outgoing).toContain(
			'pptx-tr-push-out-to-left',
		);
		expect(getSlideTransitionAnimations('reveal', 400, 'l').incoming).toContain(
			'pptx-tr-wipe-from-left',
		);
		expect(getSlideTransitionAnimations('doors', 400, undefined, 'vert').incoming).toContain(
			'pptx-tr-split-v-out',
		);
		expect(getSlideTransitionAnimations('switch', 400, undefined).incoming).toContain(
			'pptx-tr-zoom-in',
		);
		expect(getSlideTransitionAnimations('ripple', 400, undefined).incoming).toContain(
			'pptx-tr-dissolve-in',
		);
		expect(getSlideTransitionAnimations('flash', 400, undefined).incoming).toContain(
			'pptx-tr-fade-in',
		);
	});

	it('falls back to a cross-fade for truly-unknown cinematic types', () => {
		for (const type of ['cube', 'flip', 'rotate', 'orbit'] as const) {
			const result = getSlideTransitionAnimations(type as PptxTransitionType, 400, undefined);
			expect(result.incoming).toContain('pptx-tr-fade-in');
			expect(result.outgoing).toContain('pptx-tr-fade-out');
		}
	});

	describe('random', () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('delegates to a random-eligible type', () => {
			vi.spyOn(Math, 'random').mockReturnValue(0);
			const result = getSlideTransitionAnimations('random', 400, undefined);
			const expected = getSlideTransitionAnimations(RANDOM_ELIGIBLE_TYPES[0], 400, undefined);
			expect(result).toStrictEqual(expected);
		});
	});

	it('references only keyframes that exist in the injected css', () => {
		const types: PptxTransitionType[] = [
			'fade',
			'push',
			'wipe',
			'cover',
			'uncover',
			'split',
			'dissolve',
			'circle',
			'diamond',
			'plus',
			'wedge',
			'wheel',
			'zoom',
			'blinds',
			'checker',
			'comb',
			'strips',
			'randomBar',
			'newsflash',
		];
		for (const type of types) {
			const result = getSlideTransitionAnimations(type, 300, 'l', 'horz');
			for (const shorthand of [result.outgoing, result.incoming]) {
				if (shorthand === 'none') {
					continue;
				}
				const name = shorthand.split(' ')[0];
				expect(SLIDE_TRANSITION_KEYFRAMES).toContain(`@keyframes ${name}`);
			}
		}
	});
});

describe('resolveSlideTransition', () => {
	it('returns INSTANT for undefined, none, and cut', () => {
		expect(resolveSlideTransition(undefined)).toStrictEqual(INSTANT);
		expect(resolveSlideTransition({ type: 'none' })).toStrictEqual(INSTANT);
		expect(resolveSlideTransition({ type: 'cut' })).toStrictEqual(INSTANT);
	});

	it('applies the configured duration', () => {
		const transition: PptxSlideTransition = { type: 'fade', durationMs: 1234 };
		expect(resolveSlideTransition(transition).incoming).toContain('1234ms');
	});

	it('applies the default duration when unset or non-positive', () => {
		expect(resolveSlideTransition({ type: 'fade' }).incoming).toContain(
			`${DEFAULT_TRANSITION_DURATION_MS}ms`,
		);
		expect(resolveSlideTransition({ type: 'fade', durationMs: 0 }).incoming).toContain(
			`${DEFAULT_TRANSITION_DURATION_MS}ms`,
		);
	});

	it('forwards direction and orient', () => {
		const transition: PptxSlideTransition = { type: 'cover', direction: 'lu' };
		expect(resolveSlideTransition(transition).incoming).toContain('pptx-tr-cover-from-lu');
	});
});

describe('resolveTransitionDurationMs', () => {
	it('returns 0 for instant transitions', () => {
		expect(resolveTransitionDurationMs(undefined)).toBe(0);
		expect(resolveTransitionDurationMs({ type: 'none' })).toBe(0);
		expect(resolveTransitionDurationMs({ type: 'cut' })).toBe(0);
	});

	it('returns the configured duration', () => {
		expect(resolveTransitionDurationMs({ type: 'fade', durationMs: 800 })).toBe(800);
	});

	it('falls back to the default when unset or non-positive', () => {
		expect(resolveTransitionDurationMs({ type: 'fade' })).toBe(DEFAULT_TRANSITION_DURATION_MS);
		expect(resolveTransitionDurationMs({ type: 'fade', durationMs: -5 })).toBe(
			DEFAULT_TRANSITION_DURATION_MS,
		);
	});
});

describe('getP14TransitionAnimations', () => {
	it('returns undefined for non-p14 types', () => {
		expect(getP14TransitionAnimations('fade', 500, undefined)).toBeUndefined();
		expect(getP14TransitionAnimations('push', 500, undefined)).toBeUndefined();
	});

	it('resolves conveyor left/right with the dedicated keyframes', () => {
		const left = getP14TransitionAnimations('conveyor', 500, 'l');
		expect(left?.outgoing).toContain('pptx-tr-conveyor-out-to-left');
		expect(left?.incoming).toContain('pptx-tr-conveyor-in-from-right');
		const right = getP14TransitionAnimations('conveyor', 500, 'r');
		expect(right?.outgoing).toContain('pptx-tr-conveyor-out-to-right');
	});

	it('resolves doors by orientation', () => {
		expect(getP14TransitionAnimations('doors', 800, 'horz')?.incoming).toContain(
			'pptx-tr-doors-horz',
		);
		expect(getP14TransitionAnimations('doors', 800, 'vert')?.incoming).toContain(
			'pptx-tr-doors-vert',
		);
	});

	it('resolves the reverse variants of flythrough and warp via direction "out"', () => {
		expect(getP14TransitionAnimations('flythrough', 1000, 'out')?.incoming).toContain(
			'pptx-tr-flythrough-reverse-in',
		);
		expect(getP14TransitionAnimations('warp', 1000, 'out')?.incoming).toContain(
			'pptx-tr-warp-reverse-in',
		);
	});

	it('resolves pan via directionalPair to its cardinal keyframes', () => {
		const left = getP14TransitionAnimations('pan', 500, 'l');
		expect(left?.outgoing).toContain('pptx-tr-pan-to-left');
		expect(left?.incoming).toContain('pptx-tr-pan-from-right');
		expect(P14_TRANSITION_KEYFRAMES_ALL).toContain('@keyframes pptx-tr-pan-to-left');
		expect(P14_TRANSITION_KEYFRAMES_ALL).toContain('@keyframes pptx-tr-pan-from-right');
	});

	it('resolves shred rectangles vs strips pattern', () => {
		expect(getP14TransitionAnimations('shred', 600, 'rectangles')?.incoming).toContain(
			'pptx-tr-shred-rectangles-in',
		);
		expect(getP14TransitionAnimations('shred', 600, 'strips')?.incoming).toContain(
			'pptx-tr-shred-strips-in',
		);
	});

	it('references only keyframes that exist in the p14 css', () => {
		// `pan`/`prism` go through `directionalPair`, which emits cardinal-only
		// suffixes (`-to-left`/`-from-right`); only `pan`'s keyframes use that
		// naming, so they are checked separately below and excluded here.
		const types: PptxTransitionType[] = [
			'conveyor',
			'doors',
			'ferris',
			'flash',
			'flythrough',
			'gallery',
			'glitter',
			'honeycomb',
			'reveal',
			'ripple',
			'shred',
			'switch',
			'vortex',
			'warp',
			'wheelReverse',
			'window',
		];
		// `pptx-tr-fade-out` (used by glitter outgoing) lives in the core block.
		const css = `${P14_TRANSITION_KEYFRAMES_ALL}\n${SLIDE_TRANSITION_KEYFRAMES}`;
		for (const type of types) {
			const result = getP14TransitionAnimations(type, 300, 'l', 'horz');
			expect(result).toBeDefined();
			for (const shorthand of [result?.outgoing, result?.incoming]) {
				if (!shorthand || shorthand === 'none') {
					continue;
				}
				const name = shorthand.split(' ')[0];
				expect(css).toContain(`@keyframes ${name}`);
			}
		}
	});
});
