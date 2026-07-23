import type { PptxElement, PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
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
