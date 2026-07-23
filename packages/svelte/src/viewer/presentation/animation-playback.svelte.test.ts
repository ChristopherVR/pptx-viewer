import type { PptxElement, PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { AnimationPlayback } from './animation-playback.svelte';

/**
 * `.svelte.test.ts` so the runes runtime compiles `AnimationPlayback`'s reactive
 * `$state`. Exercises the native-timing controller model: seeding hidden
 * entrance states, click-group advance, exhaustion, disabled-animation short
 * circuit, and rebuild-on-reset. Uses the real shared
 * `PresentationAnimationController` (pure timeline maths, no DOM) plus happy-dom
 * for the timer / RAF glue in the playback helpers.
 */

function shapeElement(id: string): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 100, height: 100 } as unknown as PptxElement;
}

function entranceAnim(targetId: string): PptxNativeAnimation {
	return { targetId, presetClass: 'entr', trigger: 'onClick' } as unknown as PptxNativeAnimation;
}

function slideWith(elements: PptxElement[], nativeAnimations?: PptxNativeAnimation[]): PptxSlide {
	return { id: 's1', elements, nativeAnimations } as unknown as PptxSlide;
}

/** Reactive holder so `getSlide` reads live, mutable state. */
class SlideHolder {
	slide = $state<PptxSlide | undefined>(undefined);
}

describe('animationPlayback (native-timing controller)', () => {
	it('skips builds when presentation animations are disabled', () => {
		const pb = new AnimationPlayback({
			getSlide: () => slideWith([shapeElement('e1')], [entranceAnim('e1')]),
			getShowWithAnimation: () => false,
		});
		pb.reset();

		expect(pb.elementStates.size).toBe(0);
		expect(pb.keyframesCss).toBe('');
		expect(pb.isComplete).toBeTruthy();
		expect(pb.advance()).toBeFalsy();
	});

	it('seeds a hidden entrance state and reveals it on advance', () => {
		const holder = new SlideHolder();
		holder.slide = slideWith([shapeElement('e1'), shapeElement('e2')], [entranceAnim('e1')]);
		const pb = new AnimationPlayback({ getSlide: () => holder.slide });
		pb.reset();

		// Pending entrance: e1 hidden until its click-group plays; e2 has no
		// animation so it is visible from the start.
		expect(pb.elementStates.get('e1')?.visible).toBeFalsy();
		expect(pb.elementStates.get('e2')?.visible).toBeTruthy();
		expect(pb.isComplete).toBeFalsy();

		expect(pb.advance()).toBeTruthy();
		expect(pb.elementStates.get('e1')?.visible).toBeTruthy();
		expect(pb.elementStates.get('e1')?.cssAnimation).toBeTypeOf('string');
		expect(pb.isComplete).toBeTruthy();
	});

	it('advance returns false once the timeline is exhausted', () => {
		const pb = new AnimationPlayback({
			getSlide: () => slideWith([shapeElement('e1')], [entranceAnim('e1')]),
		});
		pb.reset();

		expect(pb.advance()).toBeTruthy();
		expect(pb.isComplete).toBeTruthy();
		expect(pb.advance()).toBeFalsy();
	});

	it('exposes keyframes CSS and empty trigger sets for a plain slide', () => {
		const pb = new AnimationPlayback({
			getSlide: () => slideWith([shapeElement('e1')], [entranceAnim('e1')]),
		});
		pb.reset();

		expect(pb.keyframesCss).toBeTypeOf('string');
		expect(pb.interactiveTriggerShapeIds.size).toBe(0);
		expect(pb.hoverTriggerShapeIds.size).toBe(0);
	});

	it('rebuilds for the current slide on reset (slide change)', () => {
		const holder = new SlideHolder();
		holder.slide = slideWith([shapeElement('e1')], [entranceAnim('e1')]);
		const pb = new AnimationPlayback({ getSlide: () => holder.slide });
		pb.reset();
		expect(pb.isComplete).toBeFalsy();

		// Navigate to a slide with no animations.
		holder.slide = slideWith([shapeElement('e9')]);
		pb.reset();
		expect(pb.isComplete).toBeTruthy();
		expect(pb.advance()).toBeFalsy();
	});

	it('clears without a controller when there is no slide', () => {
		const pb = new AnimationPlayback({ getSlide: () => undefined });
		pb.reset();

		expect(pb.elementStates.size).toBe(0);
		expect(pb.isComplete).toBeTruthy();
		expect(pb.advance()).toBeFalsy();
	});
});
