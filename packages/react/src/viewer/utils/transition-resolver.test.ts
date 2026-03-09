import { describe, it, expect } from 'vitest';
import { getSlideTransitionAnimations } from './transition-resolver';

describe('getSlideTransitionAnimations', () => {
	it('should return instant (no animation) for "none" type', () => {
		const result = getSlideTransitionAnimations('none', 500, undefined);
		expect(result.outgoing).toBe('none');
		expect(result.incoming).toBe('none');
	});

	it('should return instant for "cut" type', () => {
		const result = getSlideTransitionAnimations('cut', 500, undefined);
		expect(result.outgoing).toBe('none');
		expect(result.incoming).toBe('none');
	});

	it('should produce fade animations for "fade" type', () => {
		const result = getSlideTransitionAnimations('fade', 1000, undefined);
		expect(result.outgoing).toContain('pptx-tr-fade-out');
		expect(result.incoming).toContain('pptx-tr-fade-in');
		expect(result.outgoing).toContain('1000ms');
		expect(result.outgoingOnTop).toBe(true);
	});

	it('should produce push animations with correct direction', () => {
		const left = getSlideTransitionAnimations('push', 500, 'l');
		expect(left.outgoing).toContain('push-out-to-left');
		expect(left.incoming).toContain('push-in-from-right');

		const right = getSlideTransitionAnimations('push', 500, 'r');
		expect(right.outgoing).toContain('push-out-to-right');
		expect(right.incoming).toContain('push-in-from-left');
	});

	it('should produce wipe animations with direction', () => {
		const result = getSlideTransitionAnimations('wipe', 800, 'u');
		expect(result.outgoing).toBe('none');
		expect(result.incoming).toContain('wipe-from-top');
		expect(result.incoming).toContain('800ms');
	});

	it('should produce cover animations with 8-way direction support', () => {
		const lu = getSlideTransitionAnimations('cover', 500, 'lu');
		expect(lu.incoming).toContain('cover-from-lu');

		const rd = getSlideTransitionAnimations('cover', 500, 'rd');
		expect(rd.incoming).toContain('cover-from-rd');
	});

	it('should produce uncover animations for "uncover" type', () => {
		const result = getSlideTransitionAnimations('uncover', 500, 'l');
		expect(result.outgoing).toContain('uncover-to-left');
		expect(result.incoming).toBe('none');
		expect(result.outgoingOnTop).toBe(true);
	});

	it('should handle split with orientation', () => {
		const out = getSlideTransitionAnimations('split', 500, undefined, 'vert');
		expect(out.incoming).toContain('split-v-out');

		const inH = getSlideTransitionAnimations('split', 500, 'in', 'horz');
		expect(inH.outgoing).toContain('split-h-in');
	});

	it('should produce dissolve animation', () => {
		const result = getSlideTransitionAnimations('dissolve', 700, undefined);
		expect(result.outgoing).toContain('fade-out');
		expect(result.incoming).toContain('dissolve-in');
	});

	it('should produce circle clip-path animation', () => {
		const result = getSlideTransitionAnimations('circle', 500, undefined);
		expect(result.incoming).toContain('circle-in');
		expect(result.outgoing).toBe('none');
	});

	it('should produce zoom animations', () => {
		const result = getSlideTransitionAnimations('zoom', 600, undefined);
		expect(result.outgoing).toContain('zoom-out');
		expect(result.incoming).toContain('zoom-in');
	});

	it('should handle blinds with orientation', () => {
		const vert = getSlideTransitionAnimations('blinds', 500, undefined, 'vert');
		expect(vert.incoming).toContain('blinds-v');

		const horz = getSlideTransitionAnimations('blinds', 500, undefined, 'horz');
		expect(horz.incoming).toContain('blinds-h');
	});

	it('should treat "pull" as alias for "uncover"', () => {
		const pull = getSlideTransitionAnimations('pull', 500, 'l');
		const uncover = getSlideTransitionAnimations('uncover', 500, 'l');
		expect(pull).toEqual(uncover);
	});

	it('should fall back to fade for "morph" type', () => {
		const result = getSlideTransitionAnimations('morph', 500, undefined);
		expect(result.outgoing).toContain('fade-out');
		expect(result.incoming).toContain('fade-in');
	});

	it('should include duration in animation strings', () => {
		const result = getSlideTransitionAnimations('fade', 1234, undefined);
		expect(result.outgoing).toContain('1234ms');
		expect(result.incoming).toContain('1234ms');
	});

	it('should produce an animation for "random" type', () => {
		const result = getSlideTransitionAnimations('random', 500, undefined);
		// random picks from eligible types, all of which produce non-instant results
		expect(
			result.outgoing !== 'none' || result.incoming !== 'none',
		).toBe(true);
	});

	it('should handle unknown type with fade fallback', () => {
		const result = getSlideTransitionAnimations(
			'unknownType' as any,
			500,
			undefined,
		);
		expect(result.outgoing).toContain('fade-out');
		expect(result.incoming).toContain('fade-in');
	});
});
