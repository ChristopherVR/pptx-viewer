import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	DEFAULT_MORPH_DURATION_MS,
	DEFAULT_TRANSITION_DURATION_MS,
	INSTANT,
	MIN_TRANSITION_DURATION_MS,
	RANDOM_ELIGIBLE_TYPES,
	SLIDE_TRANSITION_KEYFRAMES,
	getSlideTransitionAnimations,
	resolveDirection,
	resolveDirection8,
	resolveOrientation,
	resolveOverlayDurationMs,
	resolveTransitionDuration,
	transitionSlideBoxSize,
} from './transition-helpers';

// ---------------------------------------------------------------------------
// resolveDirection
// ---------------------------------------------------------------------------

describe('resolveDirection', () => {
	it('resolves "l" to "left"', () => {
		expect(resolveDirection('l', 'right')).toBe('left');
	});

	it('resolves "r" to "right"', () => {
		expect(resolveDirection('r', 'left')).toBe('right');
	});

	it('resolves "u" to "up"', () => {
		expect(resolveDirection('u', 'down')).toBe('up');
	});

	it('resolves "d" to "down"', () => {
		expect(resolveDirection('d', 'up')).toBe('down');
	});

	it('returns the default direction for undefined input', () => {
		expect(resolveDirection(undefined, 'left')).toBe('left');
	});

	it('returns the default direction for unknown input', () => {
		expect(resolveDirection('xyz', 'right')).toBe('right');
	});

	it('returns the default direction for an empty string', () => {
		expect(resolveDirection('', 'up')).toBe('up');
	});
});

// ---------------------------------------------------------------------------
// resolveDirection8
// ---------------------------------------------------------------------------

describe('resolveDirection8', () => {
	it('resolves the basic 4 directions like resolveDirection', () => {
		expect(resolveDirection8('l', 'right')).toBe('left');
		expect(resolveDirection8('r', 'left')).toBe('right');
		expect(resolveDirection8('u', 'down')).toBe('up');
		expect(resolveDirection8('d', 'up')).toBe('down');
	});

	it('resolves diagonal "lu" (left-up)', () => {
		expect(resolveDirection8('lu', 'left')).toBe('lu');
	});

	it('resolves diagonal "ld" (left-down)', () => {
		expect(resolveDirection8('ld', 'left')).toBe('ld');
	});

	it('resolves diagonal "ru" (right-up)', () => {
		expect(resolveDirection8('ru', 'left')).toBe('ru');
	});

	it('resolves diagonal "rd" (right-down)', () => {
		expect(resolveDirection8('rd', 'left')).toBe('rd');
	});

	it('returns the default for undefined input', () => {
		expect(resolveDirection8(undefined, 'down')).toBe('down');
	});

	it('returns the default for unknown input', () => {
		expect(resolveDirection8('xyz', 'up')).toBe('up');
	});
});

// ---------------------------------------------------------------------------
// resolveOrientation
// ---------------------------------------------------------------------------

describe('resolveOrientation', () => {
	it('returns "horz" when orient is "horz"', () => {
		expect(resolveOrientation(undefined, 'horz')).toBe('horz');
	});

	it('returns "vert" when orient is "vert"', () => {
		expect(resolveOrientation(undefined, 'vert')).toBe('vert');
	});

	it('falls back to direction when orient is not valid', () => {
		expect(resolveOrientation('horz', undefined)).toBe('horz');
		expect(resolveOrientation('vert', undefined)).toBe('vert');
	});

	it('defaults to "horz" when neither orient nor direction is valid', () => {
		expect(resolveOrientation(undefined, undefined)).toBe('horz');
		expect(resolveOrientation('xyz', 'abc')).toBe('horz');
	});

	it('prefers orient over direction', () => {
		expect(resolveOrientation('vert', 'horz')).toBe('horz');
	});

	it('treats empty strings as invalid', () => {
		expect(resolveOrientation('', '')).toBe('horz');
	});
});

// ---------------------------------------------------------------------------
// RANDOM_ELIGIBLE_TYPES + INSTANT sentinel
// ---------------------------------------------------------------------------

describe('rANDOM_ELIGIBLE_TYPES', () => {
	it('contains multiple transition types', () => {
		expect(RANDOM_ELIGIBLE_TYPES.length).toBeGreaterThanOrEqual(5);
	});

	it('contains known transition types', () => {
		expect(RANDOM_ELIGIBLE_TYPES).toContain('fade');
		expect(RANDOM_ELIGIBLE_TYPES).toContain('push');
		expect(RANDOM_ELIGIBLE_TYPES).toContain('wipe');
		expect(RANDOM_ELIGIBLE_TYPES).toContain('dissolve');
	});

	it('does not contain "none" or "cut"', () => {
		expect(RANDOM_ELIGIBLE_TYPES).not.toContain('none');
		expect(RANDOM_ELIGIBLE_TYPES).not.toContain('cut');
	});

	it('does not contain "random" (avoids infinite recursion)', () => {
		expect(RANDOM_ELIGIBLE_TYPES).not.toContain('random');
	});
});

describe('iNSTANT sentinel', () => {
	it('has "none" for both outgoing and incoming', () => {
		expect(INSTANT.outgoing).toBe('none');
		expect(INSTANT.incoming).toBe('none');
	});

	it('sets outgoingOnTop to true', () => {
		expect(INSTANT.outgoingOnTop).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// resolveTransitionDuration
// ---------------------------------------------------------------------------

describe('resolveTransitionDuration', () => {
	it('returns the authored duration when above the floor', () => {
		expect(resolveTransitionDuration(700)).toBe(700);
	});

	it('applies the minimum floor for very short durations', () => {
		expect(resolveTransitionDuration(10)).toBe(MIN_TRANSITION_DURATION_MS);
	});

	it('uses the default when no duration is provided', () => {
		expect(resolveTransitionDuration(undefined)).toBe(DEFAULT_TRANSITION_DURATION_MS);
	});

	it('uses the default for zero / negative / non-finite input', () => {
		expect(resolveTransitionDuration(0)).toBe(DEFAULT_TRANSITION_DURATION_MS);
		expect(resolveTransitionDuration(-100)).toBe(DEFAULT_TRANSITION_DURATION_MS);
		expect(resolveTransitionDuration(Number.NaN)).toBe(DEFAULT_TRANSITION_DURATION_MS);
	});

	it('floor is below the default (default always passes the floor)', () => {
		expect(MIN_TRANSITION_DURATION_MS).toBeLessThanOrEqual(DEFAULT_TRANSITION_DURATION_MS);
	});
});

// ---------------------------------------------------------------------------
// getSlideTransitionAnimations
// ---------------------------------------------------------------------------

describe('getSlideTransitionAnimations', () => {
	it('returns instant (no animation) for "none" type', () => {
		const result = getSlideTransitionAnimations('none', 500, undefined);
		expect(result.outgoing).toBe('none');
		expect(result.incoming).toBe('none');
	});

	it('returns instant for "cut" type', () => {
		const result = getSlideTransitionAnimations('cut', 500, undefined);
		expect(result.outgoing).toBe('none');
		expect(result.incoming).toBe('none');
	});

	it('produces fade animations for "fade" type', () => {
		const result = getSlideTransitionAnimations('fade', 1000, undefined);
		expect(result.outgoing).toContain('pptx-tr-fade-out');
		expect(result.incoming).toContain('pptx-tr-fade-in');
		expect(result.outgoing).toContain('1000ms');
		expect(result.outgoingOnTop).toBeTruthy();
	});

	it('produces push animations with the correct direction', () => {
		const left = getSlideTransitionAnimations('push', 500, 'l');
		expect(left.outgoing).toContain('push-out-to-left');
		expect(left.incoming).toContain('push-in-from-right');
		expect(left.outgoingOnTop).toBeFalsy();

		const right = getSlideTransitionAnimations('push', 500, 'r');
		expect(right.outgoing).toContain('push-out-to-right');
		expect(right.incoming).toContain('push-in-from-left');
	});

	it('defaults push to "left" for an unknown direction', () => {
		const result = getSlideTransitionAnimations('push', 500, undefined);
		expect(result.outgoing).toContain('push-out-to-left');
	});

	it('produces vertical push animations for up/down', () => {
		const up = getSlideTransitionAnimations('push', 500, 'u');
		expect(up.outgoing).toContain('push-out-to-top');
		expect(up.incoming).toContain('push-in-from-bottom');

		const down = getSlideTransitionAnimations('push', 500, 'd');
		expect(down.outgoing).toContain('push-out-to-bottom');
		expect(down.incoming).toContain('push-in-from-top');
	});

	it('produces wipe animations with direction', () => {
		const result = getSlideTransitionAnimations('wipe', 800, 'u');
		expect(result.outgoing).toBe('none');
		// `p:wipe/@dir` is the direction of TRAVEL: PowerPoint's UI "From
		// Bottom" is stored as dir="u", so token u reveals from the BOTTOM
		// edge sweeping up.
		expect(result.incoming).toContain('wipe-from-bottom');
		expect(result.incoming).toContain('800ms');
	});

	it('produces cover animations with 8-way direction support', () => {
		const lu = getSlideTransitionAnimations('cover', 500, 'lu');
		expect(lu.incoming).toContain('cover-from-lu');

		const rd = getSlideTransitionAnimations('cover', 500, 'rd');
		expect(rd.incoming).toContain('cover-from-rd');
	});

	it('produces uncover animations for "uncover" type', () => {
		const result = getSlideTransitionAnimations('uncover', 500, 'l');
		expect(result.outgoing).toContain('uncover-to-left');
		expect(result.incoming).toBe('none');
		expect(result.outgoingOnTop).toBeTruthy();
	});

	it('handles split with orientation', () => {
		const out = getSlideTransitionAnimations('split', 500, undefined, 'vert');
		expect(out.incoming).toContain('split-v-out');

		const inH = getSlideTransitionAnimations('split', 500, 'in', 'horz');
		expect(inH.outgoing).toContain('split-h-in');
		expect(inH.outgoingOnTop).toBeTruthy();
	});

	it('produces a dissolve animation', () => {
		const result = getSlideTransitionAnimations('dissolve', 700, undefined);
		expect(result.outgoing).toContain('fade-out');
		expect(result.incoming).toContain('dissolve-in');
	});

	it('produces clip-path shape animations', () => {
		expect(getSlideTransitionAnimations('circle', 500, undefined).incoming).toContain('circle-in');
		expect(getSlideTransitionAnimations('diamond', 500, undefined).incoming).toContain(
			'diamond-in',
		);
		expect(getSlideTransitionAnimations('plus', 500, undefined).incoming).toContain('plus-in');
		expect(getSlideTransitionAnimations('wedge', 500, undefined).incoming).toContain('wedge-in');
		expect(getSlideTransitionAnimations('wheel', 500, undefined).incoming).toContain('wheel-in');
	});

	it('produces zoom animations', () => {
		const result = getSlideTransitionAnimations('zoom', 600, undefined);
		expect(result.outgoing).toContain('zoom-out');
		expect(result.incoming).toContain('zoom-in');
	});

	it('handles blinds with orientation', () => {
		expect(getSlideTransitionAnimations('blinds', 500, undefined, 'vert').incoming).toContain(
			'blinds-v',
		);
		expect(getSlideTransitionAnimations('blinds', 500, undefined, 'horz').incoming).toContain(
			'blinds-h',
		);
	});

	it('handles comb with orientation', () => {
		expect(getSlideTransitionAnimations('comb', 500, undefined, 'vert').incoming).toContain(
			'comb-v',
		);
		expect(getSlideTransitionAnimations('comb', 500, undefined, 'horz').incoming).toContain(
			'comb-h',
		);
	});

	it('handles randomBar with orientation', () => {
		expect(getSlideTransitionAnimations('randomBar', 500, undefined, 'vert').incoming).toContain(
			'randombar-v',
		);
		expect(getSlideTransitionAnimations('randomBar', 500, undefined, 'horz').incoming).toContain(
			'randombar-h',
		);
	});

	it('handles strips with diagonal direction and defaults to "lu"', () => {
		expect(getSlideTransitionAnimations('strips', 500, 'rd').incoming).toContain('strips-rd');
		expect(getSlideTransitionAnimations('strips', 500, undefined).incoming).toContain('strips-lu');
	});

	it('produces a checker animation', () => {
		const result = getSlideTransitionAnimations('checker', 500, undefined);
		expect(result.outgoing).toContain('fade-out');
		expect(result.incoming).toContain('checker-in');
	});

	it('produces a newsflash animation', () => {
		const result = getSlideTransitionAnimations('newsflash', 500, undefined);
		expect(result.incoming).toContain('newsflash-in');
		expect(result.outgoingOnTop).toBeFalsy();
	});

	it('treats "pull" as an alias for "uncover"', () => {
		const pull = getSlideTransitionAnimations('pull', 500, 'l');
		const uncover = getSlideTransitionAnimations('uncover', 500, 'l');
		expect(pull).toStrictEqual(uncover);
	});

	it('falls back to fade for "morph" type', () => {
		const result = getSlideTransitionAnimations('morph', 500, undefined);
		expect(result.outgoing).toContain('fade-out');
		expect(result.incoming).toContain('fade-in');
	});

	it('includes the duration in both animation strings', () => {
		const result = getSlideTransitionAnimations('fade', 1234, undefined);
		expect(result.outgoing).toContain('1234ms');
		expect(result.incoming).toContain('1234ms');
	});

	it('produces an animation for "random" type', () => {
		const result = getSlideTransitionAnimations('random', 500, undefined);
		expect(result.outgoing !== 'none' || result.incoming !== 'none').toBeTruthy();
	});

	it('handles an unknown type with a fade fallback', () => {
		const result = getSlideTransitionAnimations(
			'unknownType' as unknown as PptxTransitionType,
			500,
			undefined,
		);
		expect(result.outgoing).toContain('fade-out');
		expect(result.incoming).toContain('fade-in');
	});
});

// ---------------------------------------------------------------------------
// SLIDE_TRANSITION_KEYFRAMES
// ---------------------------------------------------------------------------

describe('sLIDE_TRANSITION_KEYFRAMES', () => {
	it('defines the keyframes referenced by the resolver', () => {
		expect(SLIDE_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-fade-in');
		expect(SLIDE_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-push-out-to-left');
		expect(SLIDE_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-cover-from-rd');
		expect(SLIDE_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-wheel-in');
	});
});

// ---------------------------------------------------------------------------
// transitionSlideBoxSize
// ---------------------------------------------------------------------------

describe('transitionSlideBoxSize', () => {
	// Regression (issue #106): the outgoing layer used to render at the
	// intrinsic canvas size with the inner canvas pinned to zoom 1, so the
	// leaving slide animated out at 100% over a full-screen incoming slide.
	it('scales the box by the stage zoom so both slides match', () => {
		expect(transitionSlideBoxSize({ width: 960, height: 540 }, 2)).toStrictEqual({
			width: 1920,
			height: 1080,
		});
	});

	it('is a no-op at zoom 1', () => {
		expect(transitionSlideBoxSize({ width: 960, height: 540 }, 1)).toStrictEqual({
			width: 960,
			height: 540,
		});
	});

	it('degrades a non-positive or non-finite zoom to 1 rather than collapsing', () => {
		expect(transitionSlideBoxSize({ width: 960, height: 540 }, 0)).toStrictEqual({
			width: 960,
			height: 540,
		});
		expect(transitionSlideBoxSize({ width: 960, height: 540 }, Number.NaN)).toStrictEqual({
			width: 960,
			height: 540,
		});
	});

	it('never returns a zero-sized box', () => {
		expect(transitionSlideBoxSize({ width: 0, height: 0 }, 1.5)).toStrictEqual({
			width: 1,
			height: 1,
		});
	});
});

describe('resolveOverlayDurationMs', () => {
	const transition = (overrides: Partial<PptxSlideTransition>): PptxSlideTransition =>
		({ type: 'morph', ...overrides }) as PptxSlideTransition;

	it('lets the explicit override win over everything', () => {
		expect(resolveOverlayDurationMs(800, transition({ durationMs: 2500, speed: 'slow' }))).toBe(
			800,
		);
	});

	it('honours an authored p14:dur for morphs', () => {
		expect(resolveOverlayDurationMs(undefined, transition({ durationMs: 2500 }))).toBe(2500);
	});

	it('honours the legacy spd token for morphs', () => {
		expect(resolveOverlayDurationMs(undefined, transition({ speed: 'slow' }))).toBe(1000);
		expect(resolveOverlayDurationMs(undefined, transition({ speed: 'fast' }))).toBe(500);
	});

	it('falls back to the un-authored morph default', () => {
		expect(resolveOverlayDurationMs(undefined, transition({}))).toBe(500);
	});

	it('keeps the angular classic-transition policy for non-morphs', () => {
		expect(resolveOverlayDurationMs(undefined, { type: 'fade' } as PptxSlideTransition)).toBe(
			DEFAULT_TRANSITION_DURATION_MS,
		);
	});
});
