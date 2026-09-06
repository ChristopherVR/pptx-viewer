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

	it('a second advance inside a nextAc="seek" group fast-forwards it instead of skipping ahead', () => {
		const seekAnim = (targetId: string): PptxNativeAnimation =>
			({
				targetId,
				presetClass: 'entr',
				trigger: 'onClick',
				durationMs: 5000,
				seqNextAction: 'seek',
			}) as unknown as PptxNativeAnimation;
		const pb = new AnimationPlayback({
			getSlide: () =>
				slideWith([shapeElement('e1'), shapeElement('e2')], [seekAnim('e1'), seekAnim('e2')]),
		});
		pb.reset();

		expect(pb.advance()).toBeTruthy();
		expect(pb.elementStates.get('e1')?.cssAnimation).toBeTruthy();

		// Mid-flight: the click is consumed by finishing e1, and e2 stays hidden.
		expect(pb.advance()).toBeTruthy();
		expect(pb.elementStates.get('e1')?.visible).toBeTruthy();
		expect(pb.elementStates.get('e1')?.cssAnimation).toBeUndefined();
		expect(pb.elementStates.get('e2')?.visible).toBeFalsy();
		expect(pb.isComplete).toBeFalsy();

		// Settled: the next click starts group two.
		expect(pb.advance()).toBeTruthy();
		expect(pb.elementStates.get('e2')?.visible).toBeTruthy();
		expect(pb.isComplete).toBeTruthy();
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

	// G13: an `onStopAudio`-gated effect should start from the REAL `<audio>`
	// element's `ended` event, not only the estimated `delayMs` baked into its
	// cssAnimation at build time.
	it('gates an onStopAudio-dependent effect on the real media ended event', () => {
		const audio = document.createElement('audio');
		audio.dataset['elementId'] = 'audio1';
		document.body.appendChild(audio);

		const mediaAnim: PptxNativeAnimation = {
			targetId: 'audio1',
			nodeId: 5,
			kind: 'media',
			presetClass: 'entr',
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation;
		const dependentAnim: PptxNativeAnimation = {
			targetId: 'el1',
			presetClass: 'entr',
			trigger: 'afterPrevious',
			startConditions: [{ event: 'onStopAudio', delay: 0, targetTimeNodeId: 5 }],
		} as unknown as PptxNativeAnimation;

		const pb = new AnimationPlayback({
			getSlide: () =>
				slideWith([shapeElement('audio1'), shapeElement('el1')], [mediaAnim, dependentAnim]),
		});
		pb.reset();
		pb.advance();

		const before = pb.elementStates.get('el1')?.cssAnimation;
		expect(before).toBeTypeOf('string');

		audio.dispatchEvent(new Event('ended'));
		expect(pb.elementStates.get('el1')?.cssAnimation).toContain(' 0ms ');

		audio.remove();
	});
});

describe('animationPlayback geometry/theme render context wiring', () => {
	// Grow And Turn's own ground-truth markup: `from="(-#ppt_w/2)" to="(#ppt_x)"`
	// on a `ppt_x` attribute animation (see animation-ppt-formula-ground-truth.md).
	function growAndTurnAnim(targetId: string): PptxNativeAnimation {
		return {
			attributeAnimations: [
				{ attrName: 'ppt_x', from: '(-#ppt_w/2)', keyframes: [], to: '(#ppt_x)' },
			],
			durationMs: 600,
			presetClass: 'entr',
			targetId,
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation;
	}

	function boxedShapeElement(id: string): PptxElement {
		return { height: 100, id, type: 'shape', width: 200, x: 200, y: 150 } as unknown as PptxElement;
	}

	it('resolves the cross-axis fly-in formula when getCanvasSize is supplied', () => {
		const pb = new AnimationPlayback({
			getCanvasSize: () => ({ height: 720, width: 960 }),
			getSlide: () => slideWith([boxedShapeElement('a')], [growAndTurnAnim('a')]),
		});
		pb.reset();
		// centre x = (200 + 200/2) / 960 = 0.3125; from = -100/960 = -0.104167;
		// delta = -0.104167 - 0.3125 = -0.416667 -> formatted to 4dp.
		expect(pb.keyframesCss).toContain('-0.4167');
	});

	it('falls back to canned timing when getCanvasSize is not supplied', () => {
		const pb = new AnimationPlayback({
			getSlide: () => slideWith([boxedShapeElement('a')], [growAndTurnAnim('a')]),
		});
		pb.reset();
		expect(pb.keyframesCss).not.toContain('-0.4167');
	});
});
