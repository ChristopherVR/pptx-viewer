import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { AnimationPlayback } from './animation-playback.svelte';

/**
 * `.svelte.test.ts` so the runes runtime compiles `AnimationPlayback`'s
 * `$state` step. Uses the real shared click-group / CSS helpers (pure, no DOM),
 * asserting the reactive stepping, exhaustion, and reset behaviour.
 */

/** Reactive holder so `getAnimations` reads live, mutable state. */
class AnimHolder {
	anims = $state<PptxElementAnimation[]>([]);
}

function onClick(id: string): PptxElementAnimation {
	return { elementId: id, entrance: 'fadeIn', durationMs: 500, delayMs: 0, trigger: 'onClick' };
}

describe('animationPlayback', () => {
	it('skips builds when presentation animations are disabled', () => {
		const pb = new AnimationPlayback({
			getAnimations: () => [onClick('e1')],
			getShowWithAnimation: () => false,
		});

		expect(pb.groupCount).toBe(0);
		expect(pb.pendingStyles.size).toBe(0);
		expect(pb.advance()).toBeFalsy();
	});

	it('starts with every entrance pending and nothing revealed', () => {
		const holder = new AnimHolder();
		holder.anims = [onClick('e1'), onClick('e2')];
		const pb = new AnimationPlayback({ getAnimations: () => holder.anims });

		expect(pb.groupCount).toBe(2);
		expect(pb.step).toBe(0);
		expect(pb.isComplete).toBeFalsy();
		expect(pb.elementStyles.size).toBe(0);
		expect(pb.pendingStyles.get('e1')).toStrictEqual({ opacity: '0' });
		expect(pb.pendingStyles.get('e2')).toStrictEqual({ opacity: '0' });
	});

	it('reveals one click group per advance, hiding the rest', () => {
		const holder = new AnimHolder();
		holder.anims = [onClick('e1'), onClick('e2')];
		const pb = new AnimationPlayback({ getAnimations: () => holder.anims });

		expect(pb.advance()).toBeTruthy();
		expect(pb.step).toBe(1);
		expect(pb.elementStyles.get('e1')?.['animation-name']).toBe('pptx-vue-fadeIn');
		expect(pb.elementStyles.has('e2')).toBeFalsy();
		expect(pb.pendingStyles.get('e2')).toStrictEqual({ opacity: '0' });
		expect(pb.pendingStyles.has('e1')).toBeFalsy();
	});

	it('folds withPrevious/afterPrevious into one click group', () => {
		const holder = new AnimHolder();
		holder.anims = [
			onClick('e1'),
			{ elementId: 'e2', entrance: 'fadeIn', durationMs: 500, trigger: 'withPrevious' },
		];
		const pb = new AnimationPlayback({ getAnimations: () => holder.anims });

		expect(pb.groupCount).toBe(1);
		pb.advance();
		expect(pb.elementStyles.has('e1')).toBeTruthy();
		expect(pb.elementStyles.has('e2')).toBeTruthy();
		expect(pb.isComplete).toBeTruthy();
	});

	it('advance returns false once the timeline is exhausted', () => {
		const holder = new AnimHolder();
		holder.anims = [onClick('e1')];
		const pb = new AnimationPlayback({ getAnimations: () => holder.anims });

		expect(pb.advance()).toBeTruthy();
		expect(pb.isComplete).toBeTruthy();
		expect(pb.advance()).toBeFalsy();
		expect(pb.step).toBe(1);
	});

	it('reset returns to the pre-first-build state', () => {
		const holder = new AnimHolder();
		holder.anims = [onClick('e1'), onClick('e2')];
		const pb = new AnimationPlayback({ getAnimations: () => holder.anims });

		pb.advance();
		pb.advance();
		expect(pb.step).toBe(2);
		pb.reset();
		expect(pb.step).toBe(0);
		expect(pb.elementStyles.size).toBe(0);
	});

	it('tracks a live change of the underlying animations (slide change)', () => {
		const holder = new AnimHolder();
		holder.anims = [onClick('e1')];
		const pb = new AnimationPlayback({ getAnimations: () => holder.anims });
		pb.advance();
		expect(pb.groupCount).toBe(1);

		// Simulate navigating to a slide with no animations.
		holder.anims = [];
		expect(pb.groupCount).toBe(0);
		expect(pb.advance()).toBeFalsy();
	});
});
