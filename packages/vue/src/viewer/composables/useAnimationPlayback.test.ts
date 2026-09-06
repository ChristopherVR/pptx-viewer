import type { PptxElement, PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { buildClickGroups, useAnimationPlayback } from './useAnimationPlayback';
import type { UseAnimationPlaybackResult } from './useAnimationPlayback';

// ---------------------------------------------------------------------------
// Fixtures (mirror the shared controller test)
// ---------------------------------------------------------------------------

function shapeElement(id: string): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 100, height: 100 } as unknown as PptxElement;
}

function entranceAnim(targetId: string): PptxNativeAnimation {
	return {
		targetId,
		presetClass: 'entr',
		trigger: 'onClick',
	} as unknown as PptxNativeAnimation;
}

function slideWith(elements: PptxElement[], nativeAnimations?: PptxNativeAnimation[]): PptxSlide {
	return { id: 'slide-1', elements, nativeAnimations } as unknown as PptxSlide;
}

/** Run the composable inside an effect scope so `watch` / `onScopeDispose` work. */
function runPlayback(build: () => UseAnimationPlaybackResult): {
	result: UseAnimationPlaybackResult;
	stop: () => void;
} {
	const scope = effectScope();
	const result = scope.run(build) as UseAnimationPlaybackResult;
	return { result, stop: () => scope.stop() };
}

// ---------------------------------------------------------------------------
// Native-animation controller playback
// ---------------------------------------------------------------------------

describe('useAnimationPlayback (native controller)', () => {
	it('seeds a hidden state for a pending entrance, visible otherwise', () => {
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({
				slide: () => slideWith([shapeElement('a'), shapeElement('b')], [entranceAnim('a')]),
			}),
		);

		const states = result.presentationElementStates.value;
		expect(states.get('a')?.visible).toBeFalsy();
		expect(states.get('b')?.visible).toBeTruthy();
		expect(result.isComplete.value).toBeFalsy();
		expect(result.presentationKeyframesCss.value).toBeTypeOf('string');
		stop();
	});

	it('advance() reveals the next click-group then reports completion', () => {
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({ slide: () => slideWith([shapeElement('a')], [entranceAnim('a')]) }),
		);

		expect(result.advance()).toBeTruthy();
		expect(result.presentationElementStates.value.get('a')?.visible).toBeTruthy();
		expect(result.isComplete.value).toBeTruthy();

		// Exhausted: advance returns false so the caller navigates slides.
		expect(result.advance()).toBeFalsy();
		stop();
	});

	it('reset() replays the slide from the initial hidden state', () => {
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({ slide: () => slideWith([shapeElement('a')], [entranceAnim('a')]) }),
		);

		result.advance();
		expect(result.presentationElementStates.value.get('a')?.visible).toBeTruthy();

		result.reset();
		expect(result.presentationElementStates.value.get('a')?.visible).toBeFalsy();
		expect(result.isComplete.value).toBeFalsy();
		stop();
	});

	it('skips playback when presentation animations are disabled', () => {
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({
				slide: () => slideWith([shapeElement('a')], [entranceAnim('a')]),
				showWithAnimation: () => false,
			}),
		);

		expect(result.presentationElementStates.value.size).toBe(0);
		expect(result.isComplete.value).toBeTruthy();
		expect(result.advance()).toBeFalsy();
		stop();
	});

	it('rebuilds the controller when the active slide changes', async () => {
		const slide = ref<PptxSlide>(slideWith([shapeElement('a')], [entranceAnim('a')]));
		const { result, stop } = runPlayback(() => useAnimationPlayback({ slide: () => slide.value }));

		result.advance();
		expect(result.isComplete.value).toBeTruthy();

		// Switching slides re-seeds the timeline (new pending entrance -> not complete).
		// The slide watch flushes on the next tick.
		slide.value = slideWith([shapeElement('c')], [entranceAnim('c')]);
		await nextTick();
		expect(result.presentationElementStates.value.get('c')?.visible).toBeFalsy();
		expect(result.presentationElementStates.value.has('a')).toBeFalsy();
		expect(result.isComplete.value).toBeFalsy();
		stop();
	});

	it('exposes empty trigger sets for a slide without interactive/hover anims', () => {
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({ slide: () => slideWith([shapeElement('a')], [entranceAnim('a')]) }),
		);

		expect(result.interactiveTriggerShapeIds.value.size).toBe(0);
		expect(result.hoverTriggerShapeIds.value.size).toBe(0);
		stop();
	});
});

// ---------------------------------------------------------------------------
// Repoint pins: the step/build/auto-advance clock is now the shared
// `pptx-viewer-shared` `animation-playback-engine` (formerly a local
// `composables/animation-playback-helpers` copy); these pin that the
// composable's wiring into it (the `playSound`/`stopSound`/`onPlayActionSound`
// host hooks, and the timer bookkeeping the engine's cleanup + auto-advance
// callbacks run through) still behaves correctly end-to-end.
// ---------------------------------------------------------------------------

describe('useAnimationPlayback: shared engine wiring', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('routes a step sound through the host onPlayActionSound override', () => {
		const onPlayActionSound = vi.fn<(soundPath: string) => void>();
		const anim = {
			targetId: 'a',
			presetClass: 'entr',
			trigger: 'onClick',
			soundPath: 'media/click.wav',
		} as unknown as PptxNativeAnimation;
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({
				slide: () => slideWith([shapeElement('a')], [anim]),
				onPlayActionSound,
			}),
		);

		result.advance();

		expect(onPlayActionSound).toHaveBeenCalledWith('media/click.wav');
		stop();
	});

	it('keeps the css animation attached after cleanup for a fill="hold" step (holdEndState)', () => {
		const anim = {
			targetId: 'a',
			presetClass: 'emph',
			presetId: 26,
			fill: 'hold',
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation;
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({ slide: () => slideWith([shapeElement('a')], [anim]) }),
		);

		result.advance();
		const held = result.presentationElementStates.value.get('a')?.cssAnimation;
		expect(held).toBeTruthy();

		// Past the step's cleanup timer: a non-held step would clear its
		// cssAnimation here, but `holdEndState` keeps this one attached.
		vi.advanceTimersByTime(2000);
		expect(result.presentationElementStates.value.get('a')?.cssAnimation).toBe(held);
		stop();
	});

	it('auto-plays the first group on slide entry when authored to start automatically', () => {
		const anim = {
			targetId: 'a',
			presetClass: 'entr',
			trigger: 'afterDelay',
			delayMs: 0,
			groupAutoStart: true,
			parGroupIndex: 0,
		} as unknown as PptxNativeAnimation;
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({ slide: () => slideWith([shapeElement('a')], [anim]) }),
		);

		// Not yet: the auto-advance chain schedules its own timer rather than
		// revealing the group synchronously during `resetForSlide`.
		expect(result.presentationElementStates.value.get('a')?.visible).toBeFalsy();

		vi.advanceTimersByTime(50);

		expect(result.presentationElementStates.value.get('a')?.visible).toBeTruthy();
		expect(result.isComplete.value).toBeTruthy();
		stop();
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
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({
				slide: () =>
					slideWith([shapeElement('a'), shapeElement('b')], [seekAnim('a'), seekAnim('b')]),
			}),
		);

		expect(result.advance()).toBeTruthy();
		expect(result.presentationElementStates.value.get('a')?.cssAnimation).toBeTruthy();

		// Mid-flight: the click is consumed by finishing `a`, and `b` stays hidden.
		expect(result.advance()).toBeTruthy();
		expect(result.presentationElementStates.value.get('a')?.visible).toBeTruthy();
		expect(result.presentationElementStates.value.get('a')?.cssAnimation).toBeUndefined();
		expect(result.presentationElementStates.value.get('b')?.visible).toBeFalsy();
		expect(result.isComplete.value).toBeFalsy();

		// Settled: the next click starts group two.
		expect(result.advance()).toBeTruthy();
		expect(result.presentationElementStates.value.get('b')?.visible).toBeTruthy();
		expect(result.isComplete.value).toBeTruthy();
		stop();
	});
});

// ---------------------------------------------------------------------------
// Geometry / theme render context wiring
// ---------------------------------------------------------------------------

describe('useAnimationPlayback geometry/theme render context wiring', () => {
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

	it('resolves the cross-axis fly-in formula when canvasSize is supplied', () => {
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({
				canvasSize: () => ({ height: 720, width: 960 }),
				slide: () => slideWith([boxedShapeElement('a')], [growAndTurnAnim('a')]),
			}),
		);
		// centre x = (200 + 200/2) / 960 = 0.3125; from = -100/960 = -0.104167;
		// delta = -0.104167 - 0.3125 = -0.416667 -> formatted to 4dp.
		expect(result.presentationKeyframesCss.value).toContain('-0.4167');
		stop();
	});

	it('falls back to canned timing when canvasSize is not supplied', () => {
		const { result, stop } = runPlayback(() =>
			useAnimationPlayback({
				slide: () => slideWith([boxedShapeElement('a')], [growAndTurnAnim('a')]),
			}),
		);
		expect(result.presentationKeyframesCss.value).not.toContain('-0.4167');
		stop();
	});
});

// ---------------------------------------------------------------------------
// Preset click-group re-export (kept for the editor animation preview)
// ---------------------------------------------------------------------------

describe('buildClickGroups re-export', () => {
	it('is still re-exported for the editor animation-preview model', () => {
		const groups = buildClickGroups([
			{ elementId: 't1', entrance: 'fadeIn', trigger: 'onClick' },
			{ elementId: 't2', entrance: 'fadeIn', trigger: 'withPrevious' },
			{ elementId: 't3', entrance: 'flyIn', trigger: 'onClick' },
		]);
		expect(groups).toHaveLength(2);
		expect(groups[0].animations.map((x) => x.elementId)).toStrictEqual(['t1', 't2']);
		expect(groups[1].animations.map((x) => x.elementId)).toStrictEqual(['t3']);
	});
});
